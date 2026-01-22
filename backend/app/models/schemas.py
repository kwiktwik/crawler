"""
Pydantic schemas for API requests and responses
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime


class PaginationType(str, Enum):
    NONE = "none"
    PAGE_BASED = "page_based"
    CURSOR_BASED = "cursor_based"
    OFFSET_BASED = "offset_based"


class CrawlJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


# Request schemas
class CurlValidationRequest(BaseModel):
    curl_command: str = Field(..., description="The cURL command to validate")


class CrawlConfiguration(BaseModel):
    curl_command: str = Field(..., description="The cURL command to crawl")
    table_name: str = Field(..., description="Name for the database table")
    start_date: Optional[datetime] = Field(None, description="Start date for crawling")
    end_date: Optional[datetime] = Field(None, description="End date for crawling")
    start_interval: int = Field(5, description="Minimum interval between requests in seconds")
    end_interval: int = Field(15, description="Maximum interval between requests in seconds")
    randomize_interval: bool = Field(True, description="Randomize interval between start and end")
    max_pages: Optional[int] = Field(None, description="Maximum pages to crawl (None for unlimited)")


class JobUpdateRequest(BaseModel):
    status: Optional[CrawlJobStatus] = None
    error_message: Optional[str] = None


# Response schemas
class ParsedCurlResponse(BaseModel):
    method: str
    url: str
    headers: Dict[str, str]
    data: Optional[Any] = None
    is_valid: bool
    error: Optional[str] = None

    class Config:
        extra = "allow"


class DetectedPaginationResponse(BaseModel):
    type: str
    info: Dict[str, Any] = {}

    class Config:
        extra = "allow"


class TestResponseData(BaseModel):
    status_code: int
    data: Any = None
    headers: Dict[str, Any] = {}

    class Config:
        extra = "allow"


class ValidationResponse(BaseModel):
    is_valid: bool
    parsed_curl: Optional[ParsedCurlResponse] = None
    test_response: Optional[TestResponseData] = None
    detected_pagination: Optional[DetectedPaginationResponse] = None
    inferred_schema: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        extra = "allow"


class CrawlJobResponse(BaseModel):
    id: str
    table_name: str
    status: CrawlJobStatus
    pagination_type: PaginationType
    total_records: int = 0
    current_page: int = 0
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime
    updated_at: datetime


class TableInfoResponse(BaseModel):
    name: str
    columns: List[Dict[str, str]]
    row_count: int


class NotificationResponse(BaseModel):
    type: str  # "error", "success", "info"
    message: str
    job_id: Optional[str] = None
    timestamp: datetime
