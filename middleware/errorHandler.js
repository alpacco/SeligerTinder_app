/**
 * Централизованный обработчик ошибок
 */

/**
 * Создает стандартизированный ответ об ошибке
 * @param {Error} err - объект ошибки
 * @param {Object} req - объект запроса
 * @returns {Object} - объект ошибки для ответа
 */
function createErrorResponse(err, req) {
  // В продакшене не показываем детали ошибок
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    success: false,
    error: isDevelopment ? err.message : 'Внутренняя ошибка сервера'
  };

  // Добавляем детали только в режиме разработки
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Специальная обработка для известных типов ошибок
  if (err.statusCode) {
    errorResponse.statusCode = err.statusCode;
  }

  return errorResponse;
}

/**
 * Middleware для обработки ошибок
 */
function errorHandler(err, req, res, next) {
  // Логируем ошибку
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Определяем статус код
  const statusCode = err.statusCode || err.status || 500;

  // Создаем ответ
  const errorResponse = createErrorResponse(err, req);

  // Отправляем ответ
  res.status(statusCode).json(errorResponse);
}

/**
 * Middleware для обработки 404 ошибок
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Маршрут не найден'
  });
}

/**
 * Обертка для асинхронных обработчиков маршрутов
 * Автоматически обрабатывает ошибки в async функциях
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createErrorResponse
};

