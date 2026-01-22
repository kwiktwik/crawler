"""
API Crawler - Main FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import crawler, jobs, tables
from app.services.database import init_db
from app.services.scheduler import scheduler_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    await init_db()
    scheduler_service.start()
    yield
    # Shutdown
    scheduler_service.shutdown()


app = FastAPI(
    title="API Crawler",
    description="A system to analyze, crawl APIs and persist data in structured format",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend - must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include routers
app.include_router(crawler.router, prefix="/api/crawler", tags=["Crawler"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(tables.router, prefix="/api/tables", tags=["Tables"])


@app.get("/")
async def root():
    return {"message": "API Crawler Backend", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
