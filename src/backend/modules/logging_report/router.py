"""
Module: Logging & Report
Covers: UC_Logging_1..4 (System Requirement 3)
        - UC_Logging_3: Tra cứu nhật ký
        - UC_Logging_4: Xuất báo cáo (CSV/Excel)
"""
import csv
import io
import logging
from datetime import datetime
import os
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import ActionLog, SensorData
from core.security import get_current_user, get_current_user_query, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/logging", tags=["Logging & Report"])


# ── UC_Logging_3: Tra cứu nhật ký ───────────────────────────────────────────
@router.get("/action-logs")
def get_action_logs(
    device_id: Optional[int]  = Query(None, description="Lọc theo thiết bị"),
    source:    Optional[str]  = Query(None, description="MANUAL hoặc AUTO"),
    limit:     int            = Query(100, le=1000),
    db:        Session        = Depends(get_db),
    current_user: User        = Depends(get_current_user),
):
    """UC_Logging_3: Tra cứu nhật ký bật/tắt thiết bị có bộ lọc."""
    q = db.query(ActionLog)
    if device_id:
        q = q.filter(ActionLog.device_id == device_id)
    if source:
        q = q.filter(ActionLog.trigger_source == source.upper())
    return q.order_by(ActionLog.created_at.desc()).limit(limit).all()


@router.get("/sensor-logs")
def get_sensor_logs(
    device_id: Optional[int] = Query(None),
    limit:     int           = Query(100, le=1000),
    db:        Session       = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """UC_Logging_1: Truy vấn lịch sử dữ liệu cảm biến từ DB."""
    q = db.query(SensorData)
    if device_id:
        q = q.filter(SensorData.device_id == device_id)
    return q.order_by(SensorData.created_at.desc()).limit(limit).all()


# ── UC_Logging_4: Xuất báo cáo CSV ──────────────────────────────────────────
@router.get("/export/action-logs")
def export_action_logs_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_query),
):
    """UC_Logging_4: Xuất toàn bộ nhật ký điều khiển dưới dạng file CSV."""
    rows = db.query(ActionLog).order_by(ActionLog.created_at.desc()).limit(1000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Device ID", "User ID", "Action", "Source", "Timestamp"])
    for r in rows:
        writer.writerow([r.id, r.device_id, r.user_id, r.action, r.trigger_source, r.created_at])

    output.seek(0)
    filename = f"action_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/sensor-data")
def export_sensor_data_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_query),
):
    """UC_Logging_4: Xuất lịch sử dữ liệu cảm biến dưới dạng file CSV."""
    rows = db.query(SensorData).order_by(SensorData.created_at.desc()).limit(5000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Device ID", "Value", "Timestamp"])
    for r in rows:
        writer.writerow([r.id, r.device_id, r.value, r.created_at])

    output.seek(0)
    filename = f"sensor_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

# ── F-ADMIN-5: Sao lưu cơ sở dữ liệu ─────────────────────────────────────────
@router.get("/backup-db")
def backup_database(current_user: User = Depends(get_current_user_query)):
    """F-ADMIN-5: Tải về file smartfarm.db hiện tại."""
    if current_user.role != "ADMIN":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    
    db_path = os.path.join(os.path.dirname(__file__), "..", "..", "smartfarm.db")
    if not os.path.exists(db_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Database file not found")
        
    return FileResponse(
        path=db_path,
        filename=f"smartfarm_backup_{datetime.now().strftime('%Y%m%d')}.db",
        media_type="application/octet-stream"
    )

# ── F-ADMIN-6: Xem log lỗi hệ thống ──────────────────────────────────────────
@router.get("/system-logs")
def get_system_logs(current_user: User = Depends(get_current_user), lines: int = 100):
    """F-ADMIN-6: Xem log hệ thống (đọc file system.log)."""
    if current_user.role != "ADMIN":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
        
    log_path = os.path.join(os.path.dirname(__file__), "..", "..", "system.log")
    if not os.path.exists(log_path):
        return {"logs": ["System log file is currently empty or not found."]}
        
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        return {"logs": [f"Error reading logs: {e}"]}
