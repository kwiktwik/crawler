"""
Crawler API Router
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import json

from app.models.schemas import (
    CurlValidationRequest, 
    CrawlConfiguration, 
    ValidationResponse,
    CrawlJobResponse
)
from app.services.crawler import (
    validate_curl_and_test,
    create_crawl_job,
    get_notifications,
    mark_notification_read
)
from app.services.crawl_logger import get_logs, subscribe_to_logs, get_buffer_logs
from app.services.scheduler import scheduler_service


router = APIRouter()


@router.post("/validate")
async def validate_curl(request: CurlValidationRequest) -> Dict[str, Any]:
    """
    Validate a cURL command by parsing it and making a test API call
    """
    try:
        result = await validate_curl_and_test(request.curl_command)
        return result
    except Exception as e:
        return {
            "is_valid": False,
            "parsed_curl": None,
            "test_response": None,
            "detected_pagination": None,
            "inferred_schema": None,
            "error": str(e)
        }


@router.post("/start")
async def start_crawl(config: CrawlConfiguration):
    """
    Start a new crawl job with the provided configuration
    """
    # First validate the curl command
    validation = await validate_curl_and_test(config.curl_command)
    
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cURL command: {validation['error']}"
        )
    
    # Get pagination type and schema
    pagination_type = validation["detected_pagination"]["type"] if validation["detected_pagination"] else "none"
    schema = validation["inferred_schema"] or {}
    
    # Create the crawl job
    job_id = await create_crawl_job(
        curl_command=config.curl_command,
        table_name=config.table_name,
        pagination_type=pagination_type,
        schema=schema,
        start_interval=config.start_interval,
        end_interval=config.end_interval,
        randomize_interval=config.randomize_interval,
        start_date=config.start_date,
        end_date=config.end_date,
        max_pages=config.max_pages
    )
    
    # Schedule the job
    scheduler_service.schedule_job(job_id, run_immediately=True)
    
    return {
        "job_id": job_id,
        "message": "Crawl job started",
        "pagination_type": pagination_type,
        "table_name": config.table_name
    }


@router.get("/notifications")
async def get_all_notifications(unread_only: bool = False):
    """
    Get all notifications
    """
    notifications = await get_notifications(unread_only)
    return notifications


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str):
    """
    Mark a notification as read
    """
    await mark_notification_read(notification_id)
    return {"status": "ok"}


@router.get("/jobs/{job_id}/logs")
async def get_job_logs(job_id: str, limit: int = 100, since_id: Optional[int] = None):
    """
    Get logs for a specific job
    """
    logs = await get_logs(job_id, limit, since_id)
    return {"logs": logs, "job_id": job_id}


@router.get("/jobs/{job_id}/logs/stream")
async def stream_job_logs(job_id: str):
    """
    Stream logs for a job in real-time using Server-Sent Events
    """
    async def event_generator():
        try:
            async for log in subscribe_to_logs(job_id):
                if log.get("type") == "keepalive":
                    yield f": keepalive\n\n"
                else:
                    data = json.dumps(log)
                    yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/jobs/{job_id}/logs/buffer")
async def get_buffered_logs(job_id: str):
    """
    Get in-memory buffered logs for a job (fast, no DB query)
    """
    logs = get_buffer_logs(job_id)
    return {"logs": logs, "job_id": job_id}
