const express = require('express');
const { dbGet, dbAll, dbRun, safeJsonParse } = require('../utils/db');
const { validateUserIdBody, validateUserIdQuery } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

// Определяем тип БД
const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || !!process.env.DATABASE_URL;

module.exports = (db) => {
  const router = express.Router();
  
  // Для PostgreSQL db уже имеет метод query (pool), для SQLite используем db напрямую
  const dbQuery = db;

  router.post('/like', validateUserIdBody, asyncHandler(async (req, res) => {
    const { fromUser, toUser } = req.body;
    if (!toUser) {
      return res.status(400).json({ success: false, error: 'toUser обязателен' });
    }

    // Получаем данные отправителя
    // Для PostgreSQL нужно использовать $1, $2 вместо ?
    const sql = USE_POSTGRES 
      ? "SELECT likes, matches FROM users WHERE \"userId\" = $1"
      : "SELECT likes, matches FROM users WHERE userId = ?";
    const fromUserRow = await dbGet(dbQuery, sql, [fromUser]);
    if (!fromUserRow) {
      return res.status(404).json({ success: false, error: 'Отправитель не найден' });
    }

    let likes = safeJsonParse(fromUserRow.likes, []);
    let matches = safeJsonParse(fromUserRow.matches, []);

    // Добавляем лайк, если его еще нет
    if (!likes.includes(toUser)) {
      likes.push(toUser);
      await dbRun(db, "UPDATE users SET likes = ? WHERE userId = ?", [JSON.stringify(likes), fromUser]);
    }

    // Проверяем взаимный лайк
    const toUserRow = await dbGet(db, "SELECT likes, matches FROM users WHERE userId = ?", [toUser]);
    if (!toUserRow) {
      return res.status(404).json({ success: false, error: 'Получатель не найден' });
    }

    let likes2 = safeJsonParse(toUserRow.likes, []);
    let matches2 = safeJsonParse(toUserRow.matches, []);
    let isMatch = false;

    if (likes2.includes(fromUser)) {
      isMatch = true;
      if (!matches.includes(toUser)) {
        matches.push(toUser);
        await dbRun(db, "UPDATE users SET matches = ? WHERE userId = ?", [JSON.stringify(matches), fromUser]);
      }
      if (!matches2.includes(fromUser)) {
        matches2.push(fromUser);
        await dbRun(db, "UPDATE users SET matches = ? WHERE userId = ?", [JSON.stringify(matches2), toUser]);
      }
    }

    res.json({ success: true, match: isMatch });
  }));

  router.post('/dislike', validateUserIdBody, asyncHandler(async (req, res) => {
    const { fromUser, toUser } = req.body;
    if (!toUser) {
      return res.status(400).json({ success: false, error: 'toUser обязателен' });
    }

    const fromUserRow = await dbGet(db, "SELECT dislikes FROM users WHERE userId = ?", [fromUser]);
    if (!fromUserRow) {
      return res.status(404).json({ success: false, error: 'Отправитель не найден' });
    }

    let dislikes = safeJsonParse(fromUserRow.dislikes, []);
    if (!dislikes.includes(toUser)) {
      dislikes.push(toUser);
      await dbRun(db, "UPDATE users SET dislikes = ? WHERE userId = ?", [JSON.stringify(dislikes), fromUser]);
    }

    res.json({ success: true });
  }));

  router.post('/superlike', validateUserIdBody, asyncHandler(async (req, res) => {
    const { senderId, receiverId } = req.body;
    if (!receiverId) {
      return res.status(400).json({ success: false, error: 'receiverId обязателен' });
    }

    const senderRow = await dbGet(db, "SELECT superlikes FROM users WHERE userId = ?", [senderId]);
    if (!senderRow) {
      return res.status(404).json({ success: false, error: 'Отправитель не найден' });
    }

    let superlikes = safeJsonParse(senderRow.superlikes, []);
    if (superlikes.includes(receiverId)) {
      return res.json({ success: true, message: 'Суперлайк уже существует' });
    }

    superlikes.push(receiverId);
    await dbRun(db, "UPDATE users SET superlikes = ? WHERE userId = ?", [JSON.stringify(superlikes), senderId]);
    
    res.json({ success: true });
  }));

  router.get('/likesReceived', validateUserIdQuery, asyncHandler(async (req, res) => {
    const { userId } = req.query;

    // Получаем лайки из JSON поля users.likes
    const userRow = await dbGet(db, "SELECT likes FROM users WHERE userId = ?", [userId]);
    if (!userRow) {
      return res.json({ success: true, likes: [] });
    }

    const likedByUserIds = safeJsonParse(userRow.likes, []);
    if (likedByUserIds.length === 0) {
      return res.json({ success: true, likes: [] });
    }

    // Получаем информацию о пользователях, которые лайкнули текущего пользователя
    // Проверяем, кто из них лайкнул обратно
    const placeholders = likedByUserIds.map(() => '?').join(',');
    const sql = `
      SELECT u.userId, u.username, u.photo1, u.photo2, u.photo3, u.bio, u.age, u.name
      FROM users u
      WHERE u.userId IN (${placeholders})
    `;

    const rows = await dbAll(db, sql, likedByUserIds);
    
    // Фильтруем только тех, кто лайкнул обратно (взаимные лайки)
    const mutualLikes = [];
    for (const user of rows) {
      const userLikes = await dbGet(db, "SELECT likes FROM users WHERE userId = ?", [user.userId]);
      if (userLikes) {
        const userLikesArray = safeJsonParse(userLikes.likes, []);
        if (userLikesArray.includes(userId)) {
          mutualLikes.push(user);
        }
      }
    }

    res.json({ success: true, likes: mutualLikes });
  }));

  router.get('/likesMade', validateUserIdQuery, asyncHandler(async (req, res) => {
    const { userId } = req.query;

    const userRow = await dbGet(db, "SELECT likes FROM users WHERE userId = ?", [userId]);
    if (!userRow) {
      return res.json({ success: true, likes: [] });
    }

    const likedUserIds = safeJsonParse(userRow.likes, []);
    if (likedUserIds.length === 0) {
      return res.json({ success: true, likes: [] });
    }

    const placeholders = likedUserIds.map(() => '?').join(',');
    const sql = `
      SELECT u.userId, u.username, u.photo1, u.photo2, u.photo3, u.bio, u.age, u.name
      FROM users u
      WHERE u.userId IN (${placeholders})
    `;

    const rows = await dbAll(db, sql, likedUserIds);
    res.json({ success: true, likes: rows });
  }));

  return router;
};
