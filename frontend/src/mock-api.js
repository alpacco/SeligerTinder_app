/**
 * Mock API для локальной разработки
 * Имитирует работу бэкенда в локальном режиме
 */

// Устанавливаем флаг mock-режима
window.MOCK_MODE = true;

// Mock API для тестирования фронтенда без бэкенда
console.log('🎭 Mock API: Файл загружен');

// Имитация базы данных пользователей
const mockUsers = [
  {
    id: 'UserID',
    name: 'Username',
    age: 25,
    gender: 'male',
    city: 'Москва',
    about: 'Тестовый пользователь для разработки',
    photos: ['/public/img/logo.svg'],
    interests: ['Тестирование', 'Разработка'],
    distance: 0,
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U1',
    name: 'Анна',
    age: 25,
    gender: 'female',
    city: 'Москва',
    about: 'Люблю путешествия и активный отдых. В поисках интересного собеседника и новых приключений.',
    photos: [
      '/data/img/TEST_U1/photo1.jpg',
      '/data/img/TEST_U1/photo2.jpg',
      '/data/img/TEST_U1/photo3.jpg'
    ],
    interests: ['Путешествия', 'Спорт', 'Фотография'],
    distance: 1.2,
    badge: 'L',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U2',
    name: 'Мария',
    age: 28,
    gender: 'female',
    city: 'Санкт-Петербург',
    about: 'Фотограф по выходным, искатель приключений в душе. Люблю горы и закаты.',
    photos: [
      '/data/img/TEST_U2/photo1.jpg',
      '/data/img/TEST_U2/photo2.jpg',
      '/data/img/TEST_U2/photo3.jpg'
    ],
    interests: ['Фотография', 'Горы', 'Велоспорт'],
    distance: 2.5,
    badge: 'P',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U3',
    name: 'Дарья',
    age: 23,
    gender: 'female',
    city: 'Казань',
    about: 'Люблю готовить итальянскую кухню и кататься на велосипеде. Ищу того, кто разделит мои увлечения.',
    photos: [
      '/data/img/TEST_U3/photo1.jpg',
      '/data/img/TEST_U3/photo2.jpg',
      '/data/img/TEST_U3/photo3.jpg'
    ],
    interests: ['Кулинария', 'Велоспорт', 'Италия'],
    distance: 0.8,
    badge: 'S',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U4',
    name: 'Екатерина',
    age: 27,
    gender: 'female',
    city: 'Сочи',
    about: 'Пляжи, море и солнце - моя стихия. Ищу такого же активного и позитивного человека.',
    photos: [
      '/data/img/TEST_U4/photo1.jpg',
      '/data/img/TEST_U4/photo2.jpg',
      '/data/img/TEST_U4/photo3.jpg'
    ],
    interests: ['Пляжный волейбол', 'Дайвинг', 'Фитнес'],
    distance: 5.3,
    badge: 'L',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U5',
    name: 'Ольга',
    age: 30,
    gender: 'female',
    city: 'Екатеринбург',
    about: 'Ищу серьезные отношения с перспективой создания семьи. Ценю честность и открытость в отношениях.',
    photos: [
      '/data/img/TEST_U5/photo1.jpg',
      '/data/img/TEST_U5/photo2.jpg',
      '/data/img/TEST_U5/photo3.jpg'
    ],
    interests: ['Литература', 'Кино', 'Прогулки'],
    distance: 3.1,
    badge: 'P',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U6',
    name: 'Александра',
    age: 26,
    gender: 'female',
    city: 'Москва',
    about: 'Дизайнер интерьеров. Люблю искусство, выставки и уютные вечера с хорошей книгой.',
    photos: [
      '/data/img/TEST_U6/photo1.jpg',
      '/data/img/TEST_U6/photo2.jpg',
      '/data/img/TEST_U6/photo3.jpg'
    ],
    interests: ['Дизайн', 'Искусство', 'Чтение'],
    distance: 1.8,
    badge: 'S',  // Only L, P, S or empty string
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U7',
    name: 'Виктория',
    age: 24,
    gender: 'female',
    city: 'Москва',
    about: 'Студентка МГУ, учусь на факультете журналистики. Мечтаю работать на телевидении.',
    photos: [
      '/data/img/TEST_U7/photo1.jpg',
      '/data/img/TEST_U7/photo2.jpg',
      '/data/img/TEST_U7/photo3.jpg'
    ],
    interests: ['Журналистика', 'Кино', 'Театр'],
    distance: 0.5,
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U8',
    name: 'Наталья',
    age: 29,
    gender: 'female',
    city: 'Москва',
    about: 'Врач-кардиолог. Ищу надежного, доброго и заботливого мужчину для серьезных отношений.',
    photos: [
      '/data/img/TEST_U8/photo1.jpg',
      '/data/img/TEST_U8/photo2.jpg',
      '/data/img/TEST_U8/photo3.jpg'
    ],
    interests: ['Медицина', 'ЗОЖ', 'Путешествия'],
    distance: 2.2,
    lastLogin: new Date().toISOString()
  },
  {
    id: 'TEST_U9',
    name: 'Светлана',
    age: 31,
    gender: 'female',
    city: 'Новосибирск',
    about: 'Люблю театр, книги и уютные вечера.',
    photos: [
      '/data/img/TEST_U9/photo1.jpg',
      '/data/img/TEST_U9/photo2.jpg',
      '/data/img/TEST_U9/photo3.jpg'
    ],
    interests: ['Театр', 'Книги', 'Путешествия'],
    distance: 4.2,
    lastLogin: new Date().toISOString()
  }
];

let currentUserId = 6; // Следующий ID для нового пользователя

// --- ВОССТАНОВЛЕНИЕ mockSuperLikes из localStorage ---
let mockSuperLikes = {};
try {
  const saved = localStorage.getItem('mockSuperLikes');
  if (saved) mockSuperLikes = JSON.parse(saved);
} catch (e) { mockSuperLikes = {}; }

// Функция для поиска пользователя по telegramId
function findUserByTelegramId(telegramId) {
  return mockUsers.find(user => user.telegramId === telegramId);
}

// Хранилище лайков пользователей
const mockLikes = {};

// Инициализируем текущего пользователя
if (!window.currentUser) {
  window.currentUser = {
    id: 'current',
    userId: 'current',
    name: 'Текущий пользователь',
    gender: 'male',
    age: 25,
    bio: 'Привет! Я новый пользователь.',
    photos: [],
    lastLogin: new Date().toISOString()
  };
}

// Функция для инициализации лайков пользователя, если их еще нет
function ensureUserLikes(userId) {
  if (!mockLikes[userId]) {
    mockLikes[userId] = [];
  }
  return mockLikes[userId];
}

// Инициализация лайков: только TEST_U1...TEST_U5 ставят лайк UserID
mockUsers.forEach((user) => {
  ensureUserLikes(String(user.id));
  if (user.id.startsWith('TEST_U')) {
    const num = parseInt(user.id.replace('TEST_U', ''));
    if (num >= 1 && num <= 5) {
      ensureUserLikes('UserID').push(String(user.id));
    }
  }
});

// Дополнительная инициализация для разных ID текущего пользователя
// Это обеспечит сохранение лайков даже после сброса
const currentUserIds = ['UserID', 'current', '6']; // возможные ID текущего пользователя
currentUserIds.forEach(userId => {
  ensureUserLikes(userId);
  // Первые 5 тестовых пользователей лайкают текущего пользователя
  mockUsers.slice(0, 5).forEach(user => {
    if (!mockLikes[userId].includes(String(user.id))) {
      mockLikes[userId].push(String(user.id));
    }
  });
});

// Обработчик API
window.mockApi = {
  // Имитация регистрации пользователя
  async register(userData) {
    
    // Проверяем, не зарегистрирован ли уже пользователь
    const existingUser = findUserByTelegramId(userData.telegramId);
    if (existingUser) {
      return {
        success: false,
        error: 'Пользователь с таким Telegram ID уже зарегистрирован'
      };
    }
    
    // Создаем нового пользователя
    const newUser = {
      id: currentUserId++,
      ...userData,
      isPro: false,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    mockUsers.push(newUser);
    
    // Возвращаем успешный ответ
    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        gender: newUser.gender,
        age: newUser.age,
        city: newUser.city,
        isPro: newUser.isPro,
        needPhoto: newUser.needPhoto || 0,
        photos: newUser.photos || []
      },
      token: `mock-jwt-token-${newUser.id}`
    };
  },
  
  // Имитация входа пользователя
  async login(telegramId) {
    
    // Находим пользователя по telegramId или создаем нового
    let user = mockUsers.find(u => u.telegramId === telegramId);
    
    if (!user) {
      // Создаем нового пользователя
      user = {
        id: 'current',
        userId: 'current',
        telegramId,
        name: `User${mockUsers.length + 1}`,
        age: 25,
        gender: 'male',
        bio: 'Новый пользователь',
        photos: [],
        needPhoto: 0
      };
      
      mockUsers.push(user);
    }
    
    // Устанавливаем текущего пользователя
    window.currentUser = user;
    
    // Инициализируем лайки для пользователя, если их еще нет
    ensureUserLikes(user.userId);
    
    return {
      success: true,
      user: { ...user },
      token: 'mock-jwt-token',
      isNew: false
    };
  },
  
  // Имитация проверки регистрации
  async checkRegistration(telegramId) {
    const user = findUserByTelegramId(telegramId);
    
    if (!user) {
      return {
        success: false,
        registered: false
      };
    }
    
    return {
      success: true,
      registered: true,
      user: {
        id: user.id,
        name: user.name,
        gender: user.gender,
        age: user.age,
        city: user.city,
        isPro: user.isPro,
        needPhoto: user.needPhoto || 0,
        photos: user.photos || []
      },
      token: `mock-jwt-token-${user.id}`
    };
  },
  
  // Получение списка кандидатов
  async getCandidates() {
    
    // Фильтруем пользователей по полу (показываем только противоположный пол)
    const currentUser = window.currentUser;
    const oppositeGender = currentUser.gender === 'male' ? 'female' : 'male';
    
    const candidates = mockUsers.filter(user => 
      user.gender === oppositeGender && 
      user.id !== currentUser.id
    ).map(user => ({
      ...user,
      bio: user.about || ''
    }));
    
    return {
      success: true,
      data: candidates
    };
  },
  
  // Имитация отправки лайка
  async sendLike(targetUserId) {
    
    // Получаем ID текущего пользователя
    const currentUserId = window.currentUser?.id || window.currentUser?.userId || 'current';
    
    // Инициализируем лайки для пользователей, если их еще нет
    ensureUserLikes(currentUserId);
    ensureUserLikes(targetUserId);
    
    // Добавляем лайк от текущего пользователя к целевому
    if (!mockLikes[targetUserId].includes(currentUserId)) {
      mockLikes[targetUserId].push(currentUserId);
    }
    
    // Проверяем, есть ли взаимный лайк
    const isMatch = mockLikes[currentUserId]?.includes(targetUserId) || false;
    
    // Если есть мэтч, добавляем пользователя в мэтчи
    if (isMatch) {
    }
    
    return {
      success: true,
      isMatch: isMatch
    };
  },
  
  // Имитация отправки дизлайка
  async sendDislike(targetUserId) {
    return { success: true };
  },
  
  // Имитация отправки суперлайка
  async sendSuperLike(senderId, receiverId) {
    if (!mockSuperLikes[senderId]) mockSuperLikes[senderId] = [];
    if (!mockSuperLikes[senderId].includes(receiverId)) {
      mockSuperLikes[senderId].push(receiverId);
      // --- Сохраняем в localStorage ---
      try { localStorage.setItem('mockSuperLikes', JSON.stringify(mockSuperLikes)); } catch (e) {}
    }
    
    return {
      success: true,
      message: 'Суперлайк отправлен'
    };
  },
  
  // Получение списка мэтчей
  async getMatches(userId) {
    const userSuperLikes = mockSuperLikes[userId] || [];
    const usersWhoLikedMe = mockLikes[userId] || [];
    
    // Находим мэтчи (взаимные лайки)
    const matches = [];
    for (const likedUserId of usersWhoLikedMe) {
      if (likedUserId === userId) continue; // Исключаем самого себя
      const likedUserLikes = mockLikes[likedUserId] || [];
      if (likedUserLikes.includes(userId)) {
        // Это мэтч!
        const user = mockUsers.find(u => String(u.id) === likedUserId);
        if (user) {
          const hasSuperLike = userSuperLikes.includes(likedUserId);
          const photo = user.photos && user.photos[0] ? user.photos[0] : '/img/photo.svg';
          matches.push({
            id: user.id,
            userId: user.id,
            name: user.name,
            age: user.age,
            bio: user.bio || '',
            photo: photo,
            avatar: photo,
            badge: user.badge || '',
            superLikeStatus: hasSuperLike ? 'sent' : undefined,
            isMutual: true
          });
        }
      }
    }
    // --- ДОБАВЛЯЕМ односторонние суперлайки (без взаимного лайка) ---
    for (const slUserId of userSuperLikes) {
      if (matches.some(m => m.userId === slUserId)) continue;
      // Проверяем, лайкнули ли вы slUserId
      const iLikeHim = (mockLikes[slUserId] || []).includes(userId);
      if (!usersWhoLikedMe.includes(slUserId) && iLikeHim) {
        const user = mockUsers.find(u => String(u.id) === slUserId);
        if (user) {
          const photo = user.photos && user.photos[0] ? user.photos[0] : '/img/photo.svg';
          matches.push({
            id: user.id,
            userId: user.id,
            name: user.name,
            age: user.age,
            bio: user.bio || '',
            photo: photo,
            avatar: photo,
            badge: user.badge || '',
            superLikeStatus: 'pending',
            isMutual: false
          });
        }
      }
    }
    
    return {
      success: true,
      data: matches
    };
  },
  
  // Новый метод для получения списка пользователей, которые поставили лайк
  async getLikesReceived() {
    const currentUserId = window.currentUser?.id || window.currentUser?.userId || 'current';
    
    // Инициализируем лайки для текущего пользователя, если их еще нет
    ensureUserLikes(currentUserId);
    
    const likes = mockLikes[currentUserId] || [];
    
    const users = likes.map(userId => {
      const user = mockUsers.find(u => String(u.id) === userId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        age: user.age,
        photo: user.photos?.[0] || '',
        bio: user.about || '',
        distance: user.distance || 0,
        badge: user.badge || ''
      };
    }).filter(Boolean);
    return {
      success: true,
      count: users.length,
      likes: users
    };
  },
  
  // Новый метод для получения последнего входа пользователя
  async getLastLogin(userId) {
    const user = mockUsers.find(u => String(u.id) === userId);
    if (!user) {
      return {
        success: false,
        error: 'Пользователь не найден'
      };
    }
    
    return {
      success: true,
      lastLogin: user.lastLogin
    };
  },
  
  // Получение целей пользователя
  async getGoals(userId) {
    
    // Для тестовых пользователей возвращаем случайные цели
    const allGoals = [
      'Серьезные отношения',
      'Дружба',
      'Путешествия',
      'Спорт',
      'Музыка',
      'Кино',
      'Книги',
      'Кулинария',
      'Фотография',
      'Искусство'
    ];
    
    // Выбираем 2-3 случайные цели
    const numGoals = Math.floor(Math.random() * 2) + 2; // 2-3 цели
    const selectedGoals = [];
    const shuffled = [...allGoals].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numGoals && i < shuffled.length; i++) {
      selectedGoals.push(shuffled[i]);
    }
    
    return {
      success: true,
      goals: selectedGoals
    };
  },

  // Обновление профиля пользователя
  async updateProfile(profileData) {
    
    // Находим пользователя в mockUsers
    const userIndex = mockUsers.findIndex(u => String(u.id) === String(profileData.userId) || String(u.userId) === String(profileData.userId));
    
    if (userIndex === -1) {
      console.warn('⚠️ Mock API: Пользователь не найден для обновления профиля:', profileData.userId);
      return {
        success: false,
        error: 'Пользователь не найден'
      };
    }
    
    // Обновляем данные пользователя
    const user = mockUsers[userIndex];
    if (profileData.gender !== undefined) user.gender = profileData.gender;
    if (profileData.bio !== undefined) user.about = profileData.bio;
    if (profileData.age !== undefined) user.age = profileData.age;
    if (profileData.photos !== undefined) user.photos = profileData.photos;
    if (profileData.goals !== undefined) user.goals = profileData.goals;
    
    return {
      success: true,
      message: 'Профиль успешно обновлен'
    };
  }
};

// Перехватчик fetch для имитации API
const originalFetch = window.fetch;
window.fetch = async function(resource, options = {}) {
  
  // Пропускаем запросы не к нашему API
  if (!resource.includes('/api/') && !resource.includes('localhost:3002/api')) {
    return originalFetch.call(this, resource, options);
  }
  
  // Обработка запроса списка кандидатов
  if (resource.includes('localhost:3002/api/candidates')) {
    try {
      const candidatesResponse = await window.mockApi.getCandidates();
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        json: async () => candidatesResponse
      };
    } catch (error) {
      console.error('❌ Ошибка при получении списка кандидатов:', error);
      return {
        ok: false,
        status: 500,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        json: async () => ({
          success: false,
          error: 'Ошибка при получении списка кандидатов'
        })
      };
    }
  }
  
  // Обработка запроса последнего входа пользователя
  if (resource.includes('/api/last-login/')) {
    try {
      // Извлекаем userId из URL
      const url = new URL(resource, window.location.origin);
      const userId = url.pathname.split('/api/last-login/')[1];
      
      const lastLoginResponse = await window.mockApi.getLastLogin(userId);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        json: async () => lastLoginResponse
      };
    } catch (error) {
      console.error('❌ Ошибка при получении последнего входа:', error);
      return {
        ok: false,
        status: 500,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        json: async () => ({
          success: false,
          error: 'Ошибка при получении последнего входа'
        })
      };
    }
  }
  
  // Обработка запроса профиля пользователя
  if (resource.includes('/api/user') && !resource.includes('/api/users/')) {
    const url = new URL(resource, window.location.origin);
    const userId = url.searchParams.get('userId');
    const user = mockUsers.find(u => String(u.id) === String(userId));
    if (!user) {
      return {
        ok: false,
        status: 404,
        headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
        json: async () => ({ success: false, error: 'Пользователь не найден' })
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
      json: async () => ({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          age: user.age,
          bio: user.about || '',
          badge: user.badge || '',
          photo1: user.photos?.[0] || '',
          photo2: user.photos?.[1] || '',
          photo3: user.photos?.[2] || ''
        }
      })
    };
  }
  
  // Обработка регистрации пользователя
  if (resource.includes('/api/users/join')) {
    try {
      const body = options.body ? JSON.parse(options.body) : null;
      
      // Создаем нового пользователя
      const newUser = {
        id: body.userId,
        userId: body.userId,
        name: body.name,
        username: body.username || '',
        photoUrl: body.photoUrl || '/img/logo.svg',
        gender: body.gender || '',
        bio: body.bio || '',
        age: 0,
        photos: [],
        likes: [],
        dislikes: [],
        is_pro: false,
        super_likes_count: 3,
        needPhoto: 0
      };
      
      // Добавляем пользователя в список
      mockUsers.push(newUser);
      
      // Инициализируем лайки для нового пользователя
      ensureUserLikes(body.userId);
      
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
        json: async () => ({
          success: true,
          user: {
            userId: newUser.userId,
            name: newUser.name,
            username: newUser.username,
            photoUrl: newUser.photoUrl,
            gender: newUser.gender,
            bio: newUser.bio,
            registered: true
          }
        })
      };
    } catch (error) {
      console.error('❌ Mock API: Ошибка при регистрации:', error);
      return {
        ok: false,
        status: 500,
        headers: { get: (name) => name === 'content-type' ? 'application/json' : null },
        json: async () => ({ success: false, error: 'Ошибка при регистрации' })
      };
    }
  }
  
  try {
    // Обработка запросов к API
    const url = new URL(resource, window.location.origin);
    // Извлекаем путь после /api/ для полных URL
    let path = url.pathname;
    if (resource.includes('localhost:3002/api')) {
      path = url.pathname.replace('/api', '');
    }
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    let response;

    try {
      if (path.endsWith('/register') && method === 'POST') {
        response = await window.mockApi.register(body);
      } else if (path.endsWith('/login') && method === 'POST') {
        response = await window.mockApi.login(body.telegramId);
      } else if (path.endsWith('/check-registration') && method === 'POST') {
        response = await window.mockApi.checkRegistration(body.telegramId);
      } else if (path.endsWith('/candidates') && method === 'GET') {
        response = await window.mockApi.getCandidates();
      } else if (path.endsWith('/like') && method === 'POST') {
        response = await window.mockApi.sendLike(body.toUser);
      } else if (path.endsWith('/dislike') && method === 'POST') {
        response = await window.mockApi.sendDislike(body.toUser);
      } else if (path.endsWith('/superlike') && method === 'POST') {
        response = await window.mockApi.sendSuperLike(body.senderId, body.receiverId);
      } else if (path.endsWith('/matches') && method === 'GET') {
        const url = new URL(resource, window.location.origin);
        const userId = url.searchParams.get('userId');
        response = await window.mockApi.getMatches(userId);
      } else if (path.endsWith('/likesReceived') && method === 'GET') {
        const url = new URL(resource, window.location.origin);
        const userId = url.searchParams.get('userId');
        response = await window.mockApi.getLikesReceived(userId);
      } else if (path.startsWith('/last-login/') && method === 'GET') {
        // Извлекаем userId из пути /last-login/{userId}
        const userId = path.split('/last-login/')[1];
        response = await window.mockApi.getLastLogin(userId);
      } else if (path.endsWith('/goals') && method === 'GET') {
        const url = new URL(resource, window.location.origin);
        const userId = url.searchParams.get('userId');
        response = await window.mockApi.getGoals(userId);
      } else if (path.endsWith('/updateProfile') && method === 'POST') {
        response = await window.mockApi.updateProfile(body);
      } else if (path.endsWith('/matches') && method === 'DELETE') {
        let userId;
        if (body && body.userId) {
          userId = body.userId;
        } else {
          const url = new URL(resource, window.location.origin);
          userId = url.searchParams.get('userId');
        }
        const matchId = body && body.matchId;

        // 1. Снимаем лайк userId → matchId
        const user = mockUsers.find(u => String(u.id) === String(userId) || String(u.userId) === String(userId));
        if (user && Array.isArray(user.likes)) {
          user.likes = user.likes.filter(like => String(like) !== String(matchId));
        }
        // 2. Добавляем дизлайк userId → matchId (если нужно)
        if (user && Array.isArray(user.dislikes)) {
          if (!user.dislikes.includes(matchId)) user.dislikes.push(matchId);
        }
        // 3. Удаляем лайк из mockLikes (именно это использует getMatches!)
        if (mockLikes[userId]) {
          mockLikes[userId] = mockLikes[userId].filter(like => String(like) !== String(matchId));
        }

        // Возвращаем обновлённый список мэтчей
        response = await window.mockApi.getMatches(userId);
      } else if (path.endsWith('/like') && method === 'DELETE') {
        // Снимаем лайк от fromUser к toUser
        const fromUser = body && (body.fromUser || body.userId);
        const toUser = body && (body.toUser || body.matchId);
        // Удаляем лайк из массива likes пользователя fromUser
        const user = mockUsers.find(u => String(u.id) === String(fromUser) || String(u.userId) === String(fromUser));
        if (user && Array.isArray(user.likes)) {
          user.likes = user.likes.filter(like => String(like) !== String(toUser));
        }
        // Удаляем лайк из mockLikes (используется для getMatches и likesReceived)
        if (mockLikes[fromUser]) {
          mockLikes[fromUser] = mockLikes[fromUser].filter(like => String(like) !== String(toUser));
        }
        response = { success: true };
      } else {
        // Для неизвестных эндпоинтов возвращаем ошибку
        console.warn(`⚠️ Mock API: Неизвестный эндпоинт: ${path}`);
        return Promise.resolve({
          ok: false,
          status: 404,
          headers: {
            get: (name) => {
              if (name === 'content-type') return 'application/json';
              return null;
            }
          },
          json: async () => ({
            success: false,
            error: 'Эндпоинт не найден в мок-API'
          })
        });
      }
    } catch (error) {
      console.error('❌ Mock API: Ошибка обработки запроса:', error);
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json';
            return null;
          }
        },
        json: async () => ({
          success: false,
          error: 'Внутренняя ошибка Mock API'
        })
      });
    }
    
    // Возвращаем правильный формат ответа для совместимости с api.js
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: {
        get: (name) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }
      },
      json: async () => response
    });
    
  } catch (error) {
    console.error('❌ Mock API: Ошибка обработки запроса:', error);
    return Promise.resolve({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Внутренняя ошибка Mock API'
      })
    });
  }
};

// Экспортируем mock API для доступа из других модулей
window.mockApi = mockApi;
