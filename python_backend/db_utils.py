"""
db_utils.py
Утилиты для работы с базой данных (PostgreSQL)
"""
import json
import re
from typing import Any, Optional, List, Dict, Tuple
from psycopg2.extras import RealDictCursor


def get_pg_pool():
    """Получить pg_pool динамически (чтобы избежать проблем с импортом)"""
    from database import pg_pool
    if pg_pool is None:
        raise RuntimeError("pg_pool не инициализирован! Убедитесь, что init_database() вызван.")
    return pg_pool


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
    Адаптирует SQL запрос для PostgreSQL через psycopg2:
    - Заменяет ? на %s (psycopg2 использует %s, а не $1, $2...)
    - Обрабатывает INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
    - Добавляет кавычки к camelCase идентификаторам
    
    ВАЖНО: psycopg2 использует %s для параметров, а не $1, $2...
    Это стандартная практика для psycopg2!
    """
    adapted_sql = sql
    
    # Заменяем ? на %s (psycopg2 использует %s для параметров)
    # ВАЖНО: заменяем все ? на %s, psycopg2 сам обработает порядок параметров
    adapted_sql = adapted_sql.replace('?', '%s')
    
    # Подсчитываем количество параметров для проверки
    param_count = adapted_sql.count('%s')
    
    # Проверяем, что количество параметров совпадает
    if len(params) != param_count:
        raise ValueError(
            f"Несоответствие количества параметров: SQL требует {param_count} (%s), "
            f"передано {len(params)}. SQL: {sql}, adapted_sql: {adapted_sql}, params: {params}"
        )
    
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
    
    # Добавляем кавычки к camelCase идентификаторам (только если их еще нет)
    # ВАЖНО: делаем это ПОСЛЕ замены ? на %s, чтобы не затронуть параметры
    camel_case_fields = [
        'userId', 'photoUrl', 'createdAt', 'needPhoto', 'is_pro', 'pro_end', 'pro_start',
        'last_login', 'pushSent', 'super_likes_count', 'lookingFor', 'photoBot'
    ]
    for field in camel_case_fields:
        # Ищем поле, которое НЕ уже в кавычках
        # Используем word boundary (\b) для точного совпадения
        # Паттерн: поле должно быть отдельным словом, не в кавычках
        # (?<!") - перед полем нет кавычки
        # \b - граница слова (важно для точного совпадения)
        # {field} - само поле
        # \b - граница слова
        # (?!") - после поля нет кавычки
        pattern = rf'(?<!\")\b{re.escape(field)}\b(?!\")'
        # Заменяем только незакавыченные вхождения
        adapted_sql = re.sub(pattern, f'"{field}"', adapted_sql)
    
    return adapted_sql, params


async def db_get(sql: str, params: List[Any] = None) -> Optional[Dict[str, Any]]:
    """Выполнить SELECT запрос и вернуть одну строку"""
    if params is None:
        params = []
    
    # Логируем для отладки
    print(f"[db_get] SQL: {sql}, params: {params}")
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    print(f"[db_get] Adapted SQL: {adapted_sql}, adapted_params: {adapted_params}")
    
    pg_pool = get_pg_pool()
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Детальное логирование перед выполнением
        print(f"[db_get] ПЕРЕД execute:")
        print(f"  - adapted_sql (repr): {repr(adapted_sql)}")
        print(f"  - adapted_sql (str): {adapted_sql}")
        print(f"  - adapted_params: {adapted_params}")
        print(f"  - type(adapted_params): {type(adapted_params)}")
        print(f"  - len(adapted_params): {len(adapted_params) if adapted_params else 0}")
        print(f"  - '$1' in adapted_sql: {'$1' in adapted_sql}")
        print(f"  - adapted_sql.count('$1'): {adapted_sql.count('$1')}")
        
        # psycopg2 принимает параметры как список или кортеж
        # Пробуем передать как кортеж (может быть проблема в RealDictCursor)
        if adapted_params:
            # Преобразуем список в кортеж для psycopg2
            params_tuple = tuple(adapted_params)
            print(f"  - params_tuple: {params_tuple}")
            print(f"  - type(params_tuple): {type(params_tuple)}")
            cur.execute(adapted_sql, params_tuple)
        else:
            cur.execute(adapted_sql)
        row = cur.fetchone()
        return dict(row) if row else None
    except Exception as e:
        print(f"[db_get] Ошибка выполнения SQL: {e}")
        print(f"[db_get] SQL (repr): {repr(adapted_sql)}")
        print(f"[db_get] SQL (str): {adapted_sql}")
        print(f"[db_get] Params: {adapted_params}")
        print(f"[db_get] Type of params: {type(adapted_params)}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        pg_pool.putconn(conn)


async def db_all(sql: str, params: List[Any] = None) -> List[Dict[str, Any]]:
    """Выполнить SELECT запрос и вернуть все строки"""
    if params is None:
        params = []
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    pg_pool = get_pg_pool()
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
    
    # Логируем для отладки
    print(f"[db_run] SQL: {sql}, params: {params}")
    
    adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
    print(f"[db_run] Adapted SQL: {adapted_sql}, adapted_params: {adapted_params}")
    
    pg_pool = get_pg_pool()
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        # psycopg2 принимает параметры как список или кортеж
        if adapted_params:
            cur.execute(adapted_sql, adapted_params)
        else:
            cur.execute(adapted_sql)
        conn.commit()
        return {"lastID": cur.lastrowid if hasattr(cur, 'lastrowid') else None, "changes": cur.rowcount}
    except Exception as e:
        conn.rollback()
        print(f"[db_run] Ошибка выполнения SQL: {e}")
        print(f"[db_run] SQL: {adapted_sql}")
        print(f"[db_run] Params: {adapted_params}")
        raise
    finally:
        pg_pool.putconn(conn)


async def db_transaction(operations: List[Tuple[str, List[Any]]]) -> None:
    """Выполнить несколько операций в транзакции"""
    pg_pool = get_pg_pool()
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        for sql, params in operations:
            adapted_sql, adapted_params = adapt_sql_for_postgres(sql, params)
            # psycopg2 принимает параметры как список или кортеж
            if adapted_params:
                cur.execute(adapted_sql, adapted_params)
            else:
                cur.execute(adapted_sql)
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        pg_pool.putconn(conn)
