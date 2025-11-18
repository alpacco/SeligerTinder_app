"""
middleware/security.py
Модуль безопасности: валидация, санитизация, защита
"""
import re
from pathlib import Path
from typing import Optional
from fastapi import HTTPException
from PIL import Image
import io
from config import MAX_FILE_SIZE, MAX_IMAGE_DIMENSION

# Разрешенные MIME типы изображений
ALLOWED_MIME_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
}

# Разрешенные расширения файлов
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def validate_user_id(user_id: str) -> str:
    """
    Валидация userId: только цифры, защита от path traversal
    """
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=400, detail="userId обязателен и должен быть строкой")
    
    # Удаляем все нецифровые символы
    user_id = re.sub(r'[^0-9]', '', user_id)
    
    if not user_id:
        raise HTTPException(status_code=400, detail="userId должен содержать только цифры")
    
    # Защита от path traversal
    if '..' in user_id or '/' in user_id or '\\' in user_id:
        raise HTTPException(status_code=400, detail="Недопустимый userId")
    
    return user_id


def validate_photo_index(photo_index: Optional[str]) -> Optional[str]:
    """
    Валидация photoIndex: только 1, 2 или 3
    """
    if photo_index is None:
        return None
    
    if not isinstance(photo_index, str):
        photo_index = str(photo_index)
    
    # Только цифры 1, 2, 3
    if photo_index not in ['1', '2', '3']:
        raise HTTPException(status_code=400, detail="photoIndex должен быть 1, 2 или 3")
    
    return photo_index


def sanitize_filename(filename: str) -> str:
    """
    Санитизация имени файла: удаление опасных символов
    """
    if not filename:
        return "photo.jpg"
    
    # Удаляем путь, оставляем только имя файла
    filename = Path(filename).name
    
    # Удаляем опасные символы
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    
    # Проверяем расширение
    if not any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
        filename = "photo.jpg"
    
    return filename


def validate_file_size(content: bytes) -> None:
    """
    Проверка размера файла
    """
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой. Максимальный размер: {MAX_FILE_SIZE // (1024 * 1024)} MB"
        )


def validate_image_content(content: bytes) -> None:
    """
    Валидация содержимого изображения: проверка что это действительно изображение
    """
    try:
        # Проверяем размер
        validate_file_size(content)
        
        # Пытаемся открыть как изображение
        image = Image.open(io.BytesIO(content))
        
        # Проверяем формат
        if image.format not in ['JPEG', 'PNG', 'WEBP']:
            raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")
        
        # Проверяем размеры (защита от слишком больших изображений)
        if image.width > MAX_IMAGE_DIMENSION or image.height > MAX_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=400, 
                detail=f"Изображение слишком большое. Максимальный размер: {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}"
            )
        
        # Проверяем что это не пустое изображение
        if image.width == 0 or image.height == 0:
            raise HTTPException(status_code=400, detail="Некорректное изображение")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Некорректный файл изображения: {str(e)}")


def sanitize_path(base_path: Path, user_id: str, filename: str) -> Path:
    """
    Безопасное построение пути к файлу с защитой от path traversal
    """
    # Валидируем userId
    user_id = validate_user_id(user_id)
    
    # Санитизируем имя файла
    filename = sanitize_filename(filename)
    
    # Строим путь
    user_dir = base_path / user_id
    file_path = user_dir / filename
    
    # Проверяем что путь находится внутри base_path (защита от path traversal)
    try:
        file_path.resolve().relative_to(base_path.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Недопустимый путь к файлу")
    
    return file_path


def validate_url(url: str) -> str:
    """
    Валидация URL: только http/https, защита от SSRF
    """
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="URL обязателен")
    
    url = url.strip()
    
    # Только http/https
    if not url.startswith(('http://', 'https://')):
        raise HTTPException(status_code=400, detail="URL должен начинаться с http:// или https://")
    
    # Защита от SSRF: блокируем внутренние адреса
    blocked_hosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.169.254',  # AWS metadata
        '10.',
        '172.16.',
        '192.168.',
    ]
    
    # Простая проверка (можно улучшить с помощью urllib.parse)
    url_lower = url.lower()
    for blocked in blocked_hosts:
        if blocked in url_lower:
            raise HTTPException(status_code=400, detail="Недопустимый URL")
    
    return url

