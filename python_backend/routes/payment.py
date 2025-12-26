"""
routes/payment.py
API роуты для работы с платежами через Telegram Stars
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Dict, Any
from services.payment import create_payment, refund_payment, PRO_PRICES
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class CreatePaymentRequest(BaseModel):
    userId: str
    days: int


class RefundPaymentRequest(BaseModel):
    telegram_charge_id: str


@router.post("/create")
async def create_payment_endpoint(data: CreatePaymentRequest):
    """
    Создает платеж и возвращает данные для sendInvoice
    Используется для инициации покупки PRO через API
    """
    if data.days not in PRO_PRICES:
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемое количество дней: {data.days}. Доступно: {list(PRO_PRICES.keys())}"
        )
    
    try:
        payment_data = await create_payment(data.userId, data.days)
        logger.info(f"✅ [API] Платеж создан: userId={data.userId}, days={data.days}")
        return {
            "success": True,
            "payload": payment_data["payload"],
            "amount": payment_data["amount"],
            "prices": payment_data["prices"]
        }
    except Exception as e:
        logger.error(f"❌ [API] Ошибка создания платежа: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prices")
async def get_prices():
    """Возвращает доступные тарифы PRO"""
    return {
        "success": True,
        "prices": [
            {"days": days, "amount": amount, "label": f"PRO подписка на {days} дней"}
            for days, amount in PRO_PRICES.items()
        ]
    }


@router.post("/refund")
async def refund_payment_endpoint(data: RefundPaymentRequest):
    """
    Возврат платежа (refund)
    Требует авторизации администратора
    """
    # TODO: Добавить проверку авторизации администратора
    from bot import get_bot_application
    
    try:
        bot_application = get_bot_application()
        bot = bot_application.bot if bot_application else None
        
        result = await refund_payment(data.telegram_charge_id, bot=bot)
        if result.get("success"):
            logger.info(f"✅ [API] Платеж возвращен: telegram_charge_id={data.telegram_charge_id}")
            return {"success": True}
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    except Exception as e:
        logger.error(f"❌ [API] Ошибка возврата платежа: {e}")
        raise HTTPException(status_code=500, detail=str(e))

