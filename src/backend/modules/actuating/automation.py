"""
Auto-control logic for pump and LED.
Reads thresholds from DB (Configuration table) with fallback to defaults.
Covers: UC_Actuating_3 (Relay Controller), UC_UI_4 (Auto rule)
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models import Configuration, Device, ActionLog
from shared import mqtt_client

logger = logging.getLogger(__name__)


def _get_threshold(db: Session, key: str, default: float) -> float:
    row = db.query(Configuration).filter(Configuration.config_key == key).first()
    return row.config_value if row else default


def _log_auto_action(db: Session, feed_key: str, action: str):
    device = db.query(Device).filter(Device.aio_feed_key.contains(feed_key)).first()
    if device:
        db.add(ActionLog(device_id=device.id, user_id=None, action=action, trigger_source="AUTO"))
        db.commit()


def evaluate():
    """Run automation rules. Called periodically or on each MQTT message."""
    db    = SessionLocal()
    data  = mqtt_client.sensor_data
    state = mqtt_client.device_state
    now   = datetime.now()

    try:
        # ── Watering Rule (UC_Actuating_3) ───────────────────────────────────
        if state.get("auto_pump") == 1:
            soil_on  = _get_threshold(db, "SOIL_ON_THRESHOLD",  20.0)
            soil_off = _get_threshold(db, "SOIL_OFF_THRESHOLD", 70.0)
            pump_h   = int(_get_threshold(db, "PUMP_ON_HOUR",   8))
            pump_m   = int(_get_threshold(db, "PUMP_ON_MINUTE", 0))
            pump_off_m = int(_get_threshold(db, "PUMP_OFF_MINUTE", 5))

            soil = data.get("soil")
            if soil is not None:
                should_on  = float(soil) < soil_on or (now.hour == pump_h and now.minute == pump_m)
                should_off = float(soil) > soil_off or (now.hour == pump_h and now.minute >= pump_off_m)
                current    = state.get("pump", 0)

                if should_on and current == 0:
                    logger.info("AUTO: pump ON")
                    mqtt_client.publish("pump", 1)
                    _log_auto_action(db, "pump", "ON")
                elif should_off and current == 1:
                    logger.info("AUTO: pump OFF")
                    mqtt_client.publish("pump", 0)
                    _log_auto_action(db, "pump", "OFF")

        # ── Lighting Rule ────────────────────────────────────────────────────
        if state.get("auto_led") == 1:
            lux_on   = _get_threshold(db, "LUX_ON_THRESHOLD", 20.0)
            led_off_h = int(_get_threshold(db, "LED_OFF_HOUR", 22))

            lux = data.get("lux")
            if lux is not None:
                should_on = float(lux) < lux_on and now.hour < led_off_h
                current   = state.get("led", 0)

                if should_on and current == 0:
                    logger.info("AUTO: LED ON")
                    mqtt_client.publish("led", 1)
                    _log_auto_action(db, "led", "ON")
                elif not should_on and current == 1:
                    logger.info("AUTO: LED OFF")
                    mqtt_client.publish("led", 0)
                    _log_auto_action(db, "led", "OFF")

    except Exception as e:
        logger.error(f"Automation error: {e}")
    finally:
        db.close()
