"""
Database service for managing connections and dynamic table creation
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, inspect
from typing import Dict, Any, List, Optional
import json

from app.models.database import Base

# SQLite database
DATABASE_URL = "sqlite+aiosqlite:///./api_crawler.db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Initialize the database and create tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """Get a database session"""
    async with async_session() as session:
        yield session


def python_type_to_sql(value: Any) -> str:
    """Convert Python type to SQLite type"""
    if value is None:
        return "TEXT"
    elif isinstance(value, bool):
        return "INTEGER"  # SQLite stores bools as int
    elif isinstance(value, int):
        return "INTEGER"
    elif isinstance(value, float):
        return "REAL"
    elif isinstance(value, (dict, list)):
        return "TEXT"  # Store as JSON string
    else:
        return "TEXT"


def infer_schema_from_data(data: Any) -> Dict[str, str]:
    """
    Infer database schema from API response data
    Returns a dict of column_name: sql_type
    """
    schema = {}
    
    # Handle list of objects (most common API response)
    if isinstance(data, list) and len(data) > 0:
        sample = data[0]
        if isinstance(sample, dict):
            for key, value in sample.items():
                schema[key] = python_type_to_sql(value)
    # Handle single object
    elif isinstance(data, dict):
        # Check for common wrapper patterns
        for wrapper_key in ['data', 'results', 'items', 'records']:
            if wrapper_key in data and isinstance(data[wrapper_key], list):
                return infer_schema_from_data(data[wrapper_key])
        
        # Treat as single record
        for key, value in data.items():
            if not isinstance(value, (dict, list)):
                schema[key] = python_type_to_sql(value)
            else:
                schema[key] = "TEXT"  # Store complex types as JSON
    
    return schema


async def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database"""
    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": table_name}
        )
        return result.fetchone() is not None


async def create_dynamic_table(table_name: str, schema: Dict[str, str]) -> bool:
    """
    Create a table dynamically based on inferred schema
    """
    if await table_exists(table_name):
        return False  # Table already exists
    
    # Build CREATE TABLE statement
    columns = ["_id INTEGER PRIMARY KEY AUTOINCREMENT", "_crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP"]
    for col_name, col_type in schema.items():
        # Sanitize column name
        safe_col_name = col_name.replace(" ", "_").replace("-", "_")
        columns.append(f'"{safe_col_name}" {col_type}')
    
    create_sql = f'CREATE TABLE "{table_name}" ({", ".join(columns)})'
    
    async with engine.begin() as conn:
        await conn.execute(text(create_sql))
    
    return True


async def insert_records(table_name: str, records: List[Dict[str, Any]]) -> int:
    """
    Insert records into a dynamic table
    Returns the number of records inserted
    """
    if not records:
        return 0
    
    async with async_session() as session:
        count = 0
        for record in records:
            # Prepare data - convert complex types to JSON strings
            processed = {}
            for key, value in record.items():
                safe_key = key.replace(" ", "_").replace("-", "_")
                if isinstance(value, (dict, list)):
                    processed[safe_key] = json.dumps(value)
                else:
                    processed[safe_key] = value
            
            # Build INSERT statement
            columns = ", ".join([f'"{k}"' for k in processed.keys()])
            placeholders = ", ".join([f":{k}" for k in processed.keys()])
            
            insert_sql = f'INSERT INTO "{table_name}" ({columns}) VALUES ({placeholders})'
            
            try:
                await session.execute(text(insert_sql), processed)
                count += 1
            except Exception as e:
                print(f"Error inserting record: {e}")
                continue
        
        await session.commit()
        return count


async def get_table_info(table_name: str) -> Optional[Dict[str, Any]]:
    """Get information about a table"""
    if not await table_exists(table_name):
        return None
    
    async with async_session() as session:
        # Get columns
        result = await session.execute(text(f'PRAGMA table_info("{table_name}")'))
        columns = [{"name": row[1], "type": row[2]} for row in result.fetchall()]
        
        # Get row count
        result = await session.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
        row_count = result.scalar()
        
        return {
            "name": table_name,
            "columns": columns,
            "row_count": row_count
        }


async def get_all_tables() -> List[Dict[str, Any]]:
    """Get information about all dynamic tables"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('crawl_jobs', 'notifications', 'sqlite_sequence')")
        )
        tables = []
        for row in result.fetchall():
            table_info = await get_table_info(row[0])
            if table_info:
                tables.append(table_info)
        return tables


async def get_table_data(table_name: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """Get data from a table"""
    if not await table_exists(table_name):
        return []
    
    async with async_session() as session:
        result = await session.execute(
            text(f'SELECT * FROM "{table_name}" LIMIT :limit OFFSET :offset'),
            {"limit": limit, "offset": offset}
        )
        rows = result.fetchall()
        columns = result.keys()
        return [dict(zip(columns, row)) for row in rows]
