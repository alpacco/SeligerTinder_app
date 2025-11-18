
// routes/push.js
const express = require('express');
// Using native fetch API (available in Node.js 18+)

const BOT_TOKEN = process.env.BOT_TOKEN;

function pushRouter(db) {
  const router = express.Router();
  router.use(express.json());

  // Wave (👋) endpoint: record a visit between users
  // POST /api/sendPush
  router.post('/sendPush', (req, res) => {
    console.log(`POST /api/sendPush: ${JSON.stringify(req.body)}`);
    const { senderId, senderUsername, receiverId } = req.body;
    // Insert into visits table
    db.run(
      `INSERT INTO visits (sender_id, receiver_id, createdAt)
       VALUES (?, ?, datetime('now'))`,
      [senderId, receiverId],
      function(err) {
        if (err) {
          console.error(`sendPush DB error: ${err.message}`);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
      }
    );
  });

  // Special push with custom message and inline keyboard
  // POST /api/specialPush
  router.post('/specialPush', async (req, res) => {
    console.log(`POST /api/specialPush: ${JSON.stringify(req.body)}`);
    const { userId, candidateId, message, keyboard } = req.body;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: candidateId,
            text: message,
            ...keyboard
          })
        }
      );
      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram API error: ${JSON.stringify(result)}`);
      }
      res.json({ success: true, result: result.result });
    } catch (err) {
      console.error(`specialPush error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = pushRouter;