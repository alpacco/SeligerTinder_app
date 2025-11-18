/**
 * Утилиты для работы с базой данных (SQLite и PostgreSQL)
 * Предоставляет промис-обертки для стандартных операций
 * Автоматически определяет тип БД
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || !!process.env.DATABASE_URL;

/**
 * Выполняет SQL запрос с одним результатом (db.get)
 * @param {import('sqlite3').Database|Object} db - экземпляр базы данных (SQLite или PostgreSQL pool)
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<Object|null>} - результат запроса или null
 */
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (USE_POSTGRES) {
      // PostgreSQL - адаптируем SQL для camelCase полей
      let adaptedSql = sql;
      adaptedSql = adaptedSql.replace(/\b(userId|photoUrl|createdAt|needPhoto|pushSent|is_pro|pro_start|pro_end|last_login|super_likes_count|photo1|photo2|photo3|photoBot)\b/g, '"$1"');
      db.query(adaptedSql, params)
        .then(result => resolve(result.rows[0] || null))
        .catch(reject);
    } else {
      // SQLite
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    }
  });
}

/**
 * Выполняет SQL запрос с множественными результатами (db.all)
 * @param {import('sqlite3').Database|Object} db - экземпляр базы данных (SQLite или PostgreSQL pool)
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<Array>} - массив результатов
 */
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (USE_POSTGRES) {
      // PostgreSQL - адаптируем SQL для camelCase полей
      let adaptedSql = sql;
      adaptedSql = adaptedSql.replace(/\b(userId|photoUrl|createdAt|needPhoto|pushSent|is_pro|pro_start|pro_end|last_login|super_likes_count|photo1|photo2|photo3|photoBot)\b/g, '"$1"');
      db.query(adaptedSql, params)
        .then(result => resolve(result.rows || []))
        .catch(reject);
    } else {
      // SQLite
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    }
  });
}

/**
 * Выполняет SQL запрос на изменение данных (db.run)
 * @param {import('sqlite3').Database|Object} db - экземпляр базы данных (SQLite или PostgreSQL pool)
 * @param {string} sql - SQL запрос
 * @param {Array} params - параметры запроса
 * @returns {Promise<{lastID: number, changes: number}>} - информация о результате
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (USE_POSTGRES) {
      // PostgreSQL - адаптируем SQL для camelCase полей
      let adaptedSql = sql;
      adaptedSql = adaptedSql.replace(/\b(userId|photoUrl|createdAt|needPhoto|pushSent|is_pro|pro_start|pro_end|last_login|super_likes_count|photo1|photo2|photo3|photoBot)\b/g, '"$1"');
      db.query(adaptedSql, params)
        .then(result => {
          resolve({
            lastID: result.rows[0]?.id || null,
            changes: result.rowCount || 0
          });
        })
        .catch(reject);
    } else {
      // SQLite
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    }
  });
}

/**
 * Выполняет транзакцию
 * @param {import('sqlite3').Database|Object} db - экземпляр базы данных (SQLite или PostgreSQL pool)
 * @param {Function} callback - функция, выполняющая операции в транзакции
 * @returns {Promise<any>} - результат выполнения callback
 */
async function dbTransaction(db, callback) {
  if (USE_POSTGRES) {
    // PostgreSQL - используем pool напрямую
    const { pool } = require('../db');
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
  } else {
    // SQLite
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          await dbRun(db, 'BEGIN TRANSACTION');
          const result = await callback();
          await dbRun(db, 'COMMIT');
          resolve(result);
        } catch (error) {
          try {
            await dbRun(db, 'ROLLBACK');
          } catch (rollbackError) {
            console.error('Ошибка при откате транзакции:', rollbackError);
          }
          reject(error);
        }
      });
    });
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

module.exports = {
  dbGet,
  dbAll,
  dbRun,
  dbTransaction,
  safeJsonParse
};

