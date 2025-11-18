-- Миграция 001: Начальная схема базы данных
-- Создание всех основных таблиц

-- Таблица users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "userId" VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  username VARCHAR(255) DEFAULT '',
  "photoUrl" TEXT DEFAULT '',
  gender VARCHAR(50) DEFAULT '',
  bio TEXT DEFAULT '',
  likes TEXT DEFAULT '[]',
  dislikes TEXT DEFAULT '[]',
  matches TEXT DEFAULT '[]',
  photo1 TEXT DEFAULT '',
  photo2 TEXT DEFAULT '',
  photo3 TEXT DEFAULT '',
  "photoBot" TEXT DEFAULT '',
  age INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "needPhoto" INTEGER DEFAULT 0,
  goals TEXT DEFAULT '[]',
  warned INTEGER DEFAULT 0,
  "pushSent" INTEGER DEFAULT 0,
  is_pro INTEGER DEFAULT 0,
  pro_start TEXT DEFAULT '',
  pro_end TEXT DEFAULT '',
  "lastLogin" TIMESTAMP,
  "superLikesCount" INTEGER DEFAULT 0,
  superlikes TEXT DEFAULT '[]',
  about TEXT DEFAULT '',
  "lookingFor" TEXT DEFAULT ''
);

-- Индексы для users
CREATE INDEX IF NOT EXISTS idx_users_userid ON users("userId");
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);
CREATE INDEX IF NOT EXISTS idx_users_needphoto ON users("needPhoto");

-- Таблица dislikes
CREATE TABLE IF NOT EXISTS dislikes (
  id SERIAL PRIMARY KEY,
  from_user VARCHAR(255) NOT NULL,
  to_user VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_user, to_user)
);

CREATE INDEX IF NOT EXISTS idx_dislikes_from_user ON dislikes(from_user);
CREATE INDEX IF NOT EXISTS idx_dislikes_to_user ON dislikes(to_user);

-- Таблица super_likes
CREATE TABLE IF NOT EXISTS super_likes (
  id SERIAL PRIMARY KEY,
  from_user VARCHAR(255) NOT NULL,
  to_user VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  UNIQUE(from_user, to_user)
);

CREATE INDEX IF NOT EXISTS idx_super_likes_from_user ON super_likes(from_user);
CREATE INDEX IF NOT EXISTS idx_super_likes_to_user ON super_likes(to_user);

-- Таблица visits
CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL,
  "visitorId" VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_userid ON visits("userId");
CREATE INDEX IF NOT EXISTS idx_visits_visitorid ON visits("visitorId");

-- Таблица badge_requests
CREATE TABLE IF NOT EXISTS badge_requests (
  id SERIAL PRIMARY KEY,
  "userId" VARCHAR(255) NOT NULL,
  badge_type VARCHAR(10) NOT NULL CHECK (badge_type IN ('L', 'P', 'S')),
  justification TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users("userId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_badge_requests_userid ON badge_requests("userId");
CREATE INDEX IF NOT EXISTS idx_badge_requests_status ON badge_requests(status);

-- Таблица gifts
CREATE TABLE IF NOT EXISTS gifts (
  id SERIAL PRIMARY KEY,
  "NameGift" VARCHAR(255),
  "PriceGift" INTEGER,
  "PhotoGift" TEXT,
  "AboutGift" TEXT,
  "SaleGift" INTEGER DEFAULT 0,
  "StopGift" INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_gifts_stopgift ON gifts("StopGift");

