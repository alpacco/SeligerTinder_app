# Миграция данных в Railway Volume

## Обзор

Этот документ описывает процесс миграции данных из локальной директории `/Users/dmitryalexeev/sta-black-master/data` в постоянное хранилище Railway Volume.

## Что мигрируется

1. **Фотографии пользователей** (`/data/img/`) - все фотографии пользователей
2. **Изображения подарков** (`/data/giftimg/`) - изображения подарков
3. **Логи** (`/data/log/`) - файлы логов

**Примечание**: База данных SQLite (`tinder.db`, `gift.bd`) не мигрируется, так как проект использует PostgreSQL.

## Предварительные требования

1. ✅ Railway Volume создан и смонтирован на `/data`
2. ✅ Доступ к Railway серверу (через Railway CLI или SSH)
3. ✅ Локальная директория с данными доступна

## Способ 1: Миграция через Railway CLI

### Шаг 1: Установка Railway CLI

```bash
# macOS
brew install railway

# Или через npm
npm i -g @railway/cli
```

### Шаг 2: Авторизация

```bash
railway login
```

### Шаг 3: Подключение к проекту

```bash
railway link
# Выберите ваш проект
```

### Шаг 4: Загрузка данных

```bash
# Создайте архив данных
cd /Users/dmitryalexeev/sta-black-master
tar -czf data-backup.tar.gz data/img data/giftimg data/log

# Загрузите архив на Railway
railway run --service <your-service-name> bash

# Внутри контейнера Railway:
cd /data
# Распакуйте архив (нужно будет загрузить его через другой способ)
```

## Способ 2: Миграция через скрипт (рекомендуется)

### Шаг 1: Настройка Railway Volume

1. Откройте Railway Dashboard
2. Перейдите в ваш сервис → **Settings** → **Volumes**
3. Создайте новый Volume:
   - **Name**: `data-volume`
   - **Mount Path**: `/data`
   - **Size**: `10 GB` (или больше, в зависимости от размера данных)

### Шаг 2: Подготовка скрипта миграции

Скрипт `migrate_data_to_railway.py` уже создан в `python_backend/`.

### Шаг 3: Тестовый запуск (dry run)

```bash
cd /Users/dmitryalexeev/sta-black-master
python python_backend/migrate_data_to_railway.py \
  --source ./data \
  --target /data \
  --dry-run
```

Это покажет, сколько файлов будет скопировано, без реального копирования.

### Шаг 4: Запуск на Railway

#### Вариант A: Через Railway Shell

```bash
# Подключитесь к Railway серверу
railway shell

# Загрузите скрипт миграции
# (скопируйте migrate_data_to_railway.py на сервер)

# Запустите миграцию
python migrate_data_to_railway.py \
  --source /tmp/data \
  --target /data
```

#### Вариант B: Через локальный скрипт с SSH

Если у вас есть SSH доступ к Railway:

```bash
# Создайте архив данных
cd /Users/dmitryalexeev/sta-black-master
tar -czf data-backup.tar.gz data/img data/giftimg data/log

# Загрузите архив на Railway (через Railway CLI или другой способ)
railway run --service <service-name> --command "cd /tmp && cat > data-backup.tar.gz" < data-backup.tar.gz

# Распакуйте архив
railway run --service <service-name> --command "cd /tmp && tar -xzf data-backup.tar.gz"

# Запустите миграцию
railway run --service <service-name> --command "python migrate_data_to_railway.py --source /tmp/data --target /data"
```

## Способ 3: Миграция через Railway Dashboard (простой способ)

### Шаг 1: Создание Volume

1. Railway Dashboard → Ваш проект → Settings → Volumes
2. **Create Volume**:
   - Name: `data-volume`
   - Mount Path: `/data`
   - Size: `10 GB`

### Шаг 2: Загрузка данных через Railway CLI

```bash
# Подключитесь к проекту
railway link

# Загрузите данные через railway run
railway run --service <service-name> bash

# Внутри контейнера:
mkdir -p /data/img /data/giftimg /data/log
```

### Шаг 3: Копирование данных

Самый простой способ - использовать `railway run` с локальными данными:

```bash
# Создайте временный архив
cd /Users/dmitryalexeev/sta-black-master
tar -czf data-backup.tar.gz data/img data/giftimg data/log

# Загрузите через Railway CLI (если поддерживается)
# Или используйте Railway Dashboard → Deployments → View Logs → Upload Files
```

## Способ 4: Миграция через rsync/SCP (если есть SSH доступ)

```bash
# Если Railway предоставляет SSH доступ
rsync -avz --progress \
  /Users/dmitryalexeev/sta-black-master/data/img/ \
  railway-user@railway-host:/data/img/

rsync -avz --progress \
  /Users/dmitryalexeev/sta-black-master/data/giftimg/ \
  railway-user@railway-host:/data/giftimg/

rsync -avz --progress \
  /Users/dmitryalexeev/sta-black-master/data/log/ \
  railway-user@railway-host:/data/log/
```

## Проверка миграции

После миграции проверьте:

1. **Размер данных**:
   ```bash
   railway run --service <service-name> --command "du -sh /data/*"
   ```

2. **Количество файлов**:
   ```bash
   railway run --service <service-name> --command "find /data/img -type f | wc -l"
   ```

3. **Доступность файлов**:
   - Откройте приложение
   - Проверьте, что фотографии пользователей загружаются
   - Проверьте логи в `/data/log`

## Важные замечания

1. **Размер Volume**: Убедитесь, что размер Volume достаточен для всех данных
2. **Время миграции**: Миграция может занять время в зависимости от объема данных
3. **Бэкап**: Создайте резервную копию данных перед миграцией
4. **Права доступа**: Railway автоматически устанавливает правильные права доступа

## Устранение проблем

### Volume не монтируется

- Проверьте, что Volume создан в том же регионе, что и сервис
- Убедитесь, что Mount Path установлен в `/data`
- Перезапустите сервис после создания Volume

### Недостаточно места

- Увеличьте размер Volume через Railway Dashboard
- Или удалите ненужные файлы перед миграцией

### Ошибки доступа

- Проверьте права доступа к `/data`
- Убедитесь, что приложение запущено с правильными правами

## После миграции

1. ✅ Удалите локальную директорию `/data` (после проверки)
2. ✅ Обновите документацию
3. ✅ Проверьте, что все файлы доступны через приложение

