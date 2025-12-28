"""
utils/photo_url.py
Утилиты для нормализации URL фотографий
"""
from config import WEB_APP_URL

# Старые домены, которые нужно заменить
OLD_DOMAINS = [
    'https://sta-alpacco.amvera.io',
    'http://sta-alpacco.amvera.io',
    'sta-alpacco.amvera.io',
    'https://web-production-4bcda.up.railway.app',  # На случай если нужно будет обновить
]

def normalize_photo_url(photo_url: str) -> str:
    """
    Нормализует URL фотографии:
    - Если URL содержит старый домен, извлекает относительный путь
    - Если URL уже относительный, возвращает как есть
    - Если URL пустой или дефолтный, возвращает как есть
    
    Args:
        photo_url: URL фотографии (может быть полным или относительным)
    
    Returns:
        Нормализованный относительный путь к фотографии
    """
    if not photo_url or not isinstance(photo_url, str):
        return photo_url or ""
    
    photo_url = photo_url.strip()
    
    # Если это дефолтные пути, возвращаем как есть
    if photo_url in ["/img/logo.svg", "/img/avatar.svg", "/img/photo.svg", ""]:
        return photo_url
    
    # Если это Telegram userpic (полный URL или относительный путь), обрабатываем отдельно
    if '/i/userpic/' in photo_url:
        # Если это полный URL Telegram, возвращаем как есть
        if photo_url.startswith('https://t.me/i/userpic/') or photo_url.startswith('http://t.me/i/userpic/'):
            return photo_url
        # Если это относительный путь /i/userpic/..., преобразуем в полный URL
        elif photo_url.startswith('/i/userpic/'):
            return f"https://t.me{photo_url}"
        # В остальных случаях возвращаем как есть (может быть в составе другого URL)
        return photo_url
    
    # Проверяем, содержит ли URL старый домен
    for old_domain in OLD_DOMAINS:
        if old_domain in photo_url:
            # Извлекаем относительный путь
            # Формат: https://sta-alpacco.amvera.io/data/img/123/Photo1.jpg
            # Результат: /data/img/123/Photo1.jpg
            if '/data/img/' in photo_url:
                # Извлекаем путь после /data/img/
                path_start = photo_url.find('/data/img/')
                return photo_url[path_start:]
            elif photo_url.startswith(old_domain):
                # Если URL начинается со старого домена, убираем его
                return photo_url[len(old_domain):]
    
    # Если URL уже относительный (начинается с /), но это не Telegram userpic
    # Telegram userpic уже обработан выше
    if photo_url.startswith('/'):
        # Если это путь /i/userpic/..., преобразуем в полный URL Telegram
        if photo_url.startswith('/i/userpic/'):
            return f"https://t.me{photo_url}"
        return photo_url
    
    # Если URL полный с новым доменом, извлекаем относительный путь
    if WEB_APP_URL and WEB_APP_URL in photo_url:
        path_start = photo_url.find('/', photo_url.find('//') + 2)
        if path_start > 0:
            return photo_url[path_start:]
    
    # Если это полный URL с другим доменом, возвращаем как есть (на случай внешних ссылок)
    if photo_url.startswith('http://') or photo_url.startswith('https://'):
        return photo_url
    
    # В остальных случаях возвращаем как есть
    return photo_url


def normalize_photos_list(photos: list) -> list:
    """
    Нормализует список URL фотографий
    
    Args:
        photos: Список URL фотографий
    
    Returns:
        Список нормализованных URL
    """
    if not photos:
        return []
    
    return [normalize_photo_url(photo) for photo in photos if photo]

