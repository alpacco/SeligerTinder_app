const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.post('/like', (req, res) => {
    const { fromUser, toUser } = req.body;
    if (!fromUser || !toUser) return res.status(400).json({ success: false, error: 'fromUser и toUser обязательны' });
    db.get("SELECT likes, matches FROM users WHERE userId = ?", [fromUser], (err, row) => {
      if (err || !row) return res.status(404).json({ success: false, error: 'Отправитель не найден' });
      let likes = [];
      let matches = [];
      try { likes = JSON.parse(row.likes || '[]'); } catch (e) {}
      try { matches = JSON.parse(row.matches || '[]'); } catch (e) {}
      if (!likes.includes(toUser)) {
        likes.push(toUser);
        db.run("UPDATE users SET likes = ? WHERE userId = ?", [JSON.stringify(likes), fromUser]);
      }
      db.get("SELECT likes, matches FROM users WHERE userId = ?", [toUser], (err2, row2) => {
        if (err2 || !row2) return res.status(404).json({ success: false, error: 'Получатель не найден' });
        let likes2 = [];
        let matches2 = [];
        try { likes2 = JSON.parse(row2.likes || '[]'); } catch (e) {}
        try { matches2 = JSON.parse(row2.matches || '[]'); } catch (e) {}
        let isMatch = false;
        if (likes2.includes(fromUser)) {
          isMatch = true;
          if (!matches.includes(toUser)) {
            matches.push(toUser);
            db.run("UPDATE users SET matches = ? WHERE userId = ?", [JSON.stringify(matches), fromUser]);
          }
          if (!matches2.includes(fromUser)) {
            matches2.push(fromUser);
            db.run("UPDATE users SET matches = ? WHERE userId = ?", [JSON.stringify(matches2), toUser]);
          }
        }
        res.json({ success: true, match: isMatch });
      });
    });
  });

  router.post('/dislike', (req, res) => {
    const { fromUser, toUser } = req.body;
    if (!fromUser || !toUser) return res.status(400).json({ success: false, error: 'fromUser и toUser обязательны' });
    db.get("SELECT dislikes FROM users WHERE userId = ?", [fromUser], (err, row) => {
      if (err || !row) return res.status(404).json({ success: false, error: 'Отправитель не найден' });
      let dislikes = [];
      try { dislikes = JSON.parse(row.dislikes || '[]'); } catch (e) {}
      if (!dislikes.includes(toUser)) {
        dislikes.push(toUser);
        db.run("UPDATE users SET dislikes = ? WHERE userId = ?", [JSON.stringify(dislikes), fromUser], (err2) => {
          if (err2) return res.status(500).json({ success: false, error: err2.message });
          res.json({ success: true });
        });
      } else {
        res.json({ success: true });
      }
    });
  });

  router.post('/superlike', (req, res) => {
    const { senderId, receiverId } = req.body;
    console.log(`[routes/likes.js] POST /superlike: senderId ${senderId} to receiverId ${receiverId}`);

    if (!senderId || !receiverId) {
      return res.status(400).json({ success: false, error: 'senderId и receiverId обязательны' });
    }

    // Проверяем, что отправитель существует
    db.get("SELECT superlikes FROM users WHERE userId = ?", [senderId], (err, senderRow) => {
      if (err || !senderRow) {
        console.error('❌ Ошибка в /superlike:', { message: err && err.message, stack: err && err.stack });
        return res.status(404).json({ success: false, error: 'Отправитель не найден' });
      }
      let superlikes = [];
      try { superlikes = JSON.parse(senderRow.superlikes || '[]'); } catch (e) {}
      if (superlikes.includes(receiverId)) {
        return res.json({ success: true, message: 'Суперлайк уже существует' });
      }
      superlikes.push(receiverId);
      db.run("UPDATE users SET superlikes = ? WHERE userId = ?", [JSON.stringify(superlikes), senderId], (err2) => {
        if (err2) {
          console.error('❌ Ошибка при обновлении superlikes:', err2.message);
          return res.status(500).json({ success: false, error: err2.message });
        }
        // Можно добавить дополнительную логику для мэтча по суперлайку, если нужно
        res.json({ success: true });
      });
    });
  });

  router.get('/likesReceived', (req, res) => {
    const { userId } = req.query;
    console.log(`[routes/likes.js] GET /likesReceived: userId='${userId}'`);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }

    const sql = `
      SELECT l.*, u.username, u.photo1, u.photo2, u.photo3, u.bio, u.age, u.location
      FROM likes l
      JOIN users u ON l.fromUser = u.userId
      WHERE l.toUser = ?
      ORDER BY l.timestamp DESC
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        console.error(`[routes/likes.js] GET /likesReceived error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
    }

      res.json({ success: true, likes: rows });
    });
  });

  router.get('/likesMade', (req, res) => {
    const { userId } = req.query;
    console.log(`[routes/likes.js] GET /likesMade: userId='${userId}'`);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId обязателен' });
    }

    const sql = `
      SELECT l.*, u.username, u.photo1, u.photo2, u.photo3, u.bio, u.age, u.location
      FROM likes l
      JOIN users u ON l.toUser = u.userId
      WHERE l.fromUser = ?
      ORDER BY l.timestamp DESC
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        console.error(`[routes/likes.js] GET /likesMade error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
    }

      res.json({ success: true, likes: rows });
    });
  });

  return router;
};
