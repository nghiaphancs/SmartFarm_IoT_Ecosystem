"""
Automation logic module.
Evaluates sensor data and applies watering / lighting rules.
"""

import logging
from datetime import datetime

import mqtt_client

logger = logging.getLogger(__name__)

# Thresholds
SOIL_ON_THRESHOLD = 20      # % – turn pump ON if below
SOIL_OFF_THRESHOLD = 70     # % – turn pump OFF if above
LUX_ON_THRESHOLD = 20       # lux – turn LED ON if below
LED_OFF_HOUR = 22           # hour – turn LED OFF after this hour
PUMP_ON_HOUR = 8            # scheduled watering hour
PUMP_ON_MINUTE = 0
PUMP_OFF_MINUTE = 5
TEMP_ALERT_THRESHOLD = 35   # °C


def evaluate():
    """Run automation rules based on current sensor data."""
    data = mqtt_client.sensor_data
    state = mqtt_client.device_state
    now = datetime.now()

    # ─── Watering Rule ────────────────────────────────────────────────────────
    if state.get("auto_pump") == 1:
        soil = data.get("soil")
        if soil is not None:
            should_on = (
                float(soil) < SOIL_ON_THRESHOLD
                or (now.hour == PUMP_ON_HOUR and now.minute == PUMP_ON_MINUTE)
            )
            should_off = (
                float(soil) > SOIL_OFF_THRESHOLD
                or (now.hour == PUMP_ON_HOUR and now.minute >= PUMP_OFF_MINUTE)
            )
            current = state.get("pump", 0)
            if should_on and current == 0:
                logger.info("Auto: turning pump ON")
                mqtt_client.publish("pump", 1)
            elif should_off and current == 1:
                logger.info("Auto: turning pump OFF")
                mqtt_client.publish("pump", 0)

    # ─── Lighting Rule ────────────────────────────────────────────────────────
    if state.get("auto_led") == 1:
        lux = data.get("lux")
        if lux is not None:
            should_on = float(lux) < LUX_ON_THRESHOLD and now.hour < LED_OFF_HOUR
            current = state.get("led", 0)
            if should_on and current == 0:
                logger.info("Auto: turning LED ON")
                mqtt_client.publish("led", 1)
            elif not should_on and current == 1:
                logger.info("Auto: turning LED OFF")
                mqtt_client.publish("led", 0)

    # ─── Temperature Alert ───────────────────────────────────────────────────
    temp = data.get("temperature")
    if temp is not None and float(temp) > TEMP_ALERT_THRESHOLD:
        mqtt_client.publish("alert_high_temp", temp)
