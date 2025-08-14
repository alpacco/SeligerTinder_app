const http = require('http');
// spawn no longer needed – single server setup
const app = require('./app');

console.log('=== START-APP.JS ЗАПУЩЕН ===');

const HOST = '0.0.0.0';
const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`✅ Backend server is running on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Ошибка: Порт ${PORT} уже используется.`);
  } else {
    console.error('Ошибка запуска сервера:', error);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nЗавершение работы сервера...');
  server.close(() => {
    console.log('Сервер успешно остановлен');
    process.exit(0);
  });
});