/**
 * Модуль для работы с PostgreSQL
 * Поддерживает подключение через переменные окружения Railway или DATABASE_URL
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// === ЭТАЛОННЫЕ ПУТИ ДЛЯ ДАННЫХ ===
const IMAGES_DIR = '/data/img';
const LOG_DIR = '/data/log';
const GIFT_IMAGES_DIR = '/data/giftimg';

console.log(`Путь для изображений: ${IMAGES_DIR}`);
console.log(`Путь для логов: ${LOG_DIR}`);
console.log(`Путь для изображений подарков: ${GIFT_IMAGES_DIR}`);

// Создаём папки, если не существуют
[IMAGES_DIR, LOG_DIR, GIFT_IMAGES_DIR].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Создана папка: ${dir}`);
    } else {
      console.log(`✅ Папка уже существует: ${dir}`);
    }
  } catch (err) {
    console.warn(`⚠️ Не удалось создать папку ${dir}: ${err.message}`);
  }
});

// Конфигурация подключения к PostgreSQL
// Railway предоставляет DATABASE_URL, но также можно использовать отдельные переменные
function getDbConfig() {
  // Приоритет: DATABASE_URL > отдельные переменные
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }

  // Альтернативный вариант через отдельные переменные
  return {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'railway',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
}

// Создаем пул подключений
const pool = new Pool(getDbConfig());

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка на неактивном клиенте PostgreSQL:', err);
  process.exit(-1);
});

// Тестовое подключение
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
  } else {
    console.log('✅ Подключились к PostgreSQL БД');
    console.log('📅 Время сервера:', res.rows[0].now);
  }
});

// Обертка для совместимости с SQLite API
// Создаем объект, который имитирует интерфейс sqlite3.Database
// Но также предоставляет прямой доступ к pool для новых утилит
const db = {
  // Метод get (SELECT с одним результатом)
  get: (sql, params, callback) => {
    // Адаптируем SQL для PostgreSQL: добавляем кавычки к camelCase идентификаторам
    let adaptedSql = sql;
    // Простая замена userId на "userId" для основных случаев
    adaptedSql = adaptedSql.replace(/\buserId\b/g, '"userId"');
    
    pool.query(adaptedSql, params || [])
      .then(result => {
        callback(null, result.rows[0] || null);
      })
      .catch(err => {
        console.error('❌ [db.get] Ошибка SQL:', err.message);
        console.error('❌ [db.get] SQL запрос:', adaptedSql);
        callback(err, null);
      });
  },

  // Метод all (SELECT с множественными результатами)
  all: (sql, params, callback) => {
    pool.query(sql, params || [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err, null);
      });
  },

  // Метод run (INSERT, UPDATE, DELETE)
  run: (sql, params, callback) => {
    pool.query(sql, params || [])
      .then(result => {
        // Создаем объект, похожий на this из sqlite3
        const context = {
          lastID: result.rows[0]?.id || null,
          changes: result.rowCount || 0
        };
        if (callback) {
          callback.call(context, null);
        }
      })
      .catch(err => {
        if (callback) {
          callback(err);
        }
      });
  },

  // Метод serialize (для транзакций)
  serialize: (callback) => {
    // В PostgreSQL транзакции обрабатываются через клиент
    callback();
  },

  // Прямой доступ к pool для сложных запросов (используется в utils/db.js)
  query: (sql, params) => {
    return pool.query(sql, params || []);
  },

  // Закрытие соединения
  close: (callback) => {
    pool.end()
      .then(() => {
        if (callback) callback(null);
      })
      .catch(err => {
        if (callback) callback(err);
      });
  }
};

// То же самое для giftDb (используем тот же pool, но отдельная таблица)
const giftDb = {
  get: db.get,
  all: db.all,
  run: db.run,
  serialize: db.serialize,
  query: db.query,
  close: db.close
};

// Функция инициализации БД (создание таблиц)
const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Создание таблицы users
    await client.query(`
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
    `);

    // Создание индексов
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_userid ON users("userId");');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);');

    // Таблица dislikes
    await client.query(`
      CREATE TABLE IF NOT EXISTS dislikes (
        id SERIAL PRIMARY KEY,
        from_user VARCHAR(255) NOT NULL,
        to_user VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user, to_user)
      );
    `);

    // Таблица super_likes
    await client.query(`
      CREATE TABLE IF NOT EXISTS super_likes (
        id SERIAL PRIMARY KEY,
        from_user VARCHAR(255) NOT NULL,
        to_user VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL,
        UNIQUE(from_user, to_user)
      );
    `);

    // Таблица visits
    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL,
        "visitorId" VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Таблица badge_requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_requests (
        id SERIAL PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL,
        badge_type VARCHAR(10) NOT NULL CHECK (badge_type IN ('L', 'P', 'S')),
        justification TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users("userId") ON DELETE CASCADE
      );
    `);

    // Таблица gifts
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        "NameGift" VARCHAR(255),
        "PriceGift" INTEGER,
        "PhotoGift" TEXT,
        "AboutGift" TEXT,
        "SaleGift" INTEGER DEFAULT 0,
        "StopGift" INTEGER DEFAULT 1
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Все таблицы PostgreSQL созданы или уже существуют');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка инициализации PostgreSQL БД:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// Запускаем инициализацию
initDb().catch(err => {
  console.error('❌ Критическая ошибка при инициализации БД:', err);
});

// Экспортируем подключения
module.exports = {
  db,
  giftDb,
  pool,
  initDb,
  IMAGES_DIR,
  LOG_DIR,
  GIFT_IMAGES_DIR
};

