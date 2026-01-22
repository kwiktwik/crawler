"""
Jobs API Router
"""
from fastapi import APIRouter, HTTPException
from typing import List

from app.services.crawler import get_all_jobs, get_job_by_id, update_job_status
from app.services.scheduler import scheduler_service
from app.models.database import JobStatus


router = APIRouter()


@router.get("/")
async def list_jobs():
    """
    List all crawl jobs
    """
    jobs = await get_all_jobs()
    return jobs


@router.get("/{job_id}")
async def get_job(job_id: str):
    """
    Get a specific job by ID
    """
    job = await get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/pause")
async def pause_job(job_id: str):
    """
    Pause a running job
    """
    job = await get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "running":
        raise HTTPException(status_code=400, detail="Job is not running")
    
    scheduler_service.cancel_job(job_id)
    await update_job_status(job_id, JobStatus.PAUSED)
    
    return {"status": "paused", "job_id": job_id}


@router.post("/{job_id}/resume")
async def resume_job(job_id: str):
    """
    Resume a paused job
    """
    job = await get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "paused":
        raise HTTPException(status_code=400, detail="Job is not paused")
    
    scheduler_service.schedule_job(job_id, run_immediately=True)
    
    return {"status": "resumed", "job_id": job_id}


@router.post("/{job_id}/stop")
async def stop_job(job_id: str):
    """
    Stop a job
    """
    job = await get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    scheduler_service.cancel_job(job_id)
    await update_job_status(job_id, JobStatus.COMPLETED, error_message="Manually stopped")
    
    return {"status": "stopped", "job_id": job_id}
