"""
Module: ML Watering Prediction
Covers: UC_ML_1..2 (System Requirement 6)
        NF-ACCUR-2: Model error <= 10%
        F-FARMER-6: Xem dự đoán lượng nước cần tưới
"""
import logging
import os
import time

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import AIMLHistory
from core.security import get_current_user, User
from shared import mqtt_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ml", tags=["ML Watering Prediction"])

# ── Model setup ───────────────────────────────────────────────────────────────
_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "AI_modules",
    "Watering_prediction", "model_watering_prediction.joblib"
)

_PLANT_TYPE_MAP = {
    "Rau muống": "Rau muống", "Cải, xà lách": "Cải, xà lách",
    "Cà chua": "Cà chua",     "Dưa leo": "Dưa leo",
    "Chuối": "Chuối",         "Xoài": "Xoài",
    "Thanh long": "Thanh long","Sầu riêng": "Sầu riêng",
    "Cam, bưởi": "Cam, bưởi",
}

_ml_model = None

# Monkey-patch cho tương thích ngược phiên bản scikit-learn cũ
try:
    import sklearn.compose._column_transformer
    if not hasattr(sklearn.compose._column_transformer, '_RemainderColsList'):
        class _RemainderColsList(list):
            pass
        sklearn.compose._column_transformer._RemainderColsList = _RemainderColsList
except Exception as e:
    logger.warning(f"Failed to monkey-patch sklearn: {e}")

def _load_model():
    global _ml_model
    if _ml_model is None:
        try:
            import joblib
            _ml_model = joblib.load(_MODEL_PATH)
            logger.info(f"✅ ML model loaded from {_MODEL_PATH}")
        except Exception as e:
            logger.error(f"❌ ML model load error: {e}")
            raise HTTPException(status_code=503, detail=f"ML model not available: {e}")
    return _ml_model


# ── UC_ML_1: Auto-fill sensor data vào form dự đoán ─────────────────────────
@router.get("/sensors-for-predict")
def sensors_for_predict(current_user: User = Depends(get_current_user)):
    """UC_ML_1: Trả về dữ liệu cảm biến hiện tại để điền sẵn vào form."""
    return {
        "temperature":  mqtt_client.sensor_data.get("temperature"),
        "air_humidity": mqtt_client.sensor_data.get("humidity"),
        "soil_moisture": mqtt_client.sensor_data.get("soil"),
        "light":        mqtt_client.sensor_data.get("lux"),
    }


# ── UC_ML_2: Dự đoán lượng nước tưới ────────────────────────────────────────
class PredictionInput(BaseModel):
    temperature:   float
    air_humidity:  float
    soil_moisture: float
    light:         float
    rainfall:      float
    soil_type:     str   # sandy | loamy | clay
    growth_stage:  str   # seedling | vegetative | flowering | fruiting
    plant_type:    str   # Tên tiếng Việt theo danh sách


@router.post("/predict-watering")
def predict_watering(
    body:         PredictionInput,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    UC_ML_2: Dự đoán lượng nước cần tưới (ml).
    NF-ACCUR-2: Sai số mô hình <= 10%.
    Lưu lịch sử dự đoán vào ai_ml_history.
    """
    model       = _load_model()
    plant_label = _PLANT_TYPE_MAP.get(body.plant_type, body.plant_type)

    df = pd.DataFrame([{
        "temperature":  body.temperature,
        "air_humidity": body.air_humidity,
        "soil_moisture": body.soil_moisture,
        "light":        body.light * 1000,
        "rainfall":     body.rainfall,
        "soil_type":    body.soil_type,
        "growth_stage": body.growth_stage,
        "plant_type":   plant_label,
    }])

    result = round(max(0.0, float(model.predict(df)[0])), 1)

    # Lưu lịch sử dự đoán
    db.add(AIMLHistory(
        model_type="WATERING_PREDICT",
        input_data=body.model_dump(),
        result_data={"water_amount_ml": result},
        confidence_score=None,
    ))
    db.commit()

    return {"water_amount": result}


# ── F-FARMER-6: Xem lịch sử dự đoán tưới ───────────────────────────────────
@router.get("/watering-history")
def get_watering_history(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
    limit:        int     = 20,
):
    """F-FARMER-6: Xem danh sách kết quả dự đoán tưới gần nhất."""
    return (
        db.query(AIMLHistory)
        .filter(AIMLHistory.model_type == "WATERING_PREDICT")
        .order_by(AIMLHistory.created_at.desc())
        .limit(limit)
        .all()
    )

# ── F-ADMIN-3: Cập nhật hoặc thay thế mô hình ML ─────────────────────────────
@router.post("/update-model")
async def update_ml_model(
    file:         UploadFile = File(...),
    current_user: User       = Depends(get_current_user),
):
    """F-ADMIN-3: Tải lên file .joblib mới để thay thế mô hình ML."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
        
    if not file.filename.endswith(".joblib"):
        raise HTTPException(status_code=400, detail="Only .joblib files are allowed for the ML model")

    try:
        content = await file.read()
        
        # Backup the old model if it exists
        if os.path.exists(_MODEL_PATH):
            os.rename(_MODEL_PATH, _MODEL_PATH + f".backup_{int(time.time())}")
            
        with open(_MODEL_PATH, "wb") as f:
            f.write(content)
            
        # Reset the cached model so it reloads on next request
        global _ml_model
        _ml_model = None
        logger.info(f"✅ ML Model updated by {current_user.username}")
        
        return {"ok": True, "message": "Model updated successfully. It will be loaded on the next prediction."}
    except Exception as e:
        logger.error(f"Failed to update model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save model file: {e}")
