"""
Скрипт для поиска и удаления пользователей без фото
1. Находит всех пользователей без фото (photo1, photo2, photo3, photoUrl, photoBot все пустые)
2. Сохраняет список удаляемых пользователей в файл
3. Удаляет их из БД

Использование:
    python3 delete_users_without_photos.py          # с подтверждением
    python3 delete_users_without_photos.py --yes   # без подтверждения
"""
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent))

from db_utils import db_get, db_all, db_run
from database import init_database

BACKUP_FILE = "deleted_users_without_photos.json"

async def find_users_without_photos():
    """Найти всех пользователей без фото"""
    print("🔍 Ищу пользователей без фото...")
    
    # Ищем пользователей, у которых:
    # - нет photo1, photo2, photo3 (реальных загруженных фото)
    # - и photoUrl либо пустой, либо дефолтный Telegram userpic
    sql = """
        SELECT "userId", name, username, "photo1", "photo2", "photo3", "photoUrl", "photoBot", "createdAt"
        FROM users
        WHERE (
            ("photo1" IS NULL OR "photo1" = '' OR "photo1" = '/img/photo.svg')
            AND ("photo2" IS NULL OR "photo2" = '')
            AND ("photo3" IS NULL OR "photo3" = '')
            AND (
                "photoUrl" IS NULL 
                OR "photoUrl" = '' 
                OR "photoUrl" = '/img/photo.svg'
                OR "photoUrl" LIKE '/img/logo.svg'
                OR "photoUrl" LIKE '%photo.svg'
                OR "photoUrl" LIKE 'https://t.me/i/userpic/%'
            )
        )
    """
    
    # SQL запрос без параметров - используем прямой запрос
    from database import pg_pool
    from psycopg2.extras import RealDictCursor
    
    conn = pg_pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(sql)  # SQL уже адаптирован для PostgreSQL
        rows = cur.fetchall()
        rows = [dict(row) for row in rows]
    finally:
        pg_pool.putconn(conn)
    
    users = []
    for row in rows:
        users.append({
            "userId": row["userId"],
            "name": row.get("name", ""),
            "username": row.get("username", ""),
            "photo1": row.get("photo1", ""),
            "photo2": row.get("photo2", ""),
            "photo3": row.get("photo3", ""),
            "photoUrl": row.get("photoUrl", ""),
            "photoBot": row.get("photoBot", ""),
            "createdAt": str(row.get("createdAt", "")) if row.get("createdAt") else ""
        })
    
    print(f"✅ Найдено {len(users)} пользователей без фото")
    return users

async def save_backup(users):
    """Сохранить список пользователей для удаления"""
    backup_data = {
        "timestamp": datetime.now().isoformat(),
        "count": len(users),
        "users": users
    }
    
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Список сохранен в {BACKUP_FILE}")

async def delete_users(user_ids):
    """Удалить пользователей из БД"""
    if not user_ids:
        print("⚠️ Нет пользователей для удаления")
        return 0
    
    print(f"\n🗑️ Удаляю {len(user_ids)} пользователей...")
    
    deleted_count = 0
    for i, user_id in enumerate(user_ids, 1):
        try:
            # Удаляем пользователя
            await db_run('DELETE FROM users WHERE "userId" = ?', [user_id])
            deleted_count += 1
            if i % 10 == 0:
                print(f"  ✅ Удалено {i}/{len(user_ids)} пользователей...")
        except Exception as e:
            print(f"  ❌ Ошибка при удалении пользователя {user_id}: {e}")
    
    print(f"\n✅ Удалено {deleted_count} пользователей из {len(user_ids)}")
    return deleted_count

async def main():
    print("=" * 60)
    print("Скрипт для удаления пользователей без фото")
    print("=" * 60)
    
    # Инициализируем БД
    print("🔌 Подключаюсь к базе данных...")
    await init_database()
    print("✅ Подключение установлено\n")
    
    # 1. Находим пользователей без фото
    users_without_photos = await find_users_without_photos()
    
    if not users_without_photos:
        print("✅ Пользователей без фото не найдено")
        return
    
    # 2. Показываем список
    print(f"\n📋 Список пользователей без фото ({len(users_without_photos)}):")
    for i, user in enumerate(users_without_photos[:10], 1):  # Показываем первые 10
        print(f"  {i}. {user['name']} (userId: {user['userId']}, username: {user['username']})")
    if len(users_without_photos) > 10:
        print(f"  ... и еще {len(users_without_photos) - 10} пользователей")
    
    # 3. Сохраняем резервную копию
    await save_backup(users_without_photos)
    
    # 4. Подтверждение
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    
    if not auto_confirm:
        print(f"\n⚠️ ВНИМАНИЕ: Будет удалено {len(users_without_photos)} пользователей!")
        print("Для продолжения введите 'DELETE' (без кавычек): ", end='')
        confirmation = input().strip()
        
        if confirmation != 'DELETE':
            print("❌ Операция отменена")
            return
    else:
        print(f"\n⚠️ ВНИМАНИЕ: Будет удалено {len(users_without_photos)} пользователей!")
        print("⚠️ Автоматическое подтверждение (--yes)")
    
    # 5. Удаляем пользователей
    user_ids = [user["userId"] for user in users_without_photos]
    deleted_count = await delete_users(user_ids)
    
    print("\n" + "=" * 60)
    print("✅ Готово!")
    print(f"📁 Резервная копия: {BACKUP_FILE}")
    print(f"🗑️ Удалено пользователей: {deleted_count}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

