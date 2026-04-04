"""
Main FastAPI application.
Provides REST API and WebSocket endpoint for the React frontend.
"""

import asyncio
import json
import logging
import os
import pandas as pd

from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import mqtt_client
# import automation  # removed – handled on device side
# import prediction  # not needed – prediction logic inline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── WebSocket connection manager ────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    def broadcast_sync(self, message: str):
        """Called from the synchronous MQTT thread."""
        loop = _event_loop
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(self._broadcast(message), loop)

    async def _broadcast(self, message: str):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        self.active -= dead


manager = ConnectionManager()
_event_loop: asyncio.AbstractEventLoop | None = None


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _event_loop
    _event_loop = asyncio.get_event_loop()
    mqtt_client.set_broadcast_callback(manager.broadcast_sync)
    
    # Sync latest values from Adafruit IO REST API before starting MQTT loop
    await mqtt_client.sync_initial_values()
    
    mqtt_client.start()
    yield


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="Smart Farming API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/sensors")
def get_sensors():
    """Return the latest sensor values."""
    return mqtt_client.sensor_data


@app.get("/api/devices")
def get_devices():
    """Return the current device states."""
    return mqtt_client.device_state


@app.get("/api/alerts")
def get_alerts():
    """Return the alert history."""
    return mqtt_client.alerts


class ControlBody(BaseModel):
    device: str   # e.g. "pump", "led", "auto_pump", "auto_led"
    value: int    # 0 or 1


@app.post("/api/control")
def control_device(body: ControlBody):
    """Publish a control command to the MQTT broker."""
    allowed = {"pump", "led", "auto_pump", "auto_led"}
    if body.device not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown device: {body.device}")
    if body.value not in (0, 1):
        raise HTTPException(status_code=400, detail="Value must be 0 or 1")
    mqtt_client.publish(body.device, body.value)
    mqtt_client.device_state[body.device] = body.value
    return {"ok": True, "device": body.device, "value": body.value}

# ─── ML Prediction Model ─────────────────────────────────────────────────────

_MODEL = None
_MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "AI_modules", "Watering_prediction", "model_watering_prediction.joblib"
)

# Mapping from frontend id → exact label used in training dataset
_PLANT_TYPE_MAP = {
    "Rau muống": "Rau muống",
    "Cải, xà lách": "Cải, xà lách",
    "Cà chua": "Cà chua",
    "Dưa leo": "Dưa leo",
    "Chuối": "Chuối",
    "Xoài": "Xoài",
    "Thanh long": "Thanh long",
    "Sầu riêng": "Sầu riêng",
    "Cam, bưởi": "Cam, bưởi",
}

def _load_model():
    """Lazy-load the joblib pipeline once."""
    global _MODEL
    if _MODEL is None:
        try:
            import joblib
            _MODEL = joblib.load(_MODEL_PATH)
            logger.info(f"✅ ML model loaded from {_MODEL_PATH}")
        except Exception as e:
            logger.error(f"❌ Failed to load ML model: {e}")
            raise HTTPException(status_code=503, detail=f"Model not available: {e}")
    return _MODEL


class PredictionInput(BaseModel):
    temperature: float
    air_humidity: float
    soil_moisture: float
    light: float
    rainfall: float
    soil_type: str       # sandy | loamy | clay
    growth_stage: str    # seedling | vegetative | flowering | fruiting
    plant_type: str      # exact Vietnamese name matching training labels


@app.post("/api/predict")
def predict_water(input: PredictionInput):
    """Return predicted water amount (ml) using the trained ML pipeline."""
    model = _load_model()

    # Map plant_type to training label (pass-through if already correct)
    plant_label = _PLANT_TYPE_MAP.get(input.plant_type, input.plant_type)

    df = pd.DataFrame([{
        "temperature":  input.temperature,
        "air_humidity": input.air_humidity,
        "soil_moisture": input.soil_moisture,
        "light":        input.light,
        "rainfall":     input.rainfall,
        "soil_type":    input.soil_type,
        "growth_stage": input.growth_stage,
        "plant_type":   plant_label,
    }])

    result = float(model.predict(df)[0])
    return {"water_amount": round(max(0.0, result), 1)}


@app.get("/api/sensors-for-predict")
def sensors_for_predict():
    """Return current sensor readings for the prediction form auto-fill."""
    return {
        "temperature":  mqtt_client.sensor_data.get("temperature"),
        "air_humidity": mqtt_client.sensor_data.get("humidity"),
        "soil_moisture": mqtt_client.sensor_data.get("soil"),
        "light":        mqtt_client.sensor_data.get("lux"),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─── WebSocket Endpoint ──────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send current state immediately on connect
    await websocket.send_text(json.dumps({
        "type": "init",
        "sensors": mqtt_client.sensor_data,
        "history": mqtt_client.sensor_history,
        "devices": mqtt_client.device_state,
        "alerts": mqtt_client.alerts,
    }))
    try:
        while True:
            await websocket.receive_text()  # keep alive; client pings ignored
    except WebSocketDisconnect:
        manager.disconnect(websocket)
