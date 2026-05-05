"""
Module: Actuating (Device Control)
Covers: UC_Actuating_1..6 (System Requirement 2)
        NF-PER-1: device response < 2s
        NF-SEC-2: chỉ user được phân quyền mới điều khiển thiết bị
"""
import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Device, ActionLog, Configuration
from core.security import get_current_user, User
from shared import mqtt_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/actuating", tags=["Actuating"])

ALLOWED_DEVICES = {"pump", "led", "auto_pump", "auto_led"}


# ── UC_Actuating_1: Xem danh sách thiết bị ──────────────────────────────────
@router.get("/devices")
def get_devices(db: Session = Depends(get_db)):
    """Trả về danh sách thiết bị và trạng thái hiện tại."""
    return db.query(Device).all()


# ── UC_Actuating_2 / 3: Điều khiển thiết bị cụ thể ─────────────────────────
class ControlBody(BaseModel):
    device: str   # pump | led | auto_pump | auto_led
    value:  int   # 0 = OFF, 1 = ON


@router.post("/control")
def control_device(
    body: ControlBody,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # NF-SEC-2
):
    """
    Gửi lệnh bật/tắt thiết bị qua MQTT.
    Ghi nhật ký (ActionLog) để phục vụ UC_Logging_2.
    """
    if body.device not in ALLOWED_DEVICES:
        raise HTTPException(status_code=400, detail=f"Unknown device: {body.device}")
    if body.value not in (0, 1):
        raise HTTPException(status_code=400, detail="Value must be 0 or 1")

    mqtt_client.publish(body.device, body.value)
    mqtt_client.device_state[body.device] = body.value

    # Ghi nhật ký MANUAL vào DB (UC_Logging_2)
    device_row = db.query(Device).filter(Device.aio_feed_key.contains(body.device)).first()
    if device_row:
        log = ActionLog(
            device_id=device_row.id,
            user_id=current_user.id,
            action="ON" if body.value else "OFF",
            trigger_source="MANUAL",
        )
        db.add(log)
        db.commit()

    return {"ok": True, "device": body.device, "value": body.value}


# ── UC_Actuating_4: Thêm thiết bị mới ───────────────────────────────────────
class DeviceCreate(BaseModel):
    name:         str
    device_type:  str   # SENSOR | RELAY | CAMERA
    aio_feed_key: str


@router.post("/devices")
def add_device(
    body: DeviceCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """F-ADMIN-2: Thêm thiết bị mới."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    existing = db.query(Device).filter(Device.aio_feed_key == body.aio_feed_key).first()
    if existing:
        raise HTTPException(status_code=409, detail="Feed key already registered")
    device = Device(name=body.name, device_type=body.device_type, aio_feed_key=body.aio_feed_key)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.put("/devices/{device_id}")
def update_device(
    device_id: int,
    body: DeviceCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """F-ADMIN-2: Cập nhật cấu hình thiết bị."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    device = db.query(Device).get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    device.name = body.name
    device.device_type = body.device_type
    device.aio_feed_key = body.aio_feed_key
    db.commit()
    db.refresh(device)
    return device


@router.delete("/devices/{device_id}")
def delete_device(
    device_id: int,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """F-ADMIN-2: Xóa thiết bị khỏi hệ thống."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    device = db.query(Device).get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    db.delete(device)
    db.commit()
    return {"ok": True, "message": "Device deleted"}


# ── UC_UI_4: Cấu hình ngưỡng cảnh báo ──────────────────────────────────────
class ThresholdBody(BaseModel):
    config_key:   str    # VD: SOIL_ON_THRESHOLD
    config_value: float
    device_id:    int | None = None


@router.get("/configurations")
def get_configurations(db: Session = Depends(get_db)):
    return db.query(Configuration).all()


@router.post("/configurations")
def upsert_configuration(
    body: ThresholdBody,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo hoặc cập nhật cấu hình ngưỡng tự động."""
    row = db.query(Configuration).filter(Configuration.config_key == body.config_key).first()
    if row:
        row.config_value = body.config_value
    else:
        row = Configuration(
            config_key=body.config_key,
            config_value=body.config_value,
            device_id=body.device_id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    
    # Sync with local RAM cache and broadcast via WebSocket
    if body.config_key in mqtt_client.threshold_data:
        mqtt_client.update_local_threshold(body.config_key, body.config_value)
            
    return row
