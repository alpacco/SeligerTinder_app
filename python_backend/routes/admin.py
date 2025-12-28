"""
routes/admin.py
Роуты для администратора (требуют авторизации через Telegram ID)
"""
from fastapi import APIRouter, Query, HTTPException, Body, Header, Request
from typing import Dict, Optional
from pydantic import BaseModel
from db_utils import db_get, db_all, db_run
from middleware.auth import verify_admin
from middleware.security import validate_user_id

router = APIRouter()


class UpdateBadgeRequest(BaseModel):
    userId: str
    badge: str


@router.get("/get-user-data-for-badge")
async def get_user_data_for_badge(
    request: Request,
    userId: str = Query(..., description="ID пользователя"),
    authorization: Optional[str] = Header(None)
):
    """Получить данные пользователя для заявки на бейдж (требует авторизации)"""
    verify_admin(request, authorization)
    if not userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    
    try:
        userId = validate_user_id(userId)
        user = await db_get(
            'SELECT "userId", name, age, bio, "photo1", "photo2", "photo3" FROM users WHERE "userId" = ?',
            [userId]
        )
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"success": True, "user": user}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[get-user-data-for-badge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения данных пользователя")


@router.get("/get-all-users-for-admin")
async def get_all_users_for_admin(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Получить всех пользователей (админ, требует авторизации)"""
    verify_admin(request, authorization)
    try:
        users = await db_all("SELECT * FROM users")
        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[get-all-users-for-admin] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения пользователей")


@router.get("/search-users-for-admin")
async def search_users_for_admin(
    request: Request,
    query: str = Query(..., description="Поисковый запрос"),
    authorization: Optional[str] = Header(None)
):
    """Поиск пользователей (админ, требует авторизации)"""
    verify_admin(request, authorization)
    if not query:
        raise HTTPException(status_code=400, detail="query обязателен")
    
    # Ограничиваем длину запроса
    if len(query) > 100:
        raise HTTPException(status_code=400, detail="Поисковый запрос слишком длинный")
    
    try:
        search_term = f"%{query}%"
        users = await db_all(
            'SELECT * FROM users WHERE name LIKE ? OR username LIKE ? OR "userId" LIKE ?',
            [search_term, search_term, search_term]
        )
        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[search-users-for-admin] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка поиска пользователей")


@router.post("/update-user-for-admin")
async def update_user_for_admin(
    request: Request,
    data: Dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Обновить данные пользователя (админ, требует авторизацию)"""
    verify_admin(request, authorization)
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    
    try:
        # Валидация userId
        userId = validate_user_id(userId)
        
        # Получаем все поля кроме userId
        fields = {k: v for k, v in data.items() if k != "userId"}
        if not fields:
            raise HTTPException(status_code=400, detail="Нет полей для обновления")
        
        # Разрешенные поля для обновления (whitelist)
        allowed_fields = {
            "name", "username", "bio", "age", "gender", "badge", "blocked",
            "is_pro", "pro_start", "pro_end", "warned", "pushSent"
        }
        
        # Фильтруем только разрешенные поля
        fields = {k: v for k, v in fields.items() if k in allowed_fields}
        if not fields:
            raise HTTPException(status_code=400, detail="Нет разрешенных полей для обновления")
        
        # Строим SQL запрос безопасно (используя кавычки для camelCase)
        updates = [f'"{key}" = ?' for key in fields.keys()]
        sql = f'UPDATE users SET {", ".join(updates)} WHERE "userId" = ?'
        params = list(fields.values()) + [userId]
        
        result = await db_run(sql, params)
        if result.get("changes", 0) == 0:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"success": True, "message": "Данные пользователя обновлены"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[update-user-for-admin] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления пользователя")


@router.post("/delete-user-for-admin")
async def delete_user_for_admin(
    request: Request,
    data: Dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Удалить пользователя (админ, требует авторизации)"""
    verify_admin(request, authorization)
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    
    try:
        # Валидация userId
        userId = validate_user_id(userId)
        
        result = await db_run('DELETE FROM users WHERE "userId" = ?', [userId])
        if result.get("changes", 0) == 0:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"success": True, "message": "Пользователь удален"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[delete-user-for-admin] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления пользователя")


@router.post("/send-message-for-admin")
async def send_message_for_admin(
    request: Request,
    data: Dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Отправить сообщение пользователю (админ, требует авторизации)"""
    verify_admin(request, authorization)
    userId = data.get("userId")
    message = data.get("message")
    
    if not userId or not message:
        raise HTTPException(status_code=400, detail="userId and message required")
    
    # Валидация
    userId = validate_user_id(userId)
    
    # Ограничение длины сообщения
    if len(message) > 4096:
        raise HTTPException(status_code=400, detail="Сообщение слишком длинное")
    
    try:
        # TODO: Реализовать отправку через Telegram Bot API
        print(f"Сообщение для {userId}: {message}")
        return {"success": True, "message": "Сообщение отправлено (симуляция)."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[send-message-for-admin] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка отправки сообщения")


@router.post("/updateBadge")
async def update_badge(
    request: Request,
    data: UpdateBadgeRequest,
    authorization: Optional[str] = Header(None)
):
    """Обновить бейдж пользователя (требует авторизации)"""
    verify_admin(request, authorization)
    try:
        # Валидация
        userId = validate_user_id(data.userId)
        
        # Извлекаем букву бейджа из URL, если передан URL (например, "/label/S.svg" -> "S")
        badge_value = data.badge
        if badge_value.startswith("/label/") and badge_value.endswith(".svg"):
            # Извлекаем букву из пути: "/label/S.svg" -> "S"
            badge_value = badge_value.replace("/label/", "").replace(".svg", "").upper()
        elif "/" in badge_value or "." in badge_value:
            # Если это похоже на путь, но не стандартный формат, пытаемся извлечь последнюю часть
            badge_value = badge_value.split("/")[-1].replace(".svg", "").upper()
        
        # Валидация badge (только разрешенные значения)
        allowed_badges = {"", "L", "P", "S", "DN", "LV", "VERIFIED", "PREMIUM", "ADMIN"}
        badge_value_upper = badge_value.upper()
        if badge_value_upper not in allowed_badges:
            raise HTTPException(status_code=400, detail=f"Недопустимый бейдж: {badge_value}. Разрешенные значения: {', '.join(allowed_badges)}")
        
        # Сохраняем в верхнем регистре для консистентности
        result = await db_run('UPDATE users SET badge = ? WHERE "userId" = ?', [badge_value_upper, userId])
        if result.get("changes", 0) == 0:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"success": True, "message": f"Бейдж для пользователя {userId} обновлен."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[updateBadge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления бейджа")


@router.post("/extract-data")
async def extract_data(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Распаковать данные из архива (админ, требует авторизации)"""
    verify_admin(request, authorization)
    try:
        from config import extract_data_if_needed
        from pathlib import Path
        
        # Проверяем наличие архива
        tmp_dir = Path("/tmp")
        archives = sorted(tmp_dir.glob("data-backup-*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        
        if not archives:
            return {"success": False, "message": "Архивы данных не найдены в /tmp"}
        
        archive_path = archives[0]
        
        # Вызываем функцию распаковки
        extract_data_if_needed()
        
        # Проверяем результат
        from config import IMAGES_DIR
        img_dir = Path(IMAGES_DIR)
        img_count = sum(1 for _ in img_dir.rglob('*') if _.is_file()) if img_dir.exists() else 0
        
        return {
            "success": True,
            "message": f"Данные распакованы из {archive_path.name}",
            "archive": str(archive_path),
            "images_count": img_count
        }
    except Exception as e:
        print(f"[extract-data] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка распаковки данных: {str(e)}")


@router.get("/pro-stats")
async def get_pro_stats(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Получить статистику PRO пользователей (админ, требует авторизации)"""
    verify_admin(request, authorization)
    try:
        from datetime import datetime
        
        # Всего пользователей с is_pro = 1
        total_pro_row = await db_get('SELECT COUNT(*) AS count FROM users WHERE is_pro = 1')
        total_pro = total_pro_row.get("count", 0) if total_pro_row else 0
        
        # Активные PRO (с неистекшим сроком)
        now = datetime.now().isoformat()
        active_pro_row = await db_get(
            'SELECT COUNT(*) AS count FROM users WHERE is_pro = 1 AND "pro_end" > ?',
            [now]
        )
        active_pro = active_pro_row.get("count", 0) if active_pro_row else 0
        
        # Истекшие PRO
        expired_pro = total_pro - active_pro
        
        # Всего пользователей
        total_users_row = await db_get('SELECT COUNT(*) AS count FROM users')
        total_users = total_users_row.get("count", 0) if total_users_row else 0
        
        # Процент PRO от общего числа
        pro_percentage = round((total_pro / total_users * 100) if total_users > 0 else 0, 2)
        active_pro_percentage = round((active_pro / total_users * 100) if total_users > 0 else 0, 2)
        
        return {
            "success": True,
            "stats": {
                "total_pro": total_pro,
                "active_pro": active_pro,
                "expired_pro": expired_pro,
                "total_users": total_users,
                "pro_percentage": pro_percentage,
                "active_pro_percentage": active_pro_percentage
            }
        }
    except Exception as e:
        print(f"[pro-stats] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики PRO: {str(e)}")


@router.get("/admin_help")
async def admin_help(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Получить список всех доступных команд для администратора"""
    verify_admin(request, authorization)
    
    help_text = {
        "title": "📋 Список команд для администратора",
        "description": "Доступные команды бота и API эндпоинты",
        "bot_commands": [
            {
                "command": "/start",
                "description": "Начать работу с ботом",
                "usage": "/start [buy_pro_menu]",
                "example": "/start или /start buy_pro_menu"
            },
            {
                "command": "/grantpro",
                "description": "Выдать PRO подписку пользователю",
                "usage": "/grantpro <userId> <days>",
                "example": "/grantpro 307954967 30"
            },
            {
                "command": "/addbadge",
                "description": "Выдать бейдж пользователю",
                "usage": "/addbadge <userId> <badge>",
                "example": "/addbadge 307954967 S",
                "note": "Доступные бейджи: L, P, S, DN, LV, VERIFIED, PREMIUM, ADMIN"
            },
            {
                "command": "/stats",
                "description": "Получить статистику приложения",
                "usage": "/stats",
                "example": "/stats"
            },
            {
                "command": "/prostats",
                "description": "Получить статистику PRO пользователей",
                "usage": "/prostats",
                "example": "/prostats",
                "note": "Показывает общее количество PRO, активных PRO, истекших PRO и проценты"
            },
            {
                "command": "/delete_user",
                "description": "Удалить пользователя",
                "usage": "/delete_user <userId>",
                "example": "/delete_user 307954967"
            },
            {
                "command": "/clear_photos",
                "description": "Очистить фотографии пользователя",
                "usage": "/clear_photos <userId>",
                "example": "/clear_photos 307954967"
            },
            {
                "command": "/masssend",
                "description": "Массовая рассылка сообщений всем пользователям",
                "usage": "/masssend <сообщение>",
                "example": "/masssend Привет всем пользователям!"
            }
        ],
        "api_endpoints": [
            {
                "method": "GET",
                "endpoint": "/api/admin/get-all-users-for-admin",
                "description": "Получить всех пользователей",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>"
            },
            {
                "method": "GET",
                "endpoint": "/api/admin/search-users-for-admin?query=<query>",
                "description": "Поиск пользователей по имени, username или userId",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "example": "/api/admin/search-users-for-admin?query=Иван"
            },
            {
                "method": "GET",
                "endpoint": "/api/admin/get-user-data-for-badge?userId=<userId>",
                "description": "Получить данные пользователя для заявки на бейдж",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "example": "/api/admin/get-user-data-for-badge?userId=307954967"
            },
            {
                "method": "POST",
                "endpoint": "/api/admin/update-user-for-admin",
                "description": "Обновить данные пользователя",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "body": {
                    "userId": "string (обязательно)",
                    "name": "string (опционально)",
                    "username": "string (опционально)",
                    "bio": "string (опционально)",
                    "age": "number (опционально)",
                    "gender": "string (опционально)",
                    "badge": "string (опционально)",
                    "blocked": "boolean (опционально)",
                    "is_pro": "boolean (опционально)",
                    "pro_start": "string (опционально)",
                    "pro_end": "string (опционально)",
                    "warned": "boolean (опционально)",
                    "pushSent": "boolean (опционально)"
                },
                "example": {
                    "userId": "307954967",
                    "name": "Новое имя",
                    "badge": "S"
                }
            },
            {
                "method": "POST",
                "endpoint": "/api/admin/delete-user-for-admin",
                "description": "Удалить пользователя",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "body": {
                    "userId": "string (обязательно)"
                },
                "example": {
                    "userId": "307954967"
                }
            },
            {
                "method": "POST",
                "endpoint": "/api/admin/send-message-for-admin",
                "description": "Отправить сообщение пользователю",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "body": {
                    "userId": "string (обязательно)",
                    "message": "string (обязательно, макс. 4096 символов)"
                },
                "example": {
                    "userId": "307954967",
                    "message": "Привет!"
                }
            },
            {
                "method": "POST",
                "endpoint": "/api/admin/updateBadge",
                "description": "Обновить бейдж пользователя",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "body": {
                    "userId": "string (обязательно)",
                    "badge": "string (обязательно: L, P, S, DN, LV, VERIFIED, PREMIUM, ADMIN или пустая строка)"
                },
                "example": {
                    "userId": "307954967",
                    "badge": "S"
                }
            },
            {
                "method": "POST",
                "endpoint": "/api/admin/extract-data",
                "description": "Распаковать данные из архива",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "note": "Ищет последний архив data-backup-*.tar.gz в /tmp и распаковывает его"
            },
            {
                "method": "GET",
                "endpoint": "/api/admin/pro-stats",
                "description": "Получить статистику PRO пользователей",
                "headers": "Authorization: Bearer <token> или X-Telegram-User-Id: <telegram_id>",
                "returns": {
                    "total_pro": "Общее количество пользователей с PRO",
                    "active_pro": "Количество активных PRO (с неистекшим сроком)",
                    "expired_pro": "Количество истекших PRO",
                    "total_users": "Общее количество пользователей",
                    "pro_percentage": "Процент PRO от общего числа",
                    "active_pro_percentage": "Процент активных PRO от общего числа"
                },
                "example": "/api/admin/pro-stats"
            }
        ],
        "authorization": {
            "methods": [
                "Bearer Token: Authorization: Bearer <ADMIN_TOKEN>",
                "Telegram ID: X-Telegram-User-Id: <telegram_id> (должен быть в ADMIN_TELEGRAM_IDS)"
            ],
            "note": "Для использования API эндпоинтов требуется авторизация через один из методов выше"
        }
    }
    
    return {
        "success": True,
        "help": help_text
    }
