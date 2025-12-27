// ========== PRO Module ==========
// Модуль для работы с PRO-функционалом

import { fetchLikesReceived } from './api.js';

/**
 * Рендерит PRO-бейдж в заголовке свайпа
 */
function renderProBadge(currentUser) {
  const avaFrame = document.querySelector("#screen-swipe .ava-frame");
  const headerName = avaFrame?.querySelector(".user-id2");

  if (!headerName) return;

  let proContainer = avaFrame.querySelector(".pro-container");

  // Если контейнера нет — создаём его и вставляем имя
  if (!proContainer) {
    proContainer = document.createElement("div");
    proContainer.className = "pro-container";
    const avatarImg = avaFrame.querySelector("img.avatar_small_2");
    avaFrame.insertBefore(proContainer, avatarImg.nextSibling);
    proContainer.appendChild(headerName);
  }

  // Проверяем, действительно ли пользователь PRO (с учетом срока действия)
  const now = Date.now();
  const isProActive = currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now;
  
  // Если пользователь PRO и срок не истек — создаём бейдж (если ещё нет) и включаем колонку
  if (isProActive) {
    if (!proContainer.querySelector(".header-pro-badge")) {
      const badge = document.createElement("span");
      badge.className = "header-pro-badge";
      badge.textContent = "PRO";
      proContainer.insertBefore(badge, headerName);
    }
    avaFrame.classList.add("has-pro");
  } else {
    // Убираем бейдж и колонку, если не PRO или срок истек
    const existingBadge = proContainer.querySelector(".header-pro-badge");
    if (existingBadge) existingBadge.remove();
    avaFrame.classList.remove("has-pro");
  }
}

/**
 * Рендерит PRO-информацию в профиле
 */
function renderProInfo(currentUser) {
  // Проверяем, действительно ли пользователь PRO (с учетом срока действия)
  const now = Date.now();
  const isProActive = currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now;
  
  // Profile
  const profileProInfo = document.querySelector('.profile-header .header-pro-info');
  if (profileProInfo) {
    profileProInfo.innerHTML = '';
    if (isProActive) {
      const end = new Date(currentUser.pro_end);
      const days = Math.max(0, Math.ceil((end.getTime() - now) / (1000*60*60*24)));
      profileProInfo.innerHTML = `<strong>PRO</strong> ${days} дн.`;
    } else {
      // Показываем "Купить PRO" для не-PRO пользователей или с истекшим сроком
      profileProInfo.innerHTML = `<strong>Купить PRO</strong>`;
      // Добавляем обработчик клика для открытия PRO-модалки
      profileProInfo.style.cursor = 'pointer';
      profileProInfo.onclick = () => {
        // Открываем PRO-модалку
        if (window.showProModal) {
          window.showProModal();
        }
      };
    }
  }
  // Matches
  const matchesProInfo = document.querySelector('.matches-header .header-pro-info');
  if (matchesProInfo) {
    matchesProInfo.innerHTML = '';
    if (isProActive) {
      const end = new Date(currentUser.pro_end);
      const days = Math.max(0, Math.ceil((end.getTime() - now) / (1000*60*60*24)));
      matchesProInfo.innerHTML = `<strong>PRO</strong> ${days} дн.`;
    } else {
      // Показываем "Купить PRO" для не-PRO пользователей или с истекшим сроком
      matchesProInfo.innerHTML = `<strong>Купить PRO</strong>`;
      // Добавляем обработчик клика для открытия PRO-модалки
      matchesProInfo.style.cursor = 'pointer';
      matchesProInfo.onclick = () => {
        // Открываем PRO-модалку
        if (window.showProModal) {
          window.showProModal();
        }
      };
    }
  }
}

/**
 * Рендерит статистику лайков для PRO-пользователей в профиле
 */
function renderProLikesStats(currentUser) {
  const subRow = document.querySelector('.profile-header .header-sub-row');
  if (!subRow) return;
  
  // Очищаем строку для всех пользователей
  subRow.innerHTML = '';
  
  // Если просматриваем профиль кандидата или пользователь не PRO - не показываем статистику
  if (window.viewingCandidate || !currentUser.is_pro) {
    return;
  }
  
  // Проверяем срок действия Pro
  const now = Date.now();
  const isProActive = currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now;
  
  if (!isProActive) {
    return;
  }
  
  // Показываем статистику только для активных PRO пользователей
  // Убеждаемся, что likes - это массив
  let likesArray = currentUser.likes;
  if (typeof likesArray === 'string') {
    try {
      likesArray = JSON.parse(likesArray);
    } catch (e) {
      console.warn('Ошибка парсинга likes в renderProLikesStats:', e);
      likesArray = [];
    }
  }
  if (!Array.isArray(likesArray)) {
    likesArray = [];
  }
  const made = likesArray.length;
  subRow.innerHTML = `
    <div class="profile-likes-stats">
      <span class="likes-made-line">
        Вы: <span class="likes-made-count">${made}</span>
        <img src='/img/your_like.svg' alt='like'/>
      </span>
      <span class="likes-rec-line">
        Вам: <span class="likes-rec-count">…</span>
        <img src='/img/for_your_like.svg' alt='like'/>
      </span>
    </div>
  `;
  fetchLikesReceived(currentUser.userId)
    .then(js => {
      if (!js) return;
      if (js.success) {
        const countEl = subRow.querySelector(".likes-rec-count");
        if (countEl) countEl.textContent = js.count || 0;
      }
    })
    .catch(err => {
      console.error('Ошибка загрузки полученных лайков:', err);
      const countEl = subRow.querySelector(".likes-rec-count");
      if (countEl) countEl.textContent = '0';
    });
}

/**
 * Рендерит статистику лайков для PRO-пользователей в экране свайпов
 */
function renderProSwipeStats(currentUser) {
  const subRow = document.querySelector('.cards-header .header-sub-row');
  if (!subRow) return;
  
  // Очищаем строку для всех пользователей
  subRow.innerHTML = '';
  
  // Если пользователь не PRO - не показываем статистику
  if (!currentUser.is_pro) {
    return;
  }
  
  // Проверяем срок действия Pro
  const now = Date.now();
  const isProActive = currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now;
  
  if (!isProActive) {
    return;
  }
  
  // Показываем статистику только для активных PRO пользователей
  // Убеждаемся, что likes - это массив
  let likesArray = currentUser.likes;
  if (typeof likesArray === 'string') {
    try {
      likesArray = JSON.parse(likesArray);
    } catch (e) {
      console.warn('Ошибка парсинга likes в renderProSwipeStats:', e);
      likesArray = [];
    }
  }
  if (!Array.isArray(likesArray)) {
    likesArray = [];
  }
  const made = likesArray.length;
  subRow.innerHTML = `
    <div class="profile-likes-stats">
      <span class="likes-made-line">
        Вы: <span class="likes-made-count">${made}</span>
        <img src='/img/your_like.svg' alt='like'/>
      </span>
      <span class="likes-rec-line">
        Вам: <span class="likes-rec-count">…</span>
        <img src='/img/for_your_like.svg' alt='like'/>
      </span>
    </div>
  `;
  fetchLikesReceived(currentUser.userId)
    .then(js => {
      if (!js) return;
      if (js.success) {
        const countEl = subRow.querySelector(".likes-rec-count");
        if (countEl) countEl.textContent = js.count || 0;
      }
    })
    .catch(err => {
      console.error('Ошибка загрузки полученных лайков:', err);
      const countEl = subRow.querySelector(".likes-rec-count");
      if (countEl) countEl.textContent = '0';
    });
}

/**
 * Рендерит статистику лайков для PRO-пользователей в мэтчах
 */
function renderProMatchesStats(currentUser) {
  const subRow = document.querySelector('.matches-header .header-sub-row');
  if (!subRow) return;
  
  // Очищаем строку для всех пользователей
  subRow.innerHTML = '';
  
  // Если пользователь не PRO - не показываем статистику
  if (!currentUser.is_pro) {
    return;
  }
  
  // Проверяем срок действия Pro
  const now = Date.now();
  const isProActive = currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now;
  
  if (!isProActive) {
    return;
  }
  
  // Показываем статистику только для активных PRO пользователей
  // Убеждаемся, что likes - это массив
  let likesArray = currentUser.likes;
  if (typeof likesArray === 'string') {
    try {
      likesArray = JSON.parse(likesArray);
    } catch (e) {
      console.warn('Ошибка парсинга likes в renderProMatchesStats:', e);
      likesArray = [];
    }
  }
  if (!Array.isArray(likesArray)) {
    likesArray = [];
  }
  const made = likesArray.length;
  subRow.innerHTML = `
    <div class="matches-likes-stats">
      <span class="likes-made-line">
        Вы: <span class="likes-made-count">${made}</span>
        <img src='/img/your_like.svg' alt='like'/>
      </span>
      <span class="likes-rec-line">
        Вам: <span class="likes-rec-count">…</span>
        <img src='/img/for_your_like.svg' alt='like'/>
      </span>
    </div>
  `;
  fetchLikesReceived(currentUser.userId)
    .then(js => {
      if (!js) return;
      if (js.success) {
        const countEl = subRow.querySelector(".likes-rec-count");
        if (countEl) countEl.textContent = js.count || 0;
      }
    })
    .catch(err => {
      console.error('Ошибка загрузки полученных лайков:', err);
      const countEl = subRow.querySelector(".likes-rec-count");
      if (countEl) countEl.textContent = '0';
    });
}

/**
 * Проверяет, нужно ли показать PRO-бейдж в заголовке
 */
function toggleProLayout() {
  const avatarFrame = document.querySelector("#screen-swipe .ava-frame");
  if (!avatarFrame) return;

  if (document.querySelector("#screen-swipe .header-pro-badge")) {
    avatarFrame.classList.add("has-pro");
  } else {
    avatarFrame.classList.remove("has-pro");
  }
}

/**
 * Обновляет PRO-статус пользователя
 */
function updateProStatus(user, isPro, proEnd) {
  user.is_pro = isPro;
  user.pro_end = proEnd;
}

/**
 * Инициализирует PRO-функционал для всех экранов
 */
function initProFeatures(currentUser) {
  setProClass(currentUser);
  renderProBadge(currentUser);
  renderProInfo(currentUser);
  
  // Очищаем статистику лайков перед рендерингом (на случай, если она была в HTML)
  const profileSubRow = document.querySelector('.profile-header .header-sub-row');
  const matchesSubRow = document.querySelector('.matches-header .header-sub-row');
  const swipeSubRow = document.querySelector('.cards-header .header-sub-row');
  if (profileSubRow) profileSubRow.innerHTML = '';
  if (matchesSubRow) matchesSubRow.innerHTML = '';
  if (swipeSubRow) swipeSubRow.innerHTML = '';
  
  // Рендерим статистику только для PRO пользователей
  renderProLikesStats(currentUser);
  renderProMatchesStats(currentUser);
  renderProSwipeStats(currentUser);
  toggleProLayout();
}

function setProClass(currentUser) {
  const now = Date.now();
  if (currentUser.is_pro && currentUser.pro_end && new Date(currentUser.pro_end).getTime() > now) {
    document.body.classList.add('is-pro');
    console.log('PRO mode enabled, pro.css active');
  } else {
    document.body.classList.remove('is-pro');
    console.log('PRO mode disabled, pro.css inactive');
  }
} 

// Делаем функции глобальными
window.renderProBadge = renderProBadge;
window.renderProInfo = renderProInfo;
window.renderProLikesStats = renderProLikesStats;
window.renderProMatchesStats = renderProMatchesStats;
window.renderProSwipeStats = renderProSwipeStats;
window.toggleProLayout = toggleProLayout;
window.updateProStatus = updateProStatus;
window.initProFeatures = initProFeatures;

// Экспортируем объект pro
export const pro = { updateProStatus };

export { 
  renderProBadge,
  renderProInfo,
  renderProLikesStats,
  renderProMatchesStats,
  renderProSwipeStats,
  toggleProLayout,
  updateProStatus,
  initProFeatures
}; 