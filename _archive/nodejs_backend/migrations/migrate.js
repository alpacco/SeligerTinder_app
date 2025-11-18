/**
 * Скрипт для выполнения миграций PostgreSQL
 * Использование: node migrations/migrate.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Конфигурация подключения
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'railway',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(getDbConfig());

// Создание таблицы для отслеживания миграций
async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Получение списка выполненных миграций
async function getExecutedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

// Выполнение миграции
async function runMigration(migrationName, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Выполняем SQL миграции
    await client.query(sql);
    
    // Записываем в таблицу migrations
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
    
    await client.query('COMMIT');
    console.log(`✅ Миграция ${migrationName} выполнена успешно`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Основная функция
async function migrate() {
  try {
    console.log('🔄 Начинаем выполнение миграций...');
    
    // Создаем таблицу миграций
    await createMigrationsTable();
    
    // Получаем список выполненных миграций
    const executed = await getExecutedMigrations();
    console.log(`📋 Выполненных миграций: ${executed.length}`);
    
    // Находим все SQL файлы миграций
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Найдено миграций: ${files.length}`);
    
    // Выполняем каждую миграцию
    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      if (executed.includes(migrationName)) {
        console.log(`⏭️  Миграция ${migrationName} уже выполнена, пропускаем`);
        continue;
      }
      
      console.log(`▶️  Выполняем миграцию ${migrationName}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await runMigration(migrationName, sql);
    }
    
    console.log('✅ Все миграции выполнены успешно!');
  } catch (err) {
    console.error('❌ Ошибка при выполнении миграций:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запуск
if (require.main === module) {
  migrate();
}

module.exports = { migrate };

