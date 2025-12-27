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
    senderId = data.get("senderId") or data.get("userId")  # Поддержка обоих вариантов
    senderUsername = data.get("senderUsername")
    receiverId = data.get("receiverId")
    
    # Проверяем, что все обязательные параметры присутствуют
    if not senderId:
        raise HTTPException(status_code=400, detail="senderId or userId is required")
    if not receiverId:
        raise HTTPException(status_code=400, detail="receiverId is required")
    
    try:
        # Используем правильные имена колонок из таблицы visits: userId и visitorId
        # В PostgreSQL используем %s вместо ?
        await db_run(
            "INSERT INTO visits (\"userId\", \"visitorId\", timestamp) VALUES (%s, %s, CURRENT_TIMESTAMP)",
            [receiverId, senderId]  # receiverId = userId (кто получил), senderId = visitorId (кто отправил)
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


@router.post("/showProMenu")
async def show_pro_menu(data: Dict = Body(...)):
    """Показать меню покупки PRO пользователю"""
    userId = data.get("userId")
    
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    if not BOT_TOKEN:
        raise HTTPException(status_code=500, detail="BOT_TOKEN not configured")
    
    try:
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("7 дней - 100 ⭐", callback_data="buy_pro_7")],
            [InlineKeyboardButton("30 дней - 350 ⭐", callback_data="buy_pro_30")],
            [InlineKeyboardButton("90 дней - 900 ⭐", callback_data="buy_pro_90")],
            [InlineKeyboardButton("Назад", callback_data="show_menu")]
        ])
        
        message_text = (
            "⭐ Выберите период PRO подписки:\n\n"
            "✨ PRO функции:\n"
            "• Неограниченные лайки\n"
            "• Видеть, кто лайкнул вас\n"
            "• Суперлайки\n"
            "• Расширенная статистика"
        )
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": userId,
                    "text": message_text,
                    "reply_markup": keyboard.to_dict()
                }
            )
            response.raise_for_status()
            result = response.json()
            
            if not result.get("ok"):
                raise Exception(f"Telegram API error: {result}")
            
            print(f"✅ [showProMenu] Меню PRO отправлено пользователю {userId}")
            return {"success": True, "result": result.get("result")}
    except Exception as e:
        print(f"❌ [showProMenu] Ошибка: {e}")
        raise HTTPException(status_code=500, detail=str(e))

