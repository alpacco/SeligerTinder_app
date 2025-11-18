// db.js
// Поддержка SQLite и PostgreSQL
// Используется PostgreSQL если установлена переменная окружения USE_POSTGRES=true или DATABASE_URL
const dotenv = require('dotenv');
dotenv.config();

const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || !!process.env.DATABASE_URL;

if (USE_POSTGRES) {
  // Используем PostgreSQL
  console.log('📊 Используется PostgreSQL');
  module.exports = require('./db-pg');
} else {
  // Используем SQLite (старое поведение)
  console.log('📊 Используется SQLite');
  
  const sqlite3 = require('sqlite3');
  const fs = require('fs');
  const path = require('path');

// В CommonJS __dirname уже доступен, не нужно определять вручную

// === ЭТАЛОННЫЕ ПУТИ ДЛЯ ДАННЫХ ===
const DB_PATH = '/data/tinder.db';
const GIFT_DB_PATH = '/data/gift.bd';
const IMAGES_DIR = '/data/img';
const LOG_DIR = '/data/log';
const GIFT_IMAGES_DIR = '/data/giftimg';

console.log(`Путь к БД: ${DB_PATH}`);
console.log(`Путь к БД подарков: ${GIFT_DB_PATH}`);
console.log(`Путь для изображений: ${IMAGES_DIR}`);
console.log(`Путь для логов: ${LOG_DIR}`);
console.log(`Путь для изображений подарков: ${GIFT_IMAGES_DIR}`);

// Создаём папки, если не существуют (с обработкой ошибок)
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
    // Не падаем, продолжаем работу
  }
});

// Создаём файл БД, если не существует (с обработкой ошибок)
try {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '');
    console.warn('🆕 Создан новый файл базы данных!');
  }
} catch (err) {
  console.warn(`⚠️ Не удалось создать файл БД ${DB_PATH}: ${err.message}`);
}

try {
  if (!fs.existsSync(GIFT_DB_PATH)) {
    fs.writeFileSync(GIFT_DB_PATH, '');
    console.warn('🆕 Создан новый файл базы данных подарков!');
  }
} catch (err) {
  console.warn(`⚠️ Не удалось создать файл БД подарков ${GIFT_DB_PATH}: ${err.message}`);
}

// Открываем подключение к SQLite
const db = new sqlite3.Database(
  DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error(`❌ Не удалось открыть БД по пути ${DB_PATH}:`, err.message);
      throw err;
    }
    console.info(`✅ Подключились к SQLite БД: ${DB_PATH}`);
    // Логируем структуру таблицы users
    db.all("PRAGMA table_info(users)", [], (err, cols) => {
      if (err) {
        console.error('❌ Не удалось получить структуру таблицы users:', err.message);
      } else {
        console.log('📋 Структура таблицы users:');
        cols.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
      }
    });
  }
);
// === Инициализация базы данных для подарков ===
const giftDb = new sqlite3.Database(
  GIFT_DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error(`❌ Не удалось открыть gifts БД по пути ${GIFT_DB_PATH}:`, err.message);
      throw err;
    }
    console.info(`✅ Подключились к gifts SQLite БД: ${GIFT_DB_PATH}`);
  }
);

console.log('=== DIAGNOSTICS ===');
console.log('process.cwd():', process.cwd());
console.log('DB_PATH:', DB_PATH);
console.log('GIFT_DB_PATH:', GIFT_DB_PATH);
console.log('IMG_DIR:', IMAGES_DIR);
console.log('IMG_DIR_PATH:', IMAGES_DIR);
console.log('LOG_DIR:', LOG_DIR);
console.log('LOG_DIR_PATH:', LOG_DIR);
console.log('GIFT_IMG_DIR:', GIFT_IMAGES_DIR);
console.log('GIFT_IMG_PATH:', GIFT_IMAGES_DIR);
try {
  console.log('process.getuid:', process.getuid && process.getuid());
  console.log('process.getgid:', process.getgid && process.getgid());
} catch (e) {
  console.log('process.getuid/getgid: not available');
}
console.log('=== END DIAGNOSTICS ===');

// Экспортируем оба подключения к БД
const initDb = () => {
  // Эталонная схема users
  const createUserTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId   TEXT UNIQUE,
      name     TEXT,
      username TEXT DEFAULT '',
      photoUrl TEXT DEFAULT '',
      gender   TEXT DEFAULT '',
      bio      TEXT DEFAULT '',
      likes    TEXT DEFAULT '[]',
      dislikes TEXT DEFAULT '[]',
      matches  TEXT DEFAULT '[]',
      photo1   TEXT DEFAULT '',
      photo2   TEXT DEFAULT '',
      photo3   TEXT DEFAULT '',
      photoBot TEXT DEFAULT '',
      age      INTEGER DEFAULT 0,
      blocked  INTEGER DEFAULT 0,
      badge    TEXT DEFAULT '',
      createdAt TEXT DEFAULT '',
      needPhoto INTEGER DEFAULT 0,
      goals     TEXT DEFAULT '[]',
      warned    INTEGER DEFAULT 0,
      pushSent  INTEGER DEFAULT 0,
      is_pro    INTEGER DEFAULT 0,
      pro_start TEXT DEFAULT '',
      pro_end   TEXT DEFAULT ''
    );
  `;
  db.run(createUserTable, (err) => {
    if (err) {
      console.error('❌ Ошибка создания таблицы users:', err.message);
    } else {
      console.log('✅ Таблица users создана или уже существует.');
      // Проверяем и добавляем недостающие колонки
      db.all('PRAGMA table_info(users)', [], (err, rows) => {
        if (err) {
          console.error('❌ Ошибка проверки структуры users:', err.message);
          return;
        }
        const columns = rows.map(r => r.name);
        const addColumn = (name, sql) => {
          if (!columns.includes(name)) {
            db.run(sql, err2 => {
              if (err2) console.error(`❌ Ошибка добавления колонки ${name}:`, err2.message);
              else console.log(`✅ Колонка ${name} добавлена.`);
            });
          }
        };
        addColumn('pushSent',  "ALTER TABLE users ADD COLUMN pushSent INTEGER DEFAULT 0");
        addColumn('goals',     "ALTER TABLE users ADD COLUMN goals TEXT DEFAULT '[]'");
        addColumn('is_pro',    "ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0");
        addColumn('pro_start', "ALTER TABLE users ADD COLUMN pro_start TEXT DEFAULT ''");
        addColumn('pro_end',   "ALTER TABLE users ADD COLUMN pro_end TEXT DEFAULT ''");
        addColumn('last_login',"ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT ''");
        addColumn('super_likes_count', "ALTER TABLE users ADD COLUMN super_likes_count INTEGER DEFAULT 0");
      });
    }
  });

  // Остальные таблицы
  db.run(`CREATE TABLE IF NOT EXISTS dislikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      UNIQUE(from_user, to_user)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS super_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        status TEXT NOT NULL,
        UNIQUE(from_user, to_user)
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      visitorId TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS badge_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      badge_type TEXT NOT NULL CHECK(badge_type IN ('L', 'P', 'S')),
      justification TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
  );`);

  // gifts
  const giftDbSchema = `
    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      NameGift TEXT,
      PriceGift INTEGER,
      PhotoGift TEXT,
      StopGift INTEGER
    );
  `;
  giftDb.run(giftDbSchema, (err) => {
    if (err) {
      console.error('❌ Ошибка инициализации БД подарков:', err.message);
    } else {
      console.log('✅ Схема БД подарков успешно инициализирована.');
    }
  });
};

// Запускаем инициализацию
initDb();

  // Экспортируем оба подключения к БД
  module.exports = {
    db,
    giftDb,
    initDb,
    IMAGES_DIR,
    LOG_DIR,
    GIFT_IMAGES_DIR
  };
}