"""
Core configuration - load env & expose all constants.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Adafruit IO ──────────────────────────────────────────────────────────────
AIO_USERNAME = os.getenv("AIO_USERNAME", "dadn_nhom11")
AIO_KEY      = os.getenv("AIO_KEY", "")
MQTT_HOST    = os.getenv("MQTT_HOST", "io.adafruit.com")
MQTT_PORT    = int(os.getenv("MQTT_PORT", "1883"))

FEEDS: dict[str, str] = {
    "temperature":    f"{AIO_USERNAME}/feeds/BBC_Temperature",
    "humidity":       f"{AIO_USERNAME}/feeds/BBC_Humidity",
    "soil":           f"{AIO_USERNAME}/feeds/BBC_Soil_Moisture",
    "lux":            f"{AIO_USERNAME}/feeds/BBC_Lux",
    "led":            f"{AIO_USERNAME}/feeds/BBC_LED",
    "pump":           f"{AIO_USERNAME}/feeds/BBC_Pump",
    "auto_led":       f"{AIO_USERNAME}/feeds/BBC_AutoLED",
    "auto_pump":      f"{AIO_USERNAME}/feeds/BBC_AutoPump",
    "alert_high_temp":f"{AIO_USERNAME}/feeds/BBC_Alert_HighTemp",
}

# ── Auth ─────────────────────────────────────────────────────────────────────
SECRET_KEY        = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM         = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24   # 1 day

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartfarm.db")
