"""
start_all.py
Запуск приложения и бота одновременно
"""
import asyncio
import subprocess
import sys
from pathlib import Path

def run_app():
    """Запуск FastAPI приложения"""
    from start import main
    asyncio.run(main())


def run_bot():
    """Запуск Telegram бота"""
    from bot import main
    main()


if __name__ == "__main__":
    import multiprocessing
    
    # Запускаем приложение и бота в отдельных процессах
    app_process = multiprocessing.Process(target=run_app)
    bot_process = multiprocessing.Process(target=run_bot)
    
    app_process.start()
    bot_process.start()
    
    try:
        app_process.join()
        bot_process.join()
    except KeyboardInterrupt:
        print("\n🛑 Завершение работы...")
        app_process.terminate()
        bot_process.terminate()
        app_process.join()
        bot_process.join()

