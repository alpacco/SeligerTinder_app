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
        
        # Валидация badge (только разрешенные значения)
        allowed_badges = {"", "L", "P", "S", "DN", "LV", "verified", "premium", "admin"}
        if data.badge not in allowed_badges:
            raise HTTPException(status_code=400, detail="Недопустимый бейдж")
        
        result = await db_run('UPDATE users SET badge = ? WHERE "userId" = ?', [data.badge, userId])
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
