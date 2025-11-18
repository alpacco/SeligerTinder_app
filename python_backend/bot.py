"""
bot.py
Telegram бот для SeligerTinder
"""
import os
import asyncio
import httpx
from pathlib import Path
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes
)
from dotenv import load_dotenv

load_dotenv()

# Импортируем конфигурацию
from config import BOT_TOKEN, WEB_APP_URL

API_URL = f"{WEB_APP_URL}/api" if WEB_APP_URL else ""

# DEV_CHAT_ID можно вынести в переменные окружения если нужно
DEV_CHAT_ID = int(os.getenv("DEV_CHAT_ID", "0"))  # 0 = отключено
# Состояния пользователей
user_states = {}


def get_start_keyboard():
    """Клавиатура для команды /start"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✨Открыть Seliger Tinder✨", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("Меню", callback_data="show_menu")]
    ])


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    await update.message.reply_text(
        "Добро пожаловать в SeligerTinder!",
        reply_markup=get_start_keyboard()
    )


async def grantpro_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /grantpro - выдача PRO-подписки"""
    if DEV_CHAT_ID and update.effective_user.id != DEV_CHAT_ID:
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


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик callback запросов"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user_id = update.effective_user.id
    
    if data == "show_menu":
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✨Открыть Seliger Tinder✨", web_app=WebAppInfo(url=WEB_APP_URL))],
            [InlineKeyboardButton("Удалить профиль", callback_data="delete_user")],
            [
                InlineKeyboardButton("Запросить бейдж", callback_data="request_badge"),
                InlineKeyboardButton("Советы", callback_data="show_advice")
            ],
            [InlineKeyboardButton("Пожаловаться/Ошибка/Проблема", callback_data="dev_message")]
        ])
        await query.edit_message_reply_markup(reply_markup=keyboard)
    
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


def main():
    """Запуск бота"""
    if not BOT_TOKEN:
        print("❌ BOT_TOKEN не установлен!")
        return
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Регистрация команд
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("grantpro", grantpro_command))
    application.add_handler(CommandHandler("addbadge", addbadge_command))
    application.add_handler(CommandHandler("stats", stats_command))
    
    # Регистрация callback handlers
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    # Запуск бота
    print("✅ Бот запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

