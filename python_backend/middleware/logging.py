"""
middleware/logging.py
Логирование подозрительной активности для безопасности
"""
import time
from typing import Dict, List
from collections import defaultdict
from fastapi import Request

# Хранилище подозрительной активности (в продакшене лучше использовать Redis)
_suspicious_activity: Dict[str, List[float]] = defaultdict(list)

# Пороги для определения подозрительной активности
MAX_REQUESTS_PER_MINUTE = 50
MAX_FAILED_AUTH_PER_MINUTE = 5
MAX_FILE_UPLOADS_PER_MINUTE = 10

def log_suspicious_activity(request: Request, activity_type: str, details: str = ""):
    """
    Логирует подозрительную активность
    
    Args:
        request: FastAPI Request объект
        activity_type: Тип активности (например, 'rate_limit_exceeded', 'failed_auth', 'invalid_input')
        details: Дополнительные детали
    """
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # Добавляем запись
    _suspicious_activity[client_ip].append(current_time)
    
    # Очищаем старые записи (старше 1 минуты)
    _suspicious_activity[client_ip] = [
        t for t in _suspicious_activity[client_ip] 
        if current_time - t < 60
    ]
    
    # Проверяем пороги
    recent_requests = len(_suspicious_activity[client_ip])
    
    if recent_requests > MAX_REQUESTS_PER_MINUTE:
        print(f"⚠️ [SECURITY] Подозрительная активность: IP={client_ip}, "
              f"Тип={activity_type}, Запросов за минуту={recent_requests}, "
              f"Детали={details}")
    
    # Логируем все подозрительные события
    print(f"🔍 [SECURITY] {activity_type}: IP={client_ip}, "
          f"Path={request.url.path}, Детали={details}")


def check_rate_limit(client_ip: str, max_per_minute: int = MAX_REQUESTS_PER_MINUTE) -> bool:
    """
    Проверяет rate limit для IP адреса
    
    Returns:
        True если лимит не превышен, False если превышен
    """
    current_time = time.time()
    
    # Очищаем старые записи
    _suspicious_activity[client_ip] = [
        t for t in _suspicious_activity[client_ip] 
        if current_time - t < 60
    ]
    
    return len(_suspicious_activity[client_ip]) < max_per_minute

