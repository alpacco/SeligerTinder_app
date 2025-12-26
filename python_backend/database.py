"""
database.py
Поддержка PostgreSQL для Python бэкенда
"""
from typing import Optional
import psycopg2  # type: ignore[reportMissingModuleSource]
from psycopg2 import pool  # type: ignore[reportMissingModuleSource]
from psycopg2.extras import RealDictCursor  # type: ignore[reportMissingModuleSource]
from config import (
    DATABASE_URL, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD,
    IMAGES_DIR, LOG_DIR
)

# PostgreSQL connection pool
pg_pool: Optional[pool.ThreadedConnectionPool] = None


async def init_postgres():
    """Инициализация PostgreSQL"""
    global pg_pool
    
    if DATABASE_URL:
        pg_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=DATABASE_URL
        )
    else:
        pg_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=PGHOST,
            port=PGPORT,
            database=PGDATABASE,
            user=PGUSER,
            password=PGPASSWORD
        )
    
    print("✅ Подключились к PostgreSQL БД")
    await create_postgres_tables()


async def create_postgres_tables():
    """Создание таблиц в PostgreSQL"""
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor()
        conn.autocommit = False
        
        # Таблица users
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                "userId" TEXT UNIQUE,
                name TEXT,
                username TEXT DEFAULT '',
                "photoUrl" TEXT DEFAULT '',
                gender TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                likes JSONB DEFAULT '[]'::jsonb,
                dislikes JSONB DEFAULT '[]'::jsonb,
                matches JSONB DEFAULT '[]'::jsonb,
                photo1 TEXT DEFAULT '',
                photo2 TEXT DEFAULT '',
                photo3 TEXT DEFAULT '',
                "photoBot" TEXT DEFAULT '',
                age INTEGER DEFAULT 0,
                blocked INTEGER DEFAULT 0,
                badge TEXT DEFAULT '',
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "needPhoto" INTEGER DEFAULT 0,
                goals JSONB DEFAULT '[]'::jsonb,
                about TEXT DEFAULT '',
                "lookingFor" TEXT DEFAULT '',
                warned INTEGER DEFAULT 0,
                "pushSent" INTEGER DEFAULT 0,
                is_pro INTEGER DEFAULT 0,
                pro_start TIMESTAMP WITH TIME ZONE,
                pro_end TIMESTAMP WITH TIME ZONE,
                "last_login" TIMESTAMP WITH TIME ZONE,
                super_likes_count INTEGER DEFAULT 0,
                "hideAge" INTEGER DEFAULT 0
            );
        """)
        
        # Добавляем колонку hideAge, если её нет (для существующих БД)
        try:
            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS "hideAge" INTEGER DEFAULT 0;
            """)
            print("✅ Колонка hideAge добавлена или уже существует")
        except Exception as e:
            print(f"⚠️ Ошибка при добавлении колонки hideAge (возможно, уже существует): {e}")
        
        # Таблица dislikes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS dislikes (
                id SERIAL PRIMARY KEY,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(from_user, to_user)
            );
        """)
        
        # Таблица super_likes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS super_likes (
                id SERIAL PRIMARY KEY,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                status TEXT NOT NULL,
                UNIQUE(from_user, to_user)
            );
        """)
        
        # Таблица visits
        cur.execute("""
            CREATE TABLE IF NOT EXISTS visits (
                id SERIAL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "visitorId" TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Таблица badge_requests
        cur.execute("""
            CREATE TABLE IF NOT EXISTS badge_requests (
                id SERIAL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                badge_type TEXT NOT NULL CHECK(badge_type IN ('L', 'P', 'S')),
                justification TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Таблица payments для Telegram Stars
        cur.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payload TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'XTR',
                telegram_charge_id TEXT UNIQUE,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'refunded')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                paid_at TIMESTAMP WITH TIME ZONE,
                refunded_at TIMESTAMP WITH TIME ZONE
            );
        """)
        
        # Индекс для быстрого поиска по payload (для идемпотентности)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_payload ON payments(payload);
        """)
        
        # Индекс для поиска по user_id
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
        """)
        
        conn.commit()
        print("✅ Все таблицы PostgreSQL созданы или уже существуют")
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка создания таблиц PostgreSQL: {e}")
        raise
    finally:
        pg_pool.putconn(conn)


async def get_db():
    """Получить подключение к БД (PostgreSQL)"""
    return pg_pool.getconn()


async def init_database():
    """Инициализация базы данных"""
    print("📊 Используется PostgreSQL")
    await init_postgres()


# Экспортируем константы
__all__ = [
    "IMAGES_DIR",
    "LOG_DIR",
    "pg_pool",
    "get_db",
    "init_database",
]
