"""
cURL command parser service
"""
import re
import shlex
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urlparse, parse_qs


class CurlParseError(Exception):
    """Exception raised when cURL parsing fails"""
    pass


def parse_curl_command(curl_command: str) -> Dict[str, Any]:
    """
    Parse a cURL command into its components
    
    Returns:
        Dict containing method, url, headers, data
    """
    try:
        # Clean up the command
        curl_command = curl_command.strip()
        
        # Remove line continuations
        curl_command = curl_command.replace("\\\n", " ").replace("\\\r\n", " ")
        
        # Handle Windows-style commands
        curl_command = curl_command.replace("^", "")
        
        # Tokenize
        try:
            tokens = shlex.split(curl_command)
        except ValueError as e:
            raise CurlParseError(f"Failed to parse command: {e}")
        
        if not tokens or tokens[0].lower() != "curl":
            raise CurlParseError("Command must start with 'curl'")
        
        # Initialize result
        result = {
            "method": "GET",
            "url": "",
            "headers": {},
            "data": None,
            "cookies": {}
        }
        
        i = 1
        while i < len(tokens):
            token = tokens[i]
            
            # Method
            if token in ("-X", "--request"):
                i += 1
                if i < len(tokens):
                    result["method"] = tokens[i].upper()
            
            # Headers
            elif token in ("-H", "--header"):
                i += 1
                if i < len(tokens):
                    header = tokens[i]
                    if ":" in header:
                        key, value = header.split(":", 1)
                        result["headers"][key.strip()] = value.strip()
            
            # Data/body
            elif token in ("-d", "--data", "--data-raw", "--data-binary"):
                i += 1
                if i < len(tokens):
                    result["data"] = tokens[i]
                    # If data is provided, default to POST if not specified
                    if result["method"] == "GET":
                        result["method"] = "POST"
            
            # JSON data
            elif token == "--json":
                i += 1
                if i < len(tokens):
                    result["data"] = tokens[i]
                    result["headers"]["Content-Type"] = "application/json"
                    if result["method"] == "GET":
                        result["method"] = "POST"
            
            # Cookies
            elif token in ("-b", "--cookie"):
                i += 1
                if i < len(tokens):
                    cookie_str = tokens[i]
                    for cookie in cookie_str.split(";"):
                        if "=" in cookie:
                            key, value = cookie.split("=", 1)
                            result["cookies"][key.strip()] = value.strip()
            
            # User agent
            elif token in ("-A", "--user-agent"):
                i += 1
                if i < len(tokens):
                    result["headers"]["User-Agent"] = tokens[i]
            
            # URL (no flag, or --url)
            elif token == "--url":
                i += 1
                if i < len(tokens):
                    result["url"] = tokens[i]
            elif not token.startswith("-") and not result["url"]:
                # Check if it looks like a URL
                if token.startswith("http://") or token.startswith("https://") or "." in token:
                    result["url"] = token
            
            i += 1
        
        if not result["url"]:
            raise CurlParseError("No URL found in cURL command")
        
        # Ensure URL has scheme
        if not result["url"].startswith("http"):
            result["url"] = "https://" + result["url"]
        
        return result
    
    except CurlParseError:
        raise
    except Exception as e:
        raise CurlParseError(f"Unexpected error parsing cURL: {e}")


def extract_pagination_params(url: str) -> Dict[str, Any]:
    """
    Extract pagination-related parameters from URL
    """
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    
    pagination_params = {}
    
    # Common pagination parameter names
    page_params = ["page", "p", "pageNumber", "page_number"]
    offset_params = ["offset", "skip", "start"]
    limit_params = ["limit", "size", "per_page", "pageSize", "page_size", "count"]
    cursor_params = ["cursor", "after", "next_token", "continuation", "token"]
    
    for param, values in query_params.items():
        param_lower = param.lower()
        if any(pp.lower() == param_lower for pp in page_params):
            pagination_params["page_param"] = param
            pagination_params["page_value"] = values[0] if values else None
        elif any(op.lower() == param_lower for op in offset_params):
            pagination_params["offset_param"] = param
            pagination_params["offset_value"] = values[0] if values else None
        elif any(lp.lower() == param_lower for lp in limit_params):
            pagination_params["limit_param"] = param
            pagination_params["limit_value"] = values[0] if values else None
        elif any(cp.lower() == param_lower for cp in cursor_params):
            pagination_params["cursor_param"] = param
            pagination_params["cursor_value"] = values[0] if values else None
    
    return pagination_params


def build_url_with_pagination(base_url: str, pagination_type: str, 
                              page: Optional[int] = None,
                              offset: Optional[int] = None,
                              cursor: Optional[str] = None,
                              limit: Optional[int] = None) -> str:
    """
    Build a new URL with updated pagination parameters
    """
    from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
    
    parsed = urlparse(base_url)
    query_params = parse_qs(parsed.query)
    
    # Flatten query params
    flat_params = {k: v[0] if v else "" for k, v in query_params.items()}
    
    # Extract known pagination param names
    pagination_info = extract_pagination_params(base_url)
    
    if pagination_type == "page_based" and page is not None:
        param_name = pagination_info.get("page_param", "page")
        flat_params[param_name] = str(page)
    
    elif pagination_type == "offset_based" and offset is not None:
        param_name = pagination_info.get("offset_param", "offset")
        flat_params[param_name] = str(offset)
    
    elif pagination_type == "cursor_based" and cursor is not None:
        param_name = pagination_info.get("cursor_param", "cursor")
        flat_params[param_name] = cursor
    
    if limit is not None and "limit_param" in pagination_info:
        flat_params[pagination_info["limit_param"]] = str(limit)
    
    # Rebuild URL
    new_query = urlencode(flat_params)
    new_parsed = parsed._replace(query=new_query)
    
    return urlunparse(new_parsed)
