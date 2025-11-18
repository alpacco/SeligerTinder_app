"""
routes/pro.py
Роуты для работы с PRO-подпиской
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Dict
from pydantic import BaseModel
from db_utils import db_get, db_run
from datetime import datetime, timedelta

router = APIRouter()


class GrantProRequest(BaseModel):
    userId: str
    days: int


class UpgradeProRequest(BaseModel):
    userId: str
    durationDays: int


class CancelProRequest(BaseModel):
    userId: str


@router.post("/grantPro")
async def grant_pro(data: GrantProRequest):
    """Выдать PRO-подписку пользователю (для команды бота)"""
    if not data.userId or data.days < 1:
        raise HTTPException(status_code=400, detail="userId and days (positive) are required")
    
    now = datetime.now()
    
    # Получаем текущее pro_end
    row = await db_get('SELECT "pro_end" FROM users WHERE "userId" = ?', [data.userId])
    
    base_time = now
    if row and row.get("pro_end"):
        try:
            existing = datetime.fromisoformat(row["pro_end"].replace("Z", "+00:00"))
            if existing > now:
                base_time = existing
        except (ValueError, TypeError):
            pass
    
    new_end = (base_time + timedelta(days=data.days)).isoformat()
    
    await db_run('UPDATE users SET is_pro = 1, "pro_end" = ? WHERE "userId" = ?', [new_end, data.userId])
    
    print(f"PRO granted for user {data.userId}, new end: {new_end}")
    return {"success": True, "is_pro": 1, "pro_end": new_end, "end": new_end}


@router.post("/upgrade")
async def upgrade_pro(data: UpgradeProRequest):
    """Обновить PRO-подписку"""
    if not data.userId or data.durationDays < 1:
        raise HTTPException(status_code=400, detail="userId and durationDays (positive) are required")
    
    now = datetime.now()
    
    row = await db_get('SELECT "pro_end" FROM users WHERE "userId" = ?', [data.userId])
    
    base_time = now
    if row and row.get("pro_end"):
        try:
            existing = datetime.fromisoformat(row["pro_end"].replace("Z", "+00:00"))
            if existing > now:
                base_time = existing
        except (ValueError, TypeError):
            pass
    
    new_end = (base_time + timedelta(days=data.durationDays)).isoformat()
    
    await db_run('UPDATE users SET is_pro = 1, "pro_end" = ? WHERE "userId" = ?', [new_end, data.userId])
    
    print(f"PRO upgraded for user {data.userId}, new end: {new_end}")
    return {"success": True, "is_pro": 1, "pro_end": new_end}


@router.get("/status")
async def get_pro_status(userId: str = Query(..., description="ID пользователя")):
    """Получить статус PRO-подписки"""
    if not userId:
        raise HTTPException(status_code=400, detail="userId is required")
    
    row = await db_get('SELECT is_pro, "pro_end" FROM users WHERE "userId" = ?', [userId])
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "is_pro": row.get("is_pro", 0), "pro_end": row.get("pro_end")}


@router.post("/cancel")
async def cancel_pro(data: CancelProRequest):
    """Отменить PRO-подписку"""
    if not data.userId:
        raise HTTPException(status_code=400, detail="userId is required")
    
    await db_run('UPDATE users SET is_pro = 0 WHERE "userId" = ?', [data.userId])
    print(f"PRO cancelled for user {data.userId}")
    return {"success": True}

