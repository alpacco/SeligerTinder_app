"""
routes/photos.py
Роуты для загрузки и обработки фотографий
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body, Request
from typing import Optional, Dict
import aiofiles
from pathlib import Path
import httpx
from db_utils import db_get, db_run
from opencv_utils import check_face_in_photo, is_meme_or_fake
from config import IMAGES_DIR, HTTP_TIMEOUT, HTTP_MAX_REDIRECTS
from middleware.security import (
    validate_user_id,
    validate_photo_index,
    sanitize_filename,
    validate_image_content,
    sanitize_path,
    validate_url
)

router = APIRouter()


@router.post("/upload")
@router.post("/uploadPhoto")  # Алиас для совместимости с ботом
async def upload_photo(
    file: UploadFile = File(...),
    userId: str = Form(...),
    photoIndex: Optional[str] = Form(None)
):
    """Загрузить фотографию (с валидацией безопасности)"""
    try:
        # Валидация входных данных
        userId = validate_user_id(userId)
        photoIndex = validate_photo_index(photoIndex)
        
        # Читаем содержимое файла
        content = await file.read()
        
        # Валидация файла
        validate_image_content(content)
        
        # Определяем имя файла безопасно
        if photoIndex:
            filename = f"Photo{photoIndex}.jpg"
        else:
            filename = sanitize_filename(file.filename) or "Photo1.jpg"
            photoIndex = "1"
        
        # Создаем безопасный путь
        file_path = sanitize_path(Path(IMAGES_DIR), userId, filename)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Сохраняем файл
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Проверяем лицо через OpenCV
        has_face, face_count = check_face_in_photo(content)
        
        # Обновляем БД (безопасно, используя параметризованный запрос)
        column = f"photo{photoIndex}"
        photo_url = f"/data/img/{userId}/{filename}"
        
        await db_run(
            f'UPDATE users SET "{column}" = ?, needPhoto = ? WHERE "userId" = ?',
            [photo_url, 0 if has_face else 1, userId]
        )
        
        return {
            "success": True,
            "photoUrl": photo_url,
            "hasFace": has_face,
            "faceCount": face_count
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка загрузки фото: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки фотографии")


@router.post("/uploadUrl")
@router.post("/webUploadPhoto")  # Алиас для совместимости
async def upload_photo_from_url(request: Request):
    """Загрузить фотографию по URL (поддерживает JSON и Form data)"""
    # Определяем тип контента
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        # JSON body (для бота)
        data = await request.json()
        userId = data.get("userId")
        fileUrl = data.get("fileUrl") or data.get("file_url")
        photoIndex = data.get("photoIndex") or data.get("photo_index")
        fileUniqueId = data.get("fileUniqueId") or data.get("file_unique_id")
    else:
        # Form data
        form_data = await request.form()
        userId = form_data.get("userId")
        fileUrl = form_data.get("fileUrl") or form_data.get("file_url")
        photoIndex = form_data.get("photoIndex") or form_data.get("photo_index")
        fileUniqueId = form_data.get("fileUniqueId") or form_data.get("file_unique_id")
    
    if not userId or not fileUrl:
        raise HTTPException(status_code=400, detail="userId and fileUrl required")
    
    try:
        # Валидация входных данных
        userId = validate_user_id(userId)
        fileUrl = validate_url(fileUrl)
        photoIndex = validate_photo_index(photoIndex) if photoIndex else None
        
        # Скачиваем изображение (с таймаутом и ограничением размера)
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, max_redirects=HTTP_MAX_REDIRECTS) as client:
            response = await client.get(fileUrl)
            response.raise_for_status()
            image_buffer = response.content
            
            # Валидация размера и содержимого
            validate_image_content(image_buffer)
        
        # Получаем текущие слоты из БД
        row = await db_get('SELECT "photo1", "photo2", "photo3" FROM users WHERE "userId" = ?', [userId])
        p1 = (row.get("photo1") or "").strip() if row else ""
        p2 = (row.get("photo2") or "").strip() if row else ""
        p3 = (row.get("photo3") or "").strip() if row else ""
        
        # Определяем имя файла и слот безопасно
        if photoIndex:
            column = f"photo{photoIndex}"
            filename = f"Photo{photoIndex}.jpg"
        elif fileUniqueId:
            # Санитизируем fileUniqueId
            fileUniqueId = sanitize_filename(fileUniqueId.replace('.jpg', '').replace('.jpeg', ''))
            # Определяем свободный слот
            if not p1:
                column = "photo1"
                filename = "Photo1.jpg"
            elif not p2:
                column = "photo2"
                filename = "Photo2.jpg"
            elif not p3:
                column = "photo3"
                filename = "Photo3.jpg"
            else:
                # Все слоты заняты, используем первый
                column = "photo1"
                filename = "Photo1.jpg"
        else:
            # Автоматически определяем свободный слот
            if not p1:
                column = "photo1"
                filename = "Photo1.jpg"
            elif not p2:
                column = "photo2"
                filename = "Photo2.jpg"
            elif not p3:
                column = "photo3"
                filename = "Photo3.jpg"
            else:
                # Все слоты заняты, используем первый
                column = "photo1"
                filename = "Photo1.jpg"
        
        # Создаем безопасный путь
        file_path = sanitize_path(Path(IMAGES_DIR), userId, filename)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Сохраняем файл
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(image_buffer)
        
        # Проверяем лицо
        has_face, face_count = check_face_in_photo(image_buffer)
        
        if not has_face:
            # Удаляем файл если лицо не найдено
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=400, detail="Лицо не обнаружено. Загрузите другое фото.", needPhoto=1)
        
        # Обновляем БД (безопасно, используя параметризованный запрос)
        photo_url = f"/data/img/{userId}/{filename}"
        await db_run(
            f'UPDATE users SET "{column}" = ?, needPhoto = ? WHERE "userId" = ?',
            [photo_url, 0, userId]
        )
        
        return {
            "success": True,
            "photoUrl": photo_url,
            "hasFace": has_face,
            "faceCount": face_count
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка загрузки фото по URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/uploadBase64")
async def upload_photo_base64(data: Dict = Body(...)):
    """Загрузить фотографию из Base64 (с валидацией безопасности)"""
    import base64
    userId = data.get("userId")
    base64_data = data.get("base64")
    photoIndex = data.get("photoIndex")
    
    if not userId or not base64_data:
        raise HTTPException(status_code=400, detail="userId and base64 required")
    
    try:
        # Валидация входных данных
        userId = validate_user_id(userId)
        photoIndex = validate_photo_index(photoIndex) if photoIndex else "1"
        
        # Декодируем Base64
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
        
        try:
            image_buffer = base64.b64decode(base64_data, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Некорректный Base64")
        
        # Валидация файла
        validate_image_content(image_buffer)
        
        # Определяем имя файла безопасно
        filename = f"Photo{photoIndex}.jpg"
        
        # Создаем безопасный путь
        file_path = sanitize_path(Path(IMAGES_DIR), userId, filename)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Сохраняем файл
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(image_buffer)
        
        # Проверяем лицо
        has_face, face_count = check_face_in_photo(image_buffer)
        
        # Обновляем БД (безопасно)
        column = f"photo{photoIndex}"
        photo_url = f"/data/img/{userId}/{filename}"
        
        await db_run(
            f'UPDATE users SET "{column}" = ?, needPhoto = ? WHERE "userId" = ?',
            [photo_url, 0 if has_face else 1, userId]
        )
        
        return {
            "success": True,
            "photoUrl": photo_url,
            "hasFace": has_face,
            "faceCount": face_count
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка загрузки фото из Base64: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки фотографии")


@router.post("/deletePhoto")
async def delete_photo(data: Dict = Body(...)):
    """Удалить конкретное фото пользователя (с валидацией безопасности)"""
    userId = data.get("userId")
    photoIndex = data.get("photoIndex")
    
    if not userId or not photoIndex:
        raise HTTPException(status_code=400, detail="userId and photoIndex required")
    
    try:
        # Валидация входных данных
        userId = validate_user_id(userId)
        photoIndex = validate_photo_index(photoIndex)
        column = f"photo{photoIndex}"
        
        # Получаем текущее значение фото (безопасно)
        row = await db_get(f'SELECT "{column}" FROM users WHERE "userId" = ?', [userId])
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        photo_url = row.get(column)
        
        # Удаляем файл, если он существует (безопасно)
        if photo_url:
            filename = sanitize_filename(Path(photo_url).name)
            file_path = sanitize_path(Path(IMAGES_DIR), userId, filename)
            if file_path.exists():
                file_path.unlink()
        
        # Очищаем поле в БД (безопасно)
        await db_run(f'UPDATE users SET "{column}" = \'\' WHERE "userId" = ?', [userId])
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка удаления фото: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления фотографии")


@router.post("/checkPhotoUrl")
async def check_photo_url(data: Dict = Body(...)):
    """Проверить photoUrl (для совместимости)"""
    photoUrl = data.get("photoUrl")
    if not photoUrl:
        raise HTTPException(status_code=400, detail="photoUrl required")
    
    # Простая проверка - если URL валидный, возвращаем успех
    if photoUrl.startswith("http") or photoUrl.startswith("/"):
        return {"success": True, "valid": True}
    
    return {"success": False, "valid": False}


@router.post("/clear")
async def clear_photos(data: Dict = Body(...)):
    """Удалить все фотографии пользователя"""
    userId = data.get("userId")
    if not userId:
        raise HTTPException(status_code=400, detail="userId required")
    
    try:
        # Удаляем директорию
        user_dir = Path(IMAGES_DIR) / userId
        if user_dir.exists():
            import shutil
            shutil.rmtree(user_dir)
        
        # Очищаем БД
        await db_run(
            "UPDATE users SET photo1 = '', photo2 = '', photo3 = '' WHERE userId = ?",
            [userId]
        )
        
        return {"success": True}
    except Exception as e:
        print(f"Ошибка очистки фото: {e}")
        raise HTTPException(status_code=500, detail=str(e))

