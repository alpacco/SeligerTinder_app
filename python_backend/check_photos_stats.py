"""
Скрипт для проверки статистики по фото пользователей
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db_utils import db_all
from database import init_database

async def check_photos_stats():
    """Проверить статистику по фото"""
    print("🔍 Проверяю статистику по фото...\n")
    
    # Общее количество пользователей
    total = await db_all('SELECT COUNT(*) as count FROM users', [])
    total_count = total[0]['count'] if total else 0
    print(f"📊 Всего пользователей: {total_count}\n")
    
    # Пользователи без photo1, photo2, photo3
    no_photos = await db_all("""
        SELECT COUNT(*) as count
        FROM users
        WHERE (
            ("photo1" IS NULL OR "photo1" = '' OR "photo1" = '/img/photo.svg')
            AND ("photo2" IS NULL OR "photo2" = '')
            AND ("photo3" IS NULL OR "photo3" = '')
        )
    """, [])
    no_photos_count = no_photos[0]['count'] if no_photos else 0
    print(f"📊 Пользователей без photo1, photo2, photo3: {no_photos_count}")
    
    # Пользователи только с photoUrl
    only_photourl = await db_all("""
        SELECT COUNT(*) as count
        FROM users
        WHERE (
            ("photo1" IS NULL OR "photo1" = '' OR "photo1" = '/img/photo.svg')
            AND ("photo2" IS NULL OR "photo2" = '')
            AND ("photo3" IS NULL OR "photo3" = '')
            AND ("photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != '/img/photo.svg')
        )
    """, [])
    only_photourl_count = only_photourl[0]['count'] if only_photourl else 0
    print(f"📊 Пользователей только с photoUrl (без photo1-3): {only_photourl_count}")
    
    # Пользователи полностью без фото
    completely_no_photos = await db_all("""
        SELECT COUNT(*) as count
        FROM users
        WHERE (
            ("photo1" IS NULL OR "photo1" = '' OR "photo1" = '/img/photo.svg')
            AND ("photo2" IS NULL OR "photo2" = '')
            AND ("photo3" IS NULL OR "photo3" = '')
            AND ("photoUrl" IS NULL OR "photoUrl" = '' OR "photoUrl" = '/img/photo.svg')
            AND ("photoBot" IS NULL OR "photoBot" = '')
        )
    """, [])
    completely_no_photos_count = completely_no_photos[0]['count'] if completely_no_photos else 0
    print(f"📊 Пользователей полностью без фото: {completely_no_photos_count}")
    
    # Показываем примеры пользователей без фото
    if completely_no_photos_count > 0:
        examples = await db_all("""
            SELECT "userId", name, username, "photo1", "photo2", "photo3", "photoUrl", "photoBot"
            FROM users
            WHERE (
                ("photo1" IS NULL OR "photo1" = '' OR "photo1" = '/img/photo.svg')
                AND ("photo2" IS NULL OR "photo2" = '')
                AND ("photo3" IS NULL OR "photo3" = '')
                AND ("photoUrl" IS NULL OR "photoUrl" = '' OR "photoUrl" = '/img/photo.svg')
                AND ("photoBot" IS NULL OR "photoBot" = '')
            )
            LIMIT 10
        """, [])
        
        print(f"\n📋 Примеры пользователей без фото (первые 10):")
        for i, user in enumerate(examples, 1):
            print(f"  {i}. userId: {user['userId']}, name: {user.get('name', 'N/A')}, username: {user.get('username', 'N/A')}")

async def main():
    print("=" * 60)
    print("Проверка статистики по фото пользователей")
    print("=" * 60)
    
    await init_database()
    await check_photos_stats()
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

