"""
opencv_utils.py
Утилиты для работы с OpenCV (детекция лиц)
"""
import cv2
import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# Инициализация каскада для детекции лиц
try:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    if face_cascade.empty():
        # Fallback на другой каскад
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    opencv_available = True
    logger.info("✅ OpenCV инициализирован успешно")
except Exception as e:
    opencv_available = False
    face_cascade = None
    logger.warning(f"⚠️ OpenCV недоступен: {e}")


def check_face_in_photo(image_buffer: bytes) -> Tuple[bool, int]:
    """
    Проверить наличие лица на фотографии
    
    Args:
        image_buffer: Байты изображения
        
    Returns:
        Tuple[bool, int]: (успех, количество лиц)
    """
    if not opencv_available or face_cascade is None:
        logger.warning("OpenCV недоступен, пропускаем проверку лица")
        return True, 1  # Возвращаем успех, чтобы не блокировать
    
    try:
        # Декодируем изображение из буфера
        nparr = np.frombuffer(image_buffer, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None or img.size == 0:
            logger.error("Не удалось декодировать изображение из буфера")
            return True, 1  # Возвращаем успех при ошибке
        
        # Конвертируем в grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Детектируем лица
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        face_count = len(faces)
        logger.info(f"OpenCV: найдено лиц: {face_count}")
        
        if face_count == 0:
            return False, 0
        
        return True, face_count
        
    except Exception as e:
        logger.error(f"Ошибка при проверке лица через OpenCV: {e}")
        return True, 1  # Возвращаем успех при ошибке


def is_meme_or_fake(image_buffer: bytes) -> dict:
    """
    Проверить, является ли изображение мемом или фейком
    (Упрощенная версия - OpenCV не имеет встроенной функции для этого)
    
    Args:
        image_buffer: Байты изображения
        
    Returns:
        dict: {"isMeme": bool}
    """
    # OpenCV не имеет встроенной функции для определения мемов/фейков
    # Это упрощенная версия - всегда возвращаем False
    logger.info("Проверка на мем/фейк пропущена (OpenCV не поддерживает)")
    return {"isMeme": False}

