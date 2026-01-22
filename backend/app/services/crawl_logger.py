"""
Crawl Logger Service - Handles logging for crawl jobs
Supports real-time streaming via Server-Sent Events
"""
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator
from sqlalchemy import text
from collections import defaultdict

from app.services.database import async_session

# In-memory log buffer for real-time streaming
# job_id -> list of recent logs
_log_buffers: Dict[str, list] = defaultdict(list)
_log_subscribers: Dict[str, list] = defaultdict(list)
MAX_BUFFER_SIZE = 100


async def add_log(
    job_id: str, 
    level: str, 
    message: str, 
    details: Optional[Dict[str, Any]] = None
) -> None:
    """
    Add a log entry for a crawl job
    """
    log_entry = {
        "job_id": job_id,
        "level": level,
        "message": message,
        "details": json.dumps(details) if details else None,
        "created_at": datetime.utcnow().isoformat(),
        "timestamp": datetime.utcnow().timestamp()
    }
    
    # Add to in-memory buffer for live streaming
    _log_buffers[job_id].append(log_entry)
    if len(_log_buffers[job_id]) > MAX_BUFFER_SIZE:
        _log_buffers[job_id] = _log_buffers[job_id][-MAX_BUFFER_SIZE:]
    
    # Notify subscribers
    for queue in _log_subscribers.get(job_id, []):
        try:
            queue.put_nowait(log_entry)
        except:
            pass
    
    # Persist to database
    async with async_session() as session:
        await session.execute(
            text("""
                INSERT INTO crawl_logs (job_id, level, message, details, created_at)
                VALUES (:job_id, :level, :message, :details, :created_at)
            """),
            {
                "job_id": job_id,
                "level": level,
                "message": message,
                "details": log_entry["details"],
                "created_at": datetime.utcnow()
            }
        )
        await session.commit()


async def get_logs(job_id: str, limit: int = 100, since_id: Optional[int] = None) -> list:
    """
    Get logs for a job from database
    """
    async with async_session() as session:
        if since_id:
            result = await session.execute(
                text("""
                    SELECT id, job_id, level, message, details, created_at 
                    FROM crawl_logs 
                    WHERE job_id = :job_id AND id > :since_id
                    ORDER BY id ASC
                    LIMIT :limit
                """),
                {"job_id": job_id, "since_id": since_id, "limit": limit}
            )
        else:
            result = await session.execute(
                text("""
                    SELECT id, job_id, level, message, details, created_at 
                    FROM crawl_logs 
                    WHERE job_id = :job_id
                    ORDER BY id DESC
                    LIMIT :limit
                """),
                {"job_id": job_id, "limit": limit}
            )
        
        rows = result.fetchall()
        logs = []
        for row in rows:
            logs.append({
                "id": row[0],
                "job_id": row[1],
                "level": row[2],
                "message": row[3],
                "details": json.loads(row[4]) if row[4] else None,
                "created_at": row[5].isoformat() if row[5] else None
            })
        
        # Reverse if we got DESC order
        if not since_id:
            logs.reverse()
        
        return logs


async def subscribe_to_logs(job_id: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Subscribe to live log updates for a job
    Returns an async generator that yields log entries
    """
    queue = asyncio.Queue()
    _log_subscribers[job_id].append(queue)
    
    try:
        # First send buffered logs
        for log in _log_buffers.get(job_id, []):
            yield log
        
        # Then wait for new logs
        while True:
            try:
                log = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield log
            except asyncio.TimeoutError:
                # Send keepalive
                yield {"type": "keepalive", "timestamp": datetime.utcnow().isoformat()}
    finally:
        # Clean up subscription
        if queue in _log_subscribers.get(job_id, []):
            _log_subscribers[job_id].remove(queue)


def get_buffer_logs(job_id: str) -> list:
    """Get logs from in-memory buffer"""
    return list(_log_buffers.get(job_id, []))


async def clear_logs(job_id: str) -> None:
    """Clear logs for a job"""
    _log_buffers.pop(job_id, None)
    
    async with async_session() as session:
        await session.execute(
            text("DELETE FROM crawl_logs WHERE job_id = :job_id"),
            {"job_id": job_id}
        )
        await session.commit()


# Convenience functions for different log levels
async def log_info(job_id: str, message: str, details: Optional[Dict] = None):
    await add_log(job_id, "info", message, details)

async def log_success(job_id: str, message: str, details: Optional[Dict] = None):
    await add_log(job_id, "success", message, details)

async def log_warning(job_id: str, message: str, details: Optional[Dict] = None):
    await add_log(job_id, "warning", message, details)

async def log_error(job_id: str, message: str, details: Optional[Dict] = None):
    await add_log(job_id, "error", message, details)

async def log_debug(job_id: str, message: str, details: Optional[Dict] = None):
    await add_log(job_id, "debug", message, details)
