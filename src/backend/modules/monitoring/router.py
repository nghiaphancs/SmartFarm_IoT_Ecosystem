"""
Module: Monitoring & Alert
Covers: UC_Monitoring_Alert_1..6 (System Requirement 1)
        NF-PER-0: sensor data updated < 3s via WebSocket
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from shared import mqtt_client
from shared.ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/monitoring", tags=["Monitoring & Alert"])


# ── UC_Monitoring_Alert_1: Xem thông số dữ liệu môi trường ─────────────────
@router.get("/sensors")
def get_sensors():
    """Trả về giá trị cảm biến mới nhất (nhiệt độ, độ ẩm, đất, ánh sáng)."""
    return mqtt_client.sensor_data


# ── UC_Monitoring_Alert_2: Xem biểu đồ đánh giá ────────────────────────────
@router.get("/sensors/history")
def get_sensor_history():
    """Trả về lịch sử 30 điểm gần nhất để vẽ biểu đồ."""
    return mqtt_client.sensor_history


# ── UC_Monitoring_Alert_5 / 6: Nhận & Gửi cảnh báo bất thường ──────────────
@router.get("/alerts")
def get_alerts():
    """Trả về danh sách cảnh báo gần nhất (tối đa 50 bản ghi trong RAM)."""
    return mqtt_client.alerts


# ── WebSocket: NF-PER-0 – Cập nhật real-time < 3 giây ──────────────────────
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint – gửi trạng thái đầy đủ ngay khi kết nối,
    sau đó push từng event (sensor / device / alert) qua broadcast_sync.
    """
    await manager.connect(websocket)
    await manager.send_json(websocket, {
        "type":    "init",
        "sensors": mqtt_client.sensor_data,
        "history": mqtt_client.sensor_history,
        "devices": mqtt_client.device_state,
        "alerts":  mqtt_client.alerts,
        "thresholds": mqtt_client.threshold_data,
    })
    try:
        while True:
            await websocket.receive_text()   # keep-alive ping
    except WebSocketDisconnect:
        manager.disconnect(websocket)
