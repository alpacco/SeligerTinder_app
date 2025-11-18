"""
start.py
Точка входа для запуска приложения
"""
import asyncio
from main import app
from database import init_database
from config import PORT, LOG_LEVEL
import uvicorn

async def main():
    """Инициализация и запуск приложения"""
    # Инициализируем БД
    await init_database()
    
    # Запускаем сервер
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level=LOG_LEVEL.lower()
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())

