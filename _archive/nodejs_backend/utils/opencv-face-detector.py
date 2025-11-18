#!/usr/bin/env python3
"""
OpenCV Face Detector для Node.js
Использует OpenCV для обнаружения лиц на изображениях
"""
import cv2
import numpy as np
import sys
import json
import base64
from io import BytesIO
from PIL import Image

def detect_face(image_data_base64):
    """
    Обнаруживает лица на изображении
    Возвращает JSON с результатом
    """
    try:
        # Декодируем base64 изображение
        image_bytes = base64.b64decode(image_data_base64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return json.dumps({
                "success": False,
                "error": "Не удалось декодировать изображение",
                "hasFace": False
            })
        
        # Конвертируем в grayscale для детектора
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Загружаем каскад Хаара для обнаружения лиц
        # Используем встроенный каскад OpenCV
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Обнаруживаем лица
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        has_face = len(faces) > 0
        
        return json.dumps({
            "success": True,
            "hasFace": has_face,
            "faceCount": len(faces),
            "faces": [{"x": int(x), "y": int(y), "w": int(w), "h": int(h)} for (x, y, w, h) in faces]
        })
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "hasFace": False
        })

def check_meme_or_fake(image_data_base64):
    """
    Простая проверка на мемы/фейки
    (OpenCV не имеет встроенной проверки на мемы, поэтому возвращаем false)
    """
    return json.dumps({
        "success": True,
        "isMeme": False,
        "reason": "OpenCV не поддерживает проверку на мемы"
    })

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Недостаточно аргументов. Использование: python opencv-face-detector.py <command> <base64_image>"
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    image_data = sys.argv[2]
    
    if command == "detect_face":
        result = detect_face(image_data)
        print(result)
    elif command == "check_meme":
        result = check_meme_or_fake(image_data)
        print(result)
    else:
        print(json.dumps({
            "success": False,
            "error": f"Неизвестная команда: {command}"
        }))
        sys.exit(1)

