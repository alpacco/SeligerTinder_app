# SeligerTinder - Python Backend

Python версия бэкенда для SeligerTinder на FastAPI.

## 🚀 Технологии

- **Backend**: Python 3.11, FastAPI
- **Bot**: python-telegram-bot
- **Database**: PostgreSQL (через psycopg2-binary)
- **Image Processing**: OpenCV (opencv-python-headless)

## 📋 Требования

- Python >= 3.11
- pip

## 🔧 Установка

```bash
pip install -r requirements.txt
```

## 🏃 Запуск локально

```bash
# Запуск приложения и бота одновременно
python python_backend/start_all.py

# Или отдельно:
python python_backend/start.py          # Только веб-сервер
python python_backend/bot.py            # Только бот
```

## 🌐 Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token
WEB_APP_URL=https://your-domain.com

# Server
PORT=8080
NODE_ENV=production
LOCAL=false

# Database (только PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database
# Или
USE_POSTGRES=true
PGHOST=localhost
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=your_password
```

## 📁 Структура проекта

```
python_backend/
├── main.py              # Основной FastAPI сервер
├── bot.py               # Telegram бот
├── database.py          # Инициализация базы данных
├── db_utils.py          # Утилиты для работы с БД
├── opencv_utils.py      # OpenCV функции
├── start.py             # Запуск веб-сервера
├── start_all.py         # Запуск приложения и бота
├── routes/              # API маршруты
│   ├── users.py
│   ├── likes.py
│   ├── matches.py
│   ├── photos.py
│   ├── pro.py
│   ├── stats.py
│   ├── admin.py
│   ├── goals.py
│   └── push.py
└── middleware/          # Middleware
    ├── validation.py
    └── error_handler.py
```

## 🚢 Деплой на Railway

1. Убедитесь, что `python_backend/nixpacks.toml` настроен
2. Railway автоматически определит Python проект
3. Установите переменные окружения в Railway Dashboard
4. Приложение запустится автоматически

## ✅ Преимущества Python версии

1. **OpenCV** - `opencv-python-headless` устанавливается без компиляции
2. **Производительность** - FastAPI быстрее Express для async операций
3. **Типизация** - Pydantic модели для валидации
4. **Экосистема** - богатая библиотека для ML/обработки изображений

## 📝 API Endpoints

Все эндпоинты идентичны Node.js версии:
- `/api/users` - управление пользователями
- `/api/likes` - лайки
- `/api/matches` - совпадения
- `/api/photos` - загрузка фотографий
- `/api/pro` - PRO подписка
- `/api/stats` - статистика

## 🤖 Команды бота

- `/start` - начать работу с ботом
- `/grantpro` - выдать PRO подписку (только для админа)
- `/addbadge` - установить бейдж (только для админа)
- `/stats` - статистика (только для админа)

