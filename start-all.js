const { spawn } = require('child_process');
const path = require('path');

let appProcess, botProcess;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n🛑 Завершение работы...');
  if (appProcess) appProcess.kill('SIGTERM');
  if (botProcess) botProcess.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1000);
}

// Запускаем сервер приложения
appProcess = spawn('node', ['start-app.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

appProcess.on('error', (err) => {
  console.error('❌ Ошибка при запуске сервера приложения:', err);
  shutdown(1);
});

appProcess.on('exit', (code, signal) => {
  console.log(`⛔ start-app.js завершился (code: ${code}, signal: ${signal})`);
  shutdown(code || 1);
});

// Даем серверу немного времени на запуск перед запуском бота
setTimeout(() => {
  // Запускаем бота
  botProcess = spawn('node', ['start-bot.js'], {
    stdio: 'inherit',
    env: { ...process.env, BOT_ENABLED: 'true' }
  });

  botProcess.on('error', (err) => {
    console.error('❌ Ошибка при запуске бота:', err);
    shutdown(1);
  });

  botProcess.on('exit', (code, signal) => {
    console.log(`⛔ start-bot.js завершился (code: ${code}, signal: ${signal})`);
    shutdown(code || 1);
  });
}, 2000);

// Обработка завершения работы
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('🚀 Запуск приложения и бота...');
console.log('Для завершения работы нажмите Ctrl+C');
