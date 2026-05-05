"""
SmartFarm IoT Ecosystem – Application Entry Point
--------------------------------------------------
Thin bootstrap file: registers all module routers, initialises DB and MQTT.

Architecture (theo đặc tả NF-MAINT-0):
  core/          – Config, DB, Models, Security
  shared/        – MQTT Client, WebSocket Manager (dùng chung)
  modules/
    auth/         – UC_UI_1       (F-FARMER-0, F-ADMIN-0, F-ADMIN-1)
    monitoring/   – UC_Monitoring (F-FARMER-1, F-FARMER-2)
    actuating/    – UC_Actuating  (F-FARMER-3, F-FARMER-4, F-FARMER-7)
    logging_report/ – UC_Logging  (F-FARMER-8, F-ADMIN-5)
    ai_disease/   – UC_AI         (F-FARMER-5, F-ADMIN-3)
    ml_prediction/– UC_ML         (F-FARMER-6)
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import engine
import core.models  # noqa: F401  – ensure all tables are registered before create_all

from shared import mqtt_client
from shared.ws_manager import manager

from modules.auth.router           import router as auth_router
from modules.monitoring.router     import router as monitoring_router
from modules.actuating.router      import router as actuating_router
from modules.logging_report.router import router as logging_router
from modules.ai_disease.router     import router as ai_router
from modules.ml_prediction.router  import router as ml_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "system.log"), encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Tạo tất cả các bảng DB nếu chưa tồn tại
    core.models.Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables ready.")

    # 1.5. Khởi tạo tài khoản Admin mặc định (Seed data)
    from core.database import SessionLocal
    from core.models import User
    from core.security import hash_password
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(User(username="admin", password_hash=hash_password("admin123"), role="ADMIN"))
            db.commit()
            logger.info("✅ Seeded default admin account (admin / admin123)")
    except Exception as e:
        logger.error(f"Error seeding admin: {e}")
    finally:
        db.close()

    # 2. Gắn event loop vào WebSocket manager để broadcast_sync hoạt động
    loop = asyncio.get_event_loop()
    manager.set_loop(loop)

    # 3. Sync dữ liệu lịch sử từ Adafruit IO trước khi MQTT loop khởi động
    mqtt_client.set_broadcast_callback = lambda fn: None  # handled via manager
    await mqtt_client.sync_initial_values()

    # 4. Khởi động MQTT loop trong background thread
    mqtt_client.start()
    logger.info("✅ MQTT loop started.")

    yield   # Application is running

    logger.info("Shutting down…")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SmartFarm IoT Ecosystem API",
    version="2.0.0",
    description="Backend theo đặc tả UC_Monitoring | UC_Actuating | UC_Logging | UC_AI | UC_ML",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register module routers ───────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(monitoring_router)
app.include_router(actuating_router)
app.include_router(logging_router)
app.include_router(ai_router)
app.include_router(ml_router)


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "version": "2.0.0"}
