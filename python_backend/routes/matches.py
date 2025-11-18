"""
routes/matches.py
Роуты для работы с совпадениями (matches)
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Dict, List
from pydantic import BaseModel
from db_utils import db_get, db_all, db_run, safe_json_parse
import json

router = APIRouter()


@router.get("/matches")
async def get_matches(userId: str = Query(..., description="ID пользователя")):
    """Получить список совпадений пользователя"""
    user_row = await db_get("SELECT matches FROM users WHERE userId = ?", [userId])
    
    if not user_row:
        return {"success": True, "data": []}
    
    matches_arr = safe_json_parse(user_row.get("matches"), [])
    if not matches_arr:
        return {"success": True, "data": []}
    
    # Получаем информацию о пользователях из matches
    placeholders = ",".join(["?"] * len(matches_arr))
    sql = f"""
        SELECT userId, userId AS id, name, username,
               COALESCE(photo1, photoUrl) AS avatar
        FROM users
        WHERE userId IN ({placeholders})
    """
    rows = await db_all(sql, matches_arr)
    
    data = [
        {
            "id": row["id"],
            "userId": row["userId"],
            "name": row.get("name", ""),
            "username": row.get("username", ""),
            "avatar": row.get("avatar") or "/img/logo.svg",
            "mutual": True
        }
        for row in rows
    ]
    
    return {"success": True, "data": data}


@router.delete("/matches")
async def delete_match(data: Dict[str, str] = Body(...)):
    """Удалить совпадение"""
    userId = data.get("userId")
    matchId = data.get("matchId")
    
    if not userId or not matchId:
        raise HTTPException(status_code=400, detail="userId и matchId обязательны")
    
    async def update_matches(owner_id: str, id_to_remove: str):
        """Обновить список matches для пользователя"""
        row = await db_get("SELECT matches FROM users WHERE userId = ?", [owner_id])
        if not row:
            return
        
        matches = safe_json_parse(row.get("matches"), [])
        new_matches = [m for m in matches if str(m) != str(id_to_remove)]
        await db_run("UPDATE users SET matches = ? WHERE userId = ?", [json.dumps(new_matches), owner_id])
    
    # Удаляем match у обоих пользователей
    await update_matches(userId, matchId)
    await update_matches(matchId, userId)
    
    return {"success": True, "message": "Мэтч удален"}

