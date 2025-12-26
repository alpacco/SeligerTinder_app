#!/bin/bash
# Проверка Volume и распаковка данных
# Использование: ./scripts/check_and_extract.sh

set -e

SERVICE_NAME="${RAILWAY_SERVICE:-web}"
ARCHIVE_NAME="data-backup-20251226-141714.tar.gz"

echo "=========================================="
echo "🔍 ПРОВЕРКА VOLUME И РАСПАКОВКА ДАННЫХ"
echo "=========================================="
echo "Сервис: $SERVICE_NAME"
echo ""

echo "1️⃣ Проверка наличия архива..."
railway run --service "$SERVICE_NAME" bash -c "
if [ -f /tmp/$ARCHIVE_NAME ]; then
    echo '✅ Архив найден: /tmp/$ARCHIVE_NAME'
    ls -lh /tmp/$ARCHIVE_NAME
else
    echo '❌ Архив не найден в /tmp/$ARCHIVE_NAME'
    echo 'Доступные файлы в /tmp:'
    ls -la /tmp/ | head -10
    exit 1
fi
"

echo ""
echo "2️⃣ Проверка Volume /data..."
railway run --service "$SERVICE_NAME" bash -c "
if [ -d /data ]; then
    echo '✅ /data существует'
    echo 'Права доступа:'
    ls -ld /data
    echo ''
    echo 'Содержимое /data:'
    ls -la /data | head -10
else
    echo '❌ /data не существует'
    echo ''
    echo 'Проверка смонтированных файловых систем:'
    df -h | grep -E 'Filesystem|/data' || echo 'Volume /data не смонтирован'
    echo ''
    echo '⚠️  Убедитесь, что:'
    echo '   1. Volume создан в Railway Dashboard'
    echo '   2. Volume подключен к сервису \"$SERVICE_NAME\"'
    echo '   3. Mount Path установлен в /data'
    echo '   4. Сервис перезапущен после подключения Volume'
    exit 1
fi
"

echo ""
echo "3️⃣ Распаковка данных..."
railway run --service "$SERVICE_NAME" bash -c "
cd /data
echo 'Распаковка архива...'
tar -xzf /tmp/$ARCHIVE_NAME
echo '✅ Данные распакованы'
echo ''
echo 'Удаление архива...'
rm /tmp/$ARCHIVE_NAME
echo '✅ Архив удален'
"

echo ""
echo "4️⃣ Проверка результата..."
railway run --service "$SERVICE_NAME" bash -c "
echo 'Размеры директорий:'
du -sh /data/* 2>/dev/null || echo 'Директории пусты'
echo ''
echo 'Количество файлов:'
echo '  /data/img: \$(find /data/img -type f 2>/dev/null | wc -l) файлов'
echo '  /data/giftimg: \$(find /data/giftimg -type f 2>/dev/null | wc -l) файлов'
echo '  /data/log: \$(find /data/log -type f 2>/dev/null | wc -l) файлов'
"

echo ""
echo "✅ Миграция завершена!"

