"""
WebSocket Connection Manager (shared across modules).
Used by: monitoring module to push real-time sensor data.
"""
import asyncio
import json
from typing import Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def connect_sync(self, ws: WebSocket):
        self.active.add(ws)

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    def broadcast_sync(self, message: str):
        """Called from MQTT thread (sync context)."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._broadcast(message), self._loop)

    async def _broadcast(self, message: str):
        dead = set()
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        self.active -= dead

    async def send_json(self, ws: WebSocket, data: dict):
        await ws.send_text(json.dumps(data))


# Singleton instance – imported by all modules
manager = ConnectionManager()
