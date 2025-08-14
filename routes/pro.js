// routes/pro.js
const { Router } = require('express');
const createError = require('http-errors');

/**
 * Фáбрика маршрутов для работы с PRO-подпиской
 * @param {import('sqlite3').Database} db - экземпляр подключения к SQLite
 * @param {import('winston').Logger} logger - экземпляр логгера
 */
function proRouter(db) {
  const router = Router();

  // Upgrade to PRO: POST /api/pro/upgrade
  router.post('/upgrade', async (req, res, next) => {
    try {
      const { userId, durationDays } = req.body;
      if (!userId || typeof durationDays === 'undefined') {
        throw createError(400, 'userId and durationDays are required');
      }
      const now = Date.now();
      // Получаем текущее pro_end
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT pro_end FROM users WHERE userId = ?', userId, (err, r) => {
          if (err) reject(err);
          else resolve(r);
        });
      });
      let baseTime = now;
      if (row && row.pro_end) {
        const existing = Date.parse(row.pro_end);
        if (!isNaN(existing) && existing > now) baseTime = existing;
      }
      const newEnd = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET is_pro = 1, pro_end = ? WHERE userId = ?',
          [newEnd, userId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log(`PRO upgraded for user ${userId}, new end: ${newEnd}`);
      res.json({ success: true, is_pro: 1, pro_end: newEnd });
    } catch (err) {
      next(err);
    }
  });

  // Get PRO status: GET /api/pro/status?userId=...
  router.get('/status', async (req, res, next) => {
    try {
      const { userId } = req.query;
      if (!userId) throw createError(400, 'userId is required');
      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT is_pro, pro_end FROM users WHERE userId = ?',
          userId,
          (err, r) => {
            if (err) reject(err);
            else resolve(r);
          }
        );
      });
      if (!row) throw createError(404, 'User not found');
      res.json({ success: true, is_pro: row.is_pro, pro_end: row.pro_end });
    } catch (err) {
      next(err);
    }
  });

  // Cancel PRO subscription: POST /api/pro/cancel
  router.post('/cancel', async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) throw createError(400, 'userId is required');
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET is_pro = 0 WHERE userId = ?',
          userId,
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log(`PRO cancelled for user ${userId}`);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = proRouter;
