#!/bin/bash
# Загрузка большого архива на Railway по частям
# Использование: ./scripts/upload_split.sh /path/to/archive.tar.gz

set -e

ARCHIVE_PATH="$1"

if [ -z "$ARCHIVE_PATH" ] || [ ! -f "$ARCHIVE_PATH" ]; then
    echo "❌ Укажите путь к архиву"
    echo "Использование: ./scripts/upload_split.sh /tmp/data-backup-*.tar.gz"
    exit 1
fi

ARCHIVE_NAME=$(basename "$ARCHIVE_PATH")
SERVICE_NAME="${RAILWAY_SERVICE:-web}"
CHUNK_SIZE=$((20 * 1024 * 1024))  # 20MB на часть

# Сохраняем текущую директорию (должна быть директория проекта)
PROJECT_DIR=$(pwd)

echo "=========================================="
echo "📤 ЗАГРУЗКА БОЛЬШОГО АРХИВА НА RAILWAY"
echo "=========================================="
echo "Архив: $ARCHIVE_PATH"
echo "Сервис: $SERVICE_NAME"
echo "Размер части: 20MB"
echo ""

# Создаем временную директорию для частей
SPLIT_DIR="/tmp/archive_split_$$"
mkdir -p "$SPLIT_DIR"

echo "📦 Разбиение архива на части..."
cd "$SPLIT_DIR"
split -b ${CHUNK_SIZE} "$ARCHIVE_PATH" "part_"

PART_COUNT=$(ls -1 part_* 2>/dev/null | wc -l | tr -d ' ')
if [ "$PART_COUNT" -eq 0 ]; then
    echo "❌ Ошибка: не удалось разбить архив"
    rm -rf "$SPLIT_DIR"
    exit 1
fi
echo "✅ Архив разбит на $PART_COUNT частей"
echo ""

# Возвращаемся в директорию проекта для railway команд
cd "$PROJECT_DIR"

# Загружаем каждую часть
PART_NUM=1
for PART_FILE in "$SPLIT_DIR"/part_*; do
    if [ ! -f "$PART_FILE" ]; then
        continue
    fi
    PART_NAME=$(basename "$PART_FILE")
    echo "📤 Загрузка части $PART_NUM из $PART_COUNT..."
    
    BASE64_DATA=$(base64 < "$PART_FILE")
    
    (cd "$PROJECT_DIR" && railway run --service "$SERVICE_NAME" bash) <<EOF
cd /tmp
cat > $PART_NAME.base64 <<'ENDOFFILE'
$BASE64_DATA
ENDOFFILE
base64 -d -i $PART_NAME.base64 -o $PART_NAME 2>/dev/null || base64 -d < $PART_NAME.base64 > $PART_NAME
rm $PART_NAME.base64
ls -lh /tmp/$PART_NAME | head -1
echo "✅ Часть $PART_NUM загружена: /tmp/$PART_NAME"
EOF
    
    PART_NUM=$((PART_NUM + 1))
done

# Объединяем части на Railway сразу в /data/archive (Volume, сохраняется между перезапусками)
echo ""
echo "🔗 Объединение частей на Railway в /data/archive..."
(cd "$PROJECT_DIR" && railway run --service "$SERVICE_NAME" bash -c "
# Создаем /data/archive если не существует
if [ -d /data ]; then
    mkdir -p /data/archive
    TARGET_DIR=/data/archive
    echo '✅ Используем /data/archive (Volume, сохраняется между перезапусками)'
else
    TARGET_DIR=/tmp
    echo '⚠️ /data недоступен, используем /tmp'
fi
cd \$TARGET_DIR
ARCHIVE_NAME='$ARCHIVE_NAME'
PARTS=\$(ls -1 /tmp/part_* 2>/dev/null | sort)
if [ -z \"\$PARTS\" ]; then
    echo '❌ Части не найдены!'
    exit 1
fi
echo \"Найдено частей: \$(echo \"\$PARTS\" | wc -l)\"
cat \$PARTS > \"\$TARGET_DIR/\$ARCHIVE_NAME\"
SIZE=\$(stat -f%z \"\$TARGET_DIR/\$ARCHIVE_NAME\" 2>/dev/null || stat -c%s \"\$TARGET_DIR/\$ARCHIVE_NAME\" 2>/dev/null)
echo \"Размер архива: \$SIZE байт\"
rm -f /tmp/part_*
ls -lh \"\$TARGET_DIR/\$ARCHIVE_NAME\"
echo \"✅ Архив собран: \$TARGET_DIR/\$ARCHIVE_NAME\"
")

# Удаляем временные файлы
rm -rf "$SPLIT_DIR"

echo ""
echo "✅ Архив загружен на Railway!"
echo ""
echo "Архив сохранен в /data (Volume) и будет автоматически распакован при следующем деплое"

