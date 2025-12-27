-- Скрипт для отката лайков пользователю 307954967
-- Создан автоматически для тестирования
-- Удаляет '307954967' из массива likes у всех пользователей

-- ВАЖНО: Перед выполнением убедитесь, что это именно те лайки, которые нужно откатить!

-- Удаляем '307954967' из массива likes у всех пользователей
UPDATE users
SET likes = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(likes::jsonb) AS elem
    WHERE elem != '307954967'
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(likes::jsonb) AS elem
    WHERE elem = '307954967'
);

-- Проверяем результат
SELECT COUNT(*) as remaining_likes FROM users
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(likes::jsonb) AS elem
    WHERE elem = '307954967'
);

