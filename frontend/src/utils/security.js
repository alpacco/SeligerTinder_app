/**
 * security.js
 * Утилиты для безопасности: санитизация XSS, валидация
 */

/**
 * Экранирует HTML символы для защиты от XSS
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Безопасно устанавливает textContent вместо innerHTML
 * @param {HTMLElement} element - Элемент для обновления
 * @param {string} text - Текст для установки
 */
export function setSafeText(element, text) {
  if (element) {
    element.textContent = text || '';
  }
}

/**
 * Безопасно создает элемент с текстом
 * @param {string} tagName - Тег элемента
 * @param {string} text - Текст для элемента
 * @param {Object} attributes - Атрибуты элемента
 * @returns {HTMLElement} - Созданный элемент
 */
export function createSafeElement(tagName, text, attributes = {}) {
  const element = document.createElement(tagName);
  element.textContent = text || '';
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
}

/**
 * Валидация имени пользователя
 * @param {string} name - Имя для валидации
 * @returns {string} - Валидированное имя
 */
export function validateName(name) {
  if (!name) return '';
  // Удаляем опасные символы, оставляем только буквы, цифры, пробелы и некоторые символы
  return String(name)
    .trim()
    .replace(/[<>\"'&]/g, '')
    .substring(0, 100); // Максимальная длина
}

/**
 * Валидация биографии
 * @param {string} bio - Биография для валидации
 * @returns {string} - Валидированная биография
 */
export function validateBio(bio) {
  if (!bio) return '';
  // Удаляем опасные символы
  return String(bio)
    .trim()
    .replace(/[<>\"']/g, '')
    .substring(0, 500); // Максимальная длина
}

/**
 * Валидация возраста
 * @param {number|string} age - Возраст для валидации
 * @returns {number|null} - Валидированный возраст или null
 */
export function validateAge(age) {
  if (age == null) return null;
  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    return null;
  }
  return ageNum;
}

