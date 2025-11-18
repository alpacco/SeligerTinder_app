# Миграция на PostgreSQL

## Обзор

Проект теперь поддерживает как SQLite, так и PostgreSQL. Переключение происходит автоматически на основе переменных окружения.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Установите переменные окружения для PostgreSQL (Railway автоматически предоставляет `DATABASE_URL`):
```env
# Для Railway (автоматически)
DATABASE_URL=postgresql://user:password@host:port/database

# Или вручную
USE_POSTGRES=true
PGHOST=localhost
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=your_password
```

## Выполнение миграций

После настройки подключения к PostgreSQL выполните миграции:

```bash
npm run migrate
```

Или напрямую:
```bash
node migrations/migrate.js
```

## Структура миграций

Миграции находятся в папке `migrations/`:
- `001_initial_schema.sql` - начальная схема базы данных
- `migrate.js` - скрипт для выполнения миграций

## Отличия SQLite и PostgreSQL

### Автоматическое переключение

Код автоматически определяет тип БД:
- Если установлена `USE_POSTGRES=true` или `DATABASE_URL` → PostgreSQL
- Иначе → SQLite

### SQL синтаксис

Основные отличия:
1. **Параметры запросов**: SQLite использует `?`, PostgreSQL использует `$1, $2, $3...`
2. **Кавычки**: PostgreSQL требует двойные кавычки для идентификаторов с camelCase
3. **Типы данных**: 
   - SQLite: `INTEGER PRIMARY KEY AUTOINCREMENT`
   - PostgreSQL: `SERIAL PRIMARY KEY`
4. **Транзакции**: 
   - SQLite: `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`
   - PostgreSQL: `BEGIN` / `COMMIT` / `ROLLBACK`

### Адаптация кода

Утилиты в `utils/db.js` автоматически адаптируют запросы:
- Для SQLite используются callbacks
- Для PostgreSQL используются промисы с pool.query()

## Миграция данных из SQLite

Когда будете готовы мигрировать данные:

1. **Экспорт из SQLite**:
```bash
sqlite3 /data/tinder.db .dump > dump.sql
```

2. **Адаптация SQL** для PostgreSQL:
   - Замените `INTEGER PRIMARY KEY AUTOINCREMENT` на `SERIAL PRIMARY KEY`
   - Замените `TEXT` на `VARCHAR` или `TEXT`
   - Добавьте кавычки к идентификаторам: `userId` → `"userId"`
   - Адаптируйте функции даты/времени

3. **Импорт в PostgreSQL**:
```bash
psql $DATABASE_URL < adapted_dump.sql
```

Или используйте скрипт миграции (будет создан позже).

## Railway настройка

В Railway:

1. Добавьте PostgreSQL сервис
2. Railway автоматически установит `DATABASE_URL`
3. При деплое миграции выполнятся автоматически (если добавить в `postinstall`)

Или добавьте в `package.json`:
```json
{
  "scripts": {
    "postinstall": "npm rebuild sqlite3 && npm run migrate"
  }
}
```

## Проверка подключения

После настройки проверьте подключение:

```javascript
const { pool } = require('./db');
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Ошибка подключения:', err);
  } else {
    console.log('Подключено! Время сервера:', res.rows[0].now);
  }
});
```

## Обратная совместимость

- ✅ Все существующие routes работают без изменений
- ✅ API интерфейс не изменился
- ✅ Можно переключаться между SQLite и PostgreSQL через переменные окружения

## Troubleshooting

### Ошибка подключения
- Проверьте `DATABASE_URL` или отдельные переменные
- Убедитесь, что SSL настроен правильно для продакшена

### Ошибки миграций
- Проверьте права доступа к БД
- Убедитесь, что таблица `migrations` создана

### Проблемы с кавычками
- PostgreSQL требует двойные кавычки для идентификаторов: `"userId"` вместо `userId`
- Все миграции уже адаптированы

