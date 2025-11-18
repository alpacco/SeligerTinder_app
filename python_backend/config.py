"""
config.py
Централизованная конфигурация из переменных окружения
Все чувствительные данные и настройки должны быть здесь
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ========== ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ==========

# База данных
DATABASE_URL = os.getenv("DATABASE_URL")
# Всегда определяем переменные для PostgreSQL (даже если DATABASE_URL установлен)
PGHOST = os.getenv("PGHOST", "localhost")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "railway")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "")

# Telegram Bot
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    print("⚠️ ВНИМАНИЕ: BOT_TOKEN не установлен! Бот не будет работать!")

# Web App URL
WEB_APP_URL = os.getenv("WEB_APP_URL", "")
if not WEB_APP_URL:
    print("⚠️ ВНИМАНИЕ: WEB_APP_URL не установлен!")
else:
    # Убеждаемся что URL начинается с https://
    if not WEB_APP_URL.startswith(("http://", "https://")):
        WEB_APP_URL = f"https://{WEB_APP_URL}"

# ========== БЕЗОПАСНОСТЬ ==========

# Admin авторизация
ADMIN_TELEGRAM_IDS_STR = os.getenv("ADMIN_TELEGRAM_IDS", "")
ADMIN_TELEGRAM_IDS = []
if ADMIN_TELEGRAM_IDS_STR:
    ADMIN_TELEGRAM_IDS = [
        tid.strip() 
        for tid in ADMIN_TELEGRAM_IDS_STR.split(",") 
        if tid.strip() and tid.strip().isdigit()
    ]

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")  # Для обратной совместимости

# ========== НАСТРОЙКИ БЕЗОПАСНОСТИ ==========

# Rate Limiting
RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))

# File Upload
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "10")) * 1024 * 1024  # По умолчанию 10 MB
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "10000"))  # Максимальный размер изображения

# HTTP Timeouts
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "30"))  # Таймаут для HTTP запросов
HTTP_MAX_REDIRECTS = int(os.getenv("HTTP_MAX_REDIRECTS", "5"))

# ========== ПУТИ ==========

# Пути для данных (можно переопределить через переменные окружения)
IMAGES_DIR = os.getenv("IMAGES_DIR", "/data/img")
LOG_DIR = os.getenv("LOG_DIR", "/data/log")

# Создаем директории если не существуют
for directory in [IMAGES_DIR, LOG_DIR]:
    Path(directory).mkdir(parents=True, exist_ok=True)

# ========== CORS ==========

# Разрешенные origins (можно добавить через переменную окружения)
CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = []

# Базовые origins
if WEB_APP_URL:
    CORS_ORIGINS.append(WEB_APP_URL)

# Дополнительные origins из переменной окружения
if CORS_ORIGINS_STR:
    CORS_ORIGINS.extend([
        origin.strip() 
        for origin in CORS_ORIGINS_STR.split(",") 
        if origin.strip()
    ])

# Стандартные origins для Telegram
CORS_ORIGINS.extend([
    "https://web.telegram.org",
    "https://telegram.org",
])

# Для локальной разработки
LOCAL = os.getenv("LOCAL", "false").lower() == "true"
if LOCAL:
    CORS_ORIGINS.extend([
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ])

# Фильтруем пустые значения
CORS_ORIGINS = [origin for origin in CORS_ORIGINS if origin]

# ========== ЛОГИРОВАНИЕ ==========

# Уровень логирования
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Логировать ли чувствительные данные (только для разработки!)
LOG_SENSITIVE = os.getenv("LOG_SENSITIVE", "false").lower() == "true"

# ========== ДРУГИЕ НАСТРОЙКИ ==========

# Порт сервера
PORT = int(os.getenv("PORT", "8080"))

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")  # production, development, staging

# Debug mode (только для разработки!)
DEBUG = os.getenv("DEBUG", "false").lower() == "true" and ENVIRONMENT != "production"

# ========== ПРОВЕРКА КОНФИГУРАЦИИ ==========

def validate_config():
    """Проверка обязательных переменных окружения"""
    errors = []
    
    if not BOT_TOKEN:
        errors.append("BOT_TOKEN не установлен")
    
    if not WEB_APP_URL:
        errors.append("WEB_APP_URL не установлен")
    
    if not DATABASE_URL and not PGPASSWORD:
        errors.append("DATABASE_URL или PGPASSWORD не установлены")
    
    if errors:
        print("⚠️ ОШИБКИ КОНФИГУРАЦИИ:")
        for error in errors:
            print(f"  - {error}")
        return False
    
    return True


# Вызываем проверку при импорте
if __name__ != "__main__":
    validate_config()

