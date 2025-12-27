"""
services/payment.py
Сервис для обработки платежей через Telegram Stars
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from db_utils import db_get, db_run
import logging

logger = logging.getLogger(__name__)

# Цены на PRO в Stars (можно вынести в конфиг)
PRO_PRICES = {
    7: 100,   # 7 дней = 100 Stars
    30: 350,  # 30 дней = 350 Stars
    90: 900,  # 90 дней = 900 Stars
}


async def create_payment(user_id: str, days: int) -> Dict[str, Any]:
    """
    Создает новый платеж и возвращает данные для sendInvoice
    
    Args:
        user_id: Telegram user ID
        days: Количество дней PRO подписки
        
    Returns:
        Dict с payload, amount, prices для sendInvoice
    """
    if days not in PRO_PRICES:
        raise ValueError(f"Неподдерживаемое количество дней: {days}. Доступно: {list(PRO_PRICES.keys())}")
    
    amount = PRO_PRICES[days]
    
    # Создаем уникальный payload (для идемпотентности)
    payload = f"pro_{user_id}_{uuid.uuid4().hex[:16]}_{int(datetime.now(timezone.utc).timestamp())}"
    
    # Сохраняем платеж в БД со статусом pending
    try:
        await db_run(
            """INSERT INTO payments (payload, user_id, amount, currency, status)
               VALUES (%s, %s, %s, %s, 'pending')""",
            [payload, user_id, amount, "XTR"]
        )
        logger.info(f"✅ [PAYMENT] Создан платеж: payload={payload}, user_id={user_id}, amount={amount} Stars, days={days}")
    except Exception as e:
        logger.error(f"❌ [PAYMENT] Ошибка создания платежа: {e}")
        raise
    
    return {
        "payload": payload,
        "amount": amount,
        "prices": [{"label": f"PRO подписка на {days} дней", "amount": amount}]
    }


async def process_pre_checkout(pre_checkout_query_id: str, payload: str) -> bool:
    """
    Обрабатывает pre_checkout_query
    
    Args:
        pre_checkout_query_id: ID запроса от Telegram
        payload: invoice_payload из запроса
        
    Returns:
        True если платеж валиден, False если нет
    """
    # Проверяем, что платеж существует и в статусе pending
    payment = await db_get(
        'SELECT * FROM payments WHERE payload = %s AND status = %s',
        [payload, "pending"]
    )
    
    if not payment:
        logger.warning(f"⚠️ [PAYMENT] Pre-checkout: платеж не найден или уже обработан: payload={payload}")
        return False
    
    logger.info(f"✅ [PAYMENT] Pre-checkout подтвержден: payload={payload}, query_id={pre_checkout_query_id}")
    return True


async def process_successful_payment(
    user_id: str,
    payload: str,
    amount: int,
    telegram_charge_id: str,
    days: int
) -> Dict[str, Any]:
    """
    Обрабатывает successful_payment и выдает PRO подписку
    
    Args:
        user_id: Telegram user ID
        payload: invoice_payload
        amount: Сумма в Stars
        telegram_charge_id: ID платежа от Telegram
        days: Количество дней PRO (определяется по amount)
        
    Returns:
        Dict с результатом обработки
    """
    # Проверяем идемпотентность: платеж с таким payload уже обработан?
    existing = await db_get(
        'SELECT * FROM payments WHERE payload = %s AND status = %s',
        [payload, "paid"]
    )
    
    if existing:
        logger.warning(f"⚠️ [PAYMENT] Дубликат successful_payment игнорирован: payload={payload}")
        return {
            "success": False,
            "error": "duplicate",
            "message": "Платеж уже обработан"
        }
    
    # Проверяем, что платеж существует в статусе pending
    payment = await db_get(
        'SELECT * FROM payments WHERE payload = %s AND status = %s',
        [payload, "pending"]
    )
    
    if not payment:
        logger.error(f"❌ [PAYMENT] Платеж не найден или уже обработан: payload={payload}")
        return {
            "success": False,
            "error": "payment_not_found",
            "message": "Платеж не найден"
        }
    
    # Проверяем сумму
    if payment.get("amount") != amount:
        logger.error(f"❌ [PAYMENT] Несоответствие суммы: ожидалось {payment.get('amount')}, получено {amount}")
        return {
            "success": False,
            "error": "amount_mismatch",
            "message": "Несоответствие суммы платежа"
        }
    
    # Обновляем статус платежа на paid
    now = datetime.now(timezone.utc).isoformat()
    await db_run(
        """UPDATE payments 
           SET status = 'paid', 
               telegram_charge_id = %s, 
               paid_at = %s 
           WHERE payload = %s""",
        [telegram_charge_id, now, payload]
    )
    
    # Выдаем PRO подписку
    from datetime import timedelta
    
    try:
        # Получаем текущее pro_end
        user_row = await db_get('SELECT "pro_end" FROM users WHERE "userId" = %s', [user_id])
        
        base_time = datetime.now(timezone.utc)
        if user_row and user_row.get("pro_end"):
            try:
                existing = datetime.fromisoformat(user_row["pro_end"].replace("Z", "+00:00"))
                if existing > base_time:
                    base_time = existing
            except (ValueError, TypeError):
                pass
        
        new_end = (base_time + timedelta(days=days)).isoformat()
        
        # Получаем текущее количество суперлайков
        # В БД колонка называется superLikesCount (camelCase)!
        user_row = await db_get('SELECT "superLikesCount" FROM users WHERE "userId" = %s', [user_id])
        current_super_likes = user_row.get("superLikesCount", 0) if user_row else 0
        
        # Если суперлайков 0 или отсутствуют, выделяем 3 при покупке PRO
        if current_super_likes == 0 or current_super_likes is None:
            await db_run(
                'UPDATE users SET is_pro = 1, "pro_end" = %s, "superLikesCount" = 3 WHERE "userId" = %s',
                [new_end, user_id]
            )
            logger.info(f"✅ [PAYMENT] PRO выдана: user_id={user_id}, days={days}, pro_end={new_end}, superLikesCount set to 3")
        else:
            await db_run(
                'UPDATE users SET is_pro = 1, "pro_end" = %s WHERE "userId" = %s',
                [new_end, user_id]
            )
            logger.info(f"✅ [PAYMENT] PRO выдана: user_id={user_id}, days={days}, pro_end={new_end}, superLikesCount kept: {current_super_likes}")
        
        return {
            "success": True,
            "user_id": user_id,
            "days": days,
            "pro_end": new_end,
            "amount": amount
        }
    except Exception as e:
        logger.error(f"❌ [PAYMENT] Ошибка выдачи PRO: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": "grant_pro_failed",
            "message": str(e)
        }


async def refund_payment(telegram_charge_id: str, bot=None) -> Dict[str, Any]:
    """
    Обрабатывает возврат платежа через Telegram Bot API
    
    Args:
        telegram_charge_id: ID платежа от Telegram
        bot: Экземпляр Telegram Bot (опционально, для вызова refundStarPayment)
        
    Returns:
        Dict с результатом возврата
    """
    # Находим платеж
    payment = await db_get(
        'SELECT * FROM payments WHERE telegram_charge_id = %s',
        [telegram_charge_id]
    )
    
    if not payment:
        logger.error(f"❌ [PAYMENT] Платеж для возврата не найден: telegram_charge_id={telegram_charge_id}")
        return {
            "success": False,
            "error": "payment_not_found"
        }
    
    if payment.get("status") == "refunded":
        logger.warning(f"⚠️ [PAYMENT] Платеж уже возвращен: telegram_charge_id={telegram_charge_id}")
        return {
            "success": False,
            "error": "already_refunded"
        }
    
    # Вызываем refundStarPayment через Telegram Bot API
    if bot:
        try:
            user_id = int(payment.get("user_id"))
            result = await bot.refund_star_payment(
                user_id=user_id,
                telegram_payment_charge_id=telegram_charge_id
            )
            if not result:
                logger.error(f"❌ [PAYMENT] Telegram API отклонил возврат: telegram_charge_id={telegram_charge_id}")
                return {
                    "success": False,
                    "error": "telegram_refund_failed"
                }
        except Exception as e:
            logger.error(f"❌ [PAYMENT] Ошибка вызова refundStarPayment: {e}")
            return {
                "success": False,
                "error": "telegram_api_error",
                "message": str(e)
            }
    
    # Обновляем статус в БД
    now = datetime.now(timezone.utc).isoformat()
    await db_run(
        """UPDATE payments 
           SET status = 'refunded', 
               refunded_at = %s 
           WHERE telegram_charge_id = %s""",
        [now, telegram_charge_id]
    )
    
    logger.info(f"✅ [PAYMENT] Платеж возвращен: telegram_charge_id={telegram_charge_id}")
    
    return {
        "success": True,
        "telegram_charge_id": telegram_charge_id
    }


def get_days_for_amount(amount: int) -> Optional[int]:
    """
    Определяет количество дней PRO по сумме платежа
    
    Args:
        amount: Сумма в Stars
        
    Returns:
        Количество дней или None если сумма не найдена
    """
    for days, price in PRO_PRICES.items():
        if price == amount:
            return days
    return None

