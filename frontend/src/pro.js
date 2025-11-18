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

  // Если пользователь PRO — создаём бейдж (если ещё нет) и включаем колонку
  if (currentUser.is_pro) {
    if (!proContainer.querySelector(".header-pro-badge")) {
      const badge = document.createElement("span");
      badge.className = "header-pro-badge";
      badge.textContent = "PRO";
      proContainer.insertBefore(badge, headerName);
    }
    avaFrame.classList.add("has-pro");
  } else {
    // Убираем бейдж и колонку, если не PRO
    const existingBadge = proContainer.querySelector(".header-pro-badge");
    if (existingBadge) existingBadge.remove();
    avaFrame.classList.remove("has-pro");
  }
}

/**
 * Рендерит PRO-информацию в профиле
 */
function renderProInfo(currentUser) {
  // Profile
  const profileProInfo = document.querySelector('.profile-header .header-pro-info');
  if (profileProInfo) {
    profileProInfo.innerHTML = '';
    if (currentUser.is_pro) {
      const now = new Date();
      const end = new Date(currentUser.pro_end);
      const days = Math.max(0, Math.ceil((end - now) / (1000*60*60*24)));
      profileProInfo.innerHTML = `<strong>PRO</strong> ${days} дн.`;
    } else {
      // Показываем "Купить PRO" для не-PRO пользователей
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
    if (currentUser.is_pro) {
      const now = new Date();
      const end = new Date(currentUser.pro_end);
      const days = Math.max(0, Math.ceil((end - now) / (1000*60*60*24)));
      matchesProInfo.innerHTML = `<strong>PRO</strong> ${days} дн.`;
    } else {
      // Показываем "Купить PRO" для не-PRO пользователей
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
  if (window.viewingCandidate || !currentUser.is_pro) return;
  const subRow = document.querySelector('.profile-header .header-sub-row');
  if (!subRow) return;
  subRow.innerHTML = '';
  const made = currentUser.likes.length;
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
      if (js.success) subRow.querySelector(".likes-rec-count").textContent = js.count;
    });
}

/**
 * Рендерит статистику лайков для PRO-пользователей в мэтчах
 */
function renderProMatchesStats(currentUser) {
  if (!currentUser.is_pro) return;
  const subRow = document.querySelector('.matches-header .header-sub-row');
  if (!subRow) return;
  subRow.innerHTML = '';
  const made = currentUser.likes.length;
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
      if (js.success) subRow.querySelector(".likes-rec-count").textContent = js.count;
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
  renderProLikesStats(currentUser);
  renderProMatchesStats(currentUser);
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
  toggleProLayout,
  updateProStatus,
  initProFeatures
}; 