-- SQL скрипт для добавления промокода SECRETPARKING
-- Активирует PRO подписку на 7 дней

INSERT INTO promo_codes (code, days, is_active, created_at)
VALUES ('SECRETPARKING', 7, true, NOW())
ON CONFLICT (code) DO UPDATE
SET days = 7,
    is_active = true,
    created_at = NOW();

-- Проверка добавления промокода
SELECT id, code, days, is_active, created_at, expires_at
FROM promo_codes
WHERE code = 'SECRETPARKING';

