#!/bin/bash
# Загрузка архива на Railway через base64
# Использование: ./scripts/upload_via_base64.sh /path/to/archive.tar.gz

set -e

ARCHIVE_PATH="$1"

if [ -z "$ARCHIVE_PATH" ] || [ ! -f "$ARCHIVE_PATH" ]; then
    echo "❌ Укажите путь к архиву"
    echo "Использование: ./scripts/upload_via_base64.sh /tmp/data-backup-*.tar.gz"
    exit 1
fi

ARCHIVE_NAME=$(basename "$ARCHIVE_PATH")
SERVICE_NAME="${RAILWAY_SERVICE:-web}"

echo "=========================================="
echo "📤 ЗАГРУЗКА АРХИВА НА RAILWAY"
echo "=========================================="
echo "Архив: $ARCHIVE_PATH"
echo "Сервис: $SERVICE_NAME"
echo ""

# Проверяем размер (base64 увеличивает размер на ~33%)
ARCHIVE_SIZE=$(stat -f%z "$ARCHIVE_PATH" 2>/dev/null || stat -c%s "$ARCHIVE_PATH")
MAX_SIZE=$((30 * 1024 * 1024))  # 30MB исходного файла

if [ "$ARCHIVE_SIZE" -gt "$MAX_SIZE" ]; then
    echo "⚠️ Архив слишком большой для base64 ($(du -h "$ARCHIVE_PATH" | cut -f1))"
    echo ""
    echo "Используйте альтернативный способ:"
    echo "1. Загрузите архив через SCP/rsync (если есть SSH доступ)"
    echo "2. Или используйте Python скрипт миграции напрямую"
    exit 1
fi

echo "⏳ Кодирование архива в base64..."
BASE64_DATA=$(base64 < "$ARCHIVE_PATH")

echo "⏳ Загрузка на Railway..."
railway run --service "$SERVICE_NAME" bash <<EOF
cd /tmp
cat > $ARCHIVE_NAME.base64 <<'ENDOFFILE'
$BASE64_DATA
ENDOFFILE
base64 -d $ARCHIVE_NAME.base64 > $ARCHIVE_NAME
rm $ARCHIVE_NAME.base64
ls -lh /tmp/$ARCHIVE_NAME
echo "✅ Архив загружен: /tmp/$ARCHIVE_NAME"
EOF

echo ""
echo "✅ Архив загружен на Railway!"
echo ""
echo "Теперь распакуйте архив:"
echo "  railway run --service $SERVICE_NAME --command 'cd /data && tar -xzf /tmp/$ARCHIVE_NAME && rm /tmp/$ARCHIVE_NAME'"

