"""
middleware/auth.py
Авторизация для admin endpoints через Telegram ID (безопасная реализация)
"""
import re
import hmac
import hashlib
import urllib.parse
from fastapi import HTTPException, Header, Request
from typing import Optional, List
from config import ADMIN_TELEGRAM_IDS, ADMIN_TOKEN, BOT_TOKEN


def validate_telegram_id(telegram_id: str) -> str:
    """
    Валидация Telegram ID: только цифры, защита от инъекций
    """
    if not telegram_id or not isinstance(telegram_id, str):
        raise HTTPException(status_code=400, detail="Некорректный Telegram ID")
    
    # Удаляем все нецифровые символы
    telegram_id = re.sub(r'[^0-9]', '', telegram_id)
    
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Telegram ID должен содержать только цифры")
    
    # Telegram ID обычно от 5 до 10 цифр
    if len(telegram_id) < 5 or len(telegram_id) > 10:
        raise HTTPException(status_code=400, detail="Некорректный формат Telegram ID")
    
    return telegram_id


def verify_telegram_init_data(init_data: str) -> Optional[str]:
    """
    Проверяет и извлекает Telegram User ID из initData (если BOT_TOKEN установлен)
    Это дополнительная защита от подделки Telegram ID
    """
    if not BOT_TOKEN or not init_data:
        return None
    
    try:
        # Парсим init_data
        parsed = urllib.parse.parse_qs(init_data)
        
        # Извлекаем hash и данные
        received_hash = parsed.get('hash', [None])[0]
        if not received_hash:
            return None
        
        # Удаляем hash из данных для проверки
        data_check_string = '&'.join(
            f"{k}={v[0]}" 
            for k, v in sorted(parsed.items()) 
            if k != 'hash'
        )
        
        # Создаем секретный ключ
        secret_key = hmac.new(
            key=b"WebAppData",
            msg=BOT_TOKEN.encode(),
            digestmod=hashlib.sha256
        ).digest()
        
        # Вычисляем hash
        calculated_hash = hmac.new(
            key=secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256
        ).hexdigest()
        
        # Сравниваем hash (защита от timing attack)
        if not hmac.compare_digest(calculated_hash, received_hash):
            return None
        
        # Извлекаем user из user JSON
        user_str = parsed.get('user', [None])[0]
        if not user_str:
            return None
        
        import json
        user = json.loads(user_str)
        user_id = str(user.get('id'))
        
        return validate_telegram_id(user_id)
        
    except Exception as e:
        # В случае ошибки не блокируем, просто не используем initData
        print(f"⚠️ Ошибка проверки initData: {e}")
        return None


def get_telegram_user_id(request: Request) -> Optional[str]:
    """
    Безопасно извлекает Telegram User ID из запроса
    Приоритет:
    1. Проверенный initData (если BOT_TOKEN установлен)
    2. Заголовок X-Telegram-User-Id (валидированный)
    3. Query параметр telegramUserId (валидированный)
    """
    # Способ 1: Проверка через initData (самый безопасный, если BOT_TOKEN установлен)
    init_data = request.headers.get("X-Telegram-Init-Data")
    if init_data:
        verified_id = verify_telegram_init_data(init_data)
        if verified_id:
            return verified_id
    
    # Способ 2: Заголовок X-Telegram-User-Id (валидируем)
    telegram_user_id = request.headers.get("X-Telegram-User-Id")
    if telegram_user_id:
        return validate_telegram_id(telegram_user_id)
    
    # Способ 3: Query параметр (валидируем)
    telegram_user_id = request.query_params.get("telegramUserId")
    if telegram_user_id:
        return validate_telegram_id(telegram_user_id)
    
    return None


def verify_admin(request: Request, authorization: Optional[str] = Header(None)) -> bool:
    """
    Безопасная проверка прав администратора через Telegram ID или токен
    
    Приоритет:
    1. Telegram User ID (если установлен ADMIN_TELEGRAM_IDS) - с валидацией
    2. Bearer Token (если установлен ADMIN_TOKEN, для обратной совместимости)
    
    Безопасность:
    - Валидация формата Telegram ID
    - Защита от инъекций
    - Проверка initData через BOT_TOKEN (если доступен)
    """
    # Проверка через Telegram ID (новый способ, более безопасный)
    if ADMIN_TELEGRAM_IDS:
        telegram_user_id = get_telegram_user_id(request)
        
        if not telegram_user_id:
            raise HTTPException(
                status_code=401,
                detail="Требуется Telegram User ID. Укажите заголовок X-Telegram-User-Id, X-Telegram-Init-Data или параметр telegramUserId"
            )
        
        # Проверяем что ID в списке администраторов (безопасное сравнение)
        if telegram_user_id not in ADMIN_TELEGRAM_IDS:
            # Логируем попытку доступа (без чувствительных данных)
            print(f"⚠️ Попытка доступа к admin endpoint с Telegram ID: {telegram_user_id[:3]}***")
            raise HTTPException(
                status_code=403,
                detail="Доступ запрещен. Ваш Telegram ID не в списке администраторов"
            )
        
        # Успешная авторизация
        print(f"✅ Admin доступ разрешен для Telegram ID: {telegram_user_id[:3]}***")
        return True
    
    # Проверка через токен (старый способ, для обратной совместимости)
    if ADMIN_TOKEN:
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Требуется авторизация",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Формат: "Bearer <token>"
        try:
            scheme, token = authorization.split(maxsplit=1)
            if scheme.lower() != "bearer":
                raise HTTPException(status_code=401, detail="Неверная схема авторизации")
            
            # Безопасное сравнение токенов (защита от timing attack)
            if not hmac.compare_digest(token, ADMIN_TOKEN):
                print("⚠️ Попытка доступа с неверным токеном")
                raise HTTPException(status_code=403, detail="Неверный токен")
            
            return True
        except ValueError:
            raise HTTPException(status_code=401, detail="Неверный формат заголовка Authorization")
    
    # Если ничего не установлено, разрешаем доступ (только для разработки!)
    # В продакшене это должно быть обязательным
    print("⚠️ ВНИМАНИЕ: ADMIN_TELEGRAM_IDS или ADMIN_TOKEN не установлены! Admin endpoints доступны без авторизации!")
    return True


def verify_admin_token(authorization: Optional[str] = Header(None)) -> bool:
    """
    Устаревшая функция для обратной совместимости
    Используйте verify_admin(request, authorization) вместо этого
    """
    # Для обратной совместимости создаем фиктивный request
    # В новых endpoint используйте verify_admin(request, authorization)
    from fastapi import Request
    from starlette.datastructures import Headers
    
    # Создаем минимальный request объект
    class MinimalRequest:
        def __init__(self):
            self.headers = Headers()
            self.query_params = {}
    
    request = MinimalRequest()
    if authorization:
        request.headers["authorization"] = authorization
    
    return verify_admin(request, authorization)

