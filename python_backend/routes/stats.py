"""
routes/stats.py
Роуты для статистики
"""
from fastapi import APIRouter
from db_utils import db_get, db_all, safe_json_parse
from datetime import datetime

router = APIRouter()


@router.get("/")
async def get_stats():
    """Получить общую статистику"""
    try:
        day = datetime.now().isoformat()[:10]
        
        # Пол пользователей
        gender_rows = await db_all("SELECT gender, COUNT(*) AS cnt FROM users GROUP BY gender")
        men_count = 0
        women_count = 0
        for row in gender_rows:
            if row.get("gender") == "male":
                men_count = row.get("cnt", 0)
            elif row.get("gender") == "female":
                women_count = row.get("cnt", 0)
        
        # Фото у пользователей
        photo_rows = await db_all("SELECT photo1, photo2, photo3 FROM users")
        with_photo = 0
        for row in photo_rows:
            photos = (row.get("photo1", "") or "") + (row.get("photo2", "") or "") + (row.get("photo3", "") or "")
            if photos.strip():
                with_photo += 1
        total = len(photo_rows)
        no_photo = total - with_photo
        
        # Топ-5 по количеству лайков
        likes_rows = await db_all("SELECT userId, name, likes FROM users")
        top5 = []
        for row in likes_rows:
            likes = safe_json_parse(row.get("likes"), [])
            top5.append({
                "userId": row.get("userId"),
                "name": row.get("name", ""),
                "count": len(likes) if isinstance(likes, list) else 0
            })
        top5.sort(key=lambda x: x["count"], reverse=True)
        top5 = top5[:5]
        
        # Визиты за сегодня - считаем уникальных посетителей по visitorId (telegramID)
        visits_row = await db_get(
            'SELECT COUNT(DISTINCT "visitorId") AS dayCount FROM visits WHERE DATE(timestamp) = ?',
            [day]
        )
        day_visits = visits_row.get("dayCount", 0) if visits_row else 0
        
        return {
            "success": True,
            "menCount": men_count,
            "womenCount": women_count,
            "withPhoto": with_photo,
            "noPhoto": no_photo,
            "dayVisits": day_visits,
            "top5": top5
        }
    except Exception as e:
        print(f"/api/stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/day")
async def get_stats_day():
    """Получить статистику за день (визиты за 24 часа) - считаем уникальных посетителей по visitorId (telegramID)"""
    try:
        # Используем интервал 24 часа вместо DATE для более точного подсчета
        row = await db_get(
            'SELECT COUNT(DISTINCT "visitorId") AS "dayCount" FROM visits WHERE timestamp >= NOW() - INTERVAL \'24 hours\'',
            []
        )
        visits_24h = row.get("dayCount", 0) if row else 0
        return {"success": True, "visits24h": visits_24h}
    except Exception as e:
        print(f"/api/stats/day error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_stats_users():
    """Получить распределение пользователей по полу"""
    try:
        # Получаем общее количество пользователей
        total_row = await db_get("SELECT COUNT(*) AS count FROM users")
        total_users = total_row.get("count", 0) if total_row else 0
        
        # Получаем распределение по полу (обрабатываем NULL и пустые строки)
        rows = await db_all("""
            SELECT 
                CASE 
                    WHEN gender IS NULL OR gender = '' THEN 'Не указан'
                    ELSE gender
                END AS name,
                COUNT(*) AS count 
            FROM users 
            GROUP BY 
                CASE 
                    WHEN gender IS NULL OR gender = '' THEN 'Не указан'
                    ELSE gender
                END
        """)
        
        return {
            "success": True,
            "data": rows,
            "total": total_users
        }
    except Exception as e:
        print(f"/api/stats/users error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

