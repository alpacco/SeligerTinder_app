"""
db_utils.py
Утилиты для работы с базой данных (PostgreSQL)
"""
import json
import re
from typing import Any, Optional, List, Dict, Tuple
from database import pg_pool
from psycopg2.extras import RealDictCursor


def safe_json_parse(value: Any, default: Any = None) -> Any:
    """Безопасный парсинг JSON"""
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default
    return default


def adapt_sql_for_postgres(sql: str, params: List[Any]) -> Tuple[str, List[Any]]:
    """
    Адаптирует SQL запрос для PostgreSQL:
    - Заменяет ? на $1, $2, $3...
    - Обрабатывает INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
    - Добавляет кавычки к camelCase идентификаторам
    """
    adapted_sql = sql
    param_index = 1
    
    # Заменяем ? на $1, $2, $3...
    while '?' in adapted_sql:
        adapted_sql = adapted_sql.replace('?', f'${param_index}', 1)
        param_index += 1
    
    # Обрабатываем INSERT OR IGNORE
    if 'INSERT OR IGNORE' in adapted_sql.upper():
        match = re.search(r'INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)', adapted_sql, re.IGNORECASE)
        if match:
            table = match.group(1)
            columns = [c.strip() for c in match.group(2).split(',')]
            unique_col = next((c for c in columns if 'userid' in c.lower()), columns[0])
            
            # Убираем кавычки из unique_col если есть
            unique_col = unique_col.strip('"')
            
            adapted_sql = re.sub(
                r'INSERT\s+OR\s+IGNORE\s+INTO',
                'INSERT INTO',
                adapted_sql,
                flags=re.IGNORECASE
            )
            
            # Находим позицию VALUES и добавляем ON CONFLICT после него
            values_match = re.search(r'VALUES\s*\([^)]+\)', adapted_sql, re.IGNORECASE)
            if values_match:
                values_end = values_match.end()
                adapted_sql = (
                    adapted_sql[:values_end] +
                    f' ON CONFLICT ("{unique_col}") DO NOTHING' +
                    adapted_sql[values_end:]
                )
    
    # Добавляем кавычки к camelCase идентификаторам
    camel_case_fields = [
        'userId', 'photoUrl', 'createdAt', 'needPhoto', 'is_pro', 'pro_end', 'pro_start',
        'last_login', 'pushSent', 'super_likes_count', 'lookingFor', 'photoBot'
    ]
    for field in camel_case_fields:
        pattern = rf'\b{field}\b'
        adapted_sql = re.sub(pattern, f'"{field}"', adapted_sql)
    
    return adapted_sql, params


async def db_get(sql: str, params: List[Any] = None) -> Optional[Dict[str, Any]]:
    """Выполнить SELECT запрос и вернуть одну строку"""
    if params is None:
        params = []
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(adapted_sql, adapted_params)
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        pg_pool.putconn(conn)


async def db_all(sql: str, params: List[Any] = None) -> List[Dict[str, Any]]:
    """Выполнить SELECT запрос и вернуть все строки"""
    if params is None:
        params = []
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(adapted_sql, adapted_params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        pg_pool.putconn(conn)


async def db_run(sql: str, params: List[Any] = None) -> Dict[str, Any]:
    """Выполнить INSERT/UPDATE/DELETE запрос"""
    if params is None:
        params = []
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(adapted_sql, adapted_params)
        conn.commit()
        return {"lastID": cur.lastrowid if hasattr(cur, 'lastrowid') else None, "changes": cur.rowcount}
    except Exception as e:
        conn.rollback()
        raise
    finally:
        pg_pool.putconn(conn)


async def db_transaction(operations: List[Tuple[str, List[Any]]]) -> None:
    """Выполнить несколько операций в транзакции"""
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        for sql, params in operations:
            adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
            cur.execute(adapted_sql, adapted_params)
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        pg_pool.putconn(conn)
