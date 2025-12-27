"""
Скрипт для удаления пользователей с фото меньше 100кб
Проверяет размер файлов на диске и удаляет пользователей с маленькими фото
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db_utils import db_all, db_run
from database import init_database
from config import DATA_BASE_PATH

BACKUP_FILE = "deleted_users_small_photos.json"
MIN_PHOTO_SIZE = 100 * 1024  # 100 КБ в байтах

async def check_photo_size(photo_path):
    """Проверить размер файла фото"""
    if not photo_path or photo_path.startswith('http') or photo_path.startswith('https://t.me'):
        return None  # URL или Telegram userpic - не проверяем
    
    # Если это путь к файлу, проверяем размер
    if photo_path.startswith('/data/img/'):
        full_path = photo_path
    elif photo_path.startswith('/'):
        full_path = photo_path
    else:
        # Относительный путь
        full_path = os.path.join(DATA_BASE_PATH, photo_path.lstrip('/'))
    
    try:
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            return size
    except Exception as e:
        print(f"⚠️ Ошибка при проверке размера {full_path}: {e}")
    
    return None

async def find_users_with_small_photos():
    """Найти пользователей с фото меньше 100кб"""
    print("🔍 Ищу пользователей с фото меньше 100кб...")
    
    # Получаем всех пользователей
    users = await db_all('SELECT "userId", name, username, "photo1", "photo2", "photo3", "photoUrl" FROM users', [])
    
    users_to_delete = []
    
    for user in users:
        user_id = user["userId"]
        photo1 = user.get("photo1", "")
        photo2 = user.get("photo2", "")
        photo3 = user.get("photo3", "")
        photoUrl = user.get("photoUrl", "")
        
        # Проверяем все фото
        photos_to_check = [p for p in [photo1, photo2, photo3] if p and not p.startswith('http') and not p.startswith('https://t.me')]
        
        # Если нет реальных фото (только URL), пропускаем
        if not photos_to_check:
            # Проверяем, не все ли фото - SVG или Telegram userpic
            all_svg = (
                (not photo1 or photo1.endswith('.svg') or 'userpic' in photo1 or photo1 == '/img/photo.svg')
                and (not photo2 or photo2.endswith('.svg') or 'userpic' in photo2)
                and (not photo3 or photo3.endswith('.svg') or 'userpic' in photo3)
                and (not photoUrl or photoUrl.endswith('.svg') or 'userpic' in photoUrl or photoUrl == '/img/photo.svg')
            )
            if all_svg:
                users_to_delete.append({
                    "userId": user_id,
                    "name": user.get("name", ""),
                    "username": user.get("username", ""),
                    "reason": "all_photos_are_svg_or_url"
                })
            continue
        
        # Проверяем размер каждого фото
        all_small = True
        for photo in photos_to_check:
            size = await check_photo_size(photo)
            if size is None:
                # Не удалось проверить - пропускаем этот файл
                continue
            if size >= MIN_PHOTO_SIZE:
                all_small = False
                break
        
        # Если все фото маленькие (меньше 100кб), добавляем в список на удаление
        if all_small and photos_to_check:
            users_to_delete.append({
                "userId": user_id,
                "name": user.get("name", ""),
                "username": user.get("username", ""),
                "reason": "all_photos_smaller_than_100kb",
                "photos": photos_to_check
            })
    
    print(f"✅ Найдено {len(users_to_delete)} пользователей с маленькими фото")
    return users_to_delete

async def save_backup(users):
    """Сохранить список пользователей для удаления"""
    backup_data = {
        "timestamp": datetime.now().isoformat(),
        "min_photo_size_kb": 100,
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
    print("Скрипт для удаления пользователей с фото меньше 100кб")
    print("=" * 60)
    
    await init_database()
    
    users_to_delete = await find_users_with_small_photos()
    
    if not users_to_delete:
        print("✅ Пользователей с маленькими фото не найдено")
        return
    
    await save_backup(users_to_delete)
    
    print(f"\n⚠️ ВНИМАНИЕ: Будет удалено {len(users_to_delete)} пользователей!")
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    
    if not auto_confirm:
        print("Для продолжения введите 'DELETE' (без кавычек): ", end='')
        confirmation = input().strip()
        if confirmation != 'DELETE':
            print("❌ Операция отменена")
            return
    else:
        print("⚠️ Автоматическое подтверждение (--yes)")
    
    user_ids = [user["userId"] for user in users_to_delete]
    deleted_count = await delete_users(user_ids)
    
    print("\n" + "=" * 60)
    print("✅ Готово!")
    print(f"📁 Резервная копия: {BACKUP_FILE}")
    print(f"🗑️ Удалено пользователей: {deleted_count}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

