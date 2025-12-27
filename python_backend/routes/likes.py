"""
routes/likes.py
Роуты для лайков, дизлайков и суперлайков
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Dict, List
from pydantic import BaseModel
from db_utils import db_get, db_all, db_run, safe_json_parse
import json

router = APIRouter()


class LikeRequest(BaseModel):
    fromUser: str
    toUser: str


class DislikeRequest(BaseModel):
    fromUser: str
    toUser: str


class SuperlikeRequest(BaseModel):
    senderId: str
    receiverId: str


@router.post("/like")
async def like_user(data: LikeRequest):
    """Поставить лайк пользователю"""
    if not data.toUser:
        raise HTTPException(status_code=400, detail="toUser обязателен")
    
    # Получаем данные отправителя
    from_user_row = await db_get("SELECT likes, matches FROM users WHERE userId = ?", [data.fromUser])
    if not from_user_row:
        raise HTTPException(status_code=404, detail="Отправитель не найден")
    
    likes = safe_json_parse(from_user_row.get("likes"), [])
    matches = safe_json_parse(from_user_row.get("matches"), [])
    
    # Добавляем лайк, если его еще нет
    if data.toUser not in likes:
        likes.append(data.toUser)
        await db_run("UPDATE users SET likes = ? WHERE userId = ?", [json.dumps(likes), data.fromUser])
    
    # Проверяем взаимный лайк
    to_user_row = await db_get("SELECT likes, matches FROM users WHERE userId = ?", [data.toUser])
    if not to_user_row:
        raise HTTPException(status_code=404, detail="Получатель не найден")
    
    likes2 = safe_json_parse(to_user_row.get("likes"), [])
    matches2 = safe_json_parse(to_user_row.get("matches"), [])
    is_match = False
    
    if data.fromUser in likes2:
        is_match = True
        if data.toUser not in matches:
            matches.append(data.toUser)
            await db_run("UPDATE users SET matches = ? WHERE userId = ?", [json.dumps(matches), data.fromUser])
        if data.fromUser not in matches2:
            matches2.append(data.fromUser)
            await db_run("UPDATE users SET matches = ? WHERE userId = ?", [json.dumps(matches2), data.toUser])
    
    return {"success": True, "match": is_match}


@router.post("/dislike")
async def dislike_user(data: DislikeRequest):
    """Поставить дизлайк пользователю"""
    if not data.toUser:
        raise HTTPException(status_code=400, detail="toUser обязателен")
    
    from_user_row = await db_get("SELECT dislikes FROM users WHERE userId = ?", [data.fromUser])
    if not from_user_row:
        raise HTTPException(status_code=404, detail="Отправитель не найден")
    
    dislikes = safe_json_parse(from_user_row.get("dislikes"), [])
    if data.toUser not in dislikes:
        dislikes.append(data.toUser)
        await db_run("UPDATE users SET dislikes = ? WHERE userId = ?", [json.dumps(dislikes), data.fromUser])
    
    return {"success": True}


@router.post("/superlike")
async def superlike_user(data: SuperlikeRequest):
    """Поставить суперлайк пользователю"""
    if not data.receiverId:
        raise HTTPException(status_code=400, detail="receiverId обязателен")
    
    # В БД колонка называется superLikesCount (camelCase)!
    sender_row = await db_get("SELECT \"superLikesCount\" FROM users WHERE \"userId\" = ?", [data.senderId])
    if not sender_row:
        raise HTTPException(status_code=404, detail="Отправитель не найден")
    
    # TODO: Реализовать логику суперлайков (проверка лимита, запись в БД)
    
    return {"success": True}


@router.get("/likesReceived")
async def get_likes_received(userId: str = Query(..., description="ID пользователя")):
    """Получить количество пользователей, которые лайкнули текущего пользователя"""
    # Находим всех пользователей, у которых в likes есть userId текущего пользователя
    # Используем jsonb_array_elements_text для развертывания массива и проверки наличия значения
    try:
        sql = """
            SELECT COUNT(*) as count
            FROM users
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(likes::jsonb) AS elem
                WHERE elem = %s
            )
        """
        result = await db_get(sql, [userId])
        
        if not result:
            return {"success": True, "count": 0}
        
        count = result.get("count", 0)
        return {"success": True, "count": count}
    except Exception as e:
        print(f"[GET /api/likesReceived] Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return {"success": True, "count": 0}


@router.get("/likesMade")
async def get_likes_made(userId: str = Query(..., description="ID пользователя")):
    """Получить список пользователей, которым поставил лайк текущий пользователь"""
    user_row = await db_get("SELECT likes FROM users WHERE userId = ?", [userId])
    if not user_row:
        return {"success": True, "likes": []}
    
    liked_user_ids = safe_json_parse(user_row.get("likes"), [])
    if not liked_user_ids:
        return {"success": True, "likes": []}
    
    placeholders = ",".join(["?"] * len(liked_user_ids))
    sql = f"""
        SELECT userId, username, photo1, photo2, photo3, bio, age, name
        FROM users
        WHERE userId IN ({placeholders})
    """
    rows = await db_all(sql, liked_user_ids)
    
    return {"success": True, "likes": rows}

