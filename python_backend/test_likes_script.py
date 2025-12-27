"""
Скрипт для работы с лайками пользователя 307954967
1. Получает текущие лайки
2. Сохраняет их в файл
3. Добавляет тестовые данные (50% пользователей лайкают)
4. Сохраняет информацию для отката
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent))

from db_utils import db_get, db_all, db_run
from database import init_database

TARGET_USER_ID = "307954967"
BACKUP_FILE = "likes_backup_307954967.json"
ROLLBACK_FILE = "likes_rollback_307954967.sql"

async def get_current_likes(user_id: str):
    """Получить текущие лайки для пользователя"""
    print(f"🔍 Получаю текущие лайки для пользователя {user_id}...")
    
    # Получаем всех пользователей, которые лайкнули этого пользователя
    sql = """
        SELECT "userId", name, username
        FROM users
        WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(likes::jsonb) AS elem
            WHERE elem = ?
        )
    """
    rows = await db_all(sql, [user_id])
    
    liked_by = [{"userId": row["userId"], "name": row.get("name", ""), "username": row.get("username", "")} for row in rows]
    
    print(f"✅ Найдено {len(liked_by)} пользователей, которые лайкнули {user_id}")
    return liked_by

async def get_all_users():
    """Получить всех пользователей (кроме целевого)"""
    print("🔍 Получаю список всех пользователей...")
    sql = """
        SELECT "userId", name, username, gender
        FROM users
        WHERE "userId" != ?
        AND gender IS NOT NULL
        AND gender != ''
    """
    rows = await db_all(sql, [TARGET_USER_ID])
    users = [{"userId": row["userId"], "name": row.get("name", ""), "username": row.get("username", ""), "gender": row.get("gender", "")} for row in rows]
    print(f"✅ Найдено {len(users)} пользователей")
    return users

async def get_user_likes(user_id: str):
    """Получить список лайков пользователя (кого он лайкнул)"""
    user_row = await db_get('SELECT likes FROM users WHERE "userId" = ?', [user_id])
    if not user_row:
        return []
    
    import json
    likes_str = user_row.get("likes", "[]")
    if isinstance(likes_str, str):
        likes = json.loads(likes_str)
    else:
        likes = likes_str if isinstance(likes_str, list) else []
    
    return likes

async def add_like_to_user(from_user_id: str, to_user_id: str):
    """Добавить лайк от одного пользователя другому"""
    # Получаем текущие лайки
    user_row = await db_get('SELECT likes FROM users WHERE "userId" = ?', [from_user_id])
    if not user_row:
        print(f"⚠️ Пользователь {from_user_id} не найден")
        return False
    
    import json
    likes_str = user_row.get("likes", "[]")
    if isinstance(likes_str, str):
        likes = json.loads(likes_str)
    else:
        likes = likes_str if isinstance(likes_str, list) else []
    
    # Добавляем лайк, если его еще нет
    if to_user_id not in likes:
        likes.append(to_user_id)
        await db_run('UPDATE users SET likes = ? WHERE "userId" = ?', [json.dumps(likes), from_user_id])
        return True
    
    return False

async def save_backup(liked_by_users):
    """Сохранить текущее состояние в файл"""
    backup_data = {
        "timestamp": datetime.now().isoformat(),
        "target_user_id": TARGET_USER_ID,
        "liked_by": liked_by_users
    }
    
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Резервная копия сохранена в {BACKUP_FILE}")

async def create_rollback_script(users_to_add_likes):
    """Создать SQL скрипт для отката изменений"""
    rollback_commands = []
    rollback_commands.append(f"-- Rollback script for user {TARGET_USER_ID}")
    rollback_commands.append(f"-- Generated at {datetime.now().isoformat()}")
    rollback_commands.append(f"-- This script removes test likes added to user {TARGET_USER_ID}")
    rollback_commands.append("")
    
    for user_id in users_to_add_likes:
        # Получаем текущие лайки пользователя
        user_row = await db_get('SELECT likes FROM users WHERE "userId" = ?', [user_id])
        if user_row:
            import json
            likes_str = user_row.get("likes", "[]")
            if isinstance(likes_str, str):
                likes = json.loads(likes_str)
            else:
                likes = likes_str if isinstance(likes_str, list) else []
            
            # Удаляем TARGET_USER_ID из лайков
            if TARGET_USER_ID in likes:
                likes.remove(TARGET_USER_ID)
                likes_json = json.dumps(likes).replace("'", "''")  # Экранируем кавычки для SQL
                rollback_commands.append(f"UPDATE users SET likes = '{likes_json}' WHERE \"userId\" = '{user_id}';")
    
    with open(ROLLBACK_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(rollback_commands))
    
    print(f"✅ Скрипт отката сохранен в {ROLLBACK_FILE}")

async def main():
    print("=" * 60)
    print("Скрипт для работы с лайками пользователя 307954967")
    print("=" * 60)
    
    # Инициализируем БД
    print("🔌 Подключаюсь к базе данных...")
    await init_database()
    print("✅ Подключение установлено")
    
    # 1. Получаем текущие лайки
    current_likes = await get_current_likes(TARGET_USER_ID)
    
    # 2. Сохраняем резервную копию
    await save_backup(current_likes)
    
    # 3. Получаем всех пользователей
    all_users = await get_all_users()
    
    if not all_users:
        print("❌ Не найдено пользователей для теста")
        return
    
    # 4. Выбираем 50% пользователей для добавления лайков
    import random
    random.seed(42)  # Для воспроизводимости
    users_to_like = random.sample(all_users, len(all_users) // 2)
    
    print(f"\n📊 Добавляю лайки от {len(users_to_like)} пользователей...")
    
    users_added = []
    for i, user in enumerate(users_to_like, 1):
        user_id = user["userId"]
        # Проверяем, не лайкнул ли уже этот пользователь
        user_likes = await get_user_likes(user_id)
        if TARGET_USER_ID not in user_likes:
            success = await add_like_to_user(user_id, TARGET_USER_ID)
            if success:
                users_added.append(user_id)
                if i % 10 == 0:
                    print(f"  ✅ Обработано {i}/{len(users_to_like)} пользователей...")
        else:
            print(f"  ⚠️ Пользователь {user_id} уже лайкнул {TARGET_USER_ID}")
    
    print(f"\n✅ Добавлено лайков от {len(users_added)} пользователей")
    
    # 5. Создаем скрипт отката
    await create_rollback_script(users_added)
    
    # 6. Проверяем результат
    final_likes = await get_current_likes(TARGET_USER_ID)
    print(f"\n📊 Итого лайков после изменений: {len(final_likes)}")
    
    print("\n" + "=" * 60)
    print("✅ Готово!")
    print(f"📁 Резервная копия: {BACKUP_FILE}")
    print(f"📁 Скрипт отката: {ROLLBACK_FILE}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

