FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY python_backend/ ./python_backend/
COPY views/ ./views/
COPY public/ ./public/

# Создаем необходимые директории
RUN mkdir -p /data/img /data/log

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Запуск приложения
CMD ["python", "python_backend/start.py"]

