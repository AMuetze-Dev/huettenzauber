"""In-Process-Broadcast fuer die aktive Bestellung -> SSE ans Kundendisplay.

Kein Redis, kein Broker. Sync-Services (Threadpool) rufen `publish()`, die
SSE-Route (Event-Loop) liest aus ihrer Queue. Cross-Thread ueber
`loop.call_soon_threadsafe`.
"""
from __future__ import annotations

import asyncio
import contextlib

_loop: asyncio.AbstractEventLoop | None = None
_subscribers: set[asyncio.Queue] = set()


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def publish(payload: dict) -> None:
    """Aus sync-Code aufrufbar. No-op solange kein Loop / keine Abonnenten."""
    if _loop is None or not _subscribers:
        return

    def _fanout() -> None:
        for queue in list(_subscribers):
            with contextlib.suppress(asyncio.QueueFull):
                queue.put_nowait(payload)

    _loop.call_soon_threadsafe(_fanout)


@contextlib.asynccontextmanager
async def subscribe():
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subscribers.add(queue)
    try:
        yield queue
    finally:
        _subscribers.discard(queue)
