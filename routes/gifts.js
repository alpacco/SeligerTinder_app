// routes/gift.js
const express = require('express');

module.exports = function giftRouter(db, giftDb) {
  const router = express.Router();
  // Автоматически парсим JSON тело
  router.use(express.json());

  // Добавление нового подарка
  // POST /api/addgift
  router.post('/addgift', (req, res) => {
    console.log(`POST /api/addgift body: ${JSON.stringify(req.body)}`);
    const { PhotoGift, AboutGift, PriceGift, SaleGift = 0, StopGift = 1 } = req.body;
    giftDb.run(
      `INSERT INTO gifts (PhotoGift, AboutGift, PriceGift, SaleGift, StopGift)
       VALUES (?, ?, ?, ?, ?)`,
      [PhotoGift, AboutGift, PriceGift, SaleGift, StopGift],
      function(err) {
        if (err) {
          console.error(`Ошибка insert gift: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: this.lastID });
      }
    );
  });

  // Получение списка подарков
  // GET /api/gifts
  router.get('/gifts', (req, res) => {
    console.log('GET /api/gifts');
    giftDb.all(
      `SELECT * FROM gifts WHERE StopGift = 1`,
      (err, rows) => {
        if (err) {
          console.error(`Ошибка select gifts: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
      }
    );
  });

  // Удаление подарка
  // POST /api/deletegift
  router.post('/deletegift', (req, res) => {
    const { id } = req.body;
    console.log(`POST /api/deletegift id=${id}`);
    giftDb.run(
      `DELETE FROM gifts WHERE id = ?`,
      [id],
      function(err) {
        if (err) {
          console.error(`Ошибка delete gift: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
      }
    );
  });

  // Обновление подарка
  // POST /api/updategift
  router.post('/updategift', (req, res) => {
    const { id, PhotoGift, AboutGift, PriceGift, SaleGift, StopGift } = req.body;
    console.log(`POST /api/updategift body: ${JSON.stringify(req.body)}`);
    giftDb.run(
      `UPDATE gifts
       SET PhotoGift = ?, AboutGift = ?, PriceGift = ?, SaleGift = ?, StopGift = ?
       WHERE id = ?`,
      [PhotoGift, AboutGift, PriceGift, SaleGift, StopGift, id],
      function(err) {
        if (err) {
          console.error(`Ошибка update gift: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
      }
    );
  });

  // Отправка подарка
  // POST /api/send-gift
  router.post('/send-gift', (req, res) => {
    const { fromUser, toUser, giftId } = req.body;
    console.log(`POST /api/send-gift from ${fromUser} to ${toUser}, giftId: ${giftId}`);
    if (!fromUser || !toUser || !giftId) {
        return res.status(400).json({ success: false, error: 'fromUser, toUser, and giftId are required' });
    }

    // Запись в таблицу отправленных подарков
    db.run('INSERT INTO user_gifts (senderId, receiverId, giftId, timestamp) VALUES (?, ?, ?, datetime("now"))', [fromUser, toUser, giftId], function(err) {
        if (err) {
            console.error(`Ошибка при отправке подарка: ${err.message}`);
            return res.status(500).json({ success: false, error: 'DB error while sending gift' });
        }
        console.log(`Подарок от ${fromUser} к ${toUser} успешно отправлен.`);
        res.json({ success: true, message: 'Gift sent successfully' });
    });
  });

  // Получение подарков пользователя
  // GET /api/my-gifts
  router.get('/my-gifts', (req, res) => {
    const { userId } = req.query;
    console.log(`GET /api/my-gifts for userId: ${userId}`);
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const sql = `
        SELECT ug.giftId, ug.senderId, u.name as senderName, g.PhotoGift, g.AboutGift, ug.timestamp
        FROM user_gifts ug
        JOIN gifts g ON ug.giftId = g.id
        JOIN users u ON ug.senderId = u.userId
        WHERE ug.receiverId = ?
        ORDER BY ug.timestamp DESC
    `;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error(`Ошибка при получении подарков для ${userId}: ${err.message}`);
            return res.status(500).json({ success: false, error: 'DB error while fetching gifts' });
        }
        res.json({ success: true, gifts: rows });
    });
  });

  return router;
}