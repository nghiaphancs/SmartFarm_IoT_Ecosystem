"""
SQLAlchemy ORM models – single source of truth for all tables.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from core.database import Base


# ── UC_UI_1 / Auth ──────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role          = Column(String, default="FARMER")   # ADMIN | FARMER
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    actions       = relationship("ActionLog", back_populates="user")


# ── UC_Actuating – Thiết bị vật lý ─────────────────────────────────────────
class Device(Base):
    __tablename__ = "devices"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, index=True, nullable=False)   # "Máy bơm khu 1"
    device_type   = Column(String, nullable=False)               # SENSOR | RELAY | CAMERA
    aio_feed_key  = Column(String, unique=True, index=True)      # Khớp với Adafruit IO feed key
    status        = Column(Boolean, default=False)               # Trạng thái hiện tại (ON/OFF)

    configs       = relationship("Configuration", back_populates="device")
    actions       = relationship("ActionLog", back_populates="device")
    sensor_data   = relationship("SensorData", back_populates="device")


# ── UC_Monitoring_Alert – Dữ liệu cảm biến (Time-series) ───────────────────
class SensorData(Base):
    """
    Lưu lịch sử đo đạc của từng cảm biến.
    Mỗi MQTT message tạo 1 dòng ở đây.
    """
    __tablename__ = "sensor_data"

    id         = Column(Integer, primary_key=True, index=True)
    device_id  = Column(Integer, ForeignKey("devices.id"), nullable=False)
    value      = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    device     = relationship("Device", back_populates="sensor_data")


# ── UC_UI_4 / UC_Actuating – Cấu hình ngưỡng & Auto Rule ───────────────────
class Configuration(Base):
    """
    Lưu ngưỡng cảnh báo và chế độ Auto (auto_pump, auto_led, …).
    Farmer / Admin có thể cập nhật qua UI thay vì hardcode.
    """
    __tablename__ = "configurations"

    id           = Column(Integer, primary_key=True, index=True)
    config_key   = Column(String, index=True, nullable=False)  # VD: SOIL_ON_THRESHOLD
    config_value = Column(Float,  nullable=False)
    device_id    = Column(Integer, ForeignKey("devices.id"), nullable=True)  # Null = config chung

    device       = relationship("Device", back_populates="configs")


# ── UC_Logging – Nhật ký hành động thiết bị ─────────────────────────────────
class ActionLog(Base):
    """
    Ghi lại mọi lệnh bật/tắt thiết bị (thủ công hoặc tự động).
    Phục vụ UC_Logging_2 và tính năng Xuất báo cáo.
    """
    __tablename__ = "action_logs"

    id             = Column(Integer, primary_key=True, index=True)
    device_id      = Column(Integer, ForeignKey("devices.id"), nullable=False)
    user_id        = Column(Integer, ForeignKey("users.id"),   nullable=True)   # Null nếu Auto
    action         = Column(String, nullable=False)   # ON | OFF
    trigger_source = Column(String, nullable=False)   # MANUAL | AUTO
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    device         = relationship("Device", back_populates="actions")
    user           = relationship("User",   back_populates="actions")


# ── UC_AI / UC_ML – Lịch sử dự đoán AI/ML ──────────────────────────────────
class AIMLHistory(Base):
    """
    Lưu input + output của mỗi lần gọi AI/ML.
    Phục vụ Retraining (UC_AI Extension 1) và UC_Logging.
    """
    __tablename__ = "ai_ml_history"

    id               = Column(Integer, primary_key=True, index=True)
    model_type       = Column(String, nullable=False)   # DISEASE_DETECT | WATERING_PREDICT
    input_data       = Column(JSON)                     # Thông số sensor / đường dẫn ảnh
    result_data      = Column(JSON)                     # Kết quả dự đoán
    confidence_score = Column(Float,  nullable=True)    # Độ tin cậy (%) – chỉ có với AI
    created_at       = Column(DateTime(timezone=True), server_default=func.now(), index=True)
