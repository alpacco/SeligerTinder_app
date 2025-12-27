# Скрипт для работы с лайками пользователя 307954967

## Описание

Скрипт `test_likes_script.py` выполняет следующие действия:

1. Получает текущие лайки для пользователя 307954967
2. Сохраняет их в файл `likes_backup_307954967.json`
3. Добавляет тестовые данные (50% пользователей лайкают этого пользователя)
4. Создает SQL скрипт для отката изменений `likes_rollback_307954967.sql`

## Запуск

### Локально (с Railway БД)

```bash
cd python_backend
export PGHOST=centerbeam.proxy.rlwy.net
export PGPORT=28021
export PGDATABASE=railway
export PGUSER=postgres
export PGPASSWORD=xzWZwgAEnXjAQTdctGVQawQisYFBXpsm
python3 test_likes_script.py
```

### На сервере (Railway)

Скрипт автоматически использует переменные окружения из Railway.

## Файлы

- `likes_backup_307954967.json` - резервная копия текущих лайков
- `likes_rollback_307954967.sql` - SQL скрипт для отката изменений

## Откат изменений

Для отката изменений выполните SQL скрипт:

```bash
psql -h centerbeam.proxy.rlwy.net -U postgres -p 28021 -d railway -f likes_rollback_307954967.sql
```

Или через Python:

```python
import asyncio
from database import init_database
from db_utils import db_run

async def rollback():
    await init_database()
    with open('likes_rollback_307954967.sql', 'r') as f:
        sql = f.read()
        # Выполнить каждую команду отдельно
        for line in sql.split(';'):
            line = line.strip()
            if line and not line.startswith('--'):
                await db_run(line, [])

asyncio.run(rollback())
```

