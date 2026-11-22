-- =========================================================================
-- QA DATABASE TESTS: Проверка ограничений и триггеров базы данных
-- =========================================================================

-- ТЕСТ 1: Создание проекта (Вместимость 2 места)
INSERT INTO users (full_name, email, password_hash, role)
VALUES ('QA Tester 1', 'qa1@test.com', 'hash', 'volunteer'),
       ('QA Tester 2', 'qa2@test.com', 'hash', 'volunteer'),
       ('Late Volunteer', 'late@test.com', 'hash', 'volunteer'),
       ('QA Tester Organizer', 'qa_org@test.com', 'hash', 'organizer');

INSERT INTO projects (title, description, city, start_datetime, end_datetime, max_capacity, status, organizer_id)
VALUES ('QA Test Project', 'Testing limits', 'Almaty', '2026-12-01 10:00:00', '2026-12-01 18:00:00', 2, 'open',
        (SELECT user_id FROM users WHERE email = 'qa_org@test.com'));

-- -------------------------------------------------------------------------
-- ТЕСТ 2: Проверка на уникальность Email (ОШИБКА: duplicate key value)
-- -------------------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, role)
VALUES ('Hacker', 'qa1@test.com', '123', 'volunteer');

-- -------------------------------------------------------------------------
-- ТЕСТ 3: Успешная запись (Мест: 2, Занято: 1)
-- -------------------------------------------------------------------------
INSERT INTO registrations (user_id, project_id)
VALUES (
    (SELECT user_id FROM users WHERE email = 'qa1@test.com'),
    (SELECT project_id FROM projects WHERE title = 'QA Test Project')
);

-- -------------------------------------------------------------------------
-- ТЕСТ 4: Защита от двойной регистрации (ОШИБКА: duplicate key value)
-- (Триггер пропустит, так как место еще 1 есть, но уникальный ключ заблокирует!)
-- -------------------------------------------------------------------------
INSERT INTO registrations (user_id, project_id)
VALUES (
    (SELECT user_id FROM users WHERE email = 'qa1@test.com'),
    (SELECT project_id FROM projects WHERE title = 'QA Test Project')
);

-- -------------------------------------------------------------------------
-- ТЕСТ 5: Занимаем последнее место (Мест: 2, Занято: 2)
-- -------------------------------------------------------------------------
INSERT INTO registrations (user_id, project_id)
VALUES (
    (SELECT user_id FROM users WHERE email = 'qa2@test.com'),
    (SELECT project_id FROM projects WHERE title = 'QA Test Project')
);

-- -------------------------------------------------------------------------
-- ТЕСТ 6: Защита вместимости (ОШИБКА: Project is full)
-- (Пытаемся записать третьего человека на 2 места)
-- -------------------------------------------------------------------------
INSERT INTO registrations (user_id, project_id)
VALUES (
    (SELECT user_id FROM users WHERE email = 'late@test.com'),
    (SELECT project_id FROM projects WHERE title = 'QA Test Project')
);

-- =========================================================================
-- ОЧИСТКА ТЕСТОВЫХ ДАННЫХ
-- =========================================================================
DELETE FROM registrations
WHERE project_id = (SELECT project_id FROM projects WHERE title = 'QA Test Project');

DELETE FROM projects
WHERE title = 'QA Test Project';

DELETE FROM users
WHERE email IN ('qa1@test.com', 'qa2@test.com', 'qa_org@test.com', 'late@test.com');