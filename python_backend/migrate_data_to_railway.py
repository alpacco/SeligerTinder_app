#!/usr/bin/env python3
"""
Скрипт для миграции данных из локальной директории в Railway Volume
Использование:
    python migrate_data_to_railway.py --source /Users/dmitryalexeev/sta-black-master/data --target /data
"""
import os
import sys
import shutil
from pathlib import Path
import argparse
from typing import List, Tuple


def get_directory_size(path: Path) -> int:
    """Получить размер директории в байтах"""
    total = 0
    try:
        for entry in path.rglob('*'):
            if entry.is_file():
                total += entry.stat().st_size
    except Exception as e:
        print(f"⚠️ Ошибка при подсчете размера {path}: {e}")
    return total


def format_size(size_bytes: int) -> str:
    """Форматировать размер в читаемый вид"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"


def copy_directory(source: Path, target: Path, dry_run: bool = False) -> Tuple[int, int]:
    """
    Копировать директорию с сохранением структуры
    Возвращает (количество скопированных файлов, количество ошибок)
    """
    copied = 0
    errors = 0
    
    if not source.exists():
        print(f"❌ Исходная директория не существует: {source}")
        return copied, errors
    
    # Создаем целевую директорию
    if not dry_run:
        target.mkdir(parents=True, exist_ok=True)
    
    # Копируем файлы
    for root, dirs, files in os.walk(source):
        # Вычисляем относительный путь
        rel_path = os.path.relpath(root, source)
        target_dir = target / rel_path if rel_path != '.' else target
        
        if not dry_run:
            target_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            source_file = Path(root) / file
            target_file = target_dir / file
            
            try:
                if not dry_run:
                    if target_file.exists():
                        print(f"  ⚠️ Файл уже существует, пропускаем: {target_file}")
                    else:
                        shutil.copy2(source_file, target_file)
                        copied += 1
                        if copied % 100 == 0:
                            print(f"  ✅ Скопировано файлов: {copied}")
                else:
                    copied += 1
                    if copied % 100 == 0:
                        print(f"  📋 Будет скопировано файлов: {copied}")
            except Exception as e:
                errors += 1
                print(f"  ❌ Ошибка копирования {source_file} -> {target_file}: {e}")
    
    return copied, errors


def migrate_data(source_dir: str, target_dir: str, dry_run: bool = False):
    """Основная функция миграции"""
    source = Path(source_dir)
    target = Path(target_dir)
    
    print("=" * 80)
    print("📦 МИГРАЦИЯ ДАННЫХ В RAILWAY VOLUME")
    print("=" * 80)
    print(f"Исходная директория: {source}")
    print(f"Целевая директория: {target}")
    print(f"Режим: {'DRY RUN (тестовый)' if dry_run else 'РЕАЛЬНАЯ МИГРАЦИЯ'}")
    print("=" * 80)
    
    if not source.exists():
        print(f"❌ Исходная директория не существует: {source}")
        return False
    
    # Проверяем, что целевая директория существует (Railway Volume должен быть смонтирован)
    if not dry_run and not target.exists():
        print(f"⚠️ Целевая директория не существует: {target}")
        print("⚠️ Убедитесь, что Railway Volume смонтирован на /data")
        response = input("Создать директорию? (y/n): ")
        if response.lower() == 'y':
            target.mkdir(parents=True, exist_ok=True)
        else:
            print("❌ Миграция отменена")
            return False
    
    # Директории для миграции
    directories_to_migrate = [
        ('img', 'img'),           # Фотографии пользователей
        ('giftimg', 'giftimg'),   # Изображения подарков
        ('log', 'log'),           # Логи
    ]
    
    total_copied = 0
    total_errors = 0
    
    for source_subdir, target_subdir in directories_to_migrate:
        source_path = source / source_subdir
        target_path = target / target_subdir
        
        if not source_path.exists():
            print(f"⚠️ Директория не существует, пропускаем: {source_path}")
            continue
        
        print(f"\n📁 Миграция: {source_subdir} -> {target_subdir}")
        
        # Подсчитываем размер
        size = get_directory_size(source_path)
        print(f"  Размер: {format_size(size)}")
        
        # Копируем
        copied, errors = copy_directory(source_path, target_path, dry_run)
        total_copied += copied
        total_errors += errors
        
        print(f"  ✅ Скопировано файлов: {copied}")
        if errors > 0:
            print(f"  ❌ Ошибок: {errors}")
    
    print("\n" + "=" * 80)
    print("📊 ИТОГИ МИГРАЦИИ")
    print("=" * 80)
    print(f"Всего скопировано файлов: {total_copied}")
    if total_errors > 0:
        print(f"Ошибок: {total_errors}")
    print("=" * 80)
    
    if dry_run:
        print("\n⚠️ Это был тестовый запуск. Для реальной миграции запустите без --dry-run")
    
    return total_errors == 0


def main():
    parser = argparse.ArgumentParser(
        description='Миграция данных в Railway Volume',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  # Тестовый запуск (dry run)
  python migrate_data_to_railway.py --source ./data --target /data --dry-run
  
  # Реальная миграция
  python migrate_data_to_railway.py --source ./data --target /data
  
  # Миграция с локальной машины на Railway (через SSH)
  # Сначала подключитесь к Railway через: railway connect
  # Затем запустите скрипт на Railway сервере
        """
    )
    parser.add_argument(
        '--source',
        type=str,
        default='/Users/dmitryalexeev/sta-black-master/data',
        help='Исходная директория с данными (по умолчанию: /Users/dmitryalexeev/sta-black-master/data)'
    )
    parser.add_argument(
        '--target',
        type=str,
        default='/data',
        help='Целевая директория (Railway Volume, по умолчанию: /data)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Тестовый запуск без реального копирования'
    )
    
    args = parser.parse_args()
    
    success = migrate_data(args.source, args.target, args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

