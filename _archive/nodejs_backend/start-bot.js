require('dotenv').config();
const { bot } = require('./bot');

console.log('=== START-BOT.JS ЗАПУЩЕН ===');

(async () => {
  try {
    await bot.launch();
    console.log('✅ Bot started');
  } catch (err) {
    console.error('❌ Error starting bot:', err);
  }
})();