"""
API Crawler Service - Core crawling logic
"""
import httpx
import asyncio
import random
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import text

from app.services.curl_parser import parse_curl_command, build_url_with_pagination, CurlParseError
from app.services.pagination import detect_pagination_type, get_next_pagination_params, _extract_data_array
from app.services.database import (
    async_session, 
    infer_schema_from_data, 
    table_exists, 
    create_dynamic_table,
    insert_records
)
from app.services.crawl_logger import log_info, log_success, log_warning, log_error, log_debug
from app.models.schemas import PaginationType, CrawlJobStatus
from app.models.database import CrawlJob, Notification, JobStatus, PaginationType as DBPaginationType


MAX_RETRIES = 3


async def validate_curl_and_test(curl_command: str) -> Dict[str, Any]:
    """
    Parse cURL command and make a test API call
    
    Returns validation result with parsed info, response sample, and detected pagination
    """
    result = {
        "is_valid": False,
        "parsed_curl": None,
        "test_response": None,
        "detected_pagination": None,
        "inferred_schema": None,
        "error": None
    }
    
    try:
        # Parse cURL
        parsed = parse_curl_command(curl_command)
        result["parsed_curl"] = {
            "method": parsed["method"],
            "url": parsed["url"],
            "headers": parsed["headers"],
            "data": parsed["data"],
            "is_valid": True,
            "error": None
        }
        
        # Make test request
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=parsed["method"],
                url=parsed["url"],
                headers=parsed["headers"],
                content=parsed["data"] if parsed["data"] else None,
                cookies=parsed.get("cookies", {})
            )
            
            # Convert headers to serializable dict
            response_headers = {k: str(v) for k, v in response.headers.items()}
            
            # Check response
            if response.status_code >= 400:
                result["error"] = f"API returned error status: {response.status_code}"
                result["test_response"] = {
                    "status_code": response.status_code,
                    "data": None,
                    "headers": response_headers
                }
                return result
            
            # Try to parse JSON response
            try:
                response_data = response.json()
                result["test_response"] = {
                    "status_code": response.status_code,
                    "data": response_data,
                    "headers": response_headers
                }
                
                # Detect pagination
                pagination_type, pagination_info = detect_pagination_type(
                    parsed["url"], response_data
                )
                result["detected_pagination"] = {
                    "type": pagination_type.value,
                    "info": pagination_info
                }
                
                # Infer schema
                schema = infer_schema_from_data(response_data)
                result["inferred_schema"] = schema
                
                result["is_valid"] = True
                
            except json.JSONDecodeError:
                result["error"] = "API response is not valid JSON"
                result["test_response"] = {
                    "status_code": response.status_code,
                    "data": response.text[:500],
                    "headers": response_headers
                }
    
    except CurlParseError as e:
        result["error"] = f"Invalid cURL command: {str(e)}"
    except httpx.TimeoutException:
        result["error"] = "Request timed out"
    except httpx.RequestError as e:
        result["error"] = f"Request failed: {str(e)}"
    except Exception as e:
        import traceback
        traceback.print_exc()
        result["error"] = f"Validation failed: {str(e)}"
    
    return result


async def create_crawl_job(
    curl_command: str,
    table_name: str,
    pagination_type: str,
    schema: Dict[str, str],
    start_interval: int = 5,
    end_interval: int = 15,
    randomize_interval: bool = True,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    max_pages: Optional[int] = None
) -> str:
    """
    Create a new crawl job
    
    Returns the job ID
    """
    job_id = str(uuid.uuid4())
    
    # Create table if it doesn't exist
    if not await table_exists(table_name):
        await create_dynamic_table(table_name, schema)
    
    # Convert pagination_type string to enum
    pagination_enum_map = {
        "none": DBPaginationType.NONE,
        "page_based": DBPaginationType.PAGE_BASED,
        "cursor_based": DBPaginationType.CURSOR_BASED,
        "offset_based": DBPaginationType.OFFSET_BASED,
    }
    db_pagination_type = pagination_enum_map.get(pagination_type, DBPaginationType.NONE)
    
    # Create job record
    async with async_session() as session:
        job = CrawlJob(
            id=job_id,
            curl_command=curl_command,
            table_name=table_name,
            status=JobStatus.PENDING,
            pagination_type=db_pagination_type,
            start_interval=start_interval,
            end_interval=end_interval,
            randomize_interval=1 if randomize_interval else 0,
            start_date=start_date,
            end_date=end_date,
            max_pages=max_pages
        )
        session.add(job)
        await session.commit()
    
    return job_id


async def run_crawl_job(job_id: str) -> None:
    """
    Execute a crawl job with live logging
    """
    await log_info(job_id, "🚀 Starting crawl job...", {"job_id": job_id})
    
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM crawl_jobs WHERE id = :id"),
            {"id": job_id}
        )
        job_row = result.fetchone()
        
        if not job_row:
            await log_error(job_id, "Job not found in database")
            return
        
        # Convert row to dict
        job = {
            "id": job_row[0],
            "curl_command": job_row[1],
            "table_name": job_row[2],
            "status": job_row[3],
            "pagination_type": job_row[4],
            "start_interval": job_row[5],
            "end_interval": job_row[6],
            "randomize_interval": job_row[7],
            "start_date": job_row[8],
            "end_date": job_row[9],
            "total_records": job_row[10],
            "current_page": job_row[11],
            "cursor_value": job_row[12],
            "max_pages": job_row[13],
            "retry_count": job_row[14]
        }
    
    await log_info(job_id, f"📊 Target table: {job['table_name']}")
    await log_info(job_id, f"🔄 Pagination type: {job['pagination_type']}")
    
    # Update status to running
    await update_job_status(job_id, JobStatus.RUNNING)
    await log_success(job_id, "✅ Job status updated to RUNNING")
    
    try:
        # Parse cURL
        await log_info(job_id, "🔍 Parsing cURL command...")
        parsed = parse_curl_command(job["curl_command"])
        await log_success(job_id, f"✅ Parsed: {parsed['method']} {parsed['url'][:80]}...")
        
        # Initialize pagination state - convert stored value to enum
        pagination_type_str = job["pagination_type"]
        pagination_type_map = {
            "none": PaginationType.NONE,
            "NONE": PaginationType.NONE,
            "page_based": PaginationType.PAGE_BASED,
            "PAGE_BASED": PaginationType.PAGE_BASED,
            "cursor_based": PaginationType.CURSOR_BASED,
            "CURSOR_BASED": PaginationType.CURSOR_BASED,
            "offset_based": PaginationType.OFFSET_BASED,
            "OFFSET_BASED": PaginationType.OFFSET_BASED,
        }
        pagination_type = pagination_type_map.get(pagination_type_str, PaginationType.NONE)
        
        current_state = {
            "page": job["current_page"] or 1,
            "offset": 0,
            "cursor": job["cursor_value"]
        }
        
        total_records = job["total_records"] or 0
        retry_count = 0
        request_count = 0
        
        await log_info(job_id, f"📄 Starting from page {current_state['page']}, {total_records} existing records")
        
        while True:
            request_count += 1
            
            # Check date constraints
            if job["end_date"]:
                end_dt = job["end_date"]
                if isinstance(end_dt, str):
                    end_dt = datetime.fromisoformat(end_dt)
                if datetime.utcnow() > end_dt:
                    await log_warning(job_id, "⏰ End date reached, stopping crawl")
                    await update_job_status(job_id, JobStatus.COMPLETED, 
                                          error_message="End date reached")
                    break
            
            # Check max pages
            if job["max_pages"] and current_state["page"] > job["max_pages"]:
                await log_warning(job_id, f"📄 Max pages ({job['max_pages']}) reached, stopping crawl")
                await update_job_status(job_id, JobStatus.COMPLETED,
                                      error_message="Max pages reached")
                break
            
            # Build URL with pagination
            current_url = parsed["url"]
            if pagination_type == PaginationType.PAGE_BASED:
                current_url = build_url_with_pagination(
                    parsed["url"], "page_based", page=current_state["page"]
                )
            elif pagination_type == PaginationType.OFFSET_BASED:
                current_url = build_url_with_pagination(
                    parsed["url"], "offset_based", offset=current_state["offset"]
                )
            elif pagination_type == PaginationType.CURSOR_BASED and current_state["cursor"]:
                current_url = build_url_with_pagination(
                    parsed["url"], "cursor_based", cursor=current_state["cursor"]
                )
            
            await log_info(job_id, f"🌐 Request #{request_count}: {parsed['method']} {current_url[:100]}...")
            
            # Make request with retry logic
            response_data = None
            for attempt in range(MAX_RETRIES):
                try:
                    start_time = datetime.utcnow()
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.request(
                            method=parsed["method"],
                            url=current_url,
                            headers=parsed["headers"],
                            content=parsed["data"] if parsed["data"] else None,
                            cookies=parsed.get("cookies", {})
                        )
                        
                        elapsed = (datetime.utcnow() - start_time).total_seconds()
                        
                        if response.status_code >= 400:
                            raise Exception(f"HTTP {response.status_code}: {response.text[:200]}")
                        
                        response_data = response.json()
                        retry_count = 0  # Reset on success
                        
                        await log_success(job_id, f"✅ Response: {response.status_code} ({elapsed:.2f}s)", {
                            "status_code": response.status_code,
                            "elapsed": elapsed
                        })
                        break
                        
                except Exception as e:
                    retry_count = attempt + 1
                    await update_job_retry_count(job_id, retry_count)
                    await log_warning(job_id, f"⚠️ Attempt {retry_count}/{MAX_RETRIES} failed: {str(e)[:100]}")
                    
                    if retry_count >= MAX_RETRIES:
                        error_msg = f"Failed after {MAX_RETRIES} retries: {str(e)}"
                        await log_error(job_id, f"❌ {error_msg}")
                        await update_job_status(job_id, JobStatus.FAILED, error_message=error_msg)
                        await create_notification(
                            job_id, "error", 
                            f"Crawl job failed: {error_msg}"
                        )
                        return
                    
                    wait_time = 2 ** attempt
                    await log_info(job_id, f"⏳ Waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
            
            if response_data is None:
                await log_warning(job_id, "📭 No response data, ending crawl")
                break
            
            # Extract and insert data
            data_array = _extract_data_array(response_data)
            if data_array:
                inserted = await insert_records(job["table_name"], data_array)
                total_records += inserted
                await update_job_progress(job_id, total_records, current_state["page"])
                await log_success(job_id, f"💾 Inserted {inserted} records (Total: {total_records})", {
                    "inserted": inserted,
                    "total": total_records,
                    "page": current_state["page"]
                })
            else:
                await log_warning(job_id, "📭 No data extracted from response")
            
            # Get next pagination params
            _, pagination_info = detect_pagination_type(parsed["url"], response_data)
            next_params = get_next_pagination_params(
                pagination_type, pagination_info, current_state, response_data
            )
            
            if not next_params:
                # No more pages
                await log_success(job_id, f"🎉 Crawl completed! Total records: {total_records}")
                await update_job_status(job_id, JobStatus.COMPLETED)
                await create_notification(
                    job_id, "success",
                    f"Crawl completed! Collected {total_records} records."
                )
                break
            
            # Update state for next iteration
            if "page" in next_params:
                current_state["page"] = next_params["page"]
                await log_debug(job_id, f"📄 Next page: {next_params['page']}")
            if "offset" in next_params:
                current_state["offset"] = next_params["offset"]
                await log_debug(job_id, f"📄 Next offset: {next_params['offset']}")
            if "cursor" in next_params:
                current_state["cursor"] = next_params["cursor"]
                await update_job_cursor(job_id, next_params["cursor"])
                await log_debug(job_id, f"📄 Next cursor: {next_params['cursor'][:50]}...")
            
            # Wait between requests
            interval = job["start_interval"]
            if job["randomize_interval"]:
                interval = random.randint(job["start_interval"], job["end_interval"])
            await log_info(job_id, f"⏳ Waiting {interval}s before next request...")
            await asyncio.sleep(interval)
    
    except Exception as e:
        error_msg = f"Crawl job error: {str(e)}"
        await log_error(job_id, f"❌ {error_msg}")
        await update_job_status(job_id, JobStatus.FAILED, error_message=error_msg)
        await create_notification(job_id, "error", error_msg)


async def update_job_status(job_id: str, status: JobStatus, error_message: str = None):
    """Update job status"""
    async with async_session() as session:
        sql = "UPDATE crawl_jobs SET status = :status, updated_at = :updated_at"
        params = {"status": status.value, "updated_at": datetime.utcnow(), "id": job_id}
        
        if error_message:
            sql += ", error_message = :error_message"
            params["error_message"] = error_message
        
        sql += " WHERE id = :id"
        await session.execute(text(sql), params)
        await session.commit()


async def update_job_progress(job_id: str, total_records: int, current_page: int):
    """Update job progress"""
    async with async_session() as session:
        await session.execute(
            text("""UPDATE crawl_jobs 
                   SET total_records = :total_records, 
                       current_page = :current_page,
                       updated_at = :updated_at
                   WHERE id = :id"""),
            {
                "total_records": total_records,
                "current_page": current_page,
                "updated_at": datetime.utcnow(),
                "id": job_id
            }
        )
        await session.commit()


async def update_job_retry_count(job_id: str, retry_count: int):
    """Update job retry count"""
    async with async_session() as session:
        await session.execute(
            text("UPDATE crawl_jobs SET retry_count = :retry_count, updated_at = :updated_at WHERE id = :id"),
            {"retry_count": retry_count, "updated_at": datetime.utcnow(), "id": job_id}
        )
        await session.commit()


async def update_job_cursor(job_id: str, cursor_value: str):
    """Update job cursor value"""
    async with async_session() as session:
        await session.execute(
            text("UPDATE crawl_jobs SET cursor_value = :cursor_value, updated_at = :updated_at WHERE id = :id"),
            {"cursor_value": cursor_value, "updated_at": datetime.utcnow(), "id": job_id}
        )
        await session.commit()


async def create_notification(job_id: str, type: str, message: str):
    """Create a notification"""
    async with async_session() as session:
        notification = Notification(
            id=str(uuid.uuid4()),
            job_id=job_id,
            type=type,
            message=message
        )
        session.add(notification)
        await session.commit()


async def get_all_jobs() -> List[Dict[str, Any]]:
    """Get all crawl jobs"""
    async with async_session() as session:
        result = await session.execute(text("SELECT * FROM crawl_jobs ORDER BY created_at DESC"))
        rows = result.fetchall()
        
        jobs = []
        for row in rows:
            jobs.append({
                "id": row[0],
                "curl_command": row[1][:100] + "..." if len(row[1]) > 100 else row[1],
                "table_name": row[2],
                "status": row[3],
                "pagination_type": row[4],
                "total_records": row[10],
                "current_page": row[11],
                "retry_count": row[14],
                "error_message": row[15],
                "created_at": row[16],
                "updated_at": row[17]
            })
        
        return jobs


async def get_job_by_id(job_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific job by ID"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM crawl_jobs WHERE id = :id"),
            {"id": job_id}
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return {
            "id": row[0],
            "curl_command": row[1],
            "table_name": row[2],
            "status": row[3],
            "pagination_type": row[4],
            "start_interval": row[5],
            "end_interval": row[6],
            "randomize_interval": bool(row[7]),
            "start_date": row[8],
            "end_date": row[9],
            "total_records": row[10],
            "current_page": row[11],
            "cursor_value": row[12],
            "max_pages": row[13],
            "retry_count": row[14],
            "error_message": row[15],
            "created_at": row[16],
            "updated_at": row[17]
        }


async def get_notifications(unread_only: bool = False) -> List[Dict[str, Any]]:
    """Get notifications"""
    async with async_session() as session:
        sql = "SELECT * FROM notifications"
        if unread_only:
            sql += " WHERE is_read = 0"
        sql += " ORDER BY created_at DESC LIMIT 50"
        
        result = await session.execute(text(sql))
        rows = result.fetchall()
        
        return [
            {
                "id": row[0],
                "job_id": row[1],
                "type": row[2],
                "message": row[3],
                "is_read": bool(row[4]),
                "created_at": row[5]
            }
            for row in rows
        ]


async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    async with async_session() as session:
        await session.execute(
            text("UPDATE notifications SET is_read = 1 WHERE id = :id"),
            {"id": notification_id}
        )
        await session.commit()
