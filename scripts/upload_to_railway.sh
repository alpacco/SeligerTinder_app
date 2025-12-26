#!/bin/bash
# Упрощенный скрипт для загрузки данных на Railway через base64
# Использование: ./scripts/upload_to_railway.sh

set -e

SOURCE_DIR="/Users/dmitryalexeev/sta-black-master/data"
SERVICE_NAME="${RAILWAY_SERVICE:-web}"  # Имя сервиса в Railway

echo "=========================================="
echo "📦 ЗАГРУЗКА ДАННЫХ НА RAILWAY"
echo "=========================================="

# Проверка Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI не установлен"
    echo "Установите: brew install railway"
    exit 1
fi

# Проверка авторизации
if ! railway whoami &> /dev/null; then
    echo "❌ Не авторизованы в Railway"
    echo "Выполните: railway login"
    exit 1
fi

# Создание архива
echo "📦 Создание архива..."
ARCHIVE_NAME="data-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE_PATH="/tmp/$ARCHIVE_NAME"

cd "$(dirname "$SOURCE_DIR")"
tar -czf "$ARCHIVE_PATH" \
    --exclude="*.db" \
    --exclude="*.bd" \
    --exclude="test.txt" \
    data/img data/giftimg data/log 2>/dev/null

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
echo "✅ Архив создан: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# Проверяем размер архива
ARCHIVE_SIZE_BYTES=$(stat -f%z "$ARCHIVE_PATH" 2>/dev/null || stat -c%s "$ARCHIVE_PATH" 2>/dev/null)
MAX_SIZE=$((50 * 1024 * 1024))  # 50MB - лимит для base64 через railway run

if [ "$ARCHIVE_SIZE_BYTES" -gt "$MAX_SIZE" ]; then
    echo "⚠️ Архив большой ($ARCHIVE_SIZE), используйте альтернативный способ"
    echo ""
    echo "Используйте скрипт upload_via_base64.sh:"
    echo "  ./scripts/upload_via_base64.sh $ARCHIVE_PATH"
    echo ""
    echo "Или загрузите вручную через Python скрипт:"
    echo "  railway run --service $SERVICE_NAME --command 'python python_backend/migrate_data_to_railway.py --source /tmp/data --target /data'"
    echo ""
    echo "Архив находится здесь: $ARCHIVE_PATH"
    exit 0
fi

echo ""
echo "📤 Загрузка архива на Railway..."
echo "Сервис: $SERVICE_NAME"
echo "Размер архива: $ARCHIVE_SIZE"
echo ""

# Загружаем архив через base64 (для архивов до 50MB)
echo "⏳ Загрузка (это может занять время)..."
railway run --service "$SERVICE_NAME" bash <<EOF
cd /tmp
cat > $ARCHIVE_NAME.base64 <<'ENDOFFILE'
$(base64 < "$ARCHIVE_PATH")
ENDOFFILE
base64 -d $ARCHIVE_NAME.base64 > $ARCHIVE_NAME
rm $ARCHIVE_NAME.base64
echo "✅ Архив загружен: /tmp/$ARCHIVE_NAME"
ls -lh /tmp/$ARCHIVE_NAME
EOF

echo ""
echo "📦 Распаковка архива..."
railway run --service "$SERVICE_NAME" --command "cd /data && tar -xzf /tmp/$ARCHIVE_NAME && rm /tmp/$ARCHIVE_NAME && echo '✅ Данные распакованы в /data'"

echo ""
echo "✅ Миграция завершена!"
echo ""
echo "Проверка:"
railway run --service "$SERVICE_NAME" --command "du -sh /data/* && echo '' && find /data/img -type f | wc -l && echo 'файлов в /data/img'"

