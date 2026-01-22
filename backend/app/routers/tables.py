"""
Tables API Router
"""
from fastapi import APIRouter, HTTPException
from typing import List

from app.services.database import get_all_tables, get_table_info, get_table_data, table_exists


router = APIRouter()


@router.get("/")
async def list_tables():
    """
    List all crawled data tables
    """
    tables = await get_all_tables()
    return tables


@router.get("/{table_name}")
async def get_table(table_name: str):
    """
    Get information about a specific table
    """
    if not await table_exists(table_name):
        raise HTTPException(status_code=404, detail="Table not found")
    
    table_info = await get_table_info(table_name)
    return table_info


@router.get("/{table_name}/data")
async def get_data(table_name: str, limit: int = 100, offset: int = 0):
    """
    Get data from a table
    """
    if not await table_exists(table_name):
        raise HTTPException(status_code=404, detail="Table not found")
    
    data = await get_table_data(table_name, limit, offset)
    return {
        "table_name": table_name,
        "data": data,
        "limit": limit,
        "offset": offset,
        "count": len(data)
    }
