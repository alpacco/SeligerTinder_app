const express = require('express');
const router = express.Router();





module.exports = (db) => {
  const dailyLog = (message) => console.log(message); // Адаптер для dailyLog

  // API-эндпоинт: /matches
  router.get('/matches', async (req, res) => {
    const { userId } = req.query;
    console.log(`▶ [routes/matches.js] GET /api/matches, query: ${JSON.stringify(req.query)}`);

    if (!userId) {
      console.error('❌ [routes/matches.js] /api/matches - отсутствует userId');
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }

    try {
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT matches FROM users WHERE userId = ?', [String(userId)], (err, row) => err ? reject(err) : resolve(row))
      );

      if (!row) {
        console.warn(`⚠️ [routes/matches.js] /api/matches - userId=${userId} не найден, возвращаем пустой массив`);
        return res.json({ success: true, data: [] });
      }

      let matchesArr = [];
      try {
        matchesArr = JSON.parse(row.matches) || [];
      } catch (e) {
        matchesArr = [];
      }

      if (matchesArr.length === 0) {
        console.log(`[routes/matches.js] /api/matches - для userId=${userId} нет мэтчей.`);
        return res.json({ success: true, data: [] });
      }

      console.log(`[routes/matches.js] /api/matches - matchesArr (userIds):`, matchesArr);
      const placeholders = matchesArr.map(() => '?').join(',');
      const sql = `
        SELECT u.userId AS userId,
               u.userId AS id,
               u.name,
               u.username,
               COALESCE(u.photo1, u.photoUrl) AS avatar
        FROM users u
        WHERE u.userId IN (${placeholders})
      `;
      console.log(`[routes/matches.js] /api/matches - SQL:`, sql);
      const params = [...matchesArr];
      console.log(`[routes/matches.js] /api/matches - SQL params:`, params);
      const rows = await new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
      );
      console.log(`[routes/matches.js] /api/matches - SQL rows:`, rows.map(r => r.userId));
      console.log(`[routes/matches.js] /api/matches - matchesArr:`, matchesArr);
      console.log(`[routes/matches.js] /api/matches - Найдено ${rows.length} мэтчей для userId=${userId}`);

      const data = rows.map(r => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        username: r.username,
        avatar: r.avatar || '/img/logo.svg', // Фоллбэк
        mutual: true
      }));

      res.json({ success: true, data });
    } catch (err) {
      console.error('❌ [routes/matches.js] /api/matches error:', { message: err.message, stack: err.stack });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/matches', async (req, res) => {
    const { userId, matchId } = req.body;
    console.log(`▶ [routes/matches.js] DELETE /api/matches, body: ${JSON.stringify(req.body)}`);

    if (!userId || !matchId) {
      console.error('❌ [routes/matches.js] DELETE /api/matches - отсутствует userId или matchId');
      return res.status(400).json({ success: false, error: 'userId и matchId обязательны' });
    }

    try {
      // Helper function to update matches for a user
      const updateMatches = (ownerId, idToRemove) => {
        return new Promise((resolve, reject) => {
          db.get('SELECT matches FROM users WHERE userId = ?', [ownerId], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(); // User not found, nothing to do

            let matches = [];
            try {
              matches = JSON.parse(row.matches || '[]');
            } catch (e) {
              matches = [];
            }

            const newMatches = matches.filter(id => String(id) !== String(idToRemove));
            const newMatchesJson = JSON.stringify(newMatches);

            db.run('UPDATE users SET matches = ? WHERE userId = ?', [newMatchesJson, ownerId], (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        });
      };
      
      // Using db.serialize to ensure transactionality
      db.serialize(async () => {
        try {
          await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));
          
          await Promise.all([
            updateMatches(userId, matchId),
            updateMatches(matchId, userId)
          ]);

          await new Promise((resolve, reject) => db.run('COMMIT', err => err ? reject(err) : resolve()));
          
          console.log(`✅ [routes/matches.js] Мэтч между ${userId} и ${matchId} успешно удален.`);
          res.json({ success: true, message: 'Мэтч удален' });

        } catch (transactionError) {
          await new Promise((resolve, reject) => db.run('ROLLBACK', err => err ? reject(err) : resolve()));
          throw transactionError; // Propagate error to the outer catch block
        }
      });

    } catch (err) {
      console.error('❌ [routes/matches.js] DELETE /api/matches error:', { message: err.message, stack: err.stack });
      res.status(500).json({ success: false, error: 'Ошибка на сервере при удалении мэтча' });
    }
  });

  return router;
};
