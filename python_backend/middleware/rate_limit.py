"""
middleware/rate_limit.py
Rate limiting для критичных эндпоинтов
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from functools import wraps
from fastapi import Request

# Импортируем limiter из main.py (будет установлен через app.state.limiter)
def get_limiter(request: Request) -> Limiter:
    """Получает limiter из состояния приложения"""
    return request.app.state.limiter

# Декоратор для применения rate limiting
def rate_limit(limit: str):
    """
    Декоратор для применения rate limiting к эндпоинту
    
    Примеры:
    - "10/minute" - 10 запросов в минуту
    - "100/hour" - 100 запросов в час
    - "5/second" - 5 запросов в секунду
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Ищем Request в аргументах
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                for key, value in kwargs.items():
                    if isinstance(value, Request):
                        request = value
                        break
            
            if request:
                limiter = get_limiter(request)
                # Применяем rate limit
                limiter.limit(limit)(func)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

