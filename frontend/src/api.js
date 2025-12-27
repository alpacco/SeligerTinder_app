/**
 * api.js - Модуль для взаимодействия с бэкенд API
 * Все функции возвращают Promise с результатом fetch-запроса.
 * Экспортируемые функции:
 * - checkUser, getCandidates, joinUser, updateGender
 * - sendLike, sendDislike, sendSuperLike
 * - getMatches, fetchLikesReceived
 * - sendGift, sendPush
 * - fetchGoals, saveGoals
 * - fetchLastLogin
 * - updateProfile, getUser
 * - uploadPhoto
 */
console.log('📜 [API.JS] Модуль api.js загружен.');

const API_URL = window.API_URL || '/api';

/**
 * Выполняет стандартизированный fetch-запрос и обрабатывает ответы.
 * @param {string} endpoint - Путь к API (например, '/users/candidates').
 * @param {object} [options={}] - Опции для fetch-запроса (method, headers, body).
 * @returns {Promise<any>} - JSON-ответ от сервера.
 * @throws {Error} - Если ответ сети не 'ok' или произошла ошибка.
 */
async function request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const method = options.method || 'GET';

    if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && options.body) {
        try {
            // Пытаемся распарсить и залогировать как объект для читаемости
        } catch (e) {
            // Если это не JSON, логируем как есть
        }
    }

    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const result = await response.json();

            if (!response.ok) {
                console.warn(`[api.js:request] ⚠️ Ответ не 'ok'. Статус: ${response.status}.`);
                if (response.status === 404) {
                    return null;
                }
                const errorMessage = result.error || `HTTP status ${response.status}`;
                console.error(`[api.js:request] ❌ Ошибка API: ${errorMessage}`);
                throw new Error(errorMessage);
            }
            return result;
        } else {
             const textResult = await response.text();
             if (!response.ok) {
                console.error(`[api.js:request] ❌ Ошибка API (не JSON ответ): HTTP status ${response.status}`);
                throw new Error(`HTTP status ${response.status}`);
             }
             return textResult;
        }

    } catch (error) {
        console.error(`[api.js:request] 💥 КРИТИЧЕСКАЯ ОШИБКА FETCH для ${url}:`, error);
        throw error; // Пробрасываем ошибку для обработки выше
    }
}

// --- Методы API ---

// Users
export const checkUser = (userId) => request(`/user?userId=${userId}`);
export const getCandidates = (userId, oppositeGender) => request(`/candidates?userId=${userId}&oppositeGender=${oppositeGender}`);
export const joinUser = (userData) => request('/join', { method: 'POST', body: JSON.stringify(userData) });
export const updateGender = (userId, gender) => request('/updateGender', { method: 'POST', body: JSON.stringify({ userId, gender }) });

// Likes
export const sendLike = (fromUser, toUser) => request('/like', { method: 'POST', body: JSON.stringify({ fromUser, toUser }) });
export const sendDislike = (fromUser, toUser) => request('/dislike', { method: 'POST', body: JSON.stringify({ fromUser, toUser }) });
export const sendSuperLike = (senderId, receiverId) => request('/superlike', { method: 'POST', body: JSON.stringify({ senderId, receiverId }) });

// Matches
export const getMatches = (userId) => {
  if (!userId) throw new Error("userId is required for getMatches");
  return request(`/matches?userId=${userId}`);
};
export const fetchLikesReceived = (userId) => request(`/likesReceived?userId=${userId}`);

// Gifts
export const sendGift = (data) => request('/specialPush', { method: 'POST', body: JSON.stringify(data) });

// Push
export const sendPush = (data) => request('/sendPush', { method: 'POST', body: JSON.stringify(data) });

// Goals
export const fetchGoals = (userId) => request(`/goals?userId=${userId}`);

// Goals (POST)
export const saveGoals = (userId, goals) => request('/goals', { method: 'POST', body: JSON.stringify({ userId, goals }) });

// Last login
export const fetchLastLogin = (userId) => request(`/last-login/${userId}`);
export const updateLastLogin = (userId) => request('/last-login', { method: 'POST', body: JSON.stringify({ userId }) });

// Profile
export const updateProfile = (profileData) => request('/updateProfile', { method: 'POST', body: JSON.stringify(profileData) });
export const getUser = (userId) => request(`/getUser?userId=${userId}`);

// Upload photo
export const uploadPhoto = (formData) => {
    // Для загрузки фото нужен другой Content-Type
    return fetch(`${API_URL}/webUploadPhoto`, {
    method: 'POST',
        body: formData
    }).then(r => r.json());
};

// New function
export const getSuperlikes = (userId) => request(`/superlikes?userId=${userId}`);

if (typeof window !== 'undefined') {
  window.getUser = getUser;
}
