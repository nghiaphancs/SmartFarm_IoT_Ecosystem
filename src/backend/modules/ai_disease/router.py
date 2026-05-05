"""
Module: AI Disease Detection
Covers: UC_AI_1..3 (System Requirement 5)
        NF-ACCUR-1: Model accuracy >= 90%
        F-FARMER-5: Xem kết quả AI phát hiện bệnh lá
        F-ADMIN-3:  Cập nhật model AI
"""
import io
import logging
import os

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import AIMLHistory
from core.security import get_current_user, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI Disease Detection"])

# ── Model setup ───────────────────────────────────────────────────────────────
_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "AI_modules",
    "Plant_disease_detection", "model_plant_disease.h5"
)

_DISEASE_CLASSES = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy',
    'Grape___Black_rot', 'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot', 'Peach___healthy',
    'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy',
    'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy',
    'Raspberry___healthy', 'Soybean___healthy', 'Squash___Powdery_mildew',
    'Strawberry___Leaf_scorch', 'Strawberry___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight',
    'Tomato___Leaf_Mold', 'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy',
]

_disease_model = None


def _load_model():
    global _disease_model
    if _disease_model is None:
        try:
            from tensorflow.keras.models import load_model
            _disease_model = load_model(_MODEL_PATH)
            logger.info(f"✅ Disease model loaded from {_MODEL_PATH}")
        except Exception as e:
            logger.error(f"❌ Disease model load error: {e}")
            raise HTTPException(status_code=503, detail=f"AI model not available: {e}")
    return _disease_model


# ── UC_AI_1 / UC_AI_2: Chụp ảnh → Phân tích bệnh lá ────────────────────────
@router.post("/predict-disease")
async def predict_disease(
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """
    UC_AI_2: Phân tích bệnh lá.
    NF-ACCUR-1: Model mục tiêu >= 90% accuracy.
    Lưu kết quả vào ai_ml_history để phục vụ retraining (UC_AI Extension 1).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    try:
        contents  = await file.read()
        image     = Image.open(io.BytesIO(contents)).convert("RGB").resize((256, 256))
        img_array = np.expand_dims(np.array(image), axis=0) / 255.0

        model       = _load_model()
        predictions = model.predict(img_array, verbose=0)
        idx         = int(np.argmax(predictions, axis=1)[0])
        confidence  = float(np.max(predictions) * 100)
        disease     = _DISEASE_CLASSES[idx].replace("___", " - ").replace("_", " ")

        # Lưu lịch sử để phục vụ retraining (UC_AI Extension 1)
        db.add(AIMLHistory(
            model_type="DISEASE_DETECT",
            input_data={"filename": file.filename},
            result_data={"disease": disease, "class_index": idx},
            confidence_score=confidence,
        ))
        db.commit()

        return {"disease": disease, "confidence": round(confidence, 2)}

    except Exception as e:
        logger.error(f"Disease prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── UC_AI: Xem lịch sử phân tích (F-FARMER-5) ───────────────────────────────
@router.get("/disease-history")
def get_disease_history(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
    limit:        int     = 20,
):
    """F-FARMER-5: Xem danh sách kết quả AI phát hiện bệnh gần nhất."""
    return (
        db.query(AIMLHistory)
        .filter(AIMLHistory.model_type == "DISEASE_DETECT")
        .order_by(AIMLHistory.created_at.desc())
        .limit(limit)
        .all()
    )

# ── F-ADMIN-3: Cập nhật hoặc thay thế mô hình AI ─────────────────────────────
@router.post("/update-model")
async def update_disease_model(
    file:         UploadFile = File(...),
    current_user: User       = Depends(get_current_user),
):
    """F-ADMIN-3: Tải lên file .h5 mới để thay thế mô hình AI."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
        
    if not file.filename.endswith(".h5"):
        raise HTTPException(status_code=400, detail="Only .h5 files are allowed for the AI model")

    try:
        content = await file.read()
        
        # Backup the old model if it exists
        if os.path.exists(_MODEL_PATH):
            os.rename(_MODEL_PATH, _MODEL_PATH + f".backup_{int(np.datetime64('now').astype(int))}")
            
        with open(_MODEL_PATH, "wb") as f:
            f.write(content)
            
        # Reset the cached model so it reloads on next request
        global _disease_model
        _disease_model = None
        logger.info(f"✅ AI Model updated by {current_user.username}")
        
        return {"ok": True, "message": "Model updated successfully. It will be loaded on the next prediction."}
    except Exception as e:
        logger.error(f"Failed to update model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save model file: {e}")
