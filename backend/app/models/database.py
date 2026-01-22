"""
SQLAlchemy Database Models
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class JobStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class PaginationType(enum.Enum):
    NONE = "none"
    PAGE_BASED = "page_based"
    CURSOR_BASED = "cursor_based"
    OFFSET_BASED = "offset_based"


class CrawlJob(Base):
    """Store crawl job configurations and status"""
    __tablename__ = "crawl_jobs"
    
    id = Column(String(36), primary_key=True)
    curl_command = Column(Text, nullable=False)
    table_name = Column(String(255), nullable=False)
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING)
    pagination_type = Column(SQLEnum(PaginationType), default=PaginationType.NONE)
    
    # Interval configuration
    start_interval = Column(Integer, default=5)
    end_interval = Column(Integer, default=15)
    randomize_interval = Column(Integer, default=1)  # Boolean as int
    
    # Date range
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # Progress tracking
    total_records = Column(Integer, default=0)
    current_page = Column(Integer, default=0)
    cursor_value = Column(String(500), nullable=True)
    max_pages = Column(Integer, nullable=True)
    
    # Error handling
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """Store notifications for the dashboard"""
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True)
    job_id = Column(String(36), nullable=True)
    type = Column(String(50), nullable=False)  # error, success, info
    message = Column(Text, nullable=False)
    is_read = Column(Integer, default=0)  # Boolean as int
    created_at = Column(DateTime, default=datetime.utcnow)


class CrawlLog(Base):
    """Store crawl job logs for live streaming"""
    __tablename__ = "crawl_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), nullable=False, index=True)
    level = Column(String(20), nullable=False)  # info, warning, error, success, debug
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)  # JSON string for additional data
    created_at = Column(DateTime, default=datetime.utcnow)
