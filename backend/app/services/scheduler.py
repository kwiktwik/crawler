"""
Scheduler service for managing crawl jobs
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from typing import Optional


class SchedulerService:
    """Service for scheduling and managing crawl jobs"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={'coalesce': False, 'max_instances': 3}
        )
        self._running_jobs = {}
    
    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
    
    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
    
    def schedule_job(self, job_id: str, run_immediately: bool = True):
        """Schedule a crawl job"""
        from app.services.crawler import run_crawl_job
        
        if run_immediately:
            # Run immediately in background
            async def run_job():
                await run_crawl_job(job_id)
            
            self.scheduler.add_job(
                run_job,
                id=f"crawl_{job_id}",
                replace_existing=True
            )
        
        return True
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a scheduled job"""
        try:
            self.scheduler.remove_job(f"crawl_{job_id}")
            return True
        except Exception:
            return False
    
    def get_job_status(self, job_id: str) -> Optional[str]:
        """Get the status of a scheduled job"""
        job = self.scheduler.get_job(f"crawl_{job_id}")
        if job:
            return "scheduled"
        return None


# Singleton instance
scheduler_service = SchedulerService()
