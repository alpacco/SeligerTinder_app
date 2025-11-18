"""
routes/goals.py
Роуты для работы с целями знакомства
"""
from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Dict, Optional
from pydantic import BaseModel
from db_utils import db_get, db_run, safe_json_parse
import json

router = APIRouter()


class UpdateGoalsRequest(BaseModel):
    userId: str
    goals: Optional[List[str]] = None
    goal: Optional[str] = None


@router.get("/goals")
async def get_goals(userId: str = Query(..., description="ID пользователя")):
    """Получить массив целей пользователя"""
    if not userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    
    try:
        row = await db_get("SELECT goals FROM users WHERE userId = ?", [userId])
        goals_arr = safe_json_parse(row.get("goals") if row else None, [])
        return {"success": True, "goals": goals_arr}
    except Exception as e:
        print(f"GET /api/goals error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/goals")
async def update_goals(data: Dict = Body(...)):
    """Заменить весь массив целей"""
    userId = data.get("userId")
    goals = data.get("goals")
    
    if not userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    if not isinstance(goals, list):
        raise HTTPException(status_code=400, detail="goals должен быть массивом")
    
    try:
        goals_str = json.dumps(goals)
        await db_run("UPDATE users SET goals = ? WHERE userId = ?", [goals_str, userId])
        return {"success": True, "goals": goals}
    except Exception as e:
        print(f"POST /api/goals error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updateGoals")
async def update_goals_advanced(data: UpdateGoalsRequest):
    """Обновить цели: заменить весь массив или добавить одну цель"""
    if not data.userId:
        raise HTTPException(status_code=400, detail="userId обязателен")
    
    try:
        if data.goals is not None and isinstance(data.goals, list):
            # Заменить весь массив
            goals_str = json.dumps(data.goals)
            await db_run("UPDATE users SET goals = ? WHERE userId = ?", [goals_str, data.userId])
            return {"success": True, "goals": data.goals}
        elif data.goal:
            # Добавить одну цель
            row = await db_get("SELECT goals FROM users WHERE userId = ?", [data.userId])
            goals_arr = safe_json_parse(row.get("goals") if row else None, [])
            if data.goal not in goals_arr:
                goals_arr.append(data.goal)
            goals_str = json.dumps(goals_arr)
            await db_run("UPDATE users SET goals = ? WHERE userId = ?", [goals_str, data.userId])
            return {"success": True, "goals": goals_arr}
        else:
            raise HTTPException(status_code=400, detail="Параметр goals должен быть массивом или goal строкой")
    except HTTPException:
        raise
    except Exception as e:
        print(f"POST /api/updateGoals error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

