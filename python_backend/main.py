"""
main.py
Основной FastAPI сервер для SeligerTinder
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from middleware.error_handler import validation_exception_handler, http_exception_handler, general_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from contextlib import asynccontextmanager
import uvicorn

# Добавляем текущую директорию в путь
sys.path.insert(0, str(Path(__file__).parent))

from database import init_database
from db_utils import db_get
from config import (
    BOT_TOKEN, WEB_APP_URL, CORS_ORIGINS, LOCAL,
    RATE_LIMIT_PER_HOUR, RATE_LIMIT_PER_MINUTE,
    IMAGES_DIR, PORT, DEBUG, ENVIRONMENT, LOG_LEVEL, MAX_FILE_SIZE, DATA_BASE_DIR
)

load_dotenv()

# Lifespan для запуска/остановки бота
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения: запуск и остановка бота"""
    # Startup: инициализируем БД и запускаем бота
    print("=" * 70)
    print("🚀 FASTAPI STARTUP")
    print("=" * 70)
    
    # Инициализация БД и проверки безопасности
    await init_app()
    
    # Распаковка данных из архива (если нужно)
    from config import extract_data_if_needed
    extract_data_if_needed()
    
    # Запуск бота
    print("=" * 70)
    print("🤖 Запуск Telegram бота...")
    print("=" * 70)
    
    try:
        from bot import start_bot
        await start_bot()
    except Exception as e:
        print(f"⚠️ Ошибка при запуске бота: {e}")
        import traceback
        traceback.print_exc()
    
    yield  # Приложение работает
    
    # Shutdown: останавливаем бота
    print("=" * 70)
    print("🛑 FASTAPI SHUTDOWN: Остановка бота...")
    print("=" * 70)
    
    try:
        from bot import stop_bot
        await stop_bot()
    except Exception as e:
        print(f"⚠️ Ошибка при остановке бота: {e}")


# Инициализация FastAPI с lifespan
app = FastAPI(
    title="SeligerTinder API",
    version="1.0.0",
    lifespan=lifespan
)

# Rate Limiter (настраиваемые лимиты из переменных окружения)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{RATE_LIMIT_PER_HOUR}/hour", f"{RATE_LIMIT_PER_MINUTE}/minute"]
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Добавляет security headers ко всем ответам"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # HSTS (только для HTTPS)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # CSP (Content Security Policy) - базовая настройка
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://telegram.org; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https://api.telegram.org; "
            "frame-src https://web.telegram.org; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS настройки (из конфигурации)
cors_origins = CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Только нужные методы
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],  # Только нужные заголовки
    expose_headers=["Content-Length", "Content-Type"],
    max_age=3600,  # Кеш preflight запросов на 1 час
)

# Статические файлы из public/
public_dir = Path(__file__).parent.parent / "public"
if public_dir.exists():
    # Монтируем статические файлы на корневые пути для совместимости с фронтендом
    app.mount("/css", StaticFiles(directory=str(public_dir / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(public_dir / "js")), name="js")
    app.mount("/img", StaticFiles(directory=str(public_dir / "img")), name="img")
    # Бейджи находятся в /img/labels/, но также поддерживаем /labels/ для совместимости
    if (public_dir / "labels").exists():
    app.mount("/labels", StaticFiles(directory=str(public_dir / "labels")), name="labels")
    # Монтируем /img/labels/ для прямого доступа
    if (public_dir / "img" / "labels").exists():
        app.mount("/img/labels", StaticFiles(directory=str(public_dir / "img" / "labels")), name="img_labels")

# Favicon
@app.get("/favicon.ico")
async def favicon():
    from fastapi.responses import FileResponse
    favicon_path = public_dir / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    return {"detail": "Not found"}

# Статические изображения
if Path(IMAGES_DIR).exists():
    app.mount("/data/img", StaticFiles(directory=IMAGES_DIR), name="images")
# Подарки больше не используются

# HTML файл (простой статический HTML)
html_file = Path(__file__).parent.parent / "public" / "index.html"

# Импорт роутов
from routes import users, likes, matches, photos, pro, stats, admin, goals, push, payment

# Импортируем opencv_utils для инициализации OpenCV при старте
try:
    import opencv_utils
    print("✅ OpenCV модуль импортирован, инициализация выполнена")
except Exception as e:
    print(f"⚠️ Ошибка импорта OpenCV модуля: {e}")
    import traceback
    traceback.print_exc()

app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(likes.router, prefix="/api", tags=["likes"])
app.include_router(matches.router, prefix="/api", tags=["matches"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
# Алиас для совместимости с ботом
app.include_router(photos.router, prefix="/api", tags=["photos-alias"])  # /api/uploadPhoto
# Подарки больше не используются - роуты удалены
app.include_router(pro.router, prefix="/api/pro", tags=["pro"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(push.router, prefix="/api", tags=["push"])

# Алиасы для совместимости с ботом
app.include_router(pro.router, prefix="/api", tags=["pro-alias"])  # /api/grantPro
app.include_router(payment.router, prefix="/api/payment", tags=["payment"])

# Обработчики ошибок
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Инициализация БД и проверка безопасности (вызывается в lifespan)
async def init_app():
    """Инициализация приложения (БД, проверки безопасности)"""
    await init_database()
    
    # Проверка безопасности admin авторизации
    from middleware.auth import ADMIN_TELEGRAM_IDS, ADMIN_TOKEN
    if not ADMIN_TELEGRAM_IDS and not ADMIN_TOKEN:
        print("⚠️ ВНИМАНИЕ: ADMIN_TELEGRAM_IDS или ADMIN_TOKEN не установлены!")
        print("⚠️ Admin endpoints доступны БЕЗ авторизации - это небезопасно!")
    elif ADMIN_TELEGRAM_IDS:
        print(f"✅ Admin авторизация настроена через Telegram ID ({len(ADMIN_TELEGRAM_IDS)} администратор(ов))")
    elif ADMIN_TOKEN:
        print("✅ Admin авторизация настроена через Bearer Token")
    
    # Сборка фронтенда (если не собран)
    print("=" * 70)
    print("📦 [INIT] Проверка и сборка фронтенда...")
    print(f"  - public_dir: {public_dir}")
    print(f"  - public_dir.exists(): {public_dir.exists()}")
    
    frontend_dir = Path(__file__).parent.parent / "frontend"
    hash_map_path = public_dir / "hash-map.json"
    
    # Проверяем, нужно ли собирать фронтенд
    need_build = False
    if not hash_map_path.exists():
        print(f"  ⚠️ hash-map.json НЕ НАЙДЕН - нужна сборка фронтенда")
        need_build = True
    else:
        # Проверяем наличие JS файлов
        js_dir = public_dir / "js"
        if not js_dir.exists() or not list(js_dir.glob("*.js")):
            print(f"  ⚠️ JS файлы НЕ НАЙДЕНЫ - нужна сборка фронтенда")
            need_build = True
    
    if need_build and frontend_dir.exists():
        print("=" * 70)
        print("📦 [BUILD] Запуск сборки фронтенда...")
        print("=" * 70)
        try:
            import subprocess
            import shutil
            
            # Проверяем наличие npm
            npm_path = shutil.which("npm")
            if not npm_path:
                print("  ⚠️ npm не найден в PATH, пытаемся найти nodejs...")
                # Пробуем найти npm через node
                node_path = shutil.which("node")
                if node_path:
                    npm_path = node_path.replace("node", "npm")
            
            if npm_path:
                print(f"  ✅ npm найден: {npm_path}")
                print(f"  📦 Установка зависимостей...")
                
                # Устанавливаем зависимости
                result = subprocess.run(
                    ["npm", "install"],
                    cwd=str(frontend_dir),
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if result.returncode != 0:
                    print(f"  ⚠️ Ошибка установки зависимостей: {result.stderr}")
                else:
                    print(f"  ✅ Зависимости установлены")
                
                print(f"  📦 Запуск сборки...")
                # Собираем фронтенд
                result = subprocess.run(
                    ["npm", "run", "build"],
                    cwd=str(frontend_dir),
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if result.returncode != 0:
                    print(f"  ❌ Ошибка сборки: {result.stderr}")
                    print(f"  stdout: {result.stdout}")
                else:
                    print(f"  ✅ Фронтенд собран успешно")
                    print(f"  stdout: {result.stdout[-500:]}")  # Последние 500 символов
            else:
                print("  ⚠️ npm не найден - пропускаем сборку фронтенда")
        except subprocess.TimeoutExpired:
            print("  ⚠️ Таймаут при сборке фронтенда (более 5 минут)")
        except Exception as e:
            print(f"  ⚠️ Ошибка при сборке фронтенда: {e}")
            import traceback
            traceback.print_exc()
    
    # Проверка наличия собранных файлов фронтенда
    print("=" * 70)
    print("📦 [INIT] Проверка собранных файлов фронтенда...")
    
    if public_dir.exists():
        # Проверяем hash-map.json
        if hash_map_path.exists():
            print(f"  ✅ hash-map.json найден: {hash_map_path}")
            try:
                import json
                with open(hash_map_path) as f:
                    hash_map = json.load(f)
                print(f"  ✅ hash-map.json загружен: {len(hash_map)} записей")
                if hash_map:
                    print(f"  - Примеры записей: {list(hash_map.items())[:3]}")
            except Exception as e:
                print(f"  ❌ Ошибка загрузки hash-map.json: {e}")
        else:
            print(f"  ⚠️ hash-map.json НЕ НАЙДЕН: {hash_map_path}")
        
        # Проверяем JS файлы
        js_dir = public_dir / "js"
        if js_dir.exists():
            js_files = list(js_dir.glob("*.js"))
            print(f"  - js_dir: {js_dir}")
            print(f"  - Найдено JS файлов: {len(js_files)}")
            if js_files:
                print(f"  - Примеры файлов: {[f.name for f in js_files[:5]]}")
            else:
                print(f"  ⚠️ JS файлы НЕ НАЙДЕНЫ в {js_dir}")
        else:
            print(f"  ⚠️ Директория js/ НЕ НАЙДЕНА: {js_dir}")
        
        # Проверяем CSS файлы
        css_dir = public_dir / "css"
        if css_dir.exists():
            css_files = list(css_dir.glob("*.css"))
            print(f"  - css_dir: {css_dir}")
            print(f"  - Найдено CSS файлов: {len(css_files)}")
            if css_files:
                print(f"  - Примеры файлов: {[f.name for f in css_files[:5]]}")
        else:
            print(f"  ⚠️ Директория css/ НЕ НАЙДЕНА: {css_dir}")
    else:
        print(f"  ⚠️ Директория public/ НЕ НАЙДЕНА: {public_dir}")
    
    print("=" * 70)
    
    print("✅ Backend server initialized")


@app.get("/api/config")
async def get_config():
    """API endpoint для получения конфигурации фронтенда"""
    if not WEB_APP_URL:
        raise HTTPException(status_code=500, detail="WEB_APP_URL не настроен")
    
    web_app_url = WEB_APP_URL
    api_base_url = f"{web_app_url}/api"
    
    # Загружаем hash-map.json для JS файлов
    hash_map_path = public_dir / "hash-map.json"
    hash_map = {}
    
    print("=" * 70)
    print("📦 [CONFIG] Проверка файлов фронтенда...")
    print(f"  - public_dir: {public_dir}")
    print(f"  - public_dir.exists(): {public_dir.exists()}")
    print(f"  - hash_map_path: {hash_map_path}")
    print(f"  - hash_map_path.exists(): {hash_map_path.exists()}")
    
    if hash_map_path.exists():
        try:
            import json
            with open(hash_map_path) as f:
                hash_map = json.load(f)
            print(f"  ✅ hash-map.json загружен: {len(hash_map)} записей")
            print(f"  - hashMap содержимое: {hash_map}")
        except Exception as e:
            print(f"  ❌ Ошибка загрузки hash-map.json: {e}")
    else:
        print(f"  ⚠️ hash-map.json НЕ НАЙДЕН!")
        print(f"  ⚠️ Это означает, что сборка фронтенда еще не прошла на сервере")
        print(f"  ⚠️ Проверьте логи Railway на этапе 'install' - должна быть команда 'npm run build'")
    
    # Проверяем наличие JS файлов
    js_dir = public_dir / "js"
    if js_dir.exists():
        js_files = list(js_dir.glob("*.js"))
        print(f"  - js_dir: {js_dir}")
        print(f"  - Найдено JS файлов: {len(js_files)}")
        if js_files:
            print(f"  - Примеры файлов: {[f.name for f in js_files[:5]]}")
            # Проверяем наличие файлов из hash-map и исправляем, если файл не найден
            if hash_map:
                import json
                hash_map_updated = False
                for name, filename in hash_map.items():
                    if not filename.endswith('.css'):  # Пропускаем CSS
                        file_path = js_dir / filename
                        if file_path.exists():
                            print(f"  ✅ {name} -> {filename} (найден)")
                        else:
                            print(f"  ❌ {name} -> {filename} (НЕ НАЙДЕН!)")
                            # Пробуем найти файл с другим hash
                            pattern = f"{name}.*.js"
                            matching_files = list(js_dir.glob(pattern))
                            if matching_files:
                                new_filename = matching_files[0].name
                                print(f"  🔄 Найден альтернативный файл: {new_filename}")
                                hash_map[name] = new_filename
                                hash_map_updated = True
                            else:
                                print(f"  ⚠️ Альтернативный файл для {name} не найден!")
                
                # Обновляем hash-map.json, если были изменения
                if hash_map_updated:
                    hash_map_path = public_dir / "hash-map.json"
                    try:
                        with open(hash_map_path, 'w', encoding='utf-8') as f:
                            json.dump(hash_map, f, indent=2, ensure_ascii=False)
                        print(f"  ✅ hash-map.json обновлен с исправленными именами файлов")
                    except Exception as e:
                        print(f"  ❌ Ошибка обновления hash-map.json: {e}")
        else:
            print(f"  ⚠️ JS файлы НЕ НАЙДЕНЫ в {js_dir}")
    else:
        print(f"  ⚠️ Директория js/ НЕ НАЙДЕНА: {js_dir}")
    
    # Проверяем наличие CSS файлов
    css_dir = public_dir / "css"
    if css_dir.exists():
        css_files = list(css_dir.glob("*.css"))
        print(f"  - css_dir: {css_dir}")
        print(f"  - Найдено CSS файлов: {len(css_files)}")
        if css_files:
            print(f"  - Примеры файлов: {[f.name for f in css_files[:5]]}")
    else:
        print(f"  ⚠️ Директория css/ НЕ НАЙДЕНА: {css_dir}")
    
    print("=" * 70)
    
    return {
        "webAppUrl": web_app_url,
        "apiBaseUrl": api_base_url,
        "hashMap": hash_map
    }


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Главная страница - простой HTML"""
    if html_file.exists():
        with open(html_file, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>SeligerTinder Backend</h1><p>index.html not found</p>")


@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/api/statsDay")
async def stats_day():
    """Алиас для /api/stats/day (для команды бота)"""
    from routes.stats import get_stats_day
    return await get_stats_day()


if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=PORT,
        log_level=LOG_LEVEL.lower() if 'LOG_LEVEL' in dir() else "info"
    )

