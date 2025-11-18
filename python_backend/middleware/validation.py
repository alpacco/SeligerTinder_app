"""
middleware/validation.py
Валидация и санитизация входных данных
"""
from fastapi import HTTPException
from pydantic import BaseModel, validator
import html


def sanitize_string(value: str) -> str:
    """Санитизация строки от XSS"""
    if not isinstance(value, str):
        return value
    return html.escape(value)


class UserIdValidator(BaseModel):
    userId: str
    
    @validator('userId')
    def validate_user_id(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('userId обязателен и должен быть строкой')
        if not v.isdigit():
            raise ValueError('userId должен содержать только цифры')
        return v

