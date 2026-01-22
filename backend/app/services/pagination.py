"""
Pagination detection and handling service
"""
from typing import Dict, Any, Optional, Tuple
from app.models.schemas import PaginationType
from app.services.curl_parser import extract_pagination_params


def detect_pagination_type(url: str, response_data: Any) -> Tuple[PaginationType, Dict[str, Any]]:
    """
    Detect the type of pagination from URL parameters and API response
    
    Returns:
        Tuple of (PaginationType, pagination_info_dict)
    """
    pagination_info = {}
    
    # First check URL for pagination params
    url_params = extract_pagination_params(url)
    
    # Check response for pagination indicators
    response_indicators = _analyze_response_for_pagination(response_data)
    
    # Combine URL and response analysis
    
    # Cursor-based pagination indicators
    cursor_indicators = ["next_cursor", "cursor", "nextToken", "next_token", 
                         "continuation", "continuationToken", "after", "endCursor"]
    
    # Page-based indicators
    page_indicators = ["page", "currentPage", "current_page", "pageNumber", 
                       "page_number", "totalPages", "total_pages"]
    
    # Offset-based indicators
    offset_indicators = ["offset", "skip", "start", "from"]
    
    # Check response for cursor-based pagination
    if isinstance(response_data, dict):
        # Check for cursor fields in response
        for indicator in cursor_indicators:
            if indicator in response_data:
                pagination_info["cursor_field"] = indicator
                pagination_info["cursor_value"] = response_data[indicator]
                pagination_info.update(url_params)
                return PaginationType.CURSOR_BASED, pagination_info
        
        # Check nested pagination object
        for wrapper in ["pagination", "paging", "meta", "_pagination", "_meta"]:
            if wrapper in response_data and isinstance(response_data[wrapper], dict):
                pag_obj = response_data[wrapper]
                
                # Check for cursor
                for indicator in cursor_indicators:
                    if indicator in pag_obj:
                        pagination_info["cursor_field"] = f"{wrapper}.{indicator}"
                        pagination_info["cursor_value"] = pag_obj[indicator]
                        pagination_info.update(url_params)
                        return PaginationType.CURSOR_BASED, pagination_info
                
                # Check for page info
                for indicator in page_indicators:
                    if indicator in pag_obj:
                        pagination_info["page_field"] = f"{wrapper}.{indicator}"
                        pagination_info.update(url_params)
                        return PaginationType.PAGE_BASED, pagination_info
        
        # Check for next_page or next URL
        if "next" in response_data or "next_page" in response_data or "nextPage" in response_data:
            next_field = "next" if "next" in response_data else ("next_page" if "next_page" in response_data else "nextPage")
            if response_data[next_field]:  # Not None/null
                pagination_info["next_url_field"] = next_field
                pagination_info.update(url_params)
                return PaginationType.CURSOR_BASED, pagination_info
        
        # Check links object (HAL, JSON:API style)
        if "links" in response_data and isinstance(response_data["links"], dict):
            links = response_data["links"]
            if "next" in links:
                pagination_info["next_url_field"] = "links.next"
                pagination_info.update(url_params)
                return PaginationType.CURSOR_BASED, pagination_info
    
    # Check URL params for pagination type
    if "cursor_param" in url_params:
        pagination_info.update(url_params)
        return PaginationType.CURSOR_BASED, pagination_info
    
    if "page_param" in url_params:
        pagination_info.update(url_params)
        return PaginationType.PAGE_BASED, pagination_info
    
    if "offset_param" in url_params:
        pagination_info.update(url_params)
        return PaginationType.OFFSET_BASED, pagination_info
    
    # No pagination detected
    return PaginationType.NONE, pagination_info


def _analyze_response_for_pagination(response_data: Any) -> Dict[str, Any]:
    """
    Analyze response structure for pagination clues
    """
    info = {}
    
    if isinstance(response_data, dict):
        # Check for total count fields
        for field in ["total", "totalCount", "total_count", "count", "totalItems", "total_items"]:
            if field in response_data:
                info["total_field"] = field
                info["total_value"] = response_data[field]
                break
        
        # Check for has_more or similar flags
        for field in ["has_more", "hasMore", "has_next", "hasNext", "more"]:
            if field in response_data:
                info["has_more_field"] = field
                info["has_more_value"] = response_data[field]
                break
    
    return info


def get_next_pagination_params(pagination_type: PaginationType, 
                                pagination_info: Dict[str, Any],
                                current_state: Dict[str, Any],
                                response_data: Any) -> Optional[Dict[str, Any]]:
    """
    Get the next pagination parameters based on current state and response
    
    Returns None if there's no next page
    """
    if pagination_type == PaginationType.NONE:
        return None
    
    if pagination_type == PaginationType.PAGE_BASED:
        current_page = current_state.get("page", 1)
        
        # Check if we have more pages
        if isinstance(response_data, dict):
            # Check for total pages
            for field in ["totalPages", "total_pages", "pages"]:
                if field in response_data:
                    total_pages = response_data[field]
                    if current_page >= total_pages:
                        return None
            
            # Check pagination wrapper
            for wrapper in ["pagination", "paging", "meta"]:
                if wrapper in response_data and isinstance(response_data[wrapper], dict):
                    pag = response_data[wrapper]
                    for field in ["totalPages", "total_pages", "pages"]:
                        if field in pag:
                            if current_page >= pag[field]:
                                return None
        
        # Check if response data is empty
        data = _extract_data_array(response_data)
        if not data or len(data) == 0:
            return None
        
        return {
            "page": current_page + 1,
            "param": pagination_info.get("page_param", "page")
        }
    
    elif pagination_type == PaginationType.OFFSET_BASED:
        current_offset = current_state.get("offset", 0)
        limit = current_state.get("limit", pagination_info.get("limit_value", 20))
        
        # Check if response data is empty
        data = _extract_data_array(response_data)
        if not data or len(data) == 0:
            return None
        
        if len(data) < int(limit):
            return None  # Last page
        
        return {
            "offset": current_offset + len(data),
            "param": pagination_info.get("offset_param", "offset")
        }
    
    elif pagination_type == PaginationType.CURSOR_BASED:
        if not isinstance(response_data, dict):
            return None
        
        # Look for next cursor in response
        cursor_value = None
        
        # Direct cursor field
        cursor_field = pagination_info.get("cursor_field")
        if cursor_field:
            if "." in cursor_field:
                parts = cursor_field.split(".")
                obj = response_data
                for part in parts:
                    if isinstance(obj, dict) and part in obj:
                        obj = obj[part]
                    else:
                        obj = None
                        break
                cursor_value = obj
            else:
                cursor_value = response_data.get(cursor_field)
        
        # Check next URL field
        if not cursor_value:
            next_field = pagination_info.get("next_url_field")
            if next_field:
                if "." in next_field:
                    parts = next_field.split(".")
                    obj = response_data
                    for part in parts:
                        if isinstance(obj, dict) and part in obj:
                            obj = obj[part]
                        else:
                            obj = None
                            break
                    cursor_value = obj
                else:
                    cursor_value = response_data.get(next_field)
        
        if not cursor_value:
            # Check for has_more = false
            has_more = response_data.get("has_more", response_data.get("hasMore", True))
            if not has_more:
                return None
            
            # Check if data is empty
            data = _extract_data_array(response_data)
            if not data or len(data) == 0:
                return None
        
        if cursor_value:
            return {
                "cursor": cursor_value,
                "param": pagination_info.get("cursor_param", "cursor")
            }
        
        return None
    
    return None


def _extract_data_array(response_data: Any) -> list:
    """Extract the main data array from response"""
    if isinstance(response_data, list):
        return response_data
    
    if isinstance(response_data, dict):
        for key in ["data", "results", "items", "records", "entries", "list"]:
            if key in response_data and isinstance(response_data[key], list):
                return response_data[key]
    
    return []
