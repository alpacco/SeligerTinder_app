// card.js — универсальные функции для работы с карточкой кандидата/профиля/матча
// Экспортируются: fillCard, renderCardPaginator, hideBadges, renderCardGoals

import { fetchGoals } from './api.js';
import { renderPaginator } from './utils.js';
import { renderProfileFooter } from './profile.js';

/**
 * Заполняет DOM-элемент карточки данными пользователя/кандидата/матча
 * @param {HTMLElement} cardEl — DOM-элемент карточки
 * @param {Object} data — объект с данными (userId, name, age, photos, badge, bio, goals и т.д.)
 * @param {Object} [options] — дополнительные опции (например, showBadges, showDeleteMatchBtn, onDeleteMatch)
 */
export function fillCard(cardEl, data, options = {}) {
  if (!cardEl || !data) return;
  // Универсальный рендер фото
  let validPhotos = (data.photos || []).filter(u => u && u.trim() !== "");
  if (validPhotos.length === 0) validPhotos = ["/img/photo.svg"];
  const rawPhoto = validPhotos[0];
  let finalPhotoUrl;
  if (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:')) {
    finalPhotoUrl = rawPhoto;
  } else if (rawPhoto.startsWith('/data/img/')) {
    finalPhotoUrl = rawPhoto;
  } else if (rawPhoto === '/img/photo.svg') {
    // Заглушка для отсутствующих фото
    finalPhotoUrl = rawPhoto;
  } else {
    const filename = rawPhoto.split('/').pop();
    finalPhotoUrl = `/data/img/${data.userId || data.id}/${filename}`;
  }
  cardEl.style.position = "relative";
  cardEl.style.backgroundImage = `url(${finalPhotoUrl})`;
  cardEl.style.backgroundSize = "cover";
  cardEl.style.backgroundPosition = "center";
  cardEl.style.backgroundRepeat = "no-repeat";

  // Рендер пагинатора только если больше одного фото
  const paginator = cardEl.parentElement?.querySelector('.paginator');
  if (paginator) {
    if (validPhotos.length <= 1) {
      paginator.style.display = 'none';
    } else {
      paginator.style.display = 'flex';
      renderCardPaginator(paginator, validPhotos.length, 0);
    }
  }

  // Рендер бейджа
  if (data.badge && options.showBadges !== false) {
    const badgeWrapper = cardEl.querySelector('.badge-wrapper');
    
    if (badgeWrapper) {
      badgeWrapper.style.display = 'flex';
      const badgeImage = badgeWrapper.querySelector('.badge-image');
      
      if (badgeImage) {
        const badgePath = `/img/labels/${data.badge}.svg`;
        badgeImage.src = badgePath;
      }
    } else {
      console.warn('[card.js] badge-wrapper не найден в карточке');
    }
  } else {
    const badgeWrapper = cardEl.querySelector('.badge-wrapper');
    if (badgeWrapper) {
      console.log('[card.js] Скрываем badge-wrapper');
      badgeWrapper.style.display = 'none';
    }
  }

  // Рендер целей
  if (data.userId || data.id) {
    renderCardGoals(cardEl, data.userId || data.id);
  }

  // Рендер футтера для кандидатов (не для своего профиля)
  if (options.showFooter && !options.isOwnProfile) {
    renderProfileFooter(cardEl.parentElement, data, options);
  }

  cardEl.dataset.photos = JSON.stringify(validPhotos);
  cardEl.dataset.photoIndex = "0";
  cardEl.dataset.userId = data.userId || data.id;

  // Универсальный HTML карточки
  cardEl.innerHTML = `
    <div class="gradient-card"></div>
    <div class="candidate-goals"></div>
    <div class="user-info">
      ${data.badge ? `<div class="badge-wrapper"><img src="/img/labels/${data.badge}.svg" class="badge-image"></div>` : ""}
      <div class="name-age-container">
        <span class="user-name">${data.name || ""}</span>
        ${(!window.currentUser?.hideAge && data.age) ? `<span class="user-age">${data.age} лет</span>` : ""}
      </div>
      <p class="user-bio">${data.bio || ""}</p>
      ${validPhotos.length > 1 ? '<div class="paginator"></div>' : ''}
    </div>
    <div class="card-badge badge-like">😍</div>
    <div class="card-badge badge-nope">🚫</div>
    <div class="card-badge badge-match">❤️‍🔥</div>
    ${options.showDeleteMatchBtn ? `<button class="delete-match-btn">Удалить мэтч</button>` : ""}
  `;

  // После innerHTML — рендерим цели
  if (data.userId || data.id) {
    renderCardGoals(cardEl, data.userId || data.id);
  }

  // После innerHTML — рендерим/скрываем пагинатор
  if (validPhotos.length > 1) {
    const paginatorEl = cardEl.querySelector('.paginator');
    paginatorEl.style.display = 'flex';
    renderCardPaginator(paginatorEl, validPhotos.length, parseInt(cardEl.dataset.photoIndex || '0', 10));
  }

  // Переключение фото по клику обрабатывается в setupSwipeHandlers()
  // Не устанавливаем onclick здесь, чтобы избежать конфликтов с обработчиками свайпа

  // Кнопка удаления мэтча (если нужно)
  if (options.showDeleteMatchBtn) {
    const btn = cardEl.querySelector('.delete-match-btn');
    if (btn && typeof options.onDeleteMatch === 'function') {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onDeleteMatch(data);
      });
    }
  }
}

/**
 * Рендерит цели (goals) в карточке
 * @param {HTMLElement} cardEl — DOM-элемент карточки
 * @param {string} userId — ID пользователя для загрузки целей
 */
export function renderCardGoals(cardEl, userId) {
  if (!cardEl || !userId) return;
  
  const goalsContainer = cardEl.querySelector('.candidate-goals');
  if (!goalsContainer) return;

  goalsContainer.classList.add('left');
  goalsContainer.innerHTML = '';
  
  fetchGoals(userId)
    .then(json => {
      if (json && json.success && Array.isArray(json.goals) && json.goals.length > 0) {
        goalsContainer.innerHTML = '';
        json.goals.forEach(goal => {
          const tag = document.createElement('div');
          tag.className = 'goal-tag';
          tag.textContent = goal;
          goalsContainer.appendChild(tag);
        });
      } else {
        goalsContainer.innerHTML = '';
      }
    })
    .catch(err => {
      console.error('Ошибка получения целей кандидата:', err);
      goalsContainer.innerHTML = '';
    });
}

/**
 * Рендерит пагинатор (точки/полоски) под фото
 * @param {HTMLElement} paginatorEl — контейнер пагинатора
 * @param {number} total — всего фото
 * @param {number} current — индекс активного фото
 */
export function renderCardPaginator(paginatorEl, total, current) {
  if (!paginatorEl) return;
  paginatorEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = (i === current ? 'pag_active' : 'pag');
    paginatorEl.appendChild(dot);
  }
}

/**
 * Скрывает бейджи 'LIKE' и 'NOPE' на карточке
 * @param {HTMLElement} card — DOM-элемент карточки
 */
export function hideBadges(card) {
  if (!card) return;
  const likeB = card.querySelector('.badge-like');
  const nopeB = card.querySelector('.badge-nope');
  if (likeB) { likeB.style.opacity = 0; likeB.style.fontSize = '64px'; }
  if (nopeB) { nopeB.style.opacity = 0; nopeB.style.fontSize = '64px'; }
}

// Здесь можно добавить другие универсальные функции для карточки (например, анимации, отображение бейджей, кнопок и т.д.) 