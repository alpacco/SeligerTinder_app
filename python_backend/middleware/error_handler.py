"""
middleware/error_handler.py
Централизованная обработка ошибок
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработка ошибок валидации"""
    errors = exc.errors()
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "error": "Ошибка валидации",
            "details": errors
        }
    )


async def http_exception_handler(request: Request, exc):
    """Обработка HTTP исключений"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Обработка общих исключений (безопасное логирование)"""
    # Логируем без чувствительных данных
    error_msg = str(exc)
    # Удаляем потенциально чувствительные данные из логов
    sensitive_patterns = ['password', 'token', 'secret', 'key', 'authorization']
    for pattern in sensitive_patterns:
        if pattern.lower() in error_msg.lower():
            error_msg = "[SENSITIVE DATA REMOVED]"
            break
    
    logger.error(
        f"Необработанная ошибка на {request.method} {request.url.path}: {error_msg}",
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Внутренняя ошибка сервера"
        }
    )

