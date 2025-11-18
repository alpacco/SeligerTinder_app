"""
routes/push.py
Роуты для push уведомлений
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import Optional, Dict
import httpx
from db_utils import db_run
from config import BOT_TOKEN

router = APIRouter()


@router.post("/sendPush")
async def send_push(data: Dict = Body(...)):
    """Записать визит (wave) между пользователями"""
    senderId = data.get("senderId")
    senderUsername = data.get("senderUsername")
    receiverId = data.get("receiverId")
    
    try:
        from datetime import datetime
        await db_run(
            "INSERT INTO visits (sender_id, receiver_id, createdAt) VALUES (?, ?, ?)",
            [senderId, receiverId, datetime.now().isoformat()]
        )
        return {"success": True}
    except Exception as e:
        print(f"[sendPush] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/specialPush")
async def special_push(data: Dict = Body(...)):
    """Отправить специальное push уведомление с кастомным сообщением"""
    userId = data.get("userId")
    candidateId = data.get("candidateId")
    message = data.get("message")
    keyboard = data.get("keyboard", {})
    
    if not BOT_TOKEN:
        raise HTTPException(status_code=500, detail="BOT_TOKEN not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": candidateId,
                    "text": message,
                    **keyboard
                }
            )
            response.raise_for_status()
            result = response.json()
            
            if not result.get("ok"):
                raise Exception(f"Telegram API error: {result}")
            
            return {"success": True, "result": result.get("result")}
    except Exception as e:
        print(f"[specialPush] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))

