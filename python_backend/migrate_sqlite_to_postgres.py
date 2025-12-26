#!/usr/bin/env python3
"""
Скрипт для миграции данных из SQLite в PostgreSQL
"""
import sqlite3
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
import json
from datetime import datetime

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent))

from database import init_postgres
from db_utils import get_pg_pool
import asyncio
from config import DATABASE_URL, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD


def read_sqlite_users(sqlite_path: str) -> list[Dict[str, Any]]:
    """Читает всех пользователей из SQLite"""
    if not os.path.exists(sqlite_path):
        print(f"❌ SQLite файл не найден: {sqlite_path}")
        return []
    
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM users")
        rows = cursor.fetchall()
        users = []
        for row in rows:
            user_dict = dict(row)
            # Преобразуем JSON строки в объекты Python
            for json_field in ['likes', 'dislikes', 'matches', 'goals']:
                if json_field in user_dict and user_dict[json_field]:
                    try:
                        if isinstance(user_dict[json_field], str):
                            user_dict[json_field] = json.loads(user_dict[json_field])
                        elif not isinstance(user_dict[json_field], (list, dict)):
                            user_dict[json_field] = []
                    except (json.JSONDecodeError, TypeError):
                        user_dict[json_field] = []
                else:
                    user_dict[json_field] = []
            
            users.append(user_dict)
        
        print(f"✅ Прочитано {len(users)} пользователей из SQLite")
        return users
    except Exception as e:
        print(f"❌ Ошибка чтения SQLite: {e}")
        return []
    finally:
        conn.close()


async def insert_user_to_postgres(user: Dict[str, Any]) -> bool:
    """Вставляет пользователя в PostgreSQL"""
    pg_pool = get_pg_pool()
    if not pg_pool:
        print("❌ PostgreSQL pool не инициализирован")
        return False
    
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        
        # Проверяем, существует ли пользователь
        cur.execute('SELECT "userId" FROM users WHERE "userId" = %s', (user.get('userId'),))
        exists = cur.fetchone()
        
        if exists:
            print(f"⏭️  Пользователь {user.get('userId')} уже существует, пропускаем")
            return True
        
        # Подготавливаем данные
        user_id = user.get('userId')
        name = user.get('name', '')
        username = user.get('username', '')
        photo_url = user.get('photoUrl', '')
        gender = user.get('gender', '')
        bio = user.get('bio', '')
        age = user.get('age', 0)
        blocked = user.get('blocked', 0)
        badge = user.get('badge', '')
        need_photo = user.get('needPhoto', 0)
        about = user.get('about', '')
        looking_for = user.get('lookingFor', '')
        warned = user.get('warned', 0)
        push_sent = user.get('pushSent', 0)
        is_pro = user.get('is_pro', 0)
        super_likes_count = user.get('super_likes_count', 0)
        hide_age = user.get('hideAge', 0)
        
        photo1 = user.get('photo1', '')
        photo2 = user.get('photo2', '')
        photo3 = user.get('photo3', '')
        photo_bot = user.get('photoBot', '')
        
        # JSON поля
        likes = json.dumps(user.get('likes', []))
        dislikes = json.dumps(user.get('dislikes', []))
        matches = json.dumps(user.get('matches', []))
        goals = json.dumps(user.get('goals', []))
        
        # Даты
        pro_start = user.get('pro_start')
        pro_end = user.get('pro_end')
        last_login = user.get('last_login')
        created_at = user.get('createdAt')
        
        # Преобразуем даты
        def parse_date(date_val):
            if not date_val:
                return None
            if isinstance(date_val, str):
                try:
                    # Пробуем разные форматы
                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d']:
                        try:
                            return datetime.strptime(date_val, fmt)
                        except ValueError:
                            continue
                    return None
                except:
                    return None
            return date_val
        
        pro_start = parse_date(pro_start)
        pro_end = parse_date(pro_end)
        last_login = parse_date(last_login)
        created_at = parse_date(created_at) or datetime.now()
        
        # Вставляем пользователя
        # Примечание: в реальной таблице колонки называются lastLogin и superLikesCount
        insert_sql = """
            INSERT INTO users (
                "userId", name, username, "photoUrl", gender, bio, age, blocked, badge,
                "needPhoto", about, "lookingFor", warned, "pushSent", is_pro,
                pro_start, pro_end, "lastLogin", "superLikesCount", "hideAge",
                photo1, photo2, photo3, "photoBot", likes, dislikes, matches, goals,
                "createdAt"
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s
            )
        """
        
        cur.execute(insert_sql, (
            user_id, name, username, photo_url, gender, bio, age, blocked, badge,
            need_photo, about, looking_for, warned, push_sent, is_pro,
            pro_start, pro_end, last_login, super_likes_count, hide_age,
            photo1, photo2, photo3, photo_bot, likes, dislikes, matches, goals,
            created_at
        ))
        
        conn.commit()
        print(f"✅ Пользователь {user_id} ({name}) добавлен в PostgreSQL")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка вставки пользователя {user.get('userId')}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        pg_pool.putconn(conn)


async def migrate_users():
    """Основная функция миграции"""
    print("=" * 70)
    print("🔄 МИГРАЦИЯ ДАННЫХ ИЗ SQLITE В POSTGRESQL")
    print("=" * 70)
    
    # Путь к SQLite файлу
    sqlite_path = Path(__file__).parent.parent / "data" / "tinder.db"
    
    if not sqlite_path.exists():
        print(f"❌ SQLite файл не найден: {sqlite_path}")
        return False
    
    # Инициализируем PostgreSQL
    print("\n📊 Инициализация PostgreSQL...")
    await init_postgres()
    print("✅ PostgreSQL инициализирован")
    
    # Читаем пользователей из SQLite
    print(f"\n📖 Чтение пользователей из SQLite: {sqlite_path}")
    users = read_sqlite_users(str(sqlite_path))
    
    if not users:
        print("❌ Не удалось прочитать пользователей из SQLite")
        return False
    
    # Вставляем пользователей в PostgreSQL
    print(f"\n💾 Вставка {len(users)} пользователей в PostgreSQL...")
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for i, user in enumerate(users, 1):
        print(f"\n[{i}/{len(users)}] Обработка пользователя {user.get('userId')}...")
        result = await insert_user_to_postgres(user)
        if result:
            success_count += 1
        else:
            # Проверяем, был ли это пропуск существующего пользователя
            pg_pool = get_pg_pool()
            if pg_pool:
                conn = pg_pool.getconn()
                try:
                    cur = conn.cursor()
                    cur.execute('SELECT "userId" FROM users WHERE "userId" = %s', (user.get('userId'),))
                    if cur.fetchone():
                        skip_count += 1
                        success_count -= 1
                    else:
                        error_count += 1
                finally:
                    pg_pool.putconn(conn)
            else:
                error_count += 1
    
    print("\n" + "=" * 70)
    print("📊 РЕЗУЛЬТАТЫ МИГРАЦИИ")
    print("=" * 70)
    print(f"✅ Успешно добавлено: {success_count}")
    print(f"⏭️  Пропущено (уже существуют): {skip_count}")
    print(f"❌ Ошибок: {error_count}")
    print(f"📦 Всего обработано: {len(users)}")
    print("=" * 70)
    
    return error_count == 0


if __name__ == "__main__":
    asyncio.run(migrate_users())

