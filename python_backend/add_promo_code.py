#!/usr/bin/env python3
"""
Скрипт для добавления промокода SECRETPARKING
Активирует PRO подписку на 7 дней
"""
import asyncio
import sys
from pathlib import Path

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent))

from database import init_database
from db_utils import db_run, db_get


async def add_promo_code():
    """Добавляет промокод SECRETPARKING в базу данных"""
    try:
        # Инициализируем подключение к БД
        await init_database()
        print("✅ Подключение к БД установлено")
        
        # Проверяем, существует ли уже промокод
        existing = await db_get(
            'SELECT id, code, days, is_active FROM promo_codes WHERE code = %s',
            ['SECRETPARKING']
        )
        
        if existing:
            print(f"⚠️ Промокод SECRETPARKING уже существует:")
            print(f"   ID: {existing['id']}")
            print(f"   Дни: {existing['days']}")
            print(f"   Активен: {existing['is_active']}")
            
            # Обновляем промокод
            await db_run(
                'UPDATE promo_codes SET days = %s, is_active = true WHERE code = %s',
                [7, 'SECRETPARKING']
            )
            print("✅ Промокод обновлен: 7 дней, активен")
        else:
            # Создаем новый промокод
            await db_run(
                'INSERT INTO promo_codes (code, days, is_active) VALUES (%s, %s, %s)',
                ['SECRETPARKING', 7, True]
            )
            print("✅ Промокод SECRETPARKING создан: 7 дней, активен")
        
        # Проверяем результат
        result = await db_get(
            'SELECT id, code, days, is_active, created_at FROM promo_codes WHERE code = %s',
            ['SECRETPARKING']
        )
        
        if result:
            print("\n📋 Информация о промокоде:")
            print(f"   ID: {result['id']}")
            print(f"   Код: {result['code']}")
            print(f"   Дни: {result['days']}")
            print(f"   Активен: {result['is_active']}")
            print(f"   Создан: {result['created_at']}")
            print("\n✅ Промокод готов к использованию!")
        else:
            print("❌ Ошибка: промокод не найден после создания")
            
    except Exception as e:
        print(f"❌ Ошибка при добавлении промокода: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print("=" * 70)
    print("🎁 ДОБАВЛЕНИЕ ПРОМОКОДА SECRETPARKING")
    print("=" * 70)
    asyncio.run(add_promo_code())
    print("=" * 70)

