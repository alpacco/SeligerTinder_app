"""
routes/pro.py
Роуты для работы с PRO-подпиской
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Dict
from pydantic import BaseModel
from db_utils import db_get, db_run
from datetime import datetime, timedelta, timezone

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
    
    # Получаем текущее количество суперлайков
    # В БД колонка называется superLikesCount (camelCase)!
    user_row = await db_get('SELECT "superLikesCount" FROM users WHERE "userId" = ?', [data.userId])
    current_super_likes = user_row.get("superLikesCount", 0) if user_row else 0
    
    # Если суперлайков 0 или отсутствуют, выделяем 3 при выдаче PRO
    if current_super_likes == 0 or current_super_likes is None:
        await db_run('UPDATE users SET is_pro = 1, "pro_end" = ?, "superLikesCount" = 3 WHERE "userId" = ?', 
                     [new_end, data.userId])
        print(f"PRO granted for user {data.userId}, new end: {new_end}, superLikesCount set to 3")
    else:
        await db_run('UPDATE users SET is_pro = 1, "pro_end" = ? WHERE "userId" = ?', [new_end, data.userId])
        print(f"PRO granted for user {data.userId}, new end: {new_end}, superLikesCount kept: {current_super_likes}")
    
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
    
    # Получаем текущее количество суперлайков
    # В БД колонка называется superLikesCount (camelCase)!
    user_row = await db_get('SELECT "superLikesCount" FROM users WHERE "userId" = ?', [data.userId])
    current_super_likes = user_row.get("superLikesCount", 0) if user_row else 0
    
    # Если суперлайков 0 или отсутствуют, выделяем 3 при обновлении PRO
    if current_super_likes == 0 or current_super_likes is None:
        await db_run('UPDATE users SET is_pro = 1, "pro_end" = ?, "superLikesCount" = 3 WHERE "userId" = ?', 
                     [new_end, data.userId])
        print(f"PRO upgraded for user {data.userId}, new end: {new_end}, superLikesCount set to 3")
    else:
        await db_run('UPDATE users SET is_pro = 1, "pro_end" = ? WHERE "userId" = ?', [new_end, data.userId])
        print(f"PRO upgraded for user {data.userId}, new end: {new_end}, superLikesCount kept: {current_super_likes}")
    
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


class ActivatePromoCodeRequest(BaseModel):
    userId: str
    promoCode: str


@router.post("/activatePromoCode")
async def activate_promo_code(data: ActivatePromoCodeRequest):
    """Активировать промокод для пользователя"""
    print(f"🔵 [activatePromoCode] Запрос: userId={data.userId}, promoCode={data.promoCode}")
    
    if not data.userId or not data.promoCode:
        raise HTTPException(status_code=400, detail="userId and promoCode are required")
    
    promo_code = data.promoCode.strip().upper()
    print(f"🔵 [activatePromoCode] Обработанный промокод: {promo_code}")
    
    # Проверяем существование промокода и его активность
    promo_row = await db_get(
        'SELECT id, days, is_active, expires_at FROM promo_codes WHERE code = ?',
        [promo_code]
    )
    
    if not promo_row:
        print(f"❌ [activatePromoCode] Промокод не найден: {promo_code}")
        return {"success": False, "error": "Промокод не найден"}
    
    print(f"✅ [activatePromoCode] Промокод найден: id={promo_row.get('id')}, days={promo_row.get('days')}, is_active={promo_row.get('is_active')}")
    
    if not promo_row.get("is_active"):
        print(f"❌ [activatePromoCode] Промокод неактивен: {promo_code}")
        return {"success": False, "error": "Промокод неактивен"}
    
    # Проверяем срок действия промокода
    expires_at = promo_row.get("expires_at")
    if expires_at:
        now = datetime.now(timezone.utc)
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at < now:
            return {"success": False, "error": "Промокод истек"}
    
    promo_code_id = promo_row["id"]
    days = promo_row["days"]
    
    # Проверяем, не использовал ли пользователь этот промокод ранее
    usage_row = await db_get(
        'SELECT id FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?',
        [promo_code_id, data.userId]
    )
    
    if usage_row:
        return {"success": False, "error": "Вы уже использовали этот промокод"}
    
    # Активируем PRO подписку
    now = datetime.now(timezone.utc)
    
    # Получаем текущее pro_end
    user_row = await db_get('SELECT "pro_end" FROM users WHERE "userId" = ?', [data.userId])
    
    base_time = now
    if user_row and user_row.get("pro_end"):
        try:
            existing = datetime.fromisoformat(user_row["pro_end"].replace("Z", "+00:00"))
            if existing > now:
                base_time = existing
        except (ValueError, TypeError):
            pass
    
    new_end = (base_time + timedelta(days=days)).isoformat()
    
    # Получаем текущее количество суперлайков
    # В БД колонка называется superLikesCount (camelCase)!
    user_row = await db_get('SELECT "superLikesCount" FROM users WHERE "userId" = ?', [data.userId])
    current_super_likes = user_row.get("superLikesCount", 0) if user_row else 0
    print(f"🔵 [activatePromoCode] Текущее количество суперлайков: {current_super_likes}")
    
    # Если суперлайков 0 или отсутствуют, выделяем 3 при активации PRO
    if current_super_likes == 0 or current_super_likes is None:
        await db_run(
            'UPDATE users SET is_pro = 1, "pro_end" = ?, "superLikesCount" = 3 WHERE "userId" = ?',
            [new_end, data.userId]
        )
        print(f"✅ [activatePromoCode] Суперлайки начислены: user_id={data.userId}, superLikesCount set to 3")
    else:
        await db_run(
            'UPDATE users SET is_pro = 1, "pro_end" = ? WHERE "userId" = ?',
            [new_end, data.userId]
        )
        print(f"ℹ️ [activatePromoCode] Суперлайки не изменены: user_id={data.userId}, superLikesCount kept: {current_super_likes}")
    
    # Записываем использование промокода
    await db_run(
        'INSERT INTO promo_code_usage (promo_code_id, user_id) VALUES (?, ?)',
        [promo_code_id, data.userId]
    )
    
    print(f"✅ Промокод активирован: user_id={data.userId}, promo_code={promo_code}, days={days}, pro_end={new_end}")
    
    return {
        "success": True,
        "days": days,
        "pro_end": new_end,
        "message": f"✅ Промокод активирован! PRO подписка продлена на {days} дней."
    }

