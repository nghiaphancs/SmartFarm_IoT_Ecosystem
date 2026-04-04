"""
MQTT Client module – subscribes to Adafruit IO feeds and stores latest values.
Also fetches historical data from REST API on startup.
"""

import json
import threading
import logging
import datetime
import httpx
import paho.mqtt.client as mqtt

from config import AIO_USERNAME, AIO_KEY, MQTT_HOST, MQTT_PORT, FEEDS

logger = logging.getLogger(__name__)

# Latest values
sensor_data: dict = {
    "temperature": None,
    "humidity": None,
    "soil": None,
    "lux": None,
}

# History for charts (last 30 points)
# Points format: {"time": "...", "value": 0.0}
sensor_history: dict = {
    "temperature": [],
    "humidity": [],
    "soil": [],
    "lux": [],
}

device_state: dict = {
    "led": 0,
    "pump": 0,
    "auto_led": 0,
    "auto_pump": 0,
}

alerts: list = []

# WebSocket broadcast callback (set by main.py)
_ws_broadcast = None


def set_broadcast_callback(fn):
    global _ws_broadcast
    _ws_broadcast = fn


def _broadcast(payload: dict):
    if _ws_broadcast:
        try:
            _ws_broadcast(json.dumps(payload))
        except Exception as e:
            logger.warning(f"WS broadcast error: {e}")


async def sync_initial_values():
    """Fetch initial historical data from Adafruit IO REST API."""
    logger.info("Discovering feeds and syncing history from Adafruit IO...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # 1. Get all feeds to find the correct KEYS (slugs) mapping
            list_url = f"https://io.adafruit.com/api/v2/{AIO_USERNAME}/feeds"
            r = await client.get(list_url, headers={"X-AIO-Key": AIO_KEY})
            if r.status_code != 200:
                logger.error(f"Failed to list feeds: {r.status_code}")
                return

            all_feeds = { f['name']: f['key'] for f in r.json() }
            
            # 2. Iterate through our config feeds and sync
            for key, feed_topic in FEEDS.items():
                # Extract the feed name from topic (last part)
                feed_name = feed_topic.split('/')[-1]
                # lookup actual REST key
                api_key = all_feeds.get(feed_name)
                if not api_key:
                    # Fallback to name if not found in list
                    api_key = feed_name.lower().replace('_', '-').replace(' ', '-')
                
                url = f"https://io.adafruit.com/api/v2/{AIO_USERNAME}/feeds/{api_key}/data"
                response = await client.get(
                    url, 
                    headers={"X-AIO-Key": AIO_KEY}, 
                    params={"limit": 30}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        # Update latest value (first one is newest)
                        latest_val = data[0]['value']
                        if key in sensor_data:
                            sensor_data[key] = float(latest_val)
                        elif key in device_state:
                            device_state[key] = int(float(latest_val))
                        
                        # Populate history list (reverse it for chronological order)
                        if key in sensor_history:
                            history_points = []
                            for point in reversed(data):
                                try:
                                    t_part = point['created_at'].split('T')[1][:5] # HH:MM
                                    history_points.append({"time": t_part, "value": float(point['value'])})
                                except Exception: continue
                            sensor_history[key] = history_points
                    logger.info(f"Synced {key} using API key '{api_key}'")
                else:
                    logger.warning(f"Failed to sync {key} ({api_key}): {response.status_code}")
        except Exception as e:
            logger.error(f"Sync overall error: {e}")
    logger.info("Initial sync complete.")


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("MQTT connected to Adafruit IO")
        client.subscribe(f"{AIO_USERNAME}/feeds/#")
    else:
        logger.error(f"MQTT connection failed, rc={rc}")


def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode("utf-8").strip()
    logger.debug(f"MQTT ← {topic}: {payload}")

    try:
        value = float(payload)
    except ValueError:
        value = payload

    # Map topic to key
    topic_map = {v: k for k, v in FEEDS.items()}
    key = topic_map.get(topic)

    if key in sensor_data:
        sensor_data[key] = value
        now = datetime.datetime.now().strftime("%H:%M")
        sensor_history[key].append({"time": now, "value": value})
        if len(sensor_history[key]) > 30:
            sensor_history[key].pop(0)
        _broadcast({"type": "sensor", "key": key, "value": value})
    elif key in device_state:
        device_state[key] = int(value)
        _broadcast({"type": "device", "key": key, "value": int(value)})
    elif key == "alert_high_temp" or key == "alert":
        alerts.append({"type": "high_temp", "message": f"High temperature alert: {value}", "value": value})
        if len(alerts) > 50:
            alerts.pop(0)
        _broadcast({"type": "alert", "key": key, "value": value})


def publish(feed_key: str, value):
    topic = FEEDS.get(feed_key)
    if not topic:
        raise ValueError(f"Unknown feed key: {feed_key}")
    payload = str(value)
    result = _client.publish(topic, payload)
    logger.info(f"MQTT → {topic}: {payload}")
    return result


# Build and start the client
_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
_client.username_pw_set(AIO_USERNAME, AIO_KEY)
_client.on_connect = on_connect
_client.on_message = on_message


def start():
    """Connect and start the MQTT loop in a background thread."""
    try:
        _client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        thread = threading.Thread(target=_client.loop_forever, daemon=True)
        thread.start()
        logger.info("MQTT loop started in background thread")
    except Exception as e:
        logger.error(f"Failed to start MQTT client: {e}")
