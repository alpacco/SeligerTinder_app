"""
Скрипт для проверки статистики по полу пользователей в БД
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db_utils import db_get, db_all
from database import init_database

async def check_gender_stats():
    """Проверить статистику по полу"""
    print("=" * 60)
    print("🔍 Проверка статистики по полу пользователей\n")
    
    # Общее количество пользователей
    total_row = await db_get("SELECT COUNT(*) AS count FROM users")
    total_users = total_row.get("count", 0) if total_row else 0
    print(f"👥 Всего пользователей в БД: {total_users}\n")
    
    # Мужчины
    male_row = await db_get('SELECT COUNT(*) AS count FROM users WHERE gender = ?', ["male"])
    male_count = male_row.get("count", 0) if male_row else 0
    print(f"👨 Мужчины (gender = 'male'): {male_count}")
    
    # Женщины
    female_row = await db_get('SELECT COUNT(*) AS count FROM users WHERE gender = ?', ["female"])
    female_count = female_row.get("count", 0) if female_row else 0
    print(f"👩 Женщины (gender = 'female'): {female_count}")
    
    # NULL значения
    null_row = await db_get('SELECT COUNT(*) AS count FROM users WHERE gender IS NULL')
    null_count = null_row.get("count", 0) if null_row else 0
    print(f"❓ NULL (gender IS NULL): {null_count}")
    
    # Пустые строки
    empty_row = await db_get("SELECT COUNT(*) AS count FROM users WHERE gender = ''")
    empty_count = empty_row.get("count", 0) if empty_row else 0
    print(f"❓ Пустые строки (gender = ''): {empty_count}")
    
    # Другие значения
    other_row = await db_get("""
        SELECT COUNT(*) AS count 
        FROM users 
        WHERE gender IS NOT NULL 
        AND gender != '' 
        AND gender != 'male' 
        AND gender != 'female'
    """)
    other_count = other_row.get("count", 0) if other_row else 0
    print(f"❓ Другие значения: {other_count}")
    
    # Показываем примеры других значений
    if other_count > 0:
        other_users = await db_all("""
            SELECT DISTINCT gender, COUNT(*) as cnt
            FROM users 
            WHERE gender IS NOT NULL 
            AND gender != '' 
            AND gender != 'male' 
            AND gender != 'female'
            GROUP BY gender
            LIMIT 10
        """)
        print(f"\n📋 Примеры других значений gender:")
        for user in other_users:
            print(f"  - '{user.get('gender')}': {user.get('cnt')} пользователей")
    
    # Сумма всех категорий
    sum_all = male_count + female_count + null_count + empty_count + other_count
    print(f"\n📊 Сумма всех категорий: {sum_all}")
    print(f"📊 Всего в БД: {total_users}")
    
    if sum_all != total_users:
        print(f"⚠️ ВНИМАНИЕ: Расхождение! Разница: {abs(total_users - sum_all)}")
    else:
        print("✅ Сумма категорий совпадает с общим количеством")
    
    # GROUP BY запрос (как в API)
    print("\n" + "=" * 60)
    print("📊 Результат GROUP BY (как в API):")
    rows = await db_all("""
        SELECT 
            CASE 
                WHEN gender IS NULL OR gender = '' THEN 'Не указан'
                ELSE gender
            END AS name,
            COUNT(*) AS count 
        FROM users 
        GROUP BY 
            CASE 
                WHEN gender IS NULL OR gender = '' THEN 'Не указан'
                ELSE gender
            END
        ORDER BY count DESC
    """)
    
    for row in rows:
        gender = row.get("name", "Не указан")
        count = row.get("count", 0)
        if gender == "male":
            gender_ru = "👨 Мужчины"
        elif gender == "female":
            gender_ru = "👩 Женщины"
        else:
            gender_ru = f"❓ {gender}"
        print(f"  {gender_ru}: {count}")
    
    print("=" * 60)

async def main():
    await init_database()
    await check_gender_stats()

if __name__ == "__main__":
    asyncio.run(main())

