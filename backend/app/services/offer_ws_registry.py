from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class OfferConnectionRegistry:
    """In-process registry of driver WebSocket connections watching for a new
    job offer. Assumes a single backend process (confirmed via Procfile/dev.sh
    — no --workers); a multi-process deployment would need a shared pub/sub
    (e.g. Redis) instead, since this dict is only visible within one process.
    """

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def register(self, tanker_id: int, ws: WebSocket) -> None:
        self._connections.setdefault(tanker_id, set()).add(ws)

    def unregister(self, tanker_id: int, ws: WebSocket) -> None:
        conns = self._connections.get(tanker_id)
        if not conns:
            return
        conns.discard(ws)
        if not conns:
            self._connections.pop(tanker_id, None)

    async def notify_offer_available(self, tanker_id: int) -> None:
        conns = list(self._connections.get(tanker_id, ()))
        for ws in conns:
            try:
                await ws.send_json({"type": "offer_available"})
            except Exception:
                logger.warning(
                    "offer_ws: send failed for tanker_id=%s, dropping connection",
                    tanker_id,
                )
                self.unregister(tanker_id, ws)

    def notify_offer_available_sync(self, tanker_id: int) -> None:
        """Fire-and-forget bridge for callers running outside the asyncio event
        loop (plain sync route/service functions, APScheduler's thread-pool
        jobs). Never raises — a dead socket must never fail an assignment.
        """
        if self._loop is None or tanker_id not in self._connections:
            return
        try:
            asyncio.run_coroutine_threadsafe(
                self.notify_offer_available(tanker_id), self._loop
            )
        except Exception:
            logger.warning(
                "offer_ws: failed to schedule notify for tanker_id=%s", tanker_id
            )


registry = OfferConnectionRegistry()
