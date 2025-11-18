/**
 * Утилиты для работы с PostgreSQL
 * Адаптированы для работы с pg (node-postgres)
 */

/**
 * Выполняет SQL запрос с одним результатом
 * @param {Object} pool - пул подключений PostgreSQL
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<Object|null>} - результат запроса или null
 */
async function dbGet(pool, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (err) {
    throw err;
  }
}

/**
 * Выполняет SQL запрос с множественными результатами
 * @param {Object} pool - пул подключений PostgreSQL
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<Array>} - массив результатов
 */
async function dbAll(pool, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Выполняет SQL запрос на изменение данных
 * @param {Object} pool - пул подключений PostgreSQL
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<{lastID: number, changes: number}>} - информация о результате
 */
async function dbRun(pool, sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    // В PostgreSQL возвращаем rowCount как changes
    // lastID можно получить из RETURNING id
    return {
      lastID: result.rows[0]?.id || null,
      changes: result.rowCount || 0
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Выполняет транзакцию
 * @param {Object} pool - пул подключений PostgreSQL
 * @param {Function} callback - функция, выполняющая операции в транзакции
 * @returns {Promise<any>} - результат выполнения callback
 */
async function dbTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Безопасно парсит JSON строку
 * @param {string} jsonString - JSON строка
 * @param {*} defaultValue - значение по умолчанию
 * @returns {*} - распарсенное значение или defaultValue
 */
function safeJsonParse(jsonString, defaultValue = []) {
  if (!jsonString || typeof jsonString !== 'string') {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch (e) {
    console.warn('Ошибка парсинга JSON:', e.message);
    return defaultValue;
  }
}

/**
 * Конвертирует SQLite запрос в PostgreSQL формат
 * @param {string} sql - SQL запрос в формате SQLite
 * @returns {string} - SQL запрос в формате PostgreSQL
 */
function convertSqliteToPg(sql) {
  // Заменяем ? на $1, $2, $3 и т.д.
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

module.exports = {
  dbGet,
  dbAll,
  dbRun,
  dbTransaction,
  safeJsonParse,
  convertSqliteToPg
};

