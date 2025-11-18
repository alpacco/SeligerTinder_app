"""
routes/users.py
Роуты для управления пользователями
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from db_utils import db_get, db_all, db_run, safe_json_parse
from middleware.security import validate_user_id
import json

router = APIRouter()


class UserCreate(BaseModel):
    userId: str
    name: Optional[str] = None
    username: Optional[str] = ""
    photoUrl: Optional[str] = ""
    gender: Optional[str] = ""


class UserUpdate(BaseModel):
    userId: str
    gender: Optional[str] = None
    photoUrl: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None


@router.get("/users")
async def get_all_users():
    """Получить список всех пользователей (ограниченные данные для безопасности)"""
    try:
        # Возвращаем только публичные данные (без чувствительной информации)
        rows = await db_all(
            'SELECT "userId", name, username, age, bio, "photoUrl", gender, badge FROM users'
        )
        return {"success": True, "data": rows}
    except Exception as e:
        print(f"[GET /api/users] Ошибка: {e}")
        return {"success": False, "data": [], "error": "Ошибка получения пользователей"}


@router.get("/user")
async def get_user(userId: str = Query(..., description="ID пользователя")):
    """Получить данные конкретного пользователя"""
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        row = await db_get("SELECT * FROM users WHERE userId = ?", [userId])
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET /api/user] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/getUser")
async def get_user_frontend(userId: str = Query(..., description="ID пользователя")):
    """Получить данные пользователя (для фронтенда)"""
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        row = await db_get("SELECT * FROM users WHERE userId = ?", [userId])
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Формируем массив фото
        photos = []
        if row.get("photo1"):
            photos.append(row["photo1"])
        if row.get("photo2"):
            photos.append(row["photo2"])
        if row.get("photo3"):
            photos.append(row["photo3"])
        
        # Формируем данные для фронтенда
        user_data = {
            "userId": row.get("userId"),
            "id": row.get("userId"),
            "name": row.get("name", ""),
            "username": row.get("username", ""),
            "photoUrl": row.get("photoUrl", ""),
            "gender": row.get("gender", ""),
            "bio": row.get("bio", ""),
            "age": row.get("age", 0),
            "photos": photos,
            "badge": row.get("badge", ""),
            "likes": safe_json_parse(row.get("likes", "[]")),
            "dislikes": safe_json_parse(row.get("dislikes", "[]")),
            "matches": safe_json_parse(row.get("matches", "[]")),
            "is_pro": row.get("is_pro", 0),
            "pro_end": row.get("pro_end"),
        }
        
        return {"success": True, "data": user_data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET /api/getUser] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/join")
async def join_user(user: UserCreate):
    """Зарегистрировать нового пользователя"""
    try:
        # Проверяем, существует ли пользователь
        existing = await db_get("SELECT userId FROM users WHERE userId = ?", [user.userId])
        
        if existing:
            return {"success": True, "message": "User already exists"}
        
        # Создаём нового пользователя
        await db_run(
            """INSERT OR IGNORE INTO users (userId, name, username, photoUrl, gender, createdAt)
               VALUES (?, ?, ?, ?, ?, datetime('now'))""",
            [user.userId, user.name or "", user.username or "", user.photoUrl or "", user.gender or ""]
        )
        
        return {"success": True, "message": "User registered"}
    except Exception as e:
        print(f"[POST /api/join] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateGender")
async def update_gender(data: UserUpdate):
    """Обновить пол пользователя"""
    if not data.userId or not data.gender:
        raise HTTPException(status_code=400, detail="userId and gender required")
    
    try:
        # Обновляем пол
        await db_run(
            "UPDATE users SET gender = ?, needPhoto = ? WHERE userId = ?",
            [data.gender, 1, data.userId]
        )
        
        # TODO: Проверка фото через OpenCV (будет добавлено позже)
        
        return {"success": True, "needPhoto": 1}
    except Exception as e:
        print(f"[POST /api/updateGender] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete_user")
async def delete_user(data: Dict[str, str] = Body(...)):
    """Удалить пользователя"""
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        result = await db_run("DELETE FROM users WHERE userId = ?", [userId])
        if result["changes"] == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/delete_user] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidates")
async def get_candidates(
    userId: str = Query(..., description="ID пользователя"),
    oppositeGender: str = Query(..., description="Противоположный пол")
):
    """Получить кандидатов для свайпа"""
    if not userId or not oppositeGender:
        raise HTTPException(status_code=400, detail="oppositeGender and userId required")
    
    try:
        # Проверяем needPhoto текущего пользователя
        user_row = await db_get("SELECT needPhoto FROM users WHERE userId = ?", [userId])
        if user_row and user_row.get("needPhoto") == 1:
            return {"success": True, "data": []}
        
        # Получаем likes/dislikes текущего пользователя
        user_row = await db_get("SELECT likes, dislikes FROM users WHERE userId = ?", [userId])
        liked = safe_json_parse(user_row.get("likes") if user_row else None, [])
        disliked = safe_json_parse(user_row.get("dislikes") if user_row else None, [])
        
        # Получаем всех пользователей противоположного пола
        rows = await db_all(
            """SELECT userId, name, username, gender, bio, age, photo1, photo2, photo3, photoUrl, badge
               FROM users
               WHERE gender = ? AND userId != ? AND blocked = 0 AND needPhoto = 0""",
            [oppositeGender, userId]
        )
        
        # Фильтруем лайкнутых/дизлайкнутых
        filtered = [row for row in rows if row["userId"] not in liked and row["userId"] not in disliked]
        
        # Обрабатываем каждого пользователя
        data = []
        for row in filtered:
            photos = []
            if row.get("photo1") and row["photo1"].strip():
                photos.append(row["photo1"])
            if row.get("photo2") and row["photo2"].strip():
                photos.append(row["photo2"])
            if row.get("photo3") and row["photo3"].strip():
                photos.append(row["photo3"])
            if not photos:
                if row.get("photoUrl") and row["photoUrl"].strip() and row["photoUrl"] != "/img/logo.svg":
                    photos.append(row["photoUrl"])
                else:
                    photos.append("/img/photo.svg")
            
            data.append({
                "id": row["userId"],
                "userId": row["userId"],
                "name": row.get("name", ""),
                "username": row.get("username", ""),
                "gender": row.get("gender", ""),
                "bio": row.get("bio", ""),
                "age": row.get("age", 0),
                "photos": photos,
                "badge": row.get("badge", "")
            })
        
        return {"success": True, "data": data}
    except Exception as e:
        print(f"[GET /api/candidates] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check")
async def check_user(userId: str = Query(..., description="ID пользователя")):
    """Проверить существование пользователя"""
    if not userId:
        raise HTTPException(status_code=400, detail="userId is required")
    
    try:
        row = await db_get("SELECT 1 FROM users WHERE userId = ?", [userId])
        return {"success": True, "exists": bool(row)}
    except Exception as e:
        print(f"[GET /api/check] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/visit")
async def record_visit(data: Dict[str, str] = Body(...)):
    """Зафиксировать посещение профиля"""
    userId = data.get("userId")
    visitorId = data.get("visitorId")
    
    if not userId or not visitorId:
        raise HTTPException(status_code=400, detail="userId and visitorId are required")
    
    try:
        await db_run(
            "INSERT INTO visits (userId, visitorId, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)",
            [userId, visitorId]
        )
        return {"success": True}
    except Exception as e:
        print(f"[POST /api/visit] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateAge")
async def update_age(data: Dict[str, Any] = Body(...)):
    """Обновить возраст пользователя"""
    userId = data.get("userId")
    age = data.get("age")
    
    if not userId or age is None:
        raise HTTPException(status_code=400, detail="userId and age required")
    
    try:
        result = await db_run("UPDATE users SET age = ? WHERE userId = ?", [age, userId])
        if result.get("changes", 0) == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/updateAge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateBio")
async def update_bio(data: Dict[str, str] = Body(...)):
    """Обновить описание профиля"""
    userId = data.get("userId")
    bio = data.get("bio", "")
    
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        await db_run("UPDATE users SET bio = ? WHERE userId = ?", [bio, userId])
        return {"success": True}
    except Exception as e:
        print(f"[POST /api/updateBio] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update_bio")
async def update_bio_alias(data: Dict[str, str] = Body(...)):
    """Алиас для /api/updateBio (для совместимости с ботом)"""
    return await update_bio(data)


@router.post("/updatePhotoUrl")
async def update_photo_url(data: Dict[str, str] = Body(...)):
    """Обновить photoUrl пользователя"""
    userId = data.get("userId")
    photoUrl = data.get("photoUrl", "")
    
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    # Если есть валидный photoUrl, обновляем needPhoto = 0
    needPhoto = 1
    if photoUrl and photoUrl.startswith("http") and photoUrl != "/img/logo.svg":
        needPhoto = 0
    
    try:
        await db_run(
            "UPDATE users SET photoUrl = ?, needPhoto = ? WHERE userId = ?",
            [photoUrl, needPhoto, userId]
        )
        return {"success": True, "needPhoto": needPhoto}
    except Exception as e:
        print(f"[POST /api/updatePhotoUrl] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updatePhoto")
async def update_photo(data: Dict[str, str] = Body(...)):
    """Обновить конкретное фото пользователя"""
    userId = data.get("userId")
    slot = data.get("slot")
    photoUrl = data.get("photoUrl", "")
    
    if not userId or not slot:
        raise HTTPException(status_code=400, detail="userId and slot are required")
    
    valid_slots = ["photo1", "photo2", "photo3"]
    if slot not in valid_slots:
        raise HTTPException(status_code=400, detail="Invalid slot. Must be one of: photo1, photo2, photo3")
    
    try:
        await db_run(f"UPDATE users SET {slot} = ? WHERE userId = ?", [photoUrl, userId])
        return {"success": True, "updatedSlot": slot, "photoUrl": photoUrl}
    except Exception as e:
        print(f"[POST /api/updatePhoto] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateProfile")
async def update_profile(data: Dict[str, Any] = Body(...)):
    """Обновить профиль пользователя"""
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId is required")
    
    # Проверяем, существует ли пользователь
    user = await db_get("SELECT * FROM users WHERE userId = ?", [userId])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Собираем поля для обновления
    updates = []
    params = []
    
    if "about" in data:
        updates.append("about = ?")
        params.append(data["about"])
    if "bio" in data:
        updates.append("bio = ?")
        params.append(data["bio"])
    if "lookingFor" in data:
        updates.append("lookingFor = ?")
        params.append(data["lookingFor"])
    if "photo" in data:
        updates.append("photo1 = ?")
        params.append(data["photo"])
    if "sex" in data:
        updates.append("gender = ?")
        params.append(data["sex"])
    if "goals" in data:
        updates.append("goals = ?")
        params.append(json.dumps(data["goals"]))
    
    if not updates:
        raise HTTPException(status_code=400, detail="Нет полей для обновления")
    
    params.append(userId)
    sql = f"UPDATE users SET {', '.join(updates)} WHERE userId = ?"
    
    try:
        await db_run(sql, params)
        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        print(f"[POST /api/updateProfile] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/last-login/{userId}")
async def get_last_login(userId: str):
    """Получить время последнего входа"""
    try:
        row = await db_get("SELECT lastLogin FROM users WHERE userId = ?", [userId])
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "lastLogin": row.get("lastLogin")}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET /api/last-login/{userId}] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/last-login")
async def update_last_login(data: Dict[str, str] = Body(...)):
    """Обновить время последнего входа"""
    userId = data.get("userId")
    if not userId or userId == "UserID":
        raise HTTPException(status_code=400, detail="Invalid userId for last-login update")
    
    from datetime import datetime
    last_login = datetime.now().isoformat()
    
    try:
        await db_run("UPDATE users SET lastLogin = ? WHERE userId = ?", [last_login, userId])
        return {"success": True, "message": "Last login time updated"}
    except Exception as e:
        print(f"[POST /api/last-login] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request-badge")
async def request_badge(data: Dict[str, str] = Body(...)):
    """Отправить запрос на получение бейджа"""
    userId = data.get("userId")
    badgeType = data.get("badgeType")
    justification = data.get("justification")
    
    if not userId or not badgeType or not justification:
        raise HTTPException(status_code=400, detail="userId, badgeType, and justification are required")
    
    try:
        await db_run(
            "INSERT INTO badge_requests (userId, badge_type, justification, status) VALUES (?, ?, ?, ?)",
            [userId, badgeType, justification, "pending"]
        )
        return {"success": True, "message": "Request submitted"}
    except Exception as e:
        print(f"[POST /api/request-badge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get-badge-requests")
async def get_badge_requests():
    """Получить все запросы на бейджи"""
    try:
        rows = await db_all("SELECT * FROM badge_requests WHERE status = ? ORDER BY createdAt DESC", ["pending"])
        return {"success": True, "data": rows}
    except Exception as e:
        print(f"[GET /api/get-badge-requests] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-badge")
async def approve_badge(data: Dict[str, int] = Body(...)):
    """Одобрить заявку на бейдж"""
    requestId = data.get("requestId")
    if not requestId:
        raise HTTPException(status_code=400, detail="requestId is required")
    
    try:
        request = await db_get("SELECT * FROM badge_requests WHERE id = ?", [requestId])
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Обновляем бейдж пользователя
        await db_run("UPDATE users SET badge = ? WHERE userId = ?", [request["badge_type"], request["userId"]])
        # Обновляем статус заявки
        await db_run("UPDATE badge_requests SET status = ? WHERE id = ?", ["approved", requestId])
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/approve-badge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-badge")
async def reject_badge(data: Dict[str, int] = Body(...)):
    """Отклонить заявку на бейдж"""
    requestId = data.get("requestId")
    if not requestId:
        raise HTTPException(status_code=400, detail="requestId is required")
    
    try:
        result = await db_run(
            "UPDATE badge_requests SET status = ? WHERE id = ? AND status = ?",
            ["rejected", requestId, "pending"]
        )
        if result.get("changes", 0) == 0:
            raise HTTPException(status_code=404, detail="Request not found or already processed")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/reject-badge] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))

