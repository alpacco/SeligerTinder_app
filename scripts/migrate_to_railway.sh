#!/bin/bash
# Скрипт для миграции данных в Railway Volume
# Использование: ./scripts/migrate_to_railway.sh

set -e

SOURCE_DIR="/Users/dmitryalexeev/sta-black-master/data"
TARGET_DIR="/data"

echo "=========================================="
echo "📦 МИГРАЦИЯ ДАННЫХ В RAILWAY VOLUME"
echo "=========================================="
echo "Исходная директория: $SOURCE_DIR"
echo "Целевая директория: $TARGET_DIR"
echo "=========================================="

# Проверка наличия Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI не установлен"
    echo "Установите через: brew install railway"
    exit 1
fi

# Проверка авторизации
if ! railway whoami &> /dev/null; then
    echo "❌ Не авторизованы в Railway"
    echo "Выполните: railway login"
    exit 1
fi

# Проверка существования исходной директории
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Исходная директория не существует: $SOURCE_DIR"
    exit 1
fi

# Создание архива
echo ""
echo "📦 Создание архива данных..."
ARCHIVE_NAME="data-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE_PATH="/tmp/$ARCHIVE_NAME"

cd "$(dirname "$SOURCE_DIR")"
tar -czf "$ARCHIVE_PATH" \
    --exclude="*.db" \
    --exclude="*.bd" \
    --exclude="test.txt" \
    data/img data/giftimg data/log 2>/dev/null || {
    echo "⚠️ Некоторые файлы не найдены, продолжаем..."
}

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
echo "✅ Архив создан: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# Подсчет файлов
IMG_COUNT=$(find "$SOURCE_DIR/img" -type f 2>/dev/null | wc -l | tr -d ' ')
GIFT_COUNT=$(find "$SOURCE_DIR/giftimg" -type f 2>/dev/null | wc -l | tr -d ' ')
LOG_COUNT=$(find "$SOURCE_DIR/log" -type f 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "📊 Статистика данных:"
echo "  - Фотографии пользователей: $IMG_COUNT файлов"
echo "  - Изображения подарков: $GIFT_COUNT файлов"
echo "  - Логи: $LOG_COUNT файлов"

# Подтверждение
echo ""
read -p "Продолжить миграцию? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Миграция отменена"
    rm -f "$ARCHIVE_PATH"
    exit 0
fi

# Инструкции для миграции
echo ""
echo "=========================================="
echo "📋 ИНСТРУКЦИИ ПО МИГРАЦИИ"
echo "=========================================="
echo ""
echo "1. Убедитесь, что Railway Volume создан и смонтирован на /data"
echo "2. Загрузите архив на Railway одним из способов:"
echo ""
echo "   Способ A (через Railway Shell):"
echo "   railway shell"
echo "   # Затем в контейнере:"
echo "   cd /tmp"
echo "   # Загрузите архив через другой терминал или используйте base64"
echo ""
echo "   Способ B (через railway run):"
echo "   # Загрузите архив через Railway Dashboard → Deployments → Upload"
echo ""
echo "3. Распакуйте архив:"
echo "   railway run --service <service-name> --command 'cd /data && tar -xzf /tmp/$ARCHIVE_NAME'"
echo ""
echo "4. Проверьте миграцию:"
echo "   railway run --service <service-name> --command 'ls -la /data/img | head -20'"
echo ""
echo "=========================================="
echo "📦 Архив готов: $ARCHIVE_PATH"
echo "Размер: $ARCHIVE_SIZE"
echo "=========================================="

