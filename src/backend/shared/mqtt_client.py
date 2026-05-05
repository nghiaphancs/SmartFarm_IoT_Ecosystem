"""
MQTT Client – subscribes to Adafruit IO feeds.
Shared by all modules that need real-time sensor/device state.

Responsibilities:
  - Maintain in-memory latest sensor_data (for WebSocket push speed)
  - Persist each reading to DB via SensorData model (for history/ML)
  - Persist device state changes to DB via Device.status
  - Push alerts list to connected WebSocket clients
"""
import json
import threading
import logging
import datetime

import httpx
import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session

from core.config import AIO_USERNAME, AIO_KEY, MQTT_HOST, MQTT_PORT, FEEDS
from core.database import SessionLocal
from core.models import SensorData, Device, ActionLog
from shared.ws_manager import manager

logger = logging.getLogger(__name__)

# ── In-memory state (RAM cache for WebSocket speed) ─────────────────────────
sensor_data: dict = {
    "temperature": None,
    "humidity":    None,
    "soil":        None,
    "lux":         None,
}

sensor_history: dict = {
    "temperature": [],
    "humidity":    [],
    "soil":        [],
    "lux":         [],
}

device_state: dict = {
    "led":       0,
    "pump":      0,
    "auto_led":  0,
    "auto_pump": 0,
}

threshold_data: dict = {
    "threshold_temp": 35.0,
    "threshold_humidity": 30.0,
    "threshold_soil": 20.0,
    "threshold_lux": 10.0,
}

alerts: list = []

# ─────────────────────────────────────────────────────────────────────────────

def _persist_sensor(key: str, value: float):
    """Write one sensor reading to the sensor_data table."""
    db: Session = SessionLocal()
    try:
        device = db.query(Device).filter(Device.aio_feed_key == FEEDS.get(key, "")).first()
        if device:
            db.add(SensorData(device_id=device.id, value=value))
            db.commit()
    except Exception as e:
        logger.warning(f"DB persist sensor error: {e}")
        db.rollback()
    finally:
        db.close()


def _persist_device_status(key: str, value: int):
    """Sync device ON/OFF state to the devices table."""
    db: Session = SessionLocal()
    try:
        device = db.query(Device).filter(Device.aio_feed_key == FEEDS.get(key, "")).first()
        if device:
            device.status = bool(value)
            db.commit()
    except Exception as e:
        logger.warning(f"DB persist device error: {e}")
        db.rollback()
    finally:
        db.close()


def _broadcast(payload: dict):
    manager.broadcast_sync(json.dumps(payload))


# ── MQTT callbacks ────────────────────────────────────────────────────────────

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("MQTT connected to Adafruit IO")
        client.subscribe(f"{AIO_USERNAME}/feeds/#")
    else:
        logger.error(f"MQTT connection failed, rc={rc}")


def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode("utf-8").strip()
    logger.debug(f"MQTT ← {topic}: {payload}")

    try:
        value = float(payload)
    except ValueError:
        value = payload

    topic_map = {v: k for k, v in FEEDS.items()}
    key = topic_map.get(topic)

    if key in sensor_data:
        if key == "lux":
            value = round(float(value) / 1000.0, 1)
        sensor_data[key] = value
        now = datetime.datetime.now().strftime("%H:%M")
        sensor_history[key].append({"time": now, "value": value})
        if len(sensor_history[key]) > 30:
            sensor_history[key].pop(0)

        # Persist to DB in background thread to avoid blocking MQTT loop
        t = threading.Thread(target=_persist_sensor, args=(key, float(value)), daemon=True)
        t.start()

        _broadcast({"type": "sensor", "key": key, "value": value})

    elif key in device_state:
        device_state[key] = int(value)

        t = threading.Thread(target=_persist_device_status, args=(key, int(value)), daemon=True)
        t.start()

        _broadcast({"type": "device", "key": key, "value": int(value)})

    elif key in threshold_data:
        threshold_data[key] = float(value)
        _broadcast({"type": "threshold", "key": key, "value": float(value)})

    elif key in ("alert_high_temp", "alert"):
        entry = {
            "type":    "high_temp",
            "message": f"High temperature: {value}°C",
            "value":   value,
        }
        alerts.append(entry)
        if len(alerts) > 50:
            alerts.pop(0)
        _broadcast({"type": "alert", "key": key, "value": value})


# ── Publish helper ────────────────────────────────────────────────────────────

def publish(feed_key: str, value):
    topic = FEEDS.get(feed_key)
    if not topic:
        raise ValueError(f"Unknown feed key: {feed_key}")
    _client.publish(topic, str(value))
    logger.info(f"MQTT → {topic}: {value}")


# ── Initial sync from Adafruit IO REST API ────────────────────────────────────

async def sync_initial_values():
    """Fetch last 30 points per feed from Adafruit IO REST on startup."""
    logger.info("Syncing initial history from Adafruit IO REST…")
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                f"https://io.adafruit.com/api/v2/{AIO_USERNAME}/feeds",
                headers={"X-AIO-Key": AIO_KEY},
            )
            if r.status_code != 200:
                logger.error(f"Failed to list feeds: {r.status_code}")
                return

            all_feeds = {f["name"]: f["key"] for f in r.json()}

            for key, feed_topic in FEEDS.items():
                feed_name = feed_topic.split("/")[-1]
                api_key   = all_feeds.get(feed_name) or feed_name.lower().replace("_", "-")
                url       = f"https://io.adafruit.com/api/v2/{AIO_USERNAME}/feeds/{api_key}/data"
                resp      = await client.get(url, headers={"X-AIO-Key": AIO_KEY}, params={"limit": 30})

                if resp.status_code == 200 and resp.json():
                    data = resp.json()
                    latest = data[0]["value"]

                    if key in sensor_data:
                        val = float(latest)
                        if key == "lux":
                            val = round(val / 1000.0, 1)
                        sensor_data[key] = val

                    elif key in device_state:
                        device_state[key] = int(float(latest))

                    if key in sensor_history:
                        pts = []
                        for pt in reversed(data):
                            try:
                                t_str = pt["created_at"].split("T")[1][:5]
                                v     = float(pt["value"])
                                if key == "lux":
                                    v = round(v / 1000.0, 1)
                                pts.append({"time": t_str, "value": v})
                            except Exception:
                                continue
                        sensor_history[key] = pts
                    logger.info(f"Synced: {key}")
        except Exception as e:
            logger.error(f"Sync error: {e}")
    logger.info("Initial sync complete.")


# ── Local DB Sync for Thresholds ──────────────────────────────────────────────
def load_local_thresholds():
    """Load thresholds from local SQLite DB into RAM cache on startup."""
    from core.models import Configuration
    db: Session = SessionLocal()
    try:
        rows = db.query(Configuration).all()
        for r in rows:
            if r.config_key in threshold_data:
                threshold_data[r.config_key] = r.config_value
    except Exception as e:
        logger.error(f"Error loading local thresholds: {e}")
    finally:
        db.close()

def update_local_threshold(key: str, value: float):
    """Update threshold in RAM and broadcast to WebSocket."""
    if key in threshold_data:
        threshold_data[key] = value
        _broadcast({"type": "threshold", "key": key, "value": value})


# ── MQTT client setup ─────────────────────────────────────────────────────────

_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
_client.username_pw_set(AIO_USERNAME, AIO_KEY)
_client.on_connect = on_connect
_client.on_message = on_message


def start():
    """Connect and run MQTT loop in a daemon thread."""
    load_local_thresholds()
    try:
        _client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        threading.Thread(target=_client.loop_forever, daemon=True).start()
        logger.info("MQTT loop started in background thread.")
    except Exception as e:
        logger.error(f"Failed to start MQTT: {e}")

