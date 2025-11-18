/******************************************************************************
 * app.js
 * ----------------------------------------------------------------------------
 * Полный серверный код Tinder‑приложения.
 * Структура:
 *  1. Импорты модулей
 *  2. Конфигурация окружения и путей
 *  3. Инициализация Express
 *  4. Настройка View Engine (EJS)
 *  5. Настройка CORS
 *  6. Инициализация сервисов (логгер, Vision API)
 *  7. Middleware (парсеры, логгер запросов)
 *  8. Rate Limiter
 *  9. Монтирование API-маршрутов
 * 10. Раздача статических файлов
 * 11. Корневой маршрут и SPA Fallback
 * 12. Обработчики ошибок
 * 13. Cron-задачи
 * 14. Экспорт приложения
 ******************************************************************************/

// 1. Импорты модулей
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const vision = require('@google-cloud/vision');
const cron = require('node-cron');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hashMap = require('./public/hash-map.json');

// Маршруты
const usersRouter = require('./routes/users');
const statsRouter = require('./routes/stats');
const likesRouter = require('./routes/likes.js');
const matchesRouter = require('./routes/matches.js');
const photosRouter = require('./routes/photos');
const goalsRouter = require('./routes/goals');
const giftsRouter = require('./routes/gifts');
const pushRouter = require('./routes/push');
const proRouter = require('./routes/pro');
const adminRouter = require('./routes/admin');

// База данных (поддерживает SQLite и PostgreSQL)
const { db, giftDb, pool } = require('./db');

// 2. Конфигурация окружения и путей
dotenv.config();
console.log('▶ ENV.LOCAL =', process.env.LOCAL);

const {
  LOG_LEVEL = 'info',
} = process.env;

// Удалить переменные и создание папок с относительными путями:
// const LOG_DIR_PATH = path.join(process.cwd(), 'log');
// const IMG_DIR_PATH = path.join(process.cwd(), 'img');
// const GIFT_IMG_PATH = path.join(process.cwd(), 'giftimg');
// [LOG_DIR_PATH, IMG_DIR_PATH, GIFT_IMG_PATH].forEach(...)
// console.log('📦 Загружены пути:', { LOG_DIR_PATH, IMG_DIR_PATH, GIFT_IMG_PATH });

// Пути для данных получаем из db модуля (поддерживает оба типа БД)
// Примечание: IMAGES_DIR и GIFT_IMAGES_DIR также получаем в секции 4.1
const { LOG_DIR } = require('./db');

// 3. Инициализация Express
const app = express();
app.set('etag', false); // Отключаем ETag глобально для всего приложения
// Логгер для статических изображений
app.use('/data/img', (req, res, next) => {
  console.log('[STATIC IMG]', req.method, req.url, 'from', req.ip);
  next();
});

// Глобальный логгер всех запросов
app.use((req, res, next) => {
  console.log(`[ALL REQUESTS] ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// 3.1. Безопасность
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://telegram.org"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://telegram.org", "https://web.telegram.org"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://telegram.org", "https://sta-black-dim.waw.amverum.cloud", process.env.WEB_APP_URL, "https://*.up.railway.app"].filter(Boolean),
      frameSrc: ["'self'", "https://telegram.org"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Отключаем crossOriginEmbedderPolicy для статических файлов
  crossOriginEmbedderPolicy: false
}));

// 4. Настройка View Engine (EJS)
app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (process.env.NODE_ENV === 'development') {
  app.disable('view cache');
}

// 4.1. Раздача статических файлов (ПЕРЕД CORS для избежания 403)
// Получаем IMAGES_DIR из db модуля (поддерживает оба типа БД)
const { IMAGES_DIR, GIFT_IMAGES_DIR } = require('./db');

app.use(express.static(path.join(__dirname, 'public'), { 
  index: false,
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

app.use('/data/img', express.static(IMAGES_DIR, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

app.use('/giftimg', express.static(GIFT_IMAGES_DIR, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// 5. Настройка CORS
const corsOrigins = [
  process.env.WEB_APP_URL, // Railway домен из переменной окружения
  'https://sta-black-dim.waw.amverum.cloud',
  'https://seligertinder.ru',
  'https://www.seligertinder.ru',
  'https://seligertinder.vercel.app',
  'https://*.vercel.app',
  'https://*.up.railway.app', // Все Railway домены
  'https://web.telegram.org',
  'https://localhost:8080',
  'https://telegram.org',
  'https://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8080',
  'http://localhost:8100',
].filter(Boolean); // Убираем undefined значения

const corsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, прямые запросы к статике)
    if (!origin) {
      return callback(null, true);
    }
    
    // Локальный режим - разрешаем все
    if (process.env.LOCAL === 'true') {
      return callback(null, true);
    }
    
    // Логируем origin для отладки
    console.log(`[CORS] Проверка origin: ${origin}`);
    
    // Проверяем точное совпадение
    if (corsOrigins.includes(origin)) {
      console.log(`[CORS] ✅ Разрешен (точное совпадение): ${origin}`);
      return callback(null, true);
    }
    
    // Проверяем wildcard паттерны (например, *.up.railway.app)
    for (const allowed of corsOrigins) {
      if (allowed && typeof allowed === 'string' && allowed.includes('*')) {
        const pattern = allowed.replace('*.', '');
        if (origin.includes(pattern)) {
          console.log(`[CORS] ✅ Разрешен (wildcard ${allowed}): ${origin}`);
          return callback(null, true);
        }
      }
    }
    
    // Разрешаем все запросы с web.telegram.org (Telegram WebView)
    if (origin.includes('web.telegram.org') || origin.includes('telegram.org')) {
      console.log(`[CORS] ✅ Разрешен (Telegram): ${origin}`);
      return callback(null, true);
    }
    
    // Разрешаем запросы с того же домена (если WEB_APP_URL установлен)
    if (process.env.WEB_APP_URL) {
      const webAppUrl = process.env.WEB_APP_URL.replace(/^https?:\/\//, '');
      const originHost = origin.replace(/^https?:\/\//, '');
      if (originHost === webAppUrl || originHost.includes(webAppUrl) || webAppUrl.includes(originHost)) {
        console.log(`[CORS] ✅ Разрешен (WEB_APP_URL match): ${origin}`);
        return callback(null, true);
      }
    }
    
    console.log(`[CORS] ❌ Запрещен: ${origin}`);
    console.log(`[CORS] Разрешенные origins:`, corsOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
console.log('⚙️ CORS настроен. Локальный режим:', process.env.LOCAL === 'true');

// 6. Инициализация сервисов
// const logger = winston.createLogger({
//   level: LOG_LEVEL,
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
//   ),
//   transports: [
//     new winston.transports.Console(),
//   ],
// });

// Добавляем файловые транспорты только если папка логов существует
// try {
//   if (fs.existsSync(LOG_DIR)) {
//     logger.add(new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }));
//     logger.add(new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') }));
//     console.log('✅ Файловые логи подключены');
//   } else {
//     console.warn('⚠️ Папка логов не существует, файловые логи отключены');
//   }
// } catch (err) {
//   console.warn('⚠️ Не удалось подключить файловые логи:', err.message);
// }

// Инициализация OpenCV (заменяет Google Vision)
// OpenCV инициализируется в routes/photos.js
// Здесь просто создаем заглушку для совместимости
let opencvClient = { available: true };
global.opencvClient = opencvClient;
// Для обратной совместимости с кодом, который использует visionClient
global.visionClient = opencvClient;

// Логируем количество пользователей в базе (только если таблица существует)
// SQL будет автоматически адаптирован в db-pg.js для PostgreSQL
db.all("SELECT userId FROM users", [], (err, rows) => {
  if (err) {
    console.log('📊 Таблица users еще не создана или пуста');
  } else {
    console.log(`👥 Всего пользователей в базе: ${rows.length}`);
  }
});

// 7. Middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Санитизация входных данных
const { sanitizeBody } = require('./middleware/validation');
app.use(sanitizeBody);

app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const bodyLog = Object.keys(req.body).length > 0 ? `| body: ${JSON.stringify(req.body)}` : '';
  console.log(`[REQUEST] ${ip} | ${req.method} ${req.originalUrl} ${bodyLog}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RESPONSE] ${ip} | ${req.method} ${req.originalUrl} → ${res.statusCode} [${duration}ms]`);
  });
  next();
});

// Отключить кэширование и ETag для всех API-ручек
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  next();
});

// ДОБАВЛЯЮ МИДДЛВАР ДЛЯ ЛОГГИРОВАНИЯ ВСЕХ ЗАПРОСОВ НА /api/photos/checkPhotoUrl
app.use('/api/photos/checkPhotoUrl', (req, res, next) => {
  console.log('🟣 [APP] /api/photos/checkPhotoUrl middleware:', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body
  });
  next();
});

// 8. Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов, попробуйте позже.' },
  skip: (req) => {
    // Пропускаем статические файлы и изображения
    return req.path.startsWith('/css/') || 
           req.path.startsWith('/js/') || 
           req.path.startsWith('/img/') || 
           req.path.startsWith('/data/img/') ||
           req.path.startsWith('/giftimg/') ||
           req.path.startsWith('/favicon.ico') ||
           req.path.startsWith('/labels/');
  }
});
app.use('/api/', apiLimiter);
console.log('🛡️ Rate limiter активирован для /api/');

// 9. Монтирование API-маршрутов
console.log('▶ API-маршруты инициализируются...');
app.use('/api', likesRouter(db));
app.use('/api', matchesRouter(db));
app.use('/api', usersRouter(db));
app.use('/api', photosRouter(db, null, IMAGES_DIR, process.env.BOT_TOKEN, visionClient));
app.use('/api', goalsRouter(db));
app.use('/api', giftsRouter(db, giftDb));
app.use('/api', pushRouter(db));
app.use('/api/pro', proRouter(db));
app.use('/api', adminRouter(db));
app.use('/api/stats', statsRouter(db));
console.log('✅ API-маршруты успешно смонтированы.');

// Функция для получения данных пользователя
async function getUserData(userId) {
  return new Promise((resolve, reject) => {
    if (!userId) {
      resolve(null);
      return;
    }
    
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row) {
        // Формируем массив фотографий для совместимости с шаблоном
        const photos = [row.photo1, row.photo2, row.photo3].filter(p => p && String(p).trim() !== '');
        
        resolve({
          ...row,
          photos,
          photoUrl: photos[0] || row.photoUrl || '/img/logo.svg'
        });
      } else {
        resolve(null);
      }
    });
  });
}

function getHashMap() {
  const hashMapPath = path.join(__dirname, 'public', 'hash-map.json');
  let hashMap = {};
  if (fs.existsSync(hashMapPath)) {
    try {
      hashMap = JSON.parse(fs.readFileSync(hashMapPath, 'utf8'));
    } catch (e) {
      hashMap = {};
    }
  }
  return hashMap;
}

// 11. Корневой маршрут и SPA Fallback
// Получаем базовые URL для передачи в шаблон
const getBaseUrls = (req) => {
  let webAppUrl = process.env.WEB_APP_URL || (req ? (req.protocol + '://' + req.get('host')) : null) || 'https://sta-black-dim.waw.amverum.cloud';
  // Убеждаемся, что URL начинается с https://
  if (webAppUrl && !webAppUrl.startsWith('http://') && !webAppUrl.startsWith('https://')) {
    webAppUrl = `https://${webAppUrl}`;
  }
  const apiBaseUrl = webAppUrl + '/api';
  return { webAppUrl, apiBaseUrl };
};

app.get('/', async (req, res) => {
  console.log('[GET /] Запрос на корневой маршрут. Загружаем подарки...');
  
  const { webAppUrl, apiBaseUrl } = getBaseUrls(req);
  
  try {
    // Получаем userId из query параметров или заголовков
    const userId = req.query.userId || req.headers['x-user-id'];
    let user = {};
    
    if (userId) {
      user = await getUserData(userId) || {};
    }
    
    giftDb.all('SELECT * FROM gifts ORDER BY PriceGift', [], (err, gifts) => {
      if (err) {
        console.error('!!! [GET /] КРИТИЧЕСКАЯ ОШИБКА при запросе к giftDb:', { error: err.message });
        return res.render('index', { user, gifts: [], hashMap: getHashMap(), apiBaseUrl, webAppUrl });
      }
      res.render('index', { user, gifts: gifts || [], hashMap: getHashMap(), apiBaseUrl, webAppUrl });
    });
  } catch (error) {
    console.error('[GET /] Ошибка при получении данных пользователя:', error);
    giftDb.all('SELECT * FROM gifts ORDER BY PriceGift', [], (err, gifts) => {
      if (err) {
        console.error('!!! [GET /] КРИТИЧЕСКАЯ ОШИБКА при запросе к giftDb:', { error: err.message });
        return res.render('index', { user: {}, gifts: [], hashMap: getHashMap() });
      }
      res.render('index', { user: {}, gifts: gifts || [], hashMap: getHashMap() });
    });
  }
});

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.match(/\.(js|css|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  console.log(`[SPA Fallback] Рендерим index.ejs для пути: ${req.path}`);
  
  const { webAppUrl, apiBaseUrl } = getBaseUrls(req);
  
  try {
    // Получаем userId из query параметров или заголовков
    const userId = req.query.userId || req.headers['x-user-id'];
    let user = {};
    
    if (userId) {
      user = await getUserData(userId) || {};
    }
    
    res.render('index', { user, gifts: [], hashMap: getHashMap(), apiBaseUrl, webAppUrl });
  } catch (error) {
    console.error('[SPA Fallback] Ошибка при получении данных пользователя:', error);
    res.render('index', { user: {}, gifts: [], hashMap: getHashMap(), apiBaseUrl, webAppUrl });
  }
});

// 12. Обработчики ошибок
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Обработка CORS ошибок
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, error: 'Доступ запрещён политикой CORS.' });
  }
  next(err);
});

// Централизованный обработчик ошибок
app.use(errorHandler);

// Обработка 404 (должен быть последним)
app.use(notFoundHandler);

// 13. Cron-задачи
cron.schedule('0 0 * * *', () => {
  console.log('Выполняется ежедневная задача по очистке старых лайков...');
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const formattedDate = oneWeekAgo.toISOString();

  db.run(`DELETE FROM likes WHERE timestamp < ?`, [formattedDate], function (err) {
    if (err) {
      console.error('Ошибка при удалении старых лайков:', err.message);
    } else {
      console.log(`Удалено старых лайков: ${this.changes}`);
    }
  });
});

// 14. Экспорт приложения
module.exports = app;
