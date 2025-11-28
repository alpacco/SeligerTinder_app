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
    import time
    start_time = time.time()
    
    print("=" * 80)
    print(f"🔍 [OpenCV] ========== НАЧАЛО ПРОВЕРКИ ЛИЦА ==========")
    print(f"🔍 [OpenCV] Размер буфера: {len(image_buffer)} байт")
    print(f"🔍 [OpenCV] opencv_available: {opencv_available}")
    print(f"🔍 [OpenCV] face_cascade is None: {face_cascade is None}")
    
    if face_cascade is not None:
        print(f"🔍 [OpenCV] face_cascade.empty(): {face_cascade.empty()}")
    
    if not opencv_available or face_cascade is None:
        print("❌ [OpenCV] OpenCV недоступен, НЕ пропускаем проверку - возвращаем False")
        logger.warning("OpenCV недоступен, возвращаем False для проверки лица")
        print("=" * 80)
        return False, 0  # Возвращаем False, чтобы требовать фото с лицом
    
    try:
        print("🔍 [OpenCV] Шаг 1: Декодируем изображение из буфера...")
        # Декодируем изображение из буфера
        nparr = np.frombuffer(image_buffer, np.uint8)
        print(f"🔍 [OpenCV] nparr создан, размер: {len(nparr)} элементов")
        
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        decode_time = time.time() - start_time
        print(f"🔍 [OpenCV] Декодирование заняло: {decode_time:.3f} сек")
        
        if img is None:
            print("❌ [OpenCV] cv2.imdecode вернул None - изображение не декодировано")
            logger.error("Не удалось декодировать изображение из буфера")
            print("=" * 80)
            return False, 0  # Возвращаем False при ошибке декодирования
        
        if img.size == 0:
            print("❌ [OpenCV] Размер изображения = 0")
            logger.error("Размер изображения = 0")
            print("=" * 80)
            return False, 0
        
        print(f"🔍 [OpenCV] Изображение декодировано успешно")
        print(f"🔍 [OpenCV] Размер изображения (shape): {img.shape}")
        print(f"🔍 [OpenCV] Тип данных: {img.dtype}")
        print(f"🔍 [OpenCV] Размер в пикселях: {img.shape[0]}x{img.shape[1]}")
        
        # Конвертируем в grayscale
        print("🔍 [OpenCV] Шаг 2: Конвертируем в grayscale...")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        print(f"🔍 [OpenCV] Grayscale создан, размер: {gray.shape}")
        print(f"🔍 [OpenCV] Диапазон значений: min={gray.min()}, max={gray.max()}")
        
        # Детектируем лица
        print("🔍 [OpenCV] Шаг 3: Начинаем детекцию лиц...")
        print(f"🔍 [OpenCV] Параметры детекции:")
        print(f"  - scaleFactor: 1.1")
        print(f"  - minNeighbors: 3")
        print(f"  - minSize: (50, 50)")
        print(f"  - flags: CASCADE_SCALE_IMAGE")
        print(f"🔍 [OpenCV] Размер изображения для детекции: {gray.shape[1]}x{gray.shape[0]}")
        
        detect_start = time.time()
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,  # Масштаб для поиска (меньше = точнее, но медленнее)
            minNeighbors=3,   # Минимум соседей для подтверждения (меньше = больше ложных срабатываний, но находит больше лиц)
            minSize=(50, 50), # Минимальный размер лица в пикселях (увеличено для лучшей точности)
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        detect_time = time.time() - detect_start
        print(f"🔍 [OpenCV] Детекция заняла: {detect_time:.3f} сек")
        
        face_count = len(faces)
        print(f"🔍 [OpenCV] Результат detectMultiScale: {type(faces)}")
        print(f"🔍 [OpenCV] Количество найденных лиц: {face_count}")
        
        if face_count > 0:
            print(f"🔍 [OpenCV] Координаты найденных лиц:")
            for i, (x, y, w, h) in enumerate(faces):
                print(f"  Лицо {i+1}: x={x}, y={y}, width={w}, height={h}")
                print(f"    Размер: {w}x{h} пикселей")
                print(f"    Позиция: ({x}, {y})")
        else:
            print("⚠️ [OpenCV] Лица не найдены!")
            print(f"🔍 [OpenCV] Попробуем с более мягкими параметрами...")
            # Пробуем с более мягкими параметрами для отладки
            faces_soft = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=2,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            print(f"🔍 [OpenCV] С мягкими параметрами найдено: {len(faces_soft)} лиц")
            if len(faces_soft) > 0:
                print(f"🔍 [OpenCV] Координаты (мягкие параметры):")
                for i, (x, y, w, h) in enumerate(faces_soft):
                    print(f"  Лицо {i+1}: x={x}, y={y}, width={w}, height={h}")
        
        total_time = time.time() - start_time
        print(f"🔍 [OpenCV] Общее время проверки: {total_time:.3f} сек")
        
        logger.info(f"OpenCV: найдено лиц: {face_count}")
        
        if face_count == 0:
            print("⚠️ [OpenCV] ========== РЕЗУЛЬТАТ: ЛИЦО НЕ НАЙДЕНО ==========")
            print("=" * 80)
            return False, 0
        
        print(f"✅ [OpenCV] ========== РЕЗУЛЬТАТ: ЛИЦО НАЙДЕНО ({face_count} шт.) ==========")
        print("=" * 80)
        return True, face_count
        
    except Exception as e:
        print(f"❌ [OpenCV] ========== ОШИБКА ПРИ ПРОВЕРКЕ ЛИЦА ==========")
        print(f"❌ [OpenCV] Ошибка: {e}")
        logger.error(f"Ошибка при проверке лица через OpenCV: {e}")
        import traceback
        print(f"❌ [OpenCV] Traceback:")
        print(traceback.format_exc())
        print("=" * 80)
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

