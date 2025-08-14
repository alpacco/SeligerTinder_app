const express = require('express');

function goalsRouter(db) {
  const router = express.Router();

  // Парсим JSON тело
  router.use(express.json());

  // GET /api/goals?userId=... — получить массив целей
  router.get('/goals', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      console.warn('GET /api/goals missing userId');
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }
    db.get(
      'SELECT goals FROM users WHERE userId = ?',
      [userId],
      (err, row) => {
        if (err) {
          console.error(`GET /api/goals DB error: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        let goalsArr = [];
        try {
          goalsArr = JSON.parse(row?.goals || '[]');
        } catch (parseErr) {
          console.error(`GET /api/goals parse error: ${parseErr.message}`);
        }
        res.json({ success: true, goals: goalsArr });
      }
    );
  });

  // POST /api/goals — заменить весь массив целей (для совместимости с фронтендом)
  router.post('/goals', (req, res) => {
    const { userId, goals } = req.body;
    if (!userId) {
      console.warn('POST /api/goals missing userId');
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }
    if (!Array.isArray(goals)) {
      return res.status(400).json({ success: false, error: 'goals должен быть массивом' });
    }
    const goalsStr = JSON.stringify(goals);
    db.run(
      'UPDATE users SET goals = ? WHERE userId = ?',
      [goalsStr, userId],
      function(err) {
        if (err) {
          console.error(`POST /api/goals update error: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        console.log(`✅ Цели обновлены для userId: ${userId}, affected rows: ${this.changes}`);
        res.json({ success: true, goals });
      }
    );
  });

  // POST /api/updateGoals — заменить весь массив или добавить одну цель
  router.post('/updateGoals', (req, res) => {
    const { userId, goals, goal } = req.body;
    if (!userId) {
      console.warn('POST /api/goals missing userId');
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }
    // если прислали массив goals
    if (Array.isArray(goals)) {
      const goalsStr = JSON.stringify(goals);
      db.run(
        'UPDATE users SET goals = ? WHERE userId = ?',
        [goalsStr, userId],
        function(err) {
          if (err) {
            console.error(`POST /api/goals update error: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
          }
          res.json({ success: true, goals });
        }
      );
    } else if (typeof goal === 'string') {
      // добавить одну цель
      db.get(
        'SELECT goals FROM users WHERE userId = ?',
        [userId],
        (err, row) => {
          if (err) {
            console.error(`POST /api/goals select error: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
          }
          let arr = [];
          try {
            arr = JSON.parse(row?.goals || '[]');
          } catch {
            arr = [];
          }
          arr.push(goal);
          const goalsStr2 = JSON.stringify(arr);
          db.run(
            'UPDATE users SET goals = ? WHERE userId = ?',
            [goalsStr2, userId],
            function(err2) {
              if (err2) {
                console.error(`POST /api/goals insert error: ${err2.message}`);
                return res.status(500).json({ success: false, error: err2.message });
              }
              res.json({ success: true, goals: arr });
            }
          );
        }
      );
    } else {
      return res
        .status(400)
        .json({ success: false, error: 'Параметр goals должен быть массивом или goal строкой' });
    }
  });

  return router;
}

module.exports = goalsRouter;