// routes/admin.js
const express = require('express');

/**
 * Фабрика маршрутов для административных функций.
 * @param {import('sqlite3').Database} db - Экземпляр подключения к основной БД.
 * @param {import('winston').Logger} logger - Экземпляр логгера.
 */
function adminRouter(db) {
  const router = express.Router();
  router.use(express.json());

  // --- Администрирование ---

  // GET /api/get-user-data-for-badge - Получить данные пользователя для заявки
  router.get('/get-user-data-for-badge', (req, res, next) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId обязателен' });

    db.get('SELECT userId, name, age, bio, photo1, photo2, photo3 FROM users WHERE userId = ?', [userId], (err, user) => {
        if (err) return next(err);
        if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        res.json({ success: true, user });
    });
  });

  // GET /api/get-all-users-for-admin - Получить всех пользователей
  router.get('/get-all-users-for-admin', (req, res, next) => {
      db.all('SELECT * FROM users', [], (err, users) => {
          if (err) return next(err);
          res.json({ success: true, users });
      });
  });

  // GET /api/search-users-for-admin - Поиск пользователей
  router.get('/search-users-for-admin', (req, res, next) => {
      const { query } = req.query;
      if (!query) return res.status(400).json({ success: false, error: 'query обязателен' });

      const sql = `SELECT * FROM users WHERE name LIKE ? OR username LIKE ? OR userId LIKE ?`;
      const searchQuery = `%${query}%`;
      db.all(sql, [searchQuery, searchQuery, searchQuery], (err, users) => {
          if (err) return next(err);
          res.json({ success: true, users });
      });
  });

  // POST /api/update-user-for-admin - Обновить данные пользователя
  router.post('/update-user-for-admin', (req, res, next) => {
      const { userId, ...fields } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: 'userId обязателен' });

      const updates = Object.keys(fields).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(fields), userId];

      if (updates.length === 0) return res.status(400).json({ success: false, error: 'Нет полей для обновления' });

      const sql = `UPDATE users SET ${updates} WHERE userId = ?`;
      db.run(sql, values, function(err) {
          if (err) return next(err);
          if (this.changes === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
          res.json({ success: true, message: 'Данные пользователя обновлены' });
      });
  });

  // POST /api/delete-user-for-admin - Удалить пользователя
  router.post('/delete-user-for-admin', (req, res, next) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: 'userId обязателен' });

      db.run('DELETE FROM users WHERE userId = ?', [userId], function(err) {
          if (err) return next(err);
          if (this.changes === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
          res.json({ success: true, message: 'Пользователь удален' });
      });
  });

  // POST /api/send-message-for-admin - Отправить сообщение пользователю (через бота)
  router.post('/send-message-for-admin', (req, res, next) => {
      const { userId, message } = req.body;
      // Логика отправки через Telegram Bot API должна быть здесь
      // Для примера просто логируем
      console.log(`Сообщение для ${userId}: ${message}`);
      res.json({ success: true, message: 'Сообщение отправлено (симуляция).' });
  });

  // --- Управление бейджами ---

  // POST /api/request-badge - Отправить запрос на получение бейджа
  router.post('/request-badge', (req, res, next) => {
    const { userId, badgeType, justification } = req.body;
    console.log(`[POST /api/request-badge] User: ${userId}, Badge: ${badgeType}`);
    if (!userId || !badgeType || !justification) {
      return res.status(400).json({ success: false, error: 'userId, badgeType и justification обязательны' });
    }

    const sql = `INSERT INTO badge_requests (userId, badgeType, justification) VALUES (?, ?, ?)`;
    db.run(sql, [userId, badgeType, justification], function(err) {
      if (err) {
        console.error(`[request-badge] Ошибка БД: ${err.message}`);
        return next(err);
      }
      res.status(201).json({ success: true, message: 'Запрос на бейдж отправлен', requestId: this.lastID });
    });
  });

  // GET /api/get-badge-requests - Получить все запросы на бейджи
  router.get('/get-badge-requests', (req, res, next) => {
    console.log(`[GET /api/get-badge-requests]`);
    db.all('SELECT * FROM badge_requests ORDER BY createdAt DESC', [], (err, rows) => {
      if (err) {
        console.error(`[get-badge-requests] Ошибка БД: ${err.message}`);
        return next(err);
      }
      res.json({ success: true, requests: rows });
    });
  });

  // POST /api/approve-badge - Одобрить заявку на бейдж
  router.post('/approve-badge', (req, res, next) => {
    const { requestId } = req.body;
    console.log(`[POST /api/approve-badge] Request ID: ${requestId}`);
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId обязателен' });
    }

    db.get('SELECT * FROM badge_requests WHERE id = ?', [requestId], (err, request) => {
      if (err) return next(err);
      if (!request) return res.status(404).json({ success: false, error: 'Запрос не найден' });
      if (request.status !== 'pending') return res.status(400).json({ success: false, error: `Запрос уже обработан (статус: ${request.status})`});

      db.serialize(() => {
        db.run('UPDATE users SET badge = ? WHERE userId = ?', [request.badgeType, request.userId], (err) => {
          if (err) return next(err);
        });
        db.run(`UPDATE badge_requests SET status = 'approved' WHERE id = ?`, [requestId], (err) => {
          if (err) return next(err);
          res.json({ success: true, message: 'Бейдж одобрен и выдан пользователю.' });
        });
      });
    });
  });

  // POST /api/reject-badge - Отклонить заявку на бейдж
  router.post('/reject-badge', (req, res, next) => {
    const { requestId } = req.body;
    console.log(`[POST /api/reject-badge] Request ID: ${requestId}`);
    if (!requestId) {
        return res.status(400).json({ success: false, error: 'requestId обязателен' });
    }
    db.run(`UPDATE badge_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'`, [requestId], function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ success: false, error: 'Запрос не найден или уже обработан' });
        res.json({ success: true, message: 'Запрос на бейдж отклонен.' });
    });
  });

  // POST /api/updateBadge - Обновить/установить бейдж пользователя (админ)
  router.post('/updateBadge', (req, res, next) => {
    const { userId, badge } = req.body;
    console.log(`[POST /api/updateBadge] User: ${userId}, Badge: ${badge}`);
    if (!userId || typeof badge === 'undefined') {
      return res.status(400).json({ success: false, error: 'userId и badge обязательны' });
    }
    const validBadges = ['L', 'P', 'S', ''];
    if (!validBadges.includes(badge)) {
        return res.status(400).json({ success: false, error: 'Недопустимый тип бейджа.' });
    }

    db.run('UPDATE users SET badge = ? WHERE userId = ?', [badge, userId], function(err) {
      if (err) {
        console.error(`[updateBadge] Ошибка БД: ${err.message}`);
        return next(err);
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
      }
      res.json({ success: true, message: `Бейдж для пользователя ${userId} обновлен.` });
    });
  });



  console.log('✅ Модуль администратора инициализирован.');

  return router;
}

module.exports = adminRouter;
