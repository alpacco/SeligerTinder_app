// Модуль match.js: ВСЯ ЛОГИКА ЭКРАНА MATCHES и профилей мэтчей
// Экспортируемые функции:
// - renderMatches, showCandidateProfile, updateMatchesScreen

import { renderPaginator } from './utils.js';
import { openChat, shareInvite, customRenderPaginator } from './swipe.js';
import { showGiftModal, hideGiftModal, showToast, handleGiftOrder } from './gift.js';
import { getMatches, sendPush, sendDislike, fetchGoals } from './api.js';
import { renderProfileFooter } from './profile.js';
import { renderCardGoals } from './card.js';

/**
 * Формирует правильный URL для аватара пользователя
 * @param {Object} match - объект мэтча
 * @returns {string} - URL аватара
 */
function getAvatarUrl(match) {
  let photoUrl = match.avatar || '/img/logo.svg';
  
  // Если это уже полный URL или заглушка, возвращаем как есть
  if (photoUrl.startsWith('http') || photoUrl.startsWith('data:') || 
      photoUrl === '/img/logo.svg' || photoUrl === '/img/photo.svg') {
    return photoUrl;
  }
  
  // Если это путь к файлу, формируем правильный URL
  if (photoUrl.startsWith('/data/img/')) {
    return photoUrl;
  }
  
  // Иначе формируем путь к файлу в папке пользователя
  const filename = photoUrl.split('/').pop();
  const userId = match.userId || match.id;
  return `/data/img/${userId}/${filename}`;
}

/**
 * Отрисовка экрана Matches
 */
export async function renderMatches() {
  console.log('[match.js] renderMatches called');
  const matchesListEl = document.getElementById('matches-list');
  if (!matchesListEl) {
    return;
  }
  matchesListEl.innerHTML = '';
  try {
    const resp = await getMatches(window.currentUser.userId);
    const json = await resp;
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      matchesListEl.innerHTML = `
        <div class="no-matches invite-wrapper">
          <p>Нет матчей</p>
          <button id="invite-matches" class="invite-button">Пригласить</button>
        </div>`;
      document.getElementById('invite-matches').addEventListener('click', shareInvite);
      return;
    }
    // Фильтрация уникальных пользователей по userId
    const unique = {};
    const uniqueData = json.data.filter(m => {
      if (unique[m.userId]) return false;
      unique[m.userId] = true;
      return true;
    });
    uniqueData.forEach(m => {
      const { id, userId, name, avatar, username, pushSent, superLikeStatus } = m;
      
      // Build main row with user info and actions in one line
      let actionsHTML = '';
      const candidateId = m.userId || m.id || "";
      // Кнопка подарков удалена
      if (superLikeStatus !== 'pending') {
        // Кнопка НАПИСАТЬ только для VALID_ и username
        if (candidateId.startsWith('VALID_') && username) {
          actionsHTML += `<button class="match-write-btn">НАПИСАТЬ</button>`;
        } else {
          if (pushSent) {
            actionsHTML += `<button class="match-push-btn" disabled>ВЫ ПОМАХАЛИ</button>`;
          } else {
            actionsHTML += `<button class="match-push-btn">ПОМAХАТЬ</button>`;
          }
        }
      }
      
      const mainRowHTML = `
        <div class="match-main-row">
          <div class="match-user">
            <img class="match-avatar" src="${getAvatarUrl(m) || '/img/logo.svg'}" alt="${name}" />
            <span class="match-name">${name}</span>
          </div>
          <div class="match-actions">${actionsHTML}</div>
        </div>`;
      
      // Build status section
      let statusSection = '';
      if (superLikeStatus === 'pending') {
        statusSection = `
          <div class="superlike-message pending superlike-banner">
            <span class="superlike-banner-icon">
              <svg class="superlike-icon" width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g><path class="st0" d="M36.7,48.8c0-0.2,0.2-0.4,0.3-0.6c2.6-2.3,2.7-6.5,0.7-9.3c-0.8-1.2-1.9-2.1-3-3c-1.6-1.5-2.4-3.4-2.5-5.6c0-0.2,0-0.4-0.2-0.5c-0.2-0.1-0.3,0.1-0.4,0.3c-2,2.1-3.1,4.6-3.3,7.5c-0.1,0.8-0.1,1.6,0,2.4c0,0.3,0,0.3-0.3,0.2c-0.8-0.3-1.2-0.9-1.5-1.7c-0.1-0.2-0.1-0.6-0.4-0.7c-0.3,0-0.4,0.3-0.6,0.6c-0.5,0.9-0.8,2-0.9,3c-0.1,1.5,0,3,0.6,4.4c0.5,1.1,1.3,1.9,2.2,2.7c0.1,0.1,0.4,0.2,0.3,0.4c-0.1,0.3-0.4,0.1-0.6,0c-2.3-0.7-4.1-2-5.6-3.8c-1.9-2.4-2.7-5.1-2.5-8.2c0.2-1.7,0.7-3.2,1.6-4.7c1.6-2.5,3.4-4.9,5.5-7.1c1.3-1.4,2.3-2.9,2.9-4.7c0.6-2,0.5-4,0-6c-0.1-0.3-0.2-0.6-0.1-1c0.6,0.2,1.1,0.6,1.7,0.9c3.1,1.9,5.4,4.4,6.5,7.9c0.7,2,0.8,4,0.5,6.1C37.6,29,37.6,29,38,29c0.7-0.2,1.1-0.5,1.5-1.1c0.3-0.5,0.5-1,0.7-1.6c0.1-0.4,0.2-0.4,0.5-0.2c1.3,0.9,2.2,2.2,2.9,3.6c1.3,2.7,1.9,5.6,1.6,8.6c-0.4,4.3-2.5,7.5-6.1,9.8C38.3,48.6,37.5,48.9,36.7,48.8z"/></g></svg>
            </span>
            <span class="superlike-banner-text">Вы отправили Супер-лайк, пользователь обязательно увидит вашу анкету первой!</span>
          </div>`;
      } else if (superLikeStatus === 'rejected') {
        statusSection = `
          <div class="superlike-message failed">
            <p class="status-text">К сожалению, пользователь не ответил взаимностью…</p>
            <button class="status-button">OK</button>
          </div>`;
      }
      
      // Assemble card
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = mainRowHTML + statusSection;
      // Attach handlers
      const writeBtn = card.querySelector('.match-write-btn');
      if (writeBtn) writeBtn.addEventListener('click', () => {
        openChat && openChat(username);
      });
      const pushBtn = card.querySelector('.match-push-btn');
      if (pushBtn && !pushBtn.disabled) pushBtn.addEventListener('click', async () => {
        pushBtn.disabled = true;
        pushBtn.textContent = 'ВЫ ПОМАХАЛИ';
        const jsonPush = await sendPush({ senderId: window.currentUser.userId, senderUsername: window.currentUser.username || window.currentUser.name, receiverId: id });
        if (!jsonPush.success) {
          pushBtn.textContent = 'ПОМAХАТЬ';
          pushBtn.disabled = false;
        }
      });
      // Кнопка подарков удалена
      card.querySelectorAll('.status-button').forEach(b =>
        b.addEventListener('click', () => {
          const msg = card.querySelector('.superlike-message');
          if (msg) msg.remove();
        })
      );
      // Добавляем обработчик клика на карточку пользователя для перехода в профиль
      const userSection = card.querySelector('.match-user');
      if (userSection) {
        userSection.style.cursor = 'pointer';
        userSection.addEventListener('click', () => {
          showCandidateProfile(m);
        });
      }
      matchesListEl.appendChild(card);
    });
  } catch (err) {
    console.error('renderMatches error:', err);
    matchesListEl.innerHTML = '<p class="no-matches">Ошибка загрузки матчей</p>';
  }
}

/**
 * Показать профиль кандидата из Matches
 * @param {Object} match - объект мэтча
 */
export async function showCandidateProfile(match) {
  console.log('[match.js] showCandidateProfile called for:', match);
  window.viewingCandidate = match; // Устанавливаем состояние: сейчас смотрим кандидата
  // 1. ЗАГРУЗКА ДАННЫХ
  try {
    const url = `${window.API_URL}/user?userId=${match.id}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Server returned status ${resp.status}`);
    const json = await resp.json();
    if (json.success && json.data) {
      const d = json.data;
      match.bio = d.bio || "";
      match.age = d.age || null;
      match.photos = [d.photo1, d.photo2, d.photo3].filter(p => p);
      match.badge = d.badge || "";
    }
  } catch (err) {
    console.error("Ошибка загрузки данных кандидата:", err);
  }

  // 2. ПОДГОТОВКА И РЕНДЕР DOM
  const profileScreen = document.getElementById('screen-profile');
  const pic = document.getElementById("profileCard");
  const userInfo = document.querySelector("#screen-profile .user-info");
  const headerTitle = document.querySelector('#screen-profile .profile-header h2');
  const nameEl = document.querySelector("#screen-profile .name-age-container .user-name");
  const ageEl = document.querySelector("#screen-profile .name-age-container .user-age");
  const bioEl = userInfo.querySelector(".user-bio");
  let paginatorEl = userInfo.querySelector(".paginator");
  
  // Создаем пагинатор, если его нет
  if (!paginatorEl && userInfo) {
    paginatorEl = document.createElement('div');
    paginatorEl.className = 'paginator';
    userInfo.appendChild(paginatorEl);
  }

  // Удаляем блок статистики лайков, если он есть (чтобы не было на чужих профилях)
  const oldStats = document.querySelector('#screen-profile .profile-likes-stats');
  if (oldStats) oldStats.remove();

  // Сброс и рендер
  if (pic) {
    pic.querySelectorAll('.candidate-goals').forEach(el => el.remove());
    // Рендерим фото кандидата вручную, без fillCard чтобы избежать конфликта обработчиков
    const photosArr = match.photos || [];
    if (photosArr.length > 0) {
      const photoUrl = photosArr[0];
      const finalUrl = photoUrl.startsWith('data:') ? photoUrl : `${photoUrl}?cb=${Date.now()}`;
      pic.style.backgroundImage = `url('${finalUrl}')`;
    }
    
    // Создаем контейнер для целей, если его нет
    let goalsContainer = pic.querySelector('.candidate-goals');
    if (!goalsContainer) {
      goalsContainer = document.createElement('div');
      goalsContainer.className = 'candidate-goals left';
      pic.appendChild(goalsContainer);
    }
    
    // Рендерим цели кандидата
    renderCardGoals(pic, match.id);
  }
  if (paginatorEl) paginatorEl.innerHTML = '';
  if (headerTitle) headerTitle.textContent = 'Ваш Match';
  // ПОКАЗ LAST LOGIN для PRO-пользователей (с учетом срока действия)
  const now = Date.now();
  const isProActive = window.currentUser && 
    (window.currentUser.is_pro === true || window.currentUser.is_pro === 'true' || window.currentUser.is_pro === 1) &&
    window.currentUser.pro_end && 
    new Date(window.currentUser.pro_end).getTime() > now;
  
  console.log('[match.js] Проверка PRO для last login:', {
    isProActive,
    is_pro: window.currentUser?.is_pro,
    pro_end: window.currentUser?.pro_end,
    now: new Date(now).toISOString(),
    pro_end_time: window.currentUser?.pro_end ? new Date(window.currentUser.pro_end).toISOString() : null
  });
  
  if (isProActive) {
    console.log('[match.js] PRO активен, показываем last login');
    const headerSelector = '#screen-profile .profile-header';
    // Используем match.id или match.userId, так как match передается напрямую
    const userIdForLastLogin = match.id || match.userId || window.viewingCandidate?.id || window.viewingCandidate?.userId;
    console.log('[match.js] Показываем last login для userId:', userIdForLastLogin, 'match:', match);
    const header = document.querySelector(headerSelector);
    console.log('[match.js] header найден:', !!header);
    if (header) {
      const subRow = header.querySelector('.header-sub-row');
      console.log('[match.js] subRow найден:', !!subRow);
      if (subRow) {
        // Удаляем старую статистику лайков, если она есть (чтобы не конфликтовала с last login)
        const oldStats = subRow.querySelector('.profile-likes-stats');
        if (oldStats) oldStats.remove();
        
        const old = subRow.querySelector('.candidate-last-login');
        if (old) old.remove();
        const el = document.createElement('div');
        el.className = 'candidate-last-login';
        el.style.textAlign = 'center';
        el.style.color = 'var(--color-white)';
        el.style.fontSize = 'var(--font-size-sm)';
        el.textContent = 'Загрузка...';
        subRow.appendChild(el);
        console.log('[match.js] Элемент создан и добавлен в DOM');
        if (userIdForLastLogin) {
          console.log('[match.js] Загружаем last login для userId:', userIdForLastLogin, 'URL:', `${window.API_URL}/last-login/${userIdForLastLogin}`);
          fetch(`${window.API_URL}/last-login/${userIdForLastLogin}`)
           .then(r => {
             console.log('[match.js] Ответ от API:', r.status, r.ok);
             if (!r.ok) {
               console.error('[match.js] Ошибка загрузки last login:', r.status);
               throw new Error(`Status ${r.status}`);
             }
             return r.json();
           })
           .then(js => {
             console.log('[match.js] Получен ответ last login:', js);
             const lastLoginTime = js.lastLogin;
            if (lastLoginTime) {
              const dt = new Date(lastLoginTime);
              const now = new Date();
              const diffH = (now - dt) / (1000 * 60 * 60);
              let timeText;
              if      (diffH < 24)    timeText = 'сегодня';
              else if (diffH < 48)    timeText = 'вчера';
              else if (diffH < 24*7)  timeText = `${Math.floor(diffH/24)} дня назад`;
              else                    timeText = 'неделю назад';
              let verb;
              if (window.currentUser.gender === 'male') verb = 'Была';
              else if (window.currentUser.gender === 'female') verb = 'Был';
              else verb = ((match.gender || window.viewingCandidate?.gender) === 'female' ? 'Была' : 'Был');
              el.textContent = `${verb} ${timeText}`;
              console.log('[match.js] Текст установлен:', el.textContent);
            } else {
              console.log('[match.js] lastLoginTime отсутствует в ответе');
              el.textContent = '—';
            }
          })
          .catch((err) => { 
            console.error('[match.js] Ошибка при загрузке last login:', err);
            el.textContent = '—'; 
          });
        } else {
          console.warn('[match.js] userIdForLastLogin отсутствует, match:', match);
          el.textContent = '—';
        }
      } else {
        console.warn('[match.js] header-sub-row не найден в header');
      }
    } else {
      console.warn('[match.js] header не найден, selector:', headerSelector);
    }
  } else {
    console.log('[match.js] Пользователь не PRO или срок истек, не показываем last login', {
      is_pro: window.currentUser?.is_pro,
      pro_end: window.currentUser?.pro_end,
      now: new Date(now).toISOString(),
      pro_end_time: window.currentUser?.pro_end ? new Date(window.currentUser.pro_end).toISOString() : null
    });
  }
  if (nameEl) nameEl.textContent = match.name;
  if (ageEl) {
    ageEl.textContent = match.age ? `${match.age} лет` : "";
    ageEl.style.display = match.age ? "" : "none";
  }
  if (bioEl) bioEl.textContent = match.bio || "";
  userInfo.querySelector(".badge-wrapper")?.remove();
  if (match.badge && match.badge.trim()) {
    const badgeDiv = document.createElement("div");
    badgeDiv.className = "badge-wrapper";
    // Нормализуем badge: убираем пути, слэши и расширения
    let badgeName = String(match.badge).trim();
    badgeName = badgeName.replace(/^.*\//, ''); // Убираем все до последнего слэша
    badgeName = badgeName.replace(/\.svg$/i, ''); // Убираем расширение .svg если есть
    badgeName = badgeName.replace(/[\/\\\.]+/g, ''); // Убираем лишние точки и слэши
    badgeDiv.innerHTML = `<img src="/img/labels/${badgeName}.svg" class="badge-image">`;
    userInfo.prepend(badgeDiv);
  }

  // 3. ИНТЕРАКТИВНОСТЬ: ПЕРЕКЛЮЧЕНИЕ ФОТО
  const photosArr = match.photos || [];
  let candPhotoIndex = 0;
  if (photosArr.length > 1) {
    if (pic) pic.style.cursor = 'pointer';
    // Используем customRenderPaginator из swipe.js для корректной работы
    if (paginatorEl) {
      customRenderPaginator(paginatorEl, photosArr.length, 0);
    }
    if (pic) pic.onclick = () => {
      candPhotoIndex = (candPhotoIndex + 1) % photosArr.length;
      pic.style.backgroundImage = `url('${photosArr[candPhotoIndex]}?cb=${Date.now()}')`;
      // Обновляем пагинатор при переключении фото
      if (paginatorEl) {
        customRenderPaginator(paginatorEl, photosArr.length, candPhotoIndex);
      }
    };
  }

  // 4. ПОКАЗ ЭКРАНА
  window.showScreen && window.showScreen('screen-profile');

  // 5. ИНТЕРАКТИВНОСТЬ: КНОПКИ
  const editBtn = document.getElementById("edit-profile-button");
  if (editBtn) editBtn.style.display = 'none';
  // Рендерим универсальный футтер кандидата
  const profileContainer = document.querySelector('#screen-profile .profile-container');
  renderProfileFooter(match, profileContainer);

  let deleteBtn = document.getElementById("candidate-delete-btn");
  if (deleteBtn) deleteBtn.remove();
  deleteBtn = document.createElement("button");
  deleteBtn.id = "candidate-delete-btn";
  deleteBtn.className = "delete-match-btn";
  deleteBtn.innerHTML = `<img src="/img/unlike.svg" alt="Удалить" width="24" height="24" /> Удалить Мэтч`;
  if (pic) pic.appendChild(deleteBtn);
  deleteBtn.addEventListener("click", async () => {
    try {
      // Delete match via API so candidate no longer appears in Matches
      await fetch(`${window.API_URL}/matches`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: window.currentUser.userId, matchId: match.id })
      });
      // Снимаем лайк (если был)
      await fetch(`${window.API_URL}/like`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUser: window.currentUser.userId, toUser: match.id })
      });
      // Ставим дизлайк
      await sendDislike(window.currentUser.userId, match.id);
      await window.renderMatches && window.renderMatches();
      window.showScreen && window.showScreen("screen-matches");
      window.updateMatchesCount && window.updateMatchesCount();
    } catch (err) {
      console.error("Ошибка удаления из матчей:", err);
      window.Telegram?.WebApp?.showAlert("Не удалось удалить из Мэтчей");
    }
  });
}

// Все вызовы showGiftModal/hideGiftModal теперь через импортированные функции
// Если есть логика заказа подарка или тостов — выношу в gift.js и импортирую здесь

/**
 * Обновление экрана Matches (заглушка, если потребуется логика — реализовать здесь)
 */
export function updateMatchesScreen() {
  console.log("▶ updateMatchesScreen() (from match.js)");
}

// Здесь будут появляться остальные функции по мере рефакторинга 