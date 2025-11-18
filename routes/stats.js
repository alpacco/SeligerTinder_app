// routes/stats.js
const express = require('express');

function statsRouter(db) {
  const router = express.Router();
  router.use(express.json());
  // GET /api/stats — общая статистика
  router.get('/', async (req, res) => {
    try {
      const day = new Date().toISOString().slice(0, 10);

      // Пол пользователей
      const genderRows = await new Promise((resolve, reject) =>
        db.all('SELECT gender, COUNT(*) AS cnt FROM users GROUP BY gender', [], (err, rows) => err ? reject(err) : resolve(rows))
      );
      let menCount = 0, womenCount = 0;
      genderRows.forEach(r => {
        if (r.gender === 'male') menCount = r.cnt;
        if (r.gender === 'female') womenCount = r.cnt;
      });

      // Фото у пользователей
      const photoRows = await new Promise((resolve, reject) =>
        db.all('SELECT photo1, photo2, photo3 FROM users', [], (err, rows) => err ? reject(err) : resolve(rows))
      );
      let withPhoto = 0;
      photoRows.forEach(r => {
        if ((r.photo1 || r.photo2 || r.photo3).trim() !== '') withPhoto++;
      });
      const total = photoRows.length;
      const noPhoto = total - withPhoto;

      // Топ-5 по количеству лайков
      const likesRows = await new Promise((resolve, reject) =>
        db.all('SELECT userId, name, likes FROM users', [], (err, rows) => err ? reject(err) : resolve(rows))
      );
      const top5 = likesRows
        .map(r => {
          let cnt = 0;
          try { cnt = JSON.parse(r.likes || '[]').length; } catch (_) {}
          return { userId: r.userId, name: r.name, count: cnt };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Визиты за сегодня
      const visitsRow = await new Promise((resolve, reject) =>
        db.get('SELECT COUNT(DISTINCT userId) AS dayCount FROM visits WHERE DATE(timestamp) = ?', [day], (err, row) => err ? reject(err) : resolve(row))
      );
      const dayVisits = visitsRow ? visitsRow.dayCount : 0;

      res.json({ success: true, menCount, womenCount, withPhoto, noPhoto, dayVisits, top5 });
    } catch (err) {
      console.error(`/api/stats error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/statsDay — визиты за последние 24 часа (алиас для /api/stats/day)
  router.get('/day', async (req, res) => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT COUNT(DISTINCT "userId") AS "dayCount" FROM visits WHERE DATE(timestamp) = ?', [day], (err, row) => err ? reject(err) : resolve(row))
      );
      res.json({ success: true, visits24h: row ? row.dayCount : 0 });
    } catch (err) {
      console.error(`/api/stats/day error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/stats_users — распределение пользователей по полу
  router.get('/users', async (req, res) => {
    try {
      const rows = await new Promise((resolve, reject) =>
        db.all('SELECT gender AS name, COUNT(*) AS count FROM users GROUP BY gender', [], (err, rows) => err ? reject(err) : resolve(rows))
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(`/api/stats_users error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = statsRouter;;
