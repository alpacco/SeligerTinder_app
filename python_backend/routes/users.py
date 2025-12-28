"""
routes/users.py
Роуты для управления пользователями
"""
from fastapi import APIRouter, Query, HTTPException, Body, Request
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from db_utils import db_get, db_all, db_run, safe_json_parse
from middleware.security import validate_user_id
from middleware.auth import get_telegram_user_id
import json

router = APIRouter()


class UserCreate(BaseModel):
    userId: Optional[str] = None  # Опционально, если не передан - используется Telegram ID
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
        
        # Проверяем needPhoto: если есть хотя бы одно фото, то needPhoto = 0
        need_photo = row.get("needPhoto", 0)
        if len(photos) > 0:
            # Фильтруем дефолтные фото
            valid_photos = [p for p in photos if p and p.strip() and p not in ["/img/logo.svg", "/img/avatar.svg", "/img/photo.svg"]]
            if len(valid_photos) > 0:
                need_photo = 0
            else:
                need_photo = 1
        
        # Проверяем Pro статус: если срок истек, то is_pro = 0
        is_pro = row.get("is_pro", 0)
        pro_end = row.get("pro_end")
        if is_pro and pro_end:
            from datetime import datetime, timezone
            try:
                # Обрабатываем разные форматы даты
                if isinstance(pro_end, str):
                    # Если строка, парсим ISO формат
                    end_date = datetime.fromisoformat(pro_end.replace('Z', '+00:00'))
                elif hasattr(pro_end, 'isoformat'):
                    # Если это datetime объект (из PostgreSQL)
                    end_date = pro_end
                else:
                    # Неизвестный формат, считаем что Pro активен
                    end_date = None
                
                if end_date:
                    # Сравниваем с текущим временем
                    now = datetime.now(end_date.tzinfo) if hasattr(end_date, 'tzinfo') and end_date.tzinfo else datetime.now(timezone.utc)
                    if end_date < now:
                        is_pro = 0
                        print(f"[getUser] Pro срок истек для userId={userId}, pro_end={pro_end}, now={now}")
            except Exception as e:
                print(f"[getUser] Ошибка проверки Pro срока для userId={userId}: {e}")
        
        # Формируем данные для фронтенда
        # В БД колонка называется superLikesCount (camelCase), не super_likes_count!
        super_likes_camel = row.get("superLikesCount")
        super_likes_snake = row.get("super_likes_count")
        super_likes_final = super_likes_camel if super_likes_camel is not None else (super_likes_snake if super_likes_snake is not None else 0)
        print(f"[getUser] 🔵 superLikesCount для userId={userId}: camel={super_likes_camel}, snake={super_likes_snake}, final={super_likes_final}")
        print(f"[getUser] 🔵 row keys: {list(row.keys())}")
        print(f"[getUser] 🔵 'superLikesCount' in row: {'superLikesCount' in row}")
        print(f"[getUser] 🔵 row.get('superLikesCount'): {row.get('superLikesCount')}")
        print(f"[getUser] 🔵 type(row.get('superLikesCount')): {type(row.get('superLikesCount'))}")
        
        user_data = {
            "userId": row.get("userId"),
            "id": row.get("userId"),
            "name": row.get("name", ""),
            "username": row.get("username", ""),
            "photoUrl": row.get("photoUrl", ""),
            "gender": row.get("gender", ""),
            "bio": row.get("bio", ""),
            "age": row.get("age", 0),
            "super_likes_count": super_likes_final,
            "photos": photos,
            "photo1": row.get("photo1", ""),  # Добавляем отдельные поля для совместимости
            "photo2": row.get("photo2", ""),
            "photo3": row.get("photo3", ""),
            "badge": row.get("badge", ""),
            "likes": safe_json_parse(row.get("likes", "[]")),
            "dislikes": safe_json_parse(row.get("dislikes", "[]")),
            "matches": safe_json_parse(row.get("matches", "[]")),
            "is_pro": is_pro,
            "pro_end": pro_end,
            "needPhoto": need_photo,
            "hideAge": row.get("hideAge", 0),
        }
        
        return {"success": True, "data": user_data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET /api/getUser] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/join")
async def join_user(user: UserCreate, request: Request):
    """Зарегистрировать нового пользователя по Telegram ID"""
    try:
        # Получаем Telegram ID из запроса (основной идентификатор)
        telegram_id = get_telegram_user_id(request)
        
        # Определяем userId: если передан в запросе - используем его, иначе - Telegram ID
        if user.userId:
            final_user_id = user.userId
            print(f"[POST /api/join] userId передан в запросе: {final_user_id}")
        elif telegram_id:
            final_user_id = telegram_id
            print(f"[POST /api/join] userId не передан, используем Telegram ID: {final_user_id}")
        else:
            raise HTTPException(
                status_code=400, 
                detail="userId обязателен. Передайте userId в теле запроса или Telegram ID через заголовки/initData"
            )
        
        print(f"[POST /api/join] Регистрация пользователя: userId={final_user_id}, telegram_id={telegram_id}, name={user.name}")
        
        # Проверяем, существует ли пользователь
        # Используем ? - функция adapt_sql_for_postgres преобразует в $1, $2...
        # ВАЖНО: не используем кавычки вокруг userId в WHERE, чтобы избежать проблем с параметрами
        existing = await db_get('SELECT "userId" FROM users WHERE "userId" = ?', [final_user_id])
        
        if existing:
            print(f"[POST /api/join] Пользователь уже существует: {final_user_id}")
            return {"success": True, "message": "User already exists"}
        
        # Создаём нового пользователя
        # Используем ? - функция adapt_sql_for_postgres преобразует в $1, $2...
        # Используем NOW() вместо datetime('now') для PostgreSQL
        await db_run(
            """INSERT INTO users ("userId", name, username, "photoUrl", gender, "createdAt")
               VALUES (?, ?, ?, ?, ?, NOW())
               ON CONFLICT ("userId") DO NOTHING""",
            [final_user_id, user.name or "", user.username or "", user.photoUrl or "", user.gender or ""]
        )
        
        print(f"[POST /api/join] Пользователь успешно зарегистрирован: {final_user_id}")
        return {"success": True, "message": "User registered", "userId": final_user_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/join] Ошибка: {e}")
        import traceback
        traceback.print_exc()
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
    """Удалить пользователя и все связанные данные"""
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        from pathlib import Path
        from config import IMAGES_DIR
        import shutil
        
        # 1. Удаляем фотографии пользователя из файловой системы
        user_photo_dir = Path(IMAGES_DIR) / str(userId)
        if user_photo_dir.exists() and user_photo_dir.is_dir():
            try:
                shutil.rmtree(user_photo_dir)
                print(f"[POST /api/delete_user] Удалена папка с фотографиями: {user_photo_dir}")
            except Exception as e:
                print(f"[POST /api/delete_user] Ошибка удаления папки с фотографиями: {e}")
        
        # 2. Удаляем записи из visits (где пользователь был посетителем или кого посетили)
        await db_run('DELETE FROM visits WHERE "userId" = ? OR "visitorId" = ?', [userId, userId])
        print(f"[POST /api/delete_user] Удалены записи из visits для userId={userId}")
        
        # 3. Удаляем записи из promo_code_usage
        await db_run('DELETE FROM promo_code_usage WHERE user_id = ?', [userId])
        print(f"[POST /api/delete_user] Удалены записи из promo_code_usage для userId={userId}")
        
        # 4. Удаляем пользователя из likes/dislikes/matches других пользователей
        # Получаем всех пользователей, у которых есть этот userId в likes/dislikes/matches
        all_users = await db_all('SELECT "userId", likes, dislikes, matches FROM users WHERE "userId" != ?', [userId])
        
        for user_row in all_users:
            user_id = user_row.get("userId")
            likes = safe_json_parse(user_row.get("likes", "[]"), [])
            dislikes = safe_json_parse(user_row.get("dislikes", "[]"), [])
            matches = safe_json_parse(user_row.get("matches", "[]"), [])
            
            updated = False
            if userId in likes:
                likes.remove(userId)
                updated = True
            if userId in dislikes:
                dislikes.remove(userId)
                updated = True
            if userId in matches:
                matches.remove(userId)
                updated = True
            
            if updated:
                await db_run(
                    'UPDATE users SET likes = ?, dislikes = ?, matches = ? WHERE "userId" = ?',
                    [json.dumps(likes), json.dumps(dislikes), json.dumps(matches), user_id]
                )
        
        print(f"[POST /api/delete_user] Удален userId={userId} из likes/dislikes/matches других пользователей")
        
        # 5. Удаляем самого пользователя
        result = await db_run('DELETE FROM users WHERE "userId" = ?', [userId])
        if result["changes"] == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        print(f"[POST /api/delete_user] Пользователь userId={userId} успешно удален")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POST /api/delete_user] Ошибка: {e}")
        import traceback
        traceback.print_exc()
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
        # Проверяем needPhoto текущего пользователя (как в get_user_frontend - проверяем наличие фото)
        user_row = await db_get('SELECT "needPhoto", photo1, photo2, photo3, "photoUrl" FROM users WHERE "userId" = ?', [userId])
        if not user_row:
            return {"success": True, "data": []}
        
        # Проверяем наличие фотографий (как в get_user_frontend)
        photos = []
        if user_row.get("photo1"):
            photos.append(user_row["photo1"])
        if user_row.get("photo2"):
            photos.append(user_row["photo2"])
        if user_row.get("photo3"):
            photos.append(user_row["photo3"])
        
        need_photo = user_row.get("needPhoto", 0)
        if len(photos) > 0:
            # Фильтруем дефолтные фото
            valid_photos = [p for p in photos if p and p.strip() and p not in ["/img/logo.svg", "/img/avatar.svg", "/img/photo.svg"]]
            if len(valid_photos) > 0:
                need_photo = 0
            else:
                need_photo = 1
        
        print(f"[GET /api/candidates] needPhoto текущего пользователя (после проверки фото): {need_photo}")
        if need_photo == 1:
            print(f"[GET /api/candidates] Пользователь не имеет фото, возвращаем пустой массив")
            return {"success": True, "data": []}
        
        # Получаем likes/dislikes текущего пользователя
        user_row = await db_get("SELECT likes, dislikes FROM users WHERE userId = ?", [userId])
        liked = safe_json_parse(user_row.get("likes") if user_row else None, [])
        disliked = safe_json_parse(user_row.get("dislikes") if user_row else None, [])
        
        # Преобразуем в строки для сравнения (userId может быть строкой или числом)
        liked_ids = set(str(uid) for uid in liked)
        disliked_ids = set(str(uid) for uid in disliked)
        
        print(f"[GET /api/candidates] userId={userId}, oppositeGender={oppositeGender}")
        print(f"[GET /api/candidates] liked: {liked_ids}, disliked: {disliked_ids}")
        
        # Получаем всех пользователей противоположного пола
        # Примечание: needPhoto может быть строкой или числом, поэтому используем CAST
        rows = await db_all(
            """SELECT "userId", name, username, gender, bio, age, photo1, photo2, photo3, "photoUrl", badge
               FROM users
               WHERE gender = ? AND "userId" != ? AND blocked = 0 AND "needPhoto" = 0""",
            [oppositeGender, userId]
        )
        
        print(f"[GET /api/candidates] Найдено пользователей в БД: {len(rows)}")
        if rows:
            print(f"[GET /api/candidates] Пример первого пользователя: {rows[0]}")
        
        # Фильтруем лайкнутых/дизлайкнутых (сравниваем как строки)
        filtered = [row for row in rows if str(row["userId"]) not in liked_ids and str(row["userId"]) not in disliked_ids]
        
        print(f"[GET /api/candidates] После фильтрации: {len(filtered)}")
        
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
    if "age" in data and data["age"] is not None:
        updates.append("age = ?")
        params.append(data["age"])
    if "hideAge" in data:
        updates.append('"hideAge" = ?')
        params.append(1 if data["hideAge"] else 0)
    if "photos" in data:
        # Обновляем photo1, photo2, photo3 из массива photos
        photos = data["photos"]
        if isinstance(photos, list):
            if len(photos) > 0:
                updates.append("photo1 = ?")
                params.append(photos[0])
            if len(photos) > 1:
                updates.append("photo2 = ?")
                params.append(photos[1])
            if len(photos) > 2:
                updates.append("photo3 = ?")
                params.append(photos[2])
    
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
        # В БД колонка называется lastLogin (camelCase), нужны кавычки для PostgreSQL!
        row = await db_get('SELECT "lastLogin" FROM users WHERE "userId" = ?', [userId])
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        last_login = row.get("lastLogin")
        # Если lastLogin NULL или пустой, возвращаем None
        if not last_login or last_login == 'null' or last_login == '':
            return {"success": True, "lastLogin": None}
        return {"success": True, "lastLogin": last_login}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET /api/last-login/{userId}] Ошибка: {e}")
        import traceback
        traceback.print_exc()
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
        # В БД колонка называется lastLogin (camelCase), нужны кавычки для PostgreSQL!
        await db_run('UPDATE users SET "lastLogin" = ? WHERE "userId" = ?', [last_login, userId])
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

