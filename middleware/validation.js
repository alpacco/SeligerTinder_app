/**
 * Middleware для валидации входных данных
 */

/**
 * Валидирует userId
 * @param {string} userId - идентификатор пользователя
 * @returns {boolean} - true если валидный
 */
function isValidUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  // userId должен быть непустой строкой, состоящей из цифр
  return /^\d+$/.test(userId.trim());
}

/**
 * Валидирует пол
 * @param {string} gender - пол пользователя
 * @returns {boolean} - true если валидный
 */
function isValidGender(gender) {
  return gender === 'male' || gender === 'female';
}

/**
 * Валидирует возраст
 * @param {number} age - возраст
 * @returns {boolean} - true если валидный
 */
function isValidAge(age) {
  const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
  return !isNaN(ageNum) && ageNum >= 1 && ageNum <= 120;
}

/**
 * Валидирует URL
 * @param {string} url - URL
 * @returns {boolean} - true если валидный
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    // Проверяем, что это либо относительный путь, либо валидный URL
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Middleware для валидации userId в query параметрах
 */
function validateUserIdQuery(req, res, next) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'userId обязателен' 
    });
  }
  if (!isValidUserId(userId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Невалидный userId' 
    });
  }
  // Нормализуем userId (trim)
  req.query.userId = userId.trim();
  next();
}

/**
 * Middleware для валидации userId в body
 */
function validateUserIdBody(req, res, next) {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'userId обязателен' 
    });
  }
  if (!isValidUserId(userId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Невалидный userId' 
    });
  }
  // Нормализуем userId (trim)
  req.body.userId = String(userId).trim();
  next();
}

/**
 * Middleware для валидации gender
 */
function validateGender(req, res, next) {
  const { gender } = req.body;
  if (!gender) {
    return res.status(400).json({ 
      success: false, 
      error: 'gender обязателен' 
    });
  }
  if (!isValidGender(gender)) {
    return res.status(400).json({ 
      success: false, 
      error: 'gender должен быть "male" или "female"' 
    });
  }
  next();
}

/**
 * Middleware для валидации age
 */
function validateAge(req, res, next) {
  const { age } = req.body;
  if (age === undefined || age === null) {
    return res.status(400).json({ 
      success: false, 
      error: 'age обязателен' 
    });
  }
  if (!isValidAge(age)) {
    return res.status(400).json({ 
      success: false, 
      error: 'age должен быть числом от 1 до 120' 
    });
  }
  next();
}

/**
 * Middleware для валидации bio (описание)
 */
function validateBio(req, res, next) {
  const { bio } = req.body;
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'bio должен быть строкой' 
      });
    }
    if (bio.length > 500) {
      return res.status(400).json({ 
        success: false, 
        error: 'bio не должен превышать 500 символов' 
      });
    }
  }
  next();
}

/**
 * Санитизирует строку (удаляет опасные символы)
 * @param {string} str - строка для санитизации
 * @returns {string} - санитизированная строка
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Middleware для санитизации строковых полей в body
 */
function sanitizeBody(req, res, next) {
  if (req.body) {
    // Санитизируем только строковые поля, не трогая специальные
    const fieldsToSanitize = ['name', 'username', 'bio', 'about'];
    fieldsToSanitize.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = sanitizeString(req.body[field]);
      }
    });
  }
  next();
}

module.exports = {
  isValidUserId,
  isValidGender,
  isValidAge,
  isValidUrl,
  validateUserIdQuery,
  validateUserIdBody,
  validateGender,
  validateAge,
  validateBio,
  sanitizeString,
  sanitizeBody
};

