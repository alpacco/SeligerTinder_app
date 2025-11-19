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
print("🔍 [OpenCV] Начинаем инициализацию OpenCV...")
try:
    print("🔍 [OpenCV] Импорт cv2 успешен, версия:", cv2.__version__)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
    print(f"🔍 [OpenCV] Загружаем каскад: {cascade_path}")
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        print("⚠️ [OpenCV] Первый каскад пустой, пробуем fallback...")
        # Fallback на другой каскад
        fallback_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        print(f"🔍 [OpenCV] Загружаем fallback каскад: {fallback_path}")
        face_cascade = cv2.CascadeClassifier(fallback_path)
        if face_cascade.empty():
            print("❌ [OpenCV] Fallback каскад тоже пустой!")
            raise Exception("Оба каскада пустые")
    opencv_available = True
    print("✅ [OpenCV] OpenCV инициализирован успешно, каскад загружен")
    print(f"✅ [OpenCV] Проверка каскада: face_cascade is not None = {face_cascade is not None}, empty() = {face_cascade.empty()}")
    logger.info("✅ OpenCV инициализирован успешно")
except Exception as e:
    opencv_available = False
    face_cascade = None
    print(f"❌ [OpenCV] OpenCV недоступен: {e}")
    import traceback
    print(f"❌ [OpenCV] Traceback: {traceback.format_exc()}")
    logger.warning(f"⚠️ OpenCV недоступен: {e}")


def check_face_in_photo(image_buffer: bytes) -> Tuple[bool, int]:
    """
    Проверить наличие лица на фотографии
    
    Args:
        image_buffer: Байты изображения
        
    Returns:
        Tuple[bool, int]: (успех, количество лиц)
    """
    print(f"🔍 [OpenCV] check_face_in_photo вызвана, размер буфера: {len(image_buffer)} байт")
    
    if not opencv_available or face_cascade is None:
        print("❌ [OpenCV] OpenCV недоступен, НЕ пропускаем проверку - возвращаем False")
        logger.warning("OpenCV недоступен, возвращаем False для проверки лица")
        return False, 0  # Возвращаем False, чтобы требовать фото с лицом
    
    try:
        print("🔍 [OpenCV] Декодируем изображение из буфера...")
        # Декодируем изображение из буфера
        nparr = np.frombuffer(image_buffer, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None or img.size == 0:
            print("❌ [OpenCV] Не удалось декодировать изображение из буфера")
            logger.error("Не удалось декодировать изображение из буфера")
            return False, 0  # Возвращаем False при ошибке декодирования
        
        print(f"🔍 [OpenCV] Изображение декодировано, размер: {img.shape}")
        
        # Конвертируем в grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        print("🔍 [OpenCV] Изображение конвертировано в grayscale")
        
        # Детектируем лица
        print("🔍 [OpenCV] Начинаем детекцию лиц...")
        print(f"🔍 [OpenCV] Параметры детекции: scaleFactor=1.1, minNeighbors=3, minSize=(50, 50)")
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,  # Масштаб для поиска (меньше = точнее, но медленнее)
            minNeighbors=3,   # Минимум соседей для подтверждения (меньше = больше ложных срабатываний, но находит больше лиц)
            minSize=(50, 50), # Минимальный размер лица в пикселях (увеличено для лучшей точности)
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        face_count = len(faces)
        print(f"✅ [OpenCV] Детекция завершена. Найдено лиц: {face_count}")
        logger.info(f"OpenCV: найдено лиц: {face_count}")
        
        if face_count == 0:
            print("⚠️ [OpenCV] Лицо не найдено на фото!")
            return False, 0
        
        print(f"✅ [OpenCV] Лицо найдено! Количество: {face_count}")
        return True, face_count
        
    except Exception as e:
        print(f"❌ [OpenCV] Ошибка при проверке лица: {e}")
        logger.error(f"Ошибка при проверке лица через OpenCV: {e}")
        import traceback
        print(f"❌ [OpenCV] Traceback: {traceback.format_exc()}")
        return False, 0  # Возвращаем False при ошибке, чтобы требовать фото с лицом


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

