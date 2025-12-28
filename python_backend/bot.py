"""
bot.py
Telegram бот для SeligerTinder
"""
import os
import asyncio
import httpx
from pathlib import Path
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, LabeledPrice
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
    ContextTypes
)
from telegram.ext.filters import BaseFilter
from dotenv import load_dotenv

load_dotenv()

# Импортируем конфигурацию
from config import BOT_TOKEN, WEB_APP_URL

API_URL = f"{WEB_APP_URL}/api" if WEB_APP_URL else ""

# DEV_CHAT_ID можно вынести в переменные окружения если нужно
DEV_CHAT_ID = int(os.getenv("DEV_CHAT_ID", "0"))  # 0 = отключено
# Состояния пользователей
user_states = {}


# Кастомный фильтр для WebApp данных
class WebAppDataFilter(BaseFilter):
    """Фильтр для сообщений с данными от WebApp"""
    def filter(self, message):
        # Проверяем, что сообщение существует и имеет web_app_data
        if not message:
            return False
        return bool(message.web_app_data)


web_app_data_filter = WebAppDataFilter()


def get_start_keyboard():
    """Клавиатура для команды /start"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✨Открыть Seliger Tinder✨", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("Меню", callback_data="show_menu")]
    ])


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    user_id = update.effective_user.id if update.effective_user else None
    username = update.effective_user.username if update.effective_user else None
    args = context.args  # Получаем аргументы команды /start
    
    print(f"🔵 [BOT] Команда /start от пользователя {user_id} (@{username}), args: {args}")
    
    # Если передан параметр buy_pro_menu, показываем меню покупки PRO
    if args and len(args) > 0 and args[0] == "buy_pro_menu":
        print(f"🔵 [BOT] Запрос меню покупки PRO через /start")
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("7 дней - 100 ⭐", callback_data="buy_pro_7")],
            [InlineKeyboardButton("30 дней - 350 ⭐", callback_data="buy_pro_30")],
            [InlineKeyboardButton("90 дней - 900 ⭐", callback_data="buy_pro_90")],
            [InlineKeyboardButton("🎁 Ввести промокод", callback_data="enter_promo_code")],
            [InlineKeyboardButton("Назад", callback_data="show_menu")]
        ])
        await update.message.reply_text(
            "⭐ Выберите период PRO подписки:\n\n"
            "✨ PRO функции:\n"
            "• Неограниченные лайки\n"
            "• Видеть, кто лайкнул вас\n"
            "• Суперлайки\n"
            "• Расширенная статистика",
            reply_markup=keyboard
        )
        print(f"✅ [BOT] Меню покупки PRO отправлено пользователю {user_id}")
        return
    
    try:
        await update.message.reply_text(
            "Добро пожаловать в SeligerTinder!",
            reply_markup=get_start_keyboard()
        )
        print(f"✅ [BOT] Ответ на /start отправлен пользователю {user_id}")
    except Exception as e:
        print(f"❌ [BOT] Ошибка при отправке ответа на /start: {e}")
        raise


async def grantpro_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /grantpro - выдача PRO-подписки"""
    user_id = update.effective_user.id if update.effective_user else None
    username = update.effective_user.username if update.effective_user else None
    print(f"🔵 [BOT] Команда /grantpro от пользователя {user_id} (@{username})")
    
    if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
        print(f"⚠️ [BOT] Попытка использования /grantpro неавторизованным пользователем {user_id}")
        await update.message.reply_text("❌ Команда /grantpro доступна только администратору.")
        return
    
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Использование: /grantpro <userId> <days>. Например: /grantpro 307954967 30")
        return
    
    target_user_id = args[0]
    try:
        days = int(args[1])
        if days < 1:
            await update.message.reply_text("Количество дней должно быть положительным числом.")
            return
    except ValueError:
        await update.message.reply_text("Количество дней должно быть числом.")
        return
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/grantPro",
                json={"userId": target_user_id, "days": days}
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                end_date = result.get("end", result.get("pro_end"))
                await update.message.reply_text(
                    f"✅ PRO-подписка выдана пользователю {target_user_id} на {days} дней (до {end_date})."
                )
                # Отправляем уведомление пользователю
                await context.bot.send_message(
                    chat_id=target_user_id,
                    text=f"🎉 Вам выдан PRO на {days} дней! Подписка активна до {end_date}."
                )
            else:
                await update.message.reply_text(f"❌ Не удалось выдать PRO: {result.get('error')}")
    except Exception as e:
        print(f"❌ /grantpro ошибка: {e}")
        await update.message.reply_text("❌ Ошибка при выдаче PRO. Попробуйте позже.")


async def addbadge_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /addbadge - установка бейджа"""
    if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
        await update.message.reply_text("❌ Команда /addbadge доступна только администратору.")
        return
    
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Использование: /addbadge <userId> <badge>. Например: /addbadge 307954967 S")
        return
    
    target_user_id = args[0]
    badge_letter = args[1].upper()
    
    if badge_letter not in ["P", "S", "L", "DN", "LV"]:
        await update.message.reply_text("Badge должен быть одним из: P, S, L, DN, LV")
        return
    
    badge_url = f"/label/{badge_letter}.svg"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/updateBadge",
                json={"userId": target_user_id, "badge": badge_url}
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                names = {"S": "Seliger City", "P": "Пик", "L": "Любовь и голуби", "DN": "DN", "LV": "LV"}
                badge_name = names.get(badge_letter, badge_letter)
                await update.message.reply_text("Бэйдж обновлён успешно!")
                await context.bot.send_message(
                    chat_id=target_user_id,
                    text=f"Бэйдж «{badge_name}» успешно добавлен"
                )
            else:
                await update.message.reply_text(f"Ошибка: {result.get('error')}")
    except Exception as e:
        print(f"❌ Ошибка /addbadge: {e}")
        await update.message.reply_text("❌ Ошибка при обновлении бейджа.")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /stats - статистика"""
    if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
        await update.message.reply_text("❌ Команда /stats доступна только администратору.")
        return
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_URL}/statsDay")
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                visits_24h = result.get("visits24h", 0)
                await update.message.reply_text(
                    f"За последние 24 часа зашли {visits_24h} пользователей (по userID).",
                    reply_markup=get_start_keyboard()
                )
            else:
                await update.message.reply_text("❌ Не удалось получить статистику.")
    except Exception as e:
        print(f"❌ Ошибка /stats: {e}")
        await update.message.reply_text("❌ Ошибка при получении статистики.")


async def delete_user_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /delete_user - удаление профиля пользователя"""
    user_id = update.effective_user.id if update.effective_user else None
    username = update.effective_user.username if update.effective_user else None
    print(f"🔵 [BOT] Команда /delete_user от пользователя {user_id} (@{username})")
    
    args = context.args
    target_user_id = str(user_id)  # По умолчанию удаляем свой профиль
    
    # Если указан userId и пользователь - админ, удаляем указанный профиль
    if args and len(args) > 0:
        if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
            await update.message.reply_text("❌ Удаление чужого профиля доступно только администратору.")
            return
        target_user_id = args[0]
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/delete_user",
                json={"userId": target_user_id}
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                if target_user_id == str(user_id):
                    await update.message.reply_text("✅ Ваш профиль удалён. Чтобы начать заново, отправьте /start")
                else:
                    await update.message.reply_text(f"✅ Профиль пользователя {target_user_id} удалён.")
            else:
                await update.message.reply_text(f"❌ Не удалось удалить профиль: {result.get('error')}")
    except Exception as e:
        print(f"❌ Ошибка /delete_user: {e}")
        await update.message.reply_text("❌ Ошибка при удалении профиля.")


async def clear_photos_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /clear_photos - очистка всех фотографий пользователя"""
    user_id = update.effective_user.id if update.effective_user else None
    username = update.effective_user.username if update.effective_user else None
    print(f"🔵 [BOT] Команда /clear_photos от пользователя {user_id} (@{username})")
    
    args = context.args
    target_user_id = str(user_id)  # По умолчанию очищаем свои фото
    
    # Если указан userId и пользователь - админ, очищаем фото указанного пользователя
    if args and len(args) > 0:
        if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
            await update.message.reply_text("❌ Очистка фото другого пользователя доступна только администратору.")
            return
        target_user_id = args[0]
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/photos/clear",
                json={"userId": target_user_id}
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                if target_user_id == str(user_id):
                    await update.message.reply_text("✅ Все ваши фотографии удалены.")
                else:
                    await update.message.reply_text(f"✅ Фотографии пользователя {target_user_id} удалены.")
            else:
                await update.message.reply_text(f"❌ Не удалось очистить фото: {result.get('error')}")
    except Exception as e:
        print(f"❌ Ошибка /clear_photos: {e}")
        await update.message.reply_text("❌ Ошибка при очистке фотографий.")


async def masssend_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /masssend - массовая рассылка сообщений (только для админа)"""
    user_id = update.effective_user.id if update.effective_user else None
    username = update.effective_user.username if update.effective_user else None
    print(f"🔵 [BOT] Команда /masssend от пользователя {user_id} (@{username})")
    
    if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
        await update.message.reply_text("❌ Команда /masssend доступна только администратору.")
        return
    
    args = context.args
    if len(args) < 1:
        await update.message.reply_text(
            "Использование: /masssend <сообщение>\n\n"
            "Пример: /masssend Привет всем пользователям!"
        )
        return
    
    message_text = " ".join(args)
    
    try:
        async with httpx.AsyncClient() as client:
            # Получаем список всех пользователей
            response = await client.get(f"{API_URL}/users")
            response.raise_for_status()
            users_result = response.json()
            
            if not users_result.get("success"):
                await update.message.reply_text("❌ Не удалось получить список пользователей.")
                return
            
            users = users_result.get("users", [])
            if not users:
                await update.message.reply_text("❌ Пользователи не найдены.")
                return
            
            # Отправляем сообщение каждому пользователю
            success_count = 0
            error_count = 0
            
            await update.message.reply_text(f"📤 Начинаю рассылку сообщения {len(users)} пользователям...")
            
            for user in users:
                user_id_str = str(user.get("userId", ""))
                if not user_id_str:
                    continue
                
                try:
                    await context.bot.send_message(
                        chat_id=int(user_id_str),
                        text=message_text
                    )
                    success_count += 1
                except Exception as e:
                    print(f"⚠️ Ошибка отправки сообщения пользователю {user_id_str}: {e}")
                    error_count += 1
                
                # Небольшая задержка, чтобы не превысить лимиты Telegram
                await asyncio.sleep(0.05)
            
            await update.message.reply_text(
                f"✅ Рассылка завершена!\n"
                f"📊 Успешно отправлено: {success_count}\n"
                f"❌ Ошибок: {error_count}"
            )
    except Exception as e:
        print(f"❌ Ошибка /masssend: {e}")
        await update.message.reply_text("❌ Ошибка при массовой рассылке.")


async def send_pro_invoice(update: Update, context: ContextTypes.DEFAULT_TYPE, days: int):
    """Отправляет инвойс для покупки PRO подписки"""
    from services.payment import create_payment
    
    user_id = str(update.effective_user.id)
    
    try:
        payment_data = await create_payment(user_id, days)
        
        # Создаем инвойс через Telegram Bot API
        await context.bot.send_invoice(
            chat_id=update.effective_chat.id,
            title=f"PRO подписка на {days} дней",
            description=f"Получите доступ к PRO функциям на {days} дней",
            payload=payment_data["payload"],
            currency="XTR",  # Telegram Stars
            prices=[LabeledPrice(label=payment_data["prices"][0]["label"], amount=payment_data["amount"])],
            provider_token=None,  # Не используется для Stars
        )
        print(f"✅ [BOT] Инвойс отправлен: user_id={user_id}, days={days}, payload={payment_data['payload']}")
    except Exception as e:
        print(f"❌ [BOT] Ошибка отправки инвойса: {e}")
        await update.message.reply_text("❌ Ошибка при создании платежа. Попробуйте позже.")


async def pre_checkout_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик pre_checkout_query"""
    from services.payment import process_pre_checkout
    
    query = update.pre_checkout_query
    user_id = str(update.effective_user.id)
    payload = query.invoice_payload
    
    print(f"🔵 [BOT] Pre-checkout: user_id={user_id}, payload={payload}")
    
    # Проверяем платеж
    is_valid = await process_pre_checkout(query.id, payload)
    
    if is_valid:
        await query.answer(ok=True)
        print(f"✅ [BOT] Pre-checkout подтвержден: payload={payload}")
    else:
        await query.answer(ok=False, error_message="Платеж не найден или уже обработан")
        print(f"❌ [BOT] Pre-checkout отклонен: payload={payload}")


async def successful_payment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик successful_payment"""
    from services.payment import process_successful_payment, get_days_for_amount
    
    payment = update.message.successful_payment
    user_id = str(update.effective_user.id)
    payload = payment.invoice_payload
    amount = payment.total_amount
    telegram_charge_id = payment.telegram_payment_charge_id
    
    print(f"🔵 [BOT] Successful payment: user_id={user_id}, payload={payload}, amount={amount}")
    
    # Определяем количество дней по сумме
    days = get_days_for_amount(amount)
    if not days:
        print(f"❌ [BOT] Неизвестная сумма платежа: {amount}")
        await update.message.reply_text("❌ Ошибка: неизвестная сумма платежа. Обратитесь в поддержку.")
        return
    
    # Обрабатываем платеж
    result = await process_successful_payment(
        user_id=user_id,
        payload=payload,
        amount=amount,
        telegram_charge_id=telegram_charge_id,
        days=days
    )
    
    if result.get("success"):
        await update.message.reply_text(
            f"🎉 Спасибо за покупку!\n\n"
            f"✅ PRO подписка активирована на {days} дней.\n"
            f"📅 Подписка активна до: {result.get('pro_end', 'N/A')}\n\n"
            f"✨ Откройте приложение, чтобы использовать PRO функции!"
        )
        print(f"✅ [BOT] PRO выдана: user_id={user_id}, days={days}")
    else:
        error = result.get("error", "unknown")
        if error == "duplicate":
            await update.message.reply_text("ℹ️ Этот платеж уже был обработан ранее.")
        else:
            await update.message.reply_text(
                f"❌ Ошибка при активации PRO подписки.\n"
                f"Обратитесь в поддержку с ID платежа: {telegram_charge_id}"
            )
        print(f"❌ [BOT] Ошибка выдачи PRO: {result}")


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик callback запросов"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user_id = update.effective_user.id
    
    if data == "show_menu":
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✨Открыть Seliger Tinder✨", web_app=WebAppInfo(url=WEB_APP_URL))],
            [InlineKeyboardButton("⭐ Купить PRO", callback_data="buy_pro_menu")],
            [InlineKeyboardButton("Удалить профиль", callback_data="delete_user")],
            [
                InlineKeyboardButton("Запросить бейдж", callback_data="request_badge"),
                InlineKeyboardButton("Советы", callback_data="show_advice")
            ],
            [InlineKeyboardButton("Пожаловаться/Ошибка/Проблема", callback_data="dev_message")]
        ])
        await query.edit_message_reply_markup(reply_markup=keyboard)
    
    elif data == "buy_pro_menu":
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("7 дней - 100 ⭐", callback_data="buy_pro_7")],
            [InlineKeyboardButton("30 дней - 350 ⭐", callback_data="buy_pro_30")],
            [InlineKeyboardButton("90 дней - 900 ⭐", callback_data="buy_pro_90")],
            [InlineKeyboardButton("🎁 Ввести промокод", callback_data="enter_promo_code")],
            [InlineKeyboardButton("Назад", callback_data="show_menu")]
        ])
        await query.edit_message_text(
            "⭐ Выберите период PRO подписки:\n\n"
            "✨ PRO функции:\n"
            "• Неограниченные лайки\n"
            "• Видеть, кто лайкнул вас\n"
            "• Суперлайки\n"
            "• Расширенная статистика",
            reply_markup=keyboard
        )
    
    elif data == "enter_promo_code":
        # Устанавливаем состояние ожидания промокода
        user_states[user_id] = "waiting_for_promo_code"
        print(f"✅ [BOT] Состояние установлено: user_id={user_id}, state=waiting_for_promo_code")
        print(f"🔵 [BOT] Текущие состояния пользователей: {list(user_states.keys())}")
        await query.edit_message_text(
            "🎁 Введите промокод:\n\n"
            "Отправьте промокод текстовым сообщением.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Отмена", callback_data="buy_pro_menu")]
            ])
        )
    
    elif data == "delete_user":
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("Да, удалить", callback_data="confirm_delete"),
                InlineKeyboardButton("Нет, передумал", callback_data="cancel_delete")
            ]
        ])
        await query.message.reply_text(
            "Вы точно уверены, что хотите удалить ваш профиль? 😢",
            reply_markup=keyboard
        )
    
    elif data == "confirm_delete":
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{API_URL}/delete_user",
                    json={"userId": str(user_id)}
                )
                response.raise_for_status()
                result = response.json()
                
                if result.get("success"):
                    await query.message.reply_text("✅ Ваш профиль удалён. Чтобы начать заново, отправьте /start")
                else:
                    await query.message.reply_text(f"❌ Не удалось удалить профиль: {result.get('error')}")
        except Exception as e:
            print(f"Ошибка delete_user: {e}")
            await query.message.reply_text("❌ Ошибка при удалении профиля.")
    
    elif data == "cancel_delete":
        await query.message.reply_text("Главное меню", reply_markup=get_start_keyboard())
    
    
    elif data.startswith("buy_pro_"):
        # Обработка покупки PRO: buy_pro_7, buy_pro_30, buy_pro_90
        try:
            days = int(data.split("_")[-1])
            await send_pro_invoice(update, context, days)
        except (ValueError, IndexError):
            await query.answer("❌ Ошибка: неверный формат команды", show_alert=True)


async def web_app_data_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик данных от WebApp"""
    print(f"🔵 [BOT] web_app_data_handler вызван")
    print(f"  - update.message: {update.message}")
    print(f"  - update.message.web_app_data: {update.message.web_app_data if update.message else None}")
    
    if not update.message:
        print("⚠️ [BOT] web_app_data_handler: нет update.message")
        return
    
    if not update.message.web_app_data:
        print("⚠️ [BOT] web_app_data_handler: нет web_app_data в сообщении")
        return
    
    user_id = update.effective_user.id
    data_str = update.message.web_app_data.data
    
    print(f"🔵 [BOT] Получены данные от WebApp: user_id={user_id}, data={data_str}")
    
    try:
        import json
        data = json.loads(data_str)
        action = data.get("action")
        
        if action == "buy_pro_menu":
            # Показываем меню с ценами PRO подписки
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("7 дней - 100 ⭐", callback_data="buy_pro_7")],
                [InlineKeyboardButton("30 дней - 350 ⭐", callback_data="buy_pro_30")],
                [InlineKeyboardButton("90 дней - 900 ⭐", callback_data="buy_pro_90")],
                [InlineKeyboardButton("🎁 Ввести промокод", callback_data="enter_promo_code")],
                [InlineKeyboardButton("Назад", callback_data="show_menu")]
            ])
            await update.message.reply_text(
                "⭐ Выберите период PRO подписки:\n\n"
                "✨ PRO функции:\n"
                "• Неограниченные лайки\n"
                "• Видеть, кто лайкнул вас\n"
                "• Суперлайки\n"
                "• Расширенная статистика",
                reply_markup=keyboard
            )
            print(f"✅ [BOT] Меню покупки PRO отправлено пользователю {user_id}")
    except json.JSONDecodeError:
        print(f"⚠️ [BOT] Не удалось распарсить JSON данные от WebApp: {data_str}")
    except Exception as e:
        print(f"❌ [BOT] Ошибка обработки данных от WebApp: {e}")


# Глобальная переменная для бота
bot_application = None


def create_bot_application():
    """Создание и настройка бота"""
    global bot_application
    
    import sys
    import os
    import traceback
    
    print("=" * 70)
    print("🤖 СОЗДАНИЕ TELEGRAM BOT APPLICATION")
    print("=" * 70)
    print(f"📁 Рабочая директория: {os.getcwd()}")
    print(f"🐍 Python версия: {sys.version}")
    print(f"📦 Python путь: {sys.executable}")
    print(f"📂 Файл bot.py: {__file__}")
    print("=" * 70)
    
    # Проверяем переменные окружения
    print("🔵 Проверка переменных окружения...")
    print(f"  - BOT_TOKEN: {'установлен' if BOT_TOKEN else 'НЕ УСТАНОВЛЕН!'}")
    print(f"  - WEB_APP_URL: {WEB_APP_URL if WEB_APP_URL else 'НЕ УСТАНОВЛЕН!'}")
    print(f"  - API_URL: {API_URL if API_URL else 'НЕ УСТАНОВЛЕН!'}")
    print(f"  - DEV_CHAT_ID: {DEV_CHAT_ID if DEV_CHAT_ID else 'не установлен'}")
    print("=" * 70)
    
    if not BOT_TOKEN:
        print("❌ BOT_TOKEN не установлен!")
        print("⚠️ Проверьте переменные окружения в Railway")
        print("⚠️ Убедитесь, что BOT_TOKEN добавлен в Variables")
        return None
    
    print(f"✅ BOT_TOKEN установлен (длина: {len(BOT_TOKEN)} символов)")
    print(f"   Первые 10 символов: {BOT_TOKEN[:10]}...")
    print(f"✅ WEB_APP_URL: {WEB_APP_URL}")
    print(f"✅ API_URL: {API_URL}")
    print(f"✅ DEV_CHAT_ID: {DEV_CHAT_ID if DEV_CHAT_ID else 'не установлен (команды доступны всем)'}")
    print("=" * 70)
    
    try:
        print("🔵 Создание Application...")
        print("  - Импорт telegram.ext...")
        from telegram.ext import Application, CommandHandler, CallbackQueryHandler
        print("  - Импорт успешен")
        
        print("  - Создание Application.builder()...")
        builder = Application.builder()
        print("  - Builder создан")
        
        print("  - Установка токена...")
        builder = builder.token(BOT_TOKEN)
        print("  - Токен установлен")
        
        print("  - Сборка Application...")
        application = builder.build()
        print("✅ Application создан успешно")
        
        # Регистрация команд
        print("🔵 Регистрация обработчиков команд...")
        print("  - Регистрация /start...")
        application.add_handler(CommandHandler("start", start_command))
        print("✅ Команда /start зарегистрирована")
        
        print("  - Регистрация /grantpro...")
        application.add_handler(CommandHandler("grantpro", grantpro_command))
        print("✅ Команда /grantpro зарегистрирована")
        
        print("  - Регистрация /addbadge...")
        application.add_handler(CommandHandler("addbadge", addbadge_command))
        print("✅ Команда /addbadge зарегистрирована")
        
        print("  - Регистрация /stats...")
        application.add_handler(CommandHandler("stats", stats_command))
        print("✅ Команда /stats зарегистрирована")
        
        print("  - Регистрация /delete_user...")
        application.add_handler(CommandHandler("delete_user", delete_user_command))
        print("✅ Команда /delete_user зарегистрирована")
        
        print("  - Регистрация /clear_photos...")
        application.add_handler(CommandHandler("clear_photos", clear_photos_command))
        print("✅ Команда /clear_photos зарегистрирована")
        
        print("  - Регистрация /masssend...")
        application.add_handler(CommandHandler("masssend", masssend_command))
        print("✅ Команда /masssend зарегистрирована")
        
        # Регистрация callback handlers
        print("  - Регистрация CallbackQueryHandler...")
        application.add_handler(CallbackQueryHandler(callback_handler))
        print("✅ CallbackQueryHandler зарегистрирован")
        
        # Регистрация обработчиков платежей
        print("  - Регистрация PreCheckoutQueryHandler...")
        application.add_handler(PreCheckoutQueryHandler(pre_checkout_handler))
        print("✅ PreCheckoutQueryHandler зарегистрирован")
        
        print("  - Регистрация MessageHandler для successful_payment...")
        application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))
        print("✅ SuccessfulPaymentHandler зарегистрирован")
        
        # Регистрация обработчика текстовых сообщений для промокодов
        # КРИТИЧНО: Регистрируем ПЕРВЫМ, чтобы он обрабатывался до WebApp handler
        print("  - Регистрация MessageHandler для промокодов...")
        async def promo_code_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
            """Обработчик текстовых сообщений для ввода промокода"""
            print(f"🔵 [BOT] promo_code_message_handler ВЫЗВАН")
            
            if not update.message or not update.message.text:
                print(f"⚠️ [BOT] promo_code_message_handler: нет сообщения или текста")
                return
            
            # Проверяем, что это не WebApp данные
            if update.message.web_app_data:
                print(f"⚠️ [BOT] promo_code_message_handler: это WebApp данные, пропускаем")
                return
            
            user_id = update.effective_user.id
            state = user_states.get(user_id)
            
            print(f"🔵 [BOT] promo_code_message_handler: user_id={user_id}, state={state}, text={update.message.text}")
            print(f"🔵 [BOT] Все состояния: {dict(user_states)}")
            
            if state == "waiting_for_promo_code":
                print(f"✅ [BOT] Состояние подтверждено, обрабатываем промокод...")
                promo_code = update.message.text.strip()
                
                # Удаляем состояние
                user_states.pop(user_id, None)
                
                # Вызываем API для активации промокода
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{API_URL}/activatePromoCode",
                            json={"userId": str(user_id), "promoCode": promo_code}
                        )
                        response.raise_for_status()
                        result = response.json()
                        
                        if result.get("success"):
                            days = result.get("days", 0)
                            pro_end = result.get("pro_end", "")
                            message = result.get("message", f"✅ Промокод активирован! PRO подписка продлена на {days} дней.")
                            await update.message.reply_text(
                                f"{message}\n\n"
                                f"📅 Подписка активна до: {pro_end}\n\n"
                                f"✨ Откройте приложение, чтобы использовать PRO функции!"
                            )
                            print(f"✅ [BOT] Промокод активирован: user_id={user_id}, promo_code={promo_code}, days={days}")
                        else:
                            error = result.get("error", "Неизвестная ошибка")
                            await update.message.reply_text(f"❌ {error}")
                            print(f"❌ [BOT] Ошибка активации промокода: user_id={user_id}, promo_code={promo_code}, error={error}")
                except Exception as e:
                    print(f"❌ [BOT] Ошибка при активации промокода: {e}")
                    await update.message.reply_text("❌ Ошибка при активации промокода. Попробуйте позже.")
        
        # Используем стандартные фильтры: TEXT (текстовые сообщения) и не команды
        # Проверку состояния пользователя делаем в обработчике
        # ВАЖНО: НЕ используем ~web_app_data_filter, так как это может блокировать сообщения
        promo_code_filter = filters.TEXT & ~filters.COMMAND
        
        # КРИТИЧНО: Регистрируем обработчик промокодов БЕЗ группы, чтобы он обрабатывался ПЕРВЫМ
        # Это важно, так как он должен проверить состояние пользователя до других обработчиков
        application.add_handler(MessageHandler(promo_code_filter, promo_code_message_handler))
        print("✅ PromoCodeMessageHandler зарегистрирован (без группы, приоритет)")
        
        # Регистрация обработчика данных от WebApp
        # Регистрируем ПОСЛЕ промокодов, чтобы промокоды обрабатывались первыми
        print("  - Регистрация MessageHandler для WebApp данных...")
        # Используем кастомный фильтр для WebApp данных
        application.add_handler(MessageHandler(web_app_data_filter, web_app_data_handler))
        print("✅ WebAppDataHandler зарегистрирован")
        
        bot_application = application
        print("=" * 70)
        print("✅ Все обработчики зарегистрированы")
        print("✅ Bot application создан и сохранен в глобальную переменную")
        print("=" * 70)
        
        return application
        
    except ImportError as e:
        print(f"❌ Ошибка импорта: {e}")
        print("=" * 70)
        traceback.print_exc()
        print("=" * 70)
        return None
    except Exception as e:
        print(f"❌ Ошибка при создании бота: {e}")
        print(f"   Тип ошибки: {type(e).__name__}")
        print("=" * 70)
        traceback.print_exc()
        print("=" * 70)
        return None


async def start_bot():
    """Запуск бота (неблокирующий, для использования в FastAPI)"""
    global bot_application
    
    print("=" * 70)
    print("🤖 ЗАПУСК TELEGRAM BOT (async)")
    print("=" * 70)
    
    # Проверяем, установлен ли bot_application
    if bot_application:
        print("✅ Bot application уже существует, используем его")
        application = bot_application
    else:
        print("ℹ️ Bot application не инициализирован, создаем новый экземпляр...")
        application = create_bot_application()
    
    if application:
        # Сохраняем в глобальную переменную, если еще не сохранено
        if not bot_application:
            bot_application = application
            print("✅ Bot application сохранен в глобальную переменную")
        
        print("📡 Запуск bot polling (неблокирующий)...")
        try:
            await application.initialize()
            print("✅ Bot application инициализирован")
            
            await application.start()
            print("✅ Bot application запущен")
            
            # КРИТИЧНО: Устанавливаем глобальную переменную ПЕРЕД start_polling()
            bot_application = application
            print("✅ Global bot_application установлен ПЕРЕД polling")
            
            # КРИТИЧНО: start_polling() - НЕБЛОКИРУЮЩИЙ через asyncio.create_task()
            # Если запустить с await, сервер FastAPI никогда не запустится
            import asyncio
            asyncio.create_task(application.updater.start_polling(
                allowed_updates=Update.ALL_TYPES,
                drop_pending_updates=True
            ))
            print("✅ Bot polling запущен в фоне (неблокирующий)")
            print("=" * 70)
            print("✅ Бот запущен и готов к работе!")
            print("⏳ Ожидание обновлений от Telegram...")
            print("💡 Попробуйте отправить команду /start боту в Telegram")
            print("=" * 70)
        except Exception as e:
            print(f"❌ Ошибка при запуске бота: {e}")
            import traceback
            traceback.print_exc()
            print("=" * 70)
    else:
        print("❌ Бот не запущен (нет токена или не удалось создать application)")


async def stop_bot():
    """Остановка бота"""
    global bot_application
    
    if bot_application:
        print("🛑 Остановка бота...")
        try:
            await bot_application.updater.stop()
            await bot_application.stop()
            await bot_application.shutdown()
            print("✅ Бот остановлен")
        except Exception as e:
            print(f"⚠️ Ошибка при остановке бота: {e}")


def get_bot_application():
    """Получить экземпляр бота (для использования в других модулях)"""
    return bot_application


def main():
    """Запуск бота в отдельном процессе (для обратной совместимости)"""
    import sys
    import os
    
    print("=" * 70)
    print("🤖 ЗАПУСК TELEGRAM BOT (standalone)")
    print("=" * 70)
    print("⚠️ ВНИМАНИЕ: Этот режим используется только для тестирования")
    print("⚠️ В production бот запускается через FastAPI startup event")
    print("=" * 70)
    
    application = create_bot_application()
    
    if application:
        print("🔵 Запуск polling (блокирующий режим)...")
        print("=" * 70)
        try:
            application.run_polling(
                allowed_updates=Update.ALL_TYPES,
                drop_pending_updates=True,
                close_loop=False
            )
        except KeyboardInterrupt:
            print("\n⚠️ Получен сигнал остановки (Ctrl+C)")
            print("🛑 Остановка бота...")
    else:
        print("❌ Не удалось создать bot application")


if __name__ == "__main__":
    main()

