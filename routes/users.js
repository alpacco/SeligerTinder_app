// routes/users.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const createError = require('http-errors');
const { asyncHandler } = require('../middleware/errorHandler');

function usersRouter(db) {
  const router = express.Router();

  // GET /api/users - Получить список всех пользователей (для админки)
  router.get('/users', asyncHandler(async (req, res, next) => {
    console.log('[GET /api/users] Запрос всех пользователей');
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM users', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      console.log('[GET /api/users] Успешно получено пользователей:', rows.length);
      res.json({ success: true, data: Array.isArray(rows) ? rows : [] });
    } catch (err) {
      console.error('[GET /api/users] Ошибка:', err);
      // Возвращаем пустой массив при ошибке
      res.json({ success: false, data: [], error: err.message });
    }
  }));

  // GET /api/user?userId=... - Получить данные конкретного пользователя
  router.get('/user', asyncHandler(async (req, res, next) => {
    const { userId } = req.query;
    console.log('[GET /api/users/get] userId = %s', userId);
    if (!userId) {
      console.warn('[GET /api/users/get] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    try {
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!row) {
        console.warn('[GET /api/users/get] Пользователь не найден:', userId);
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      console.log('[GET /api/users/get] Успешно получен пользователь:', userId);
      res.json({ success: true, data: row });
    } catch (err) {
      console.error('[GET /api/users/get] Ошибка запроса:', err);
      throw err;
    }
  }));

  // GET /api/getUser?userId=... - Получить данные пользователя (для фронтенда)
  router.get('/getUser', asyncHandler(async (req, res, next) => {
    const { userId } = req.query;
    console.log('[GET /api/getUser] userId = %s', userId);
    if (!userId) {
      console.warn('[GET /api/getUser] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    try {
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!row) {
        console.warn('[GET /api/getUser] Пользователь не найден:', userId);
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      console.log('[GET /api/getUser] Успешно получен пользователь:', userId);
      console.log('[GET /api/getUser] Данные пользователя:', row);
      res.json({ success: true, data: row });
    } catch (err) {
      console.error('[GET /api/getUser] Ошибка запроса:', err);
      throw err;
    }
  }));

  // GET /api/candidates?userId=...&oppositeGender=... - Получить кандидатов для свайпа
  router.get('/candidates', (req, res, next) => {
    const { oppositeGender, userId } = req.query;
    console.log('[GET /api/users/candidates] Параметры:', { oppositeGender, userId });
    if (!oppositeGender || !userId) {
      console.warn('[GET /api/users/candidates] Ошибка: missing oppositeGender or userId');
      return res.status(400).json({ success: false, error: 'oppositeGender and userId required' });
    }
    
    // Сначала проверяем needPhoto текущего пользователя
    db.get('SELECT needPhoto FROM users WHERE userId = ?', [userId], (err, userRow) => {
      if (err) {
        console.error('[GET /api/users/candidates] Ошибка проверки needPhoto:', err);
        return next(err);
      }
      
      if (userRow && userRow.needPhoto == 1) {
        console.warn('[GET /api/users/candidates] Пользователь должен загрузить фото');
        return res.json({ 
          success: true, 
          data: [] // Возвращаем пустой массив кандидатов, как в эталоне
        });
      }
      
      // Получаем likes/dislikes текущего пользователя
      db.get('SELECT likes, dislikes FROM users WHERE userId = ?', [userId], (err2, userRow) => {
        if (err2) {
          console.error('[GET /api/users/candidates] Ошибка загрузки likes/dislikes:', err2);
          return next(err2);
        }
        
        let liked = [], disliked = [];
        try { liked = JSON.parse(userRow?.likes || '[]'); } catch (e) {
          console.warn('[GET /api/users/candidates] Ошибка парсинга likes:', e);
        }
        try { disliked = JSON.parse(userRow?.dislikes || '[]'); } catch (e) {
          console.warn('[GET /api/users/candidates] Ошибка парсинга dislikes:', e);
        }
        
        // Получаем всех пользователей противоположного пола (как в эталоне)
        // Исключаем пользователей без фото (needPhoto = 1)
        db.all(
          `SELECT userId, name, username, gender, bio, age, photo1, photo2, photo3, photoUrl, badge
           FROM users
           WHERE gender = ?
             AND userId != ?
             AND blocked = 0
             AND needPhoto = 0`,
          [oppositeGender, userId],
          (err, rows) => {
            if (err) {
              console.error('[GET /api/users/candidates] Ошибка получения кандидатов:', err);
              return next(err);
            }
            console.log(`[GET /api/users/candidates] Всего найдено пользователей противоположного пола (${oppositeGender}): ${rows.length}`);
            console.log(`[GET /api/users/candidates] userIds: ${rows.map(r => r.userId).join(', ')}`);
            // Фильтруем лайкнутых/дизлайкнутых
            const filtered = rows.filter(row =>
              !liked.includes(row.userId) && !disliked.includes(row.userId)
            );
            console.log(`[GET /api/users/candidates] После фильтрации лайков/дизлайков: ${filtered.length}`);
            // Обрабатываем каждого пользователя (как в эталоне)
            const data = filtered.map(row => {
              let photosArr = [];
              if (row.photo1 && row.photo1.trim() !== "") photosArr.push(row.photo1);
              if (row.photo2 && row.photo2.trim() !== "") photosArr.push(row.photo2);
              if (row.photo3 && row.photo3.trim() !== "") photosArr.push(row.photo3);
              if (photosArr.length === 0) {
                if (row.photoUrl && row.photoUrl.trim() && row.photoUrl !== '/img/logo.svg') {
                  photosArr.push(row.photoUrl);
                } else {
                  photosArr.push('/img/photo.svg');
                }
              }
              console.log(`[GET /api/users/candidates] Кандидат ${row.userId}: photos = ${JSON.stringify(photosArr)}`);
              return {
                id: row.userId,
                name: row.name,
                username: row.username,
                gender: row.gender,
                bio: row.bio,
                age: row.age,
                photos: photosArr,
                badge: row.badge
              };
            });
            console.log('[GET /api/users/candidates] Количество кандидатов после обработки:', data.length);
            res.json({ success: true, data });
          }
        );
      });
    });
  });

  // GET /api/check - Проверить, зарегистрирован ли пользователь
  router.get('/check', (req, res, next) => {
    const { userId } = req.query;
    // В локальном режиме эмулируем успешную проверку пользователя
    if (process.env.LOCAL === 'true') {
      return res.json({ success: true, data: { userId, isRegistered: true } });
    }
    // В продакшене не трогаем логику
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // POST /api/join - Зарегистрировать нового пользователя
  router.post('/join', (req, res, next) => {
    console.log('🔥 [API] /api/users/join called with:', req.body);
    console.log(`[POST /api/join] for userId: ${req.body.userId}`);
    
    // В локальном режиме эмулируем успешную регистрацию
    if (process.env.LOCAL === 'true') {
      console.log('✅ [LOCAL] /api/users/join: Success (local mode)');
      
      // Создаём мокового пользователя для локальной разработки
      const { userId, name, username = 'localuser', photoUrl = '/img/logo.svg', gender = 'other', bio = 'Local test user' } = req.body;
      
      if (!userId || !name) {
        console.warn('⚠️ [LOCAL] Missing required fields:', { userId, name });
        return res.status(400).json({ 
          success: false, 
          error: 'userId and name are required',
          localMode: true
        });
      }
      
      // В локальном режиме сразу возвращаем успех
      return res.json({ 
        success: true, 
        localMode: true,
        user: {
          userId,
          name,
          username,
          photoUrl,
          gender,
          bio,
          registered: true
        }
      });
    }
    
    // Оригинальная логика для продакшена
    const { userId, name, username = '', photoUrl = '', gender = '', bio = '' } = req.body;
    
    // ЛОГИРОВАНИЕ ВСЕХ ПОЛЕЙ
    console.log('🔍 [POST /api/join] Все поля запроса:', {
      userId,
      name,
      username,
      photoUrl: photoUrl ? `${photoUrl.substring(0, 50)}...` : 'empty',
      gender,
      bio
    });
    
    // Явно логируем gender
    console.log(`[POST /api/join] gender = '${gender}' (typeof: ${typeof gender})`);

    if (!userId || !name) {
      console.warn('❌ Missing required fields:', { userId, name });
      return res.status(400).json({ 
        success: false, 
        error: 'userId and name are required' 
      });
    }
    
    // Определяем needPhoto как в эталоне
    let needPhoto = 1; // по умолчанию нужно фото
    // Если есть photoUrl из Telegram (начинается с http), то устанавливаем needPhoto = 0
    // Пользователь сможет загрузить дополнительные фото через бот
    if (photoUrl && photoUrl.startsWith('http') && photoUrl !== '/img/logo.svg') {
      needPhoto = 0;
      console.log(`✅ Пользователь ${userId} имеет photoUrl из Telegram, needPhoto = 0`);
    } else {
      console.log(`⚠️ Пользователь ${userId} не имеет photoUrl из Telegram, needPhoto = 1`);
    }
    
    const now = new Date().toISOString();
    db.run(
      'INSERT OR IGNORE INTO users (userId, name, username, photoUrl, gender, bio, createdAt, needPhoto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, name, username, photoUrl, gender, bio, now, needPhoto],
      function (err) {
        if (err) {
          console.error('❌ DB error:', err);
          return res.status(500).json({ 
            success: false, 
            error: 'Database error',
            details: err.message 
          });
        }
        
        console.log(`✅ User registered: ${userId}, needPhoto: ${needPhoto}`);
        res.json({ 
          success: true,
          user: {
            userId,
            name,
            username,
            photoUrl,
            gender,
            bio,
            registered: true
          }
        });
      }
    );
  });



  // POST /api/visit - Зафиксировать посещение профиля
  router.post('/visit', (req, res, next) => {
    const { userId, visitorId } = req.body;
    console.log('[POST /api/users/visit] Params:', { userId, visitorId });
    if (!userId || !visitorId) {
      console.warn('[POST /api/users/visit] Ошибка: userId и visitorId обязательны');
      return res.status(400).json({ success: false, error: 'both IDs required' });
    }
    db.run(
      'INSERT INTO visits (userId, visitorId, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [userId, visitorId],
      err => {
        if (err) {
          console.error('[POST /api/users/visit] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/visit] Visit записан');
        res.json({ success: true });
      }
    );
  });

  // POST /api/updateGender - Обновить пол пользователя с проверкой photoUrl из Telegram
  router.post('/updateGender', async (req, res, next) => {
    const { userId, gender, photoUrl } = req.body;
    console.log('[POST /api/users/updateGender] Params:', { userId, gender, photoUrl });

    if (!userId || !gender) {
      console.warn('[POST /api/users/updateGender] Ошибка: userId и gender обязательны');
      return res.status(400).json({ success: false, error: 'userId and gender required' });
    }

    try {
      const sqlSel = `SELECT userId FROM users WHERE userId=?`;
      db.get(sqlSel, [String(userId)], (err, row) => {
        if (err) {
          console.error('[POST /api/users/updateGender] Ошибка БД:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        if (!row) {
          console.warn('[POST /api/users/updateGender] Пользователь не найден');
          return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }

        if (photoUrl && photoUrl.startsWith('http') && photoUrl !== '/img/logo.svg') {
          console.log(`[POST /api/users/updateGender] Проверяем photoUrl из Telegram: ${photoUrl}`);
          if (global.opencvClient && global.opencvClient.available) {
            console.log(`[POST /api/users/updateGender] OpenCV: отправляем фото на проверку лица...`);
            fetch(photoUrl)
              .then(response => {
                console.log('[POST /api/users/updateGender] fetch response status:', response.status);
                return response.arrayBuffer();
              })
              .then(buffer => {
                const imageBuffer = Buffer.from(buffer);
                if (global.faceDetectorBuffer) {
                  console.log('[POST /api/users/updateGender] Вызываем faceDetectorBuffer...');
                  return global.faceDetectorBuffer(imageBuffer);
                } else {
                  console.warn('[POST /api/users/updateGender] global.faceDetectorBuffer не определён!');
                  return Promise.resolve(true);
                }
              })
              .then(hasFace => {
                console.log(`[POST /api/users/updateGender] OpenCV результат: лицо найдено = ${hasFace}`);
                if (hasFace) {
                  db.run('UPDATE users SET gender = ?, needPhoto = 0 WHERE userId = ?', [gender, String(userId)], function(err2) {
                    if (err2) {
                      console.error('[POST /api/users/updateGender] Ошибка обновления:', err2);
                      return res.status(500).json({ success: false, error: err2.message });
                    }
                    console.log(`✅ /api/updateGender: userId=${userId}, gender=${gender}, needPhoto=0 (лицо найдено)`);
                    res.json({ success: true, needPhoto: 0 });
                  });
                } else {
                  db.run('UPDATE users SET gender = ?, needPhoto = 1 WHERE userId = ?', [gender, String(userId)], function(err2) {
                    if (err2) {
                      console.error('[POST /api/users/updateGender] Ошибка обновления:', err2);
                      return res.status(500).json({ success: false, error: err2.message });
                    }
                    console.log(`✅ /api/updateGender: userId=${userId}, gender=${gender}, needPhoto=1 (лицо не найдено)`);
                    res.json({ success: true, needPhoto: 1 });
                  });
                }
              })
              .catch(err => {
                console.error(`[POST /api/users/updateGender] Ошибка проверки фото:`, err);
                db.run('UPDATE users SET gender = ?, needPhoto = 1 WHERE userId = ?', [gender, String(userId)], function(err2) {
                  if (err2) {
                    console.error('[POST /api/users/updateGender] Ошибка обновления:', err2);
                    return res.status(500).json({ success: false, error: err2.message });
                  }
                  console.log(`✅ /api/updateGender: userId=${userId}, gender=${gender}, needPhoto=1 (ошибка проверки)`);
                  res.json({ success: true, needPhoto: 1 });
                });
              });
          } else {
            console.log(`[POST /api/users/updateGender] OpenCV недоступен, устанавливаем needPhoto = 1`);
            db.run('UPDATE users SET gender = ?, needPhoto = 1 WHERE userId = ?', [gender, String(userId)], function(err2) {
              if (err2) {
                console.error('[POST /api/users/updateGender] Ошибка обновления:', err2);
                return res.status(500).json({ success: false, error: err2.message });
              }
              console.log(`✅ /api/updateGender: userId=${userId}, gender=${gender}, needPhoto=1 (Vision недоступен)`);
              res.json({ success: true, needPhoto: 1 });
            });
          }
        } else {
          console.log(`[POST /api/users/updateGender] Нет photoUrl из Telegram или невалидный:`, photoUrl);
          db.run('UPDATE users SET gender = ?, needPhoto = 1 WHERE userId = ?', [gender, String(userId)], function(err2) {
            if (err2) {
              console.error('[POST /api/users/updateGender] Ошибка обновления:', err2);
              return res.status(500).json({ success: false, error: err2.message });
            }
            console.log(`✅ /api/updateGender: userId=${userId}, gender=${gender}, needPhoto=1 (нет photoUrl)`);
            res.json({ success: true, needPhoto: 1 });
          });
        }
      });
    } catch (err) {
          console.error('[POST /api/users/updateGender] Ошибка:', err);
          return next(err);
        }
  });

  // POST /api/updateAge - Обновить возраст пользователя
  router.post('/updateAge', (req, res, next) => {
    const { userId, age } = req.body;
    console.log('[POST /api/users/updateAge] Params:', { userId, age });
    if (!userId || typeof age === 'undefined') {
      console.warn('[POST /api/users/updateAge] Ошибка: userId и age обязательны');
      return res.status(400).json({ success: false, error: 'userId and age required' });
    }
    db.run(
      'UPDATE users SET age = ? WHERE userId = ?',
      [age, userId],
      err => {
        if (err) {
          console.error('[POST /api/users/updateAge] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/updateAge] Успешно обновлен age');
        res.json({ success: true });
      }
    );
  });

  // POST /api/updatePhotoUrl - Обновить photoUrl пользователя
  router.post('/updatePhotoUrl', (req, res, next) => {
    const { userId, photoUrl } = req.body;
    console.log('[POST /api/users/updatePhotoUrl] Params:', { userId, photoUrl: photoUrl ? `${photoUrl.substring(0, 50)}...` : 'empty' });
    
    if (!userId) {
      console.warn('[POST /api/users/updatePhotoUrl] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    // Если есть валидный photoUrl, обновляем needPhoto = 0
    let needPhoto = 1;
    if (photoUrl && photoUrl.startsWith('http') && photoUrl !== '/img/logo.svg') {
      needPhoto = 0;
      console.log(`✅ Пользователь ${userId} получил photoUrl, устанавливаем needPhoto = 0`);
    }
    
    db.run(
      'UPDATE users SET photoUrl = ?, needPhoto = ? WHERE userId = ?',
      [photoUrl || '', needPhoto, userId],
      err => {
        if (err) {
          console.error('[POST /api/users/updatePhotoUrl] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/updatePhotoUrl] Успешно обновлен photoUrl и needPhoto');
        res.json({ success: true, needPhoto });
      }
    );
  });

  // POST /api/updateBio - Обновить описание профиля
  router.post('/updateBio', (req, res, next) => {
    const { userId, bio } = req.body;
    console.log('[POST /api/users/updateBio] Params:', { userId, bio });
    if (!userId) {
      console.warn('[POST /api/users/updateBio] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    db.run(
      'UPDATE users SET bio = ? WHERE userId = ?',
      [bio || '', userId],
      err => {
        if (err) {
          console.error('[POST /api/users/updateBio] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/updateBio] Успешно обновлен bio');
        res.json({ success: true });
      }
    );
  });

  // POST /api/update_bio - Алиас для /api/updateBio (для совместимости с ботом)
  router.post('/update_bio', (req, res, next) => {
    const { userId, bio } = req.body;
    console.log('[POST /api/users/update_bio] Params:', { userId, bio });
    if (!userId) {
      console.warn('[POST /api/users/update_bio] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    db.run(
      'UPDATE users SET bio = ? WHERE userId = ?',
      [bio || '', userId],
      err => {
        if (err) {
          console.error('[POST /api/users/update_bio] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/update_bio] Успешно обновлен bio');
        res.json({ success: true });
      }
    );
  });

  // POST /api/updateGoals - Обновить цели знакомства
  router.post('/updateGoals', (req, res, next) => {
    const { userId, goals } = req.body;
    console.log('[POST /api/users/updateGoals] Params:', { userId, goals });
    if (!userId || !Array.isArray(goals)) {
      console.warn('[POST /api/users/updateGoals] Ошибка: userId и массив goals обязательны');
      return res.status(400).json({ success: false, error: 'userId and goals array required' });
    }
    const goalsJson = JSON.stringify(goals);
    db.run(
      'UPDATE users SET goals = ? WHERE userId = ?',
      [goalsJson, userId],
      err => {
        if (err) {
          console.error('[POST /api/users/updateGoals] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/updateGoals] Успешно обновлены goals');
        res.json({ success: true });
      }
    );
  });

  // POST /api/updateBadge - Обновить бейдж пользователя (админ)
  router.post('/updateBadge', (req, res, next) => {
    const { userId, badge } = req.body;
    console.log('[POST /api/users/updateBadge] Params:', { userId, badge });
    
    // Validate required fields
    if (!userId || typeof badge === 'undefined') {
      console.warn('[POST /api/users/updateBadge] Ошибка: userId и badge обязательны');
      return res.status(400).json({ success: false, error: 'userId and badge required' });
    }
    
    // Validate badge value - only allow 'L', 'P', 'S' or empty string
    const validBadges = ['L', 'P', 'S', ''];
    if (!validBadges.includes(badge)) {
      console.warn(`[POST /api/users/updateBadge] Invalid badge value: ${badge}. Allowed values: L, P, S or empty string`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid badge value. Allowed values: L, P, S or empty string' 
      });
    }
    
    // Update the badge in the database
    db.run(
      'UPDATE users SET badge = ? WHERE userId = ?',
      [badge, userId],
      err => {
        if (err) {
          console.error('[POST /api/users/updateBadge] Ошибка:', err);
          return next(err);
        }
        console.log(`[POST /api/users/updateBadge] Успешно обновлен badge на ${badge}`);
        res.json({ success: true });
      }
    );
  });

  // POST /api/deletePhoto - Удалить фото (реализация в photos.js, но эндпоинт здесь для консистентности)
  router.post('/deletePhoto', (req, res, next) => {
    // Эта логика должна быть в photos.js, но для полноты API добавим заглушку
    console.warn('POST /api/deletePhoto - Not implemented, logic resides in photos.js');
    res.status(511).json({ success: false, error: 'Not implemented here' });
  });

  // GET /api/last-login/:userId - Получить время последнего входа
  router.get('/last-login/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT lastLogin FROM users WHERE userId = ?',
          [userId],
          (err, r) => (err ? reject(err) : resolve(r))
        );
      });
      res.json({ success: true, lastLogin: row ? row.lastLogin : null });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/request-badge - Отправить запрос на получение бейджа
  router.post('/request-badge', (req, res, next) => {
    const { userId, badgeType, justification } = req.body;
    if (!userId || !badgeType || !justification) {
      return next(createError(400, 'userId, badgeType, and justification are required'));
    }
    db.run(
      'INSERT INTO badge_requests (userId, badge_type, justification, status) VALUES (?, ?, ?, ?)',
      [userId, badgeType, justification, 'pending'],
      function(err) {
        if (err) return next(err);
        console.log(`New badge request created for user ${userId}, type: ${badgeType}`);
        res.status(201).json({ success: true, message: 'Request submitted' });
      }
    );
  });

  // =================== Admin Endpoints ===================

  // GET /api/get-badge-requests - Получить все запросы на бейджи
  router.get('/get-badge-requests', (req, res, next) => {
    db.all('SELECT * FROM badge_requests WHERE status = ? ORDER BY createdAt DESC', ['pending'], (err, rows) => {
      if (err) return next(err);
      res.json({ success: true, data: rows });
    });
  });

  // POST /api/approve-badge - Одобрить заявку на бейдж
  router.post('/approve-badge', (req, res, next) => {
    const { requestId } = req.body;
    if (!requestId) return next(createError(400, 'requestId is required'));
    // В реальном приложении здесь была бы транзакция
    db.get('SELECT * FROM badge_requests WHERE id = ?', [requestId], (err, request) => {
      if (err) return next(err);
      if (!request) return next(createError(404, 'Request not found'));

      db.run('UPDATE users SET badge = ? WHERE userId = ?', [request.badge_type, request.userId], (err) => {
        if (err) return next(err);
        db.run('UPDATE badge_requests SET status = ? WHERE id = ?', ['approved', requestId], (err) => {
          if (err) return next(err);
          console.log(`Badge request ${requestId} approved for user ${request.userId}`);
          res.json({ success: true });
        });
      });
    });
  });

  // POST /api/reject-badge - Отклонить заявку на бейдж
  router.post('/reject-badge', (req, res, next) => {
    const { requestId } = req.body;
    if (!requestId) return next(createError(400, 'requestId is required'));
    db.run('UPDATE badge_requests SET status = ? WHERE id = ?', ['rejected', requestId], function(err) {
      if (err) return next(err);
      console.log(`Badge request ${requestId} rejected`);
      res.json({ success: true });
    });
  });

  // POST /api/users/updatePhoto - Этот эндпоинт был здесь, но его логика в photos.js
  // Оставляем заглушку для ясности, что он не забыт.
  router.post('/updatePhoto', (req, res, next) => {
    const { userId, slot, photoUrl } = req.body;
    console.log('[POST /api/users/updatePhoto] Params:', { userId, slot, photoUrl });
    
    // Validate required fields
    if (!userId || !slot) {
      console.warn('[POST /api/users/updatePhoto] Ошибка: userId и slot обязательны');
      return res.status(400).json({ success: false, error: 'userId and slot are required' });
    }
    
    // Validate slot
    const validSlots = ['photo1', 'photo2', 'photo3'];
    if (!validSlots.includes(slot)) {
      console.warn(`[POST /api/users/updatePhoto] Неверный слот: ${slot}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid slot. Must be one of: photo1, photo2, photo3' 
      });
    }
    
    // Update the specific photo slot
    const query = `UPDATE users SET ${slot} = ? WHERE userId = ?`;
    const params = [photoUrl || '', userId];
    
    db.run(query, params, function(err) {
      if (err) {
        console.error('[POST /api/users/updatePhoto] Ошибка:', err);
        return next(err);
      }
      
      console.log(`[POST /api/users/updatePhoto] Успешно обновлен ${slot}`);
      res.json({ 
        success: true,
        updatedSlot: slot,
        photoUrl: photoUrl || ''
      });
    });
  });

  // POST /api/users/clearPhotos
  router.post('/clearPhotos', (req, res, next) => {
    const { userId } = req.body;
    console.log('[POST /api/users/clearPhotos] Params:', { userId });
    if (!userId) {
      console.warn('[POST /api/users/clearPhotos] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    
    // Clear all photo slots at once
    db.run(
      'UPDATE users SET photo1 = "", photo2 = "", photo3 = "" WHERE userId = ?',
      [userId],
      function(err) {
        if (err) {
          console.error('[POST /api/users/clearPhotos] Ошибка:', err);
          return next(err);
        }
        console.log('[POST /api/users/clearPhotos] Успешно очищены все фото');
        res.json({ 
          success: true,
          message: 'All photos cleared successfully',
          changes: this.changes
        });
      }
    );
  });

  // GET /api/check?userId=... - Проверить существование пользователя
  router.get('/check', (req, res, next) => {
    const { userId } = req.query;
    console.log(`[GET /api/check] for userId: ${userId}`);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    db.get('SELECT 1 FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        console.error(`[GET /api/check] DB error for ${userId}: ${err.message}`);
        return next(err);
      }
      res.json({ success: true, exists: !!row });
    });
  });

  // POST /api/join - Регистрация нового пользователя
  router.post('/join', asyncHandler(async (req, res, next) => {
    const { userId, username, name, age, gender, about, lookingFor, photo1 } = req.body;
    console.log('🔥 [API] /api/users/join called with:', req.body);
    console.log('[POST /api/join] for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const sql = `INSERT INTO users (userId, username, name, age, gender, about, lookingFor, photo1, likes, dislikes, matches, goals, is_pro, pro_end, super_likes_count, needPhoto, warned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', 0, NULL, 3, 0, 0)`;
    const params = [userId, username, name, age, gender, about, lookingFor, photo1];

    try {
      const result = await new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
      console.log(`✅ [API] /api/users/join: пользователь ${req.body.name} (ID: ${req.body.userId}) добавлен, rowid=${result.lastID}`);
      console.log(`[POST /api/join] User ${req.body.userId} created successfully, rowid=${result.lastID}`);
      res.json({ success: true, userId: req.body.userId });
    } catch (err) {
      console.error('❌ [API] /api/users/join DB error:', err.message);
      console.error(`[POST /api/join] DB error for ${req.body.userId}: ${err.message}`);
      throw err;
    }
  }));

  // POST /api/updateGender - Обновить пол
  router.post('/updateGender', (req, res, next) => {
    const { userId, gender } = req.body;
    console.log(`[POST /api/updateGender] for userId: ${userId}`);
    if (!userId || !gender) {
        return res.status(400).json({ success: false, error: 'userId and gender are required' });
    }
    db.run('UPDATE users SET gender = ? WHERE userId = ?', [gender, userId], function(err) {
        if (err) {
            console.error(`[POST /api/updateGender] DB error for ${userId}: ${err.message}`);
            return next(err);
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        console.log(`[POST /api/updateGender] Gender updated for ${userId}`);
        res.json({ success: true, message: 'Gender updated' });
    });
  });

  // POST /api/updateAge - Обновить возраст
  router.post('/updateAge', (req, res, next) => {
    const { userId, age } = req.body;
    console.log(`[POST /api/updateAge] for userId: ${userId}`);
    if (!userId || age === undefined) {
        return res.status(400).json({ success: false, error: 'userId and age are required' });
    }
    db.run('UPDATE users SET age = ? WHERE userId = ?', [age, userId], function(err) {
        if (err) {
            console.error(`[POST /api/updateAge] DB error for ${userId}: ${err.message}`);
            return next(err);
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        console.log(`[POST /api/updateAge] Age updated for ${userId}`);
        res.json({ success: true, message: 'Age updated' });
    });
  });

  // POST /api/updateBio - Обновить описание "о себе"
  router.post('/updateBio', (req, res, next) => {
    const { userId, bio } = req.body;
    console.log(`[POST /api/updateBio] for userId: ${userId}`);
    if (!userId || bio === undefined) {
        return res.status(400).json({ success: false, error: 'userId and bio are required' });
    }
    db.run('UPDATE users SET about = ? WHERE userId = ?', [bio, userId], function(err) {
        if (err) {
            console.error(`[POST /api/updateBio] DB error for ${userId}: ${err.message}`);
            return next(err);
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        console.log(`[POST /api/updateBio] Bio updated for ${userId}`);
        res.json({ success: true, message: 'Bio updated' });
    });
  });

    // Обновление профиля пользователя
  router.post('/updateProfile', (req, res, next) => {
    const { userId, about, bio, lookingFor, photo, photo_small, sex, goals } = req.body;
    console.log('[POST /api/updateProfile] для userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    // Проверяем, что пользователь существует
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
      if (err) {
        console.error('❌ Ошибка проверки пользователя:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      if (!user) {
        return res.status(400).json({ success: false, error: 'User not found' });
      }

      // Собираем поля для обновления
      const updates = [];
      const params = [];
      
      if (about !== undefined) {
        updates.push('about = ?');
        params.push(about);
      }
      if (bio !== undefined) {
        updates.push('bio = ?');
        params.push(bio);
      }
      if (lookingFor !== undefined) {
        updates.push('lookingFor = ?');
        params.push(lookingFor);
      }
      if (photo !== undefined) {
        updates.push('photo1 = ?');
        params.push(photo);
      }
      // Убираем сохранение photo_small в photo2, так как это создает путаницу
      // photo_small (старое фото из Telegram) не должно сохраняться в photo2
      // Новое загруженное фото должно быть в photo1
      if (sex !== undefined) {
        updates.push('gender = ?');
        params.push(sex);
      }
      if (goals !== undefined) {
        updates.push('goals = ?');
        params.push(JSON.stringify(goals));
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'Нет полей для обновления' });
      }
      
      params.push(userId);
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE userId = ?`;
      
      db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ Ошибка обновления профиля:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        console.log('✅ Профиль обновлён, affected rows:', this.changes);
        res.json({ success: true, message: 'Profile updated successfully' });
      });
    });
  });

  // GET /api/last-login/:userId - Получить время последнего входа (согласно документации)
  router.get('/last-login/:userId', (req, res, next) => {
    const { userId } = req.params;
    console.log(`[GET /api/last-login/${userId}]`);
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }
    db.get('SELECT lastLogin FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
            console.error(`[GET /api/last-login/${userId}] DB error: ${err.message}`);
            return next(err);
        }
        if (!row) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, lastLogin: row.lastLogin });
    });
  });

  // POST /api/last-login - Обновить время последнего входа (сохранено для обратной совместимости)
  router.post('/last-login', (req, res, next) => {
    const { userId } = req.body;
    console.log(`[POST /api/last-login] for userId: ${userId}`);
    if (!userId || userId === 'UserID') { // 'UserID' is a placeholder
        return res.status(400).json({ success: false, error: 'Invalid userId for last-login update' });
    }
    const lastLogin = new Date().toISOString();
    db.run('UPDATE users SET lastLogin = ? WHERE userId = ?', [lastLogin, userId], function(err) {
        if (err) {
            console.error(`[POST /api/last-login] DB error for ${userId}: ${err.message}`);
            return next(err);
        }
        console.log(`[POST /api/last-login] Last login time updated for ${userId}`);
        res.json({ success: true, message: 'Last login time updated' });
    });
  });

  // POST /api/delete_user - Удалить пользователя
  router.post('/delete_user', (req, res, next) => {
    const { userId } = req.body;
    console.log(`[POST /api/delete_user] for userId: ${userId}`);
    
    if (!userId) {
      console.warn('[POST /api/delete_user] Ошибка: userId обязателен');
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    // Сначала проверяем, существует ли пользователь
    db.get('SELECT userId FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        console.error(`[POST /api/delete_user] DB error for ${userId}: ${err.message}`);
        return next(err);
      }
      
      if (!row) {
        console.warn(`[POST /api/delete_user] Пользователь не найден: ${userId}`);
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Удаляем пользователя
      db.run('DELETE FROM users WHERE userId = ?', [userId], function(err) {
        if (err) {
          console.error(`[POST /api/delete_user] DB error for ${userId}: ${err.message}`);
          return next(err);
        }
        
        // Удаляем папку с фото пользователя
        const userDir = path.join(process.env.IMG_DIR || '/data/img', userId);
        if (fs.existsSync(userDir)) {
          try {
            fs.rmSync(userDir, { recursive: true, force: true });
            console.log(`[POST /api/delete_user] Удалена папка пользователя: ${userDir}`);
          } catch (fsErr) {
            console.error(`[POST /api/delete_user] Ошибка удаления папки ${userDir}:`, fsErr.message);
          }
        } else {
          console.log(`[POST /api/delete_user] Папка пользователя не найдена: ${userDir}`);
        }
        
        console.log(`[POST /api/delete_user] Пользователь успешно удален: ${userId}`);
        res.json({ success: true, message: 'User deleted successfully' });
      });
    });
  });


  // POST /api/visit - Зафиксировать посещение профиля
  router.post('/visit', (req, res, next) => {
    const { userId, visitorId } = req.body;
    console.log(`[POST /api/visit] visitor ${visitorId} visited ${userId}`);
    if (!userId || !visitorId) {
        return res.status(400).json({ success: false, error: 'userId and visitorId are required' });
    }
    const timestamp = new Date().toISOString();
    db.run('INSERT INTO visits (userId, timestamp, visitorId) VALUES (?, ?, ?)', [userId, timestamp, visitorId], function(err) {
        if (err) {
            console.error(`[POST /api/visit] DB error: ${err.message}`);
            return next(err);
        }
        res.json({ success: true, message: 'Visit recorded' });
    });
  });

  return router;
}

module.exports = usersRouter;