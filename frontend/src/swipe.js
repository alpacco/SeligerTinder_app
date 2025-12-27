// Модуль swipe.js: ВСЯ ЛОГИКА СВАЙПОВ, анимаций, обработчиков свайпов, кнопок и спец.событий
// Версия модуля для отладки кэша
const SWIPE_MODULE_VERSION = '2025-01-27-match-badge-like-animation-fix-v8';
console.log('🔄 [CACHE] swipe.js загружен, версия:', SWIPE_MODULE_VERSION);
console.log('🔄 [CACHE] swipe.js загружен, timestamp:', new Date().toISOString());
// Экспортируемые функции:
// - showPreviousCandidate, setupSwipeControls, showCandidate, fillCard, shareInvite, customHideBadges, moveToNextCandidate
// - onMutualLike, onSuperMatch, onSuperPending, onSuperRejected
// - handleLikeClick, attachLikeHandler, handleDislikeClick, attachDislikeHandler
// - openChat, showToast, customRenderPaginator, cyclePhoto, setupSwipeHandlers, updateSwipeScreen
// - updateMatchesCount, loadCandidates, loadUserData, initSwipeScreen

// Логика свайпа и кандидатов, вынесенная из main.js
import { hideBadges, renderPaginator } from './utils.js';
import { sendLike, sendDislike, sendSuperLike, sendPush, fetchGoals, fetchLikesReceived } from './api.js';
import { fillCard } from './card.js';
// Динамический импорт user-actions для избежания проблем с Vite
let loadUserData, handlePhotoAddition;
import('./user-actions.js').then(module => {
  loadUserData = module.loadUserData;
  handlePhotoAddition = module.handlePhotoAddition;
}).catch(err => {
  console.warn('Не удалось загрузить user-actions:', err);
});

// Глобальные переменные, связанные со свайпом
export let candidates = [];
export let currentIndex = 0;
export let currentPhotoIndex = 0;
export let inMutualMatch = false;
export let viewingCandidate = null;
export let swipeHistory = [];
window.swipeHistory = swipeHistory;

window.currentIndex = 0;

export function showPreviousCandidate() {
  if (window.swipeHistory.length > 0) {
    window._isBackAction = true;
    const { candidate, index } = window.swipeHistory.pop();
    window.candidates.splice(index, 0, candidate);
    window.currentIndex = index;
    const singleCard = document.getElementById("singleCard");
    fillCard(singleCard, window.candidates[window.currentIndex]);
    window.setupSwipeControls && window.setupSwipeControls();
    window.updateMatchesCount && window.updateMatchesCount();
  }
}

export function setupSwipeControls() {
  // ВАЖНО: Кнопки лайк/дизлайк уже есть в HTML footer, не создаем их здесь!
  // Эта функция создает только PRO-кнопки (Back, SuperLike) в cards-btns внутри footer
  // И устанавливает обработчики для кнопок лайк/дизлайк
  const swipeScreen = document.getElementById("screen-swipe");
  if (!swipeScreen) return;
  
  // Устанавливаем обработчики для кнопок лайк/дизлайк
  window.attachLikeHandler && window.attachLikeHandler();
  window.attachDislikeHandler && window.attachDislikeHandler();
  
  // Кнопки лайк/дизлайк находятся в footer.cards-footer > .cards-btns
  // PRO-кнопки (Back, SuperLike) добавляются в тот же .cards-btns
  const cardsFooter = swipeScreen.querySelector(".cards-footer");
  if (!cardsFooter) return;
  
  let cardsBtns = cardsFooter.querySelector(".cards-btns");
  if (!cardsBtns) {
    // Если cards-btns нет, создаем его (но кнопки лайк/дизлайк уже должны быть в HTML)
    cardsBtns = document.createElement("div");
    cardsBtns.className = "cards-btns";
    cardsFooter.appendChild(cardsBtns);
  }
  
  // Удаляем только PRO-кнопки, если они были созданы ранее
  // НЕ трогаем кнопки лайк/дизлайк - они в HTML
  const existingBackBtn = cardsBtns.querySelector(".back-cnd-btn");
  const existingSuperBtn = cardsBtns.querySelector(".superlike_d");
  if (existingBackBtn) existingBackBtn.remove();
  if (existingSuperBtn) existingSuperBtn.remove();
  
  // Проверяем, является ли пользователь PRO (с учетом срока действия, как в pro.js)
  const now = Date.now();
  const isPro = window.currentUser && 
    (window.currentUser.is_pro === true || window.currentUser.is_pro === 'true' || window.currentUser.is_pro === 1) &&
    window.currentUser.pro_end && 
    new Date(window.currentUser.pro_end).getTime() > now;
  
  // Back button for PRO users
  if (isPro) {
    const backBtn = document.createElement("button");
    backBtn.className = "back-cnd-btn";
    backBtn.innerHTML = `<svg class="back-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g><path class="st0" d="M25,30.3L25,30.3c1-1,2.6-1,3.5,0L39,40.8c1,1,1,2.6,0,3.5l0,0c-1,1-2.6,1-3.5,0L25,33.8C24,32.8,24,31.2,25,30.3z"/><path class="st0" d="M25,30.2l10.5-10.5c1-1,2.6-1,3.5,0l0,0c1,1,1,2.6,0,3.5L28.5,33.7c-1,1-2.6,1-3.5,0l0,0C24,32.8,24,31.2,25,30.2z"/></g></svg>`;
    backBtn.style.display = "flex"; // Явно показываем кнопку
    backBtn.addEventListener("click", () => {
      window.singleCard.style.transition = "transform 0.5s ease";
      window.singleCard.style.transform = "translate(-1000px, 0) rotate(-45deg)";
      setTimeout(() => {
        window.showPreviousCandidate && window.showPreviousCandidate();
        window.singleCard.style.transition = "none";
        window.singleCard.style.transform = "none";
      }, 500);
    });
    // Вставляем Back кнопку ПЕРЕД кнопками dislike и like
    const dislikeBtn = cardsBtns.querySelector(".dislike_d");
    if (dislikeBtn) {
      cardsBtns.insertBefore(backBtn, dislikeBtn);
    } else {
      cardsBtns.appendChild(backBtn);
    }
  }
  
  // Super-Like for PRO users
  if (isPro) {
    const superBtn = document.createElement("button");
    superBtn.className = "superlike_d";
    // Убеждаемся, что значение superLikesCount актуально
    console.log('[setupSwipeControls] ========== ПРОВЕРКА СУПЕРЛАЙКОВ ==========');
    console.log('[setupSwipeControls] window.currentUser:', window.currentUser);
    console.log('[setupSwipeControls] window.currentUser?.superLikesCount:', window.currentUser?.superLikesCount);
    console.log('[setupSwipeControls] typeof window.currentUser?.superLikesCount:', typeof window.currentUser?.superLikesCount);
    const superLikesCount = window.currentUser?.superLikesCount ?? 0;
    console.log('[setupSwipeControls] SuperLikes count для кнопки:', superLikesCount);
    console.log('[setupSwipeControls] superLikesCount === 0:', superLikesCount === 0);
    console.log('[setupSwipeControls] ========== КОНЕЦ ПРОВЕРКИ СУПЕРЛАЙКОВ ==========');
    superBtn.innerHTML = `<svg class="superlike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g><path class="st0" d="M36.7,48.8c0-0.2,0.2-0.4,0.3-0.6c2.6-2.3,2.7-6.5,0.7-9.3c-0.8-1.2-1.9-2.1-3-3c-1.6-1.5-2.4-3.4-2.5-5.6c0-0.2,0-0.4-0.2-0.5c-0.2-0.1-0.3,0.1-0.4,0.3c-2,2.1-3.1,4.6-3.3,7.5c-0.1,0.8-0.1,1.6,0,2.4c0,0.3,0,0.3-0.3,0.2c-0.8-0.3-1.2-0.9-1.5-1.7c-0.1-0.2-0.1-0.6-0.4-0.7c-0.3,0-0.4,0.3-0.6,0.6c-0.5,0.9-0.8,2-0.9,3c-0.1,1.5,0,3,0.6,4.4c0.5,1.1,1.3,1.9,2.2,2.7c0.1,0.1,0.4,0.2,0.3,0.4c-0.1,0.3-0.4,0.1-0.6,0c-2.3-0.7-4.1-2-5.6-3.8c-1.9-2.4-2.7-5.1-2.5-8.2c0.2-1.7,0.7-3.2,1.6-4.7c1.6-2.5,3.4-4.9,5.5-7.1c1.3-1.4,2.3-2.9,2.9-4.7c0.6-2,0.5-4,0-6c-0.1-0.3-0.2-0.6-0.1-1c0.6,0.2,1.1,0.6,1.7,0.9c3.1,1.9,5.4,4.4,6.5,7.9c0.7,2,0.8,4,0.5,6.1C37.6,29,37.6,29,38,29c0.7-0.2,1.1-0.5,1.5-1.1c0.3-0.5,0.5-1,0.7-1.6c0.1-0.4,0.2-0.4,0.5-0.2c1.3,0.9,2.2,2.2,2.9,3.6c1.3,2.7,1.9,5.6,1.6,8.6c-0.4,4.3-2.5,7.5-6.1,9.8C38.3,48.6,37.5,48.9,36.7,48.8z"/></g></svg> <span id='superlike-count' class='superlike-count'>${superLikesCount}</span>`;
    superBtn.disabled = superLikesCount <= 0;
    superBtn.style.display = "flex"; // Явно показываем кнопку
    superBtn.addEventListener("click", async () => {
      try {
        const receiverId = window.singleCard.dataset.userId;

        
        // Отправляем суперлайк
        const superJson = await sendSuperLike(window.currentUser.userId, receiverId);

        
        if (superJson && superJson.success) {
          window.currentUser.superLikesCount--;
          let sent = JSON.parse(localStorage.getItem('sentSuperLikes') || '[]');
          sent.push(receiverId);
          localStorage.setItem('sentSuperLikes', JSON.stringify(sent));
          window.currentUser.likes.push(receiverId);

          
          // Отправляем обычный лайк
          try {
            const likeJson = await sendLike(window.currentUser.userId, receiverId);

            
            // Обновляем счетчик
          document.getElementById('superlike-count').textContent = String(window.currentUser.superLikesCount);
          localStorage.setItem('superLikesCount', String(window.currentUser.superLikesCount));
            
          if (window.currentUser.superLikesCount <= 0) {
            superBtn.disabled = true;
            }
            
            // Проверяем, есть ли взаимный лайк
            if (likeJson && (likeJson.isMatch || superJson.mutual)) {

              window.onMutualLike && window.onMutualLike();
            } else if (superJson.status === "pending") {

              window.onSuperPending && window.onSuperPending();
            } else {

              // Обычный переход к следующему кандидату
              window.moveToNextCandidate && window.moveToNextCandidate('right');
            }
          } catch (err) {

            window.moveToNextCandidate && window.moveToNextCandidate('right');
          }
        }
      } catch (e) {

        window.showToast && window.showToast('Ошибка при отправке суперлайка');
      }
    });
    // Вставляем SuperLike кнопку ПОСЛЕ кнопки like
    // Порядок должен быть: Назад Дизлайк Лайк СуперЛайк
    const likeBtn = cardsBtns.querySelector(".like_d");
    if (likeBtn && likeBtn.nextSibling) {
      // Вставляем после кнопки like
      cardsBtns.insertBefore(superBtn, likeBtn.nextSibling);
    } else if (likeBtn) {
      // Если nextSibling нет, добавляем в конец
      cardsBtns.appendChild(superBtn);
    } else {
      // Если кнопки like нет, добавляем в конец
      cardsBtns.appendChild(superBtn);
    }
  }
}

export function showCandidate() {
  console.log('🔄 [showCandidate] ВЫЗВАН, версия:', SWIPE_MODULE_VERSION);
  
  // КРИТИЧНО: Сбрасываем кнопки ПЕРЕД всеми проверками
  const dislikeBtn = document.querySelector(".dislike_d");
  const likeBtn = document.querySelector(".like_d");
  
  console.log('🔵 [showCandidate] Начало функции, кнопки найдены:', {
    dislikeBtn: !!dislikeBtn,
    likeBtn: !!likeBtn,
    inMutualMatch: window.inMutualMatch
  });
  
  // КРИТИЧНО: Проверяем кнопку ДО всех операций и логируем её состояние
  if (dislikeBtn) {
    const currentWaveBtn = dislikeBtn.classList.contains('wave-btn');
    const currentChatBtn = dislikeBtn.classList.contains('chat-btn');
    const currentWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
    const currentChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
    console.log('🔵 [showCandidate] ТЕКУЩЕЕ состояние кнопки:', {
      currentWaveBtn,
      currentChatBtn,
      currentWaveSvg,
      currentChatSvg,
      className: dislikeBtn.className,
      innerHTML: dislikeBtn.innerHTML.substring(0, 150)
    });
  }
  
  if (dislikeBtn) {
    const hadWaveBtn = dislikeBtn.classList.contains('wave-btn');
    const hadChatBtn = dislikeBtn.classList.contains('chat-btn');
    const hadWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
    const hadChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
    
    if (hadWaveBtn || hadChatBtn || hadWaveSvg || hadChatSvg) {
      console.error('🚨 [showCandidate] КРИТИЧНО: Обнаружена кнопка "Помахать" в начале функции! Сбрасываем немедленно...', {
        hadWaveBtn,
        hadChatBtn,
        hadWaveSvg,
        hadChatSvg,
        className: dislikeBtn.className,
        innerHTML: dislikeBtn.innerHTML.substring(0, 100)
      });
      
      // АГРЕССИВНЫЙ СБРОС
      dislikeBtn.classList.remove('wave-btn', 'chat-btn');
      dislikeBtn.className = 'dislike_d';
      dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
      dislikeBtn.onclick = null;
      
      console.log('✅ [showCandidate] Кнопка дизлайка сброшена в начале функции');
    }
  }
  
  if (likeBtn) {
    if (likeBtn.innerHTML.includes('next.svg')) {
      console.error('🚨 [showCandidate] КРИТИЧНО: Обнаружена кнопка "Next" в начале функции! Сбрасываем...');
      likeBtn.classList.remove('nextMode');
      likeBtn.className = 'like_d';
      likeBtn.innerHTML = `<svg class="like-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path class="st0" d="M40.2,19.3c-5.1-0.5-7.5,2.5-8.2,3.5c-0.6-1-3.1-4-8.2-3.5c-5.4,0.6-10.8,7-5.7,15.6c4.2,6.9,13.6,11.9,13.9,12.1l0,0l0,0l0,0l0,0c0.2-0.1,9.7-5.1,13.9-12.1C51,26.3,45.6,19.9,40.2,19.3L40.2,19.3z"/></svg>`;
      likeBtn.style.backgroundColor = '';
      likeBtn.style.fontSize = '';
      likeBtn.onclick = null;
      console.log('✅ [showCandidate] Кнопка лайка сброшена в начале функции');
    }
  }
  
  // Сбрасываем флаг mutual match если он установлен
  if (window.inMutualMatch) {
    window.inMutualMatch = false;
  }
  
  // КРИТИЧНО: Финальная проверка кнопки в конце функции
  setTimeout(() => {
    const finalDislikeBtn = document.querySelector(".dislike_d");
    if (finalDislikeBtn && !window.inMutualMatch) {
      const hasWaveBtn = finalDislikeBtn.classList.contains('wave-btn');
      const hasChatBtn = finalDislikeBtn.classList.contains('chat-btn');
      const hasWaveSvg = finalDislikeBtn.innerHTML.includes('wave.svg');
      const hasChatSvg = finalDislikeBtn.innerHTML.includes('chat.svg');
      
      if (hasWaveBtn || hasChatBtn || hasWaveSvg || hasChatSvg) {
        console.error('🚨 [showCandidate setTimeout] КРИТИЧНО: Кнопка "Помахать" обнаружена ПОСЛЕ выполнения функции! Сбрасываем...', {
          hasWaveBtn,
          hasChatBtn,
          hasWaveSvg,
          hasChatSvg,
          inMutualMatch: window.inMutualMatch
        });
        
        // АГРЕССИВНЫЙ СБРОС
        finalDislikeBtn.classList.remove('wave-btn', 'chat-btn');
        finalDislikeBtn.className = 'dislike_d';
        finalDislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
        finalDislikeBtn.style.backgroundColor = '';
        finalDislikeBtn.style.fontSize = '';
        finalDislikeBtn.onclick = null;
      }
    }
  }, 50); // Проверяем через 50ms после завершения функции
  
  // Экспортируем в глобальную область для использования в main.js
  window.showCandidateFromSwipe = showCandidate;
  const singleCard = document.getElementById("singleCard");
  if (!singleCard) {
    console.error('[showCandidate] singleCard не найден!');
    return;
  }
  
  if (window.currentUser.needPhoto === 1) {
    singleCard.style.backgroundImage = "none";
    singleCard.style.backgroundColor = "#fff";
    const errorText = window.currentUser.photoErrorReason ? `<div class='photo-error-reason'>${window.currentUser.photoErrorReason}</div>` : '';
    singleCard.innerHTML = `
      <div class="no-users invite-wrapper">
        ${errorText}
        <h3>Пожалуйста, загрузите 1-3 фото с лицом, чтобы просматривать анкеты.</h3>
        <button id="add-photo-swipe-btn" class="invite-button">Добавить фото</button>
      </div>
    `;
    singleCard.style.boxShadow = "none";
    // Скрываем кнопки лайк/дизлайк, но НЕ удаляем их из DOM
    // PRO-кнопки скрываем только если needPhoto, иначе они управляются отдельно
    document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = "none");
    const btn = document.getElementById("add-photo-swipe-btn");
    if (btn) {
      // Удаляем старые обработчики
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener("click", function() { handlePhotoAddition.call(newBtn); });
    }
    return;
  }
  if (!window.candidates || window.candidates.length === 0 || window.currentIndex >= window.candidates.length) {
    const newCard = singleCard.cloneNode(false); // без детей и событий
    singleCard.parentNode.replaceChild(newCard, singleCard);

    newCard.style.backgroundImage = "none";
    newCard.style.backgroundColor = "#fff";
    // Если needPhoto=1, показываем "Загрузите фото", иначе "Пригласить"
    const buttonText = window.currentUser && window.currentUser.needPhoto === 1 ? "Загрузите фото" : "Пригласить";
    const buttonId = window.currentUser && window.currentUser.needPhoto === 1 ? "add-photo-swipe-btn" : "invite-button";
    newCard.innerHTML = `
      <div class="no-users invite-wrapper">
        <h3>Нет новых пользователей</h3>
        <button id="${buttonId}" class="invite-button">${buttonText}</button>
      </div>
    `;
    newCard.style.boxShadow = "none";
    newCard.className = "card";
    // Скрываем кнопки лайк/дизлайк, PRO-кнопки управляются отдельно
    document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = "none");
    const btn = newCard.querySelector(`#${buttonId}`);
    if (btn) {
      if (window.currentUser && window.currentUser.needPhoto === 1) {
        // Если needPhoto=1, открываем модалку для загрузки фото
        btn.addEventListener("click", function() {
          if (window.handlePhotoAddition) {
            window.handlePhotoAddition.call(btn);
          }
        });
      } else {
        // Иначе - приглашение
        btn.addEventListener("click", window.shareInvite);
      }
    }
    return;
  }
  // Обычная карточка
  const currentCandidate = window.candidates[window.currentIndex];
  if (!currentCandidate) {
    console.warn('[swipe.js] ⚠️ showCandidate: нет кандидата по индексу', window.currentIndex);
    return;
  }
  // КРИТИЧНО: Сохраняем плашку перед fillCard, так как fillCard перезаписывает innerHTML
  const existingBadge = singleCard.querySelector('.match-badge-pro');
  const badgeData = existingBadge ? {
    candidateId: String(currentCandidate.id || currentCandidate.userId || ''),
    element: existingBadge
  } : null;
  
  fillCard(singleCard, { ...currentCandidate });
  
  // КРИТИЧНО: Восстанавливаем плашку после fillCard, если она была
  if (badgeData && badgeData.element && badgeData.candidateId) {
    const candidateId = String(currentCandidate.id || currentCandidate.userId || '');
    if (candidateId === badgeData.candidateId) {
      // Проверяем, должен ли кандидат иметь плашку
      if (window.likesReceivedList && window.likesReceivedList.has(candidateId)) {
        // Восстанавливаем плашку
        const newBadge = document.createElement('div');
        newBadge.className = 'match-badge-pro';
        newBadge.textContent = 'Мэтч 💯';
        newBadge.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; background-color: #9f722f !important; color: #ffffff !important; padding: 8px 16px !important; border-radius: 20px !important; font-size: 14px !important; font-weight: bold !important; z-index: 10000 !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
        singleCard.appendChild(newBadge);
        console.log('[swipe.js] ✅ Плашка восстановлена после fillCard для кандидата:', candidateId);
      }
    }
  }
  
  // Показываем плашку "Мэтч 💯" для PRO пользователей, если кандидат поставил лайк
  // Вызываем с небольшой задержкой, чтобы убедиться, что карточка отрендерена
  // И что likesReceivedList загружен
  setTimeout(() => {
    showMatchBadgeIfLiked(singleCard, currentCandidate);
  }, 200);
  
  singleCard.classList.remove("show-match", "returning");
  // Добавляю анимацию появления
  singleCard.classList.add("card-appear");
  singleCard.addEventListener('animationend', function handler() {
    singleCard.classList.remove('card-appear');
    singleCard.removeEventListener('animationend', handler);
  });
  // Показываем/скрываем кнопки лайк/дизлайк (они уже есть в HTML)
  document.querySelectorAll(".like_d, .dislike_d")
    .forEach(b => b.style.display = window.currentUser.needPhoto ? "none" : "flex");
  
  // КРИТИЧНО: Устанавливаем обработчики свайпа после заполнения карточки
  // Это нужно делать каждый раз, так как fillCard может пересоздавать элементы
  // ВАЖНО: НЕ вызываем setupSwipeControls если мы в mutual match режиме, чтобы не сбросить кнопки
  setTimeout(() => {
    // Если мы в mutual match режиме, не пересоздаем кнопки
    if (!window.inMutualMatch) {
      window.setupSwipeHandlers && window.setupSwipeHandlers();
      // Устанавливаем обработчики для кнопок лайк/дизлайк
      window.attachLikeHandler && window.attachLikeHandler();
      window.attachDislikeHandler && window.attachDislikeHandler();
      
      // КРИТИЧНО: Пересоздаем PRO-кнопки после показа кандидата
      // Это нужно, так как кнопки могут быть удалены или скрыты
      window.setupSwipeControls && window.setupSwipeControls();
    } else {
      console.log('🔵 [showCandidate] Пропускаем setupSwipeControls, так как в mutual match режиме');
    }
  }, 0);
  
  // КРИТИЧНО: Принудительно сбрасываем кнопки к обычному состоянию для обычных кандидатов
  // Кнопка "Помахать" должна появляться ТОЛЬКО при mutual like, а не при обычном показе кандидата
  // Переиспользуем уже объявленные переменные dislikeBtn и likeBtn из начала функции
  
  // Сбрасываем флаг mutual match при показе нового кандидата (если это не mutual match)
  // ВАЖНО: НЕ сбрасываем кнопки, если мы в mutual match режиме
  if (!window.inMutualMatch) {
    // Сбрасываем кнопку дизлайка к обычному состоянию
    if (dislikeBtn) {
      const hadWaveBtn = dislikeBtn.classList.contains('wave-btn');
      const hadChatBtn = dislikeBtn.classList.contains('chat-btn');
      const hadWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
      const hadChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
      
      if (hadWaveBtn || hadChatBtn || hadWaveSvg || hadChatSvg) {
        console.log('⚠️ [showCandidate] Обнаружена кнопка "Помахать" на обычном кандидате! Сбрасываем...', {
          hadWaveBtn,
          hadChatBtn,
          hadWaveSvg,
          hadChatSvg
        });
      }
      
      // Удаляем все классы wave-btn и chat-btn
      dislikeBtn.classList.remove('wave-btn', 'chat-btn');
      dislikeBtn.className = 'dislike_d'; // Принудительно устанавливаем только базовый класс
      // Проверяем innerHTML - если там wave.svg, сбрасываем
      if (dislikeBtn.innerHTML.includes('wave.svg') || dislikeBtn.innerHTML.includes('chat.svg')) {
        dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
      }
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
      dislikeBtn.style.display = window.currentUser.needPhoto ? "none" : "flex";
    }
    
    // Сбрасываем кнопку лайка к обычному состоянию
    if (likeBtn) {
      likeBtn.classList.remove('nextMode');
      likeBtn.className = 'like_d';
      if (likeBtn.innerHTML.includes('next.svg')) {
        likeBtn.innerHTML = `<svg class="like-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path class="st0" d="M40.2,19.3c-5.1-0.5-7.5,2.5-8.2,3.5c-0.6-1-3.1-4-8.2-3.5c-5.4,0.6-10.8,7-5.7,15.6c4.2,6.9,13.6,11.9,13.9,12.1l0,0l0,0l0,0l0,0c0.2-0.1,9.7-5.1,13.9-12.1C51,26.3,45.6,19.9,40.2,19.3L40.2,19.3z"/></svg>`;
      }
      likeBtn.style.backgroundColor = '';
      likeBtn.style.fontSize = '';
      likeBtn.style.display = window.currentUser.needPhoto ? "none" : "flex";
    }
  }
  
  // Для PRO показываем Back и SuperLike (если они были созданы)
  // Для обычных пользователей скрываем PRO-кнопки
  // Используем ту же логику проверки, что и в pro.js (с учетом срока действия)
  const now = Date.now();
  const isPro = window.currentUser && 
    (window.currentUser.is_pro === true || window.currentUser.is_pro === 'true' || window.currentUser.is_pro === 1) &&
    window.currentUser.pro_end && 
    new Date(window.currentUser.pro_end).getTime() > now;
  
  console.log('[showCandidate] PRO статус:', {
    isPro,
    is_pro: window.currentUser?.is_pro,
    pro_end: window.currentUser?.pro_end,
    needPhoto: window.currentUser?.needPhoto,
    now: new Date(now).toISOString(),
    pro_end_time: window.currentUser?.pro_end ? new Date(window.currentUser.pro_end).toISOString() : null
  });
  
  if (isPro && !window.currentUser.needPhoto) {
    // Показываем PRO-кнопки для активных PRO пользователей
    const backBtns = document.querySelectorAll(".back-cnd-btn");
    const superBtns = document.querySelectorAll(".superlike_d");
    console.log('[showCandidate] Найдено PRO-кнопок:', { backBtns: backBtns.length, superBtns: superBtns.length });
    backBtns.forEach(b => {
      if (b) {
        b.style.display = "flex";
        console.log('[showCandidate] Показываем кнопку Back');
      }
    });
    superBtns.forEach(b => {
      if (b) {
        b.style.display = "flex";
        console.log('[showCandidate] Показываем кнопку SuperLike');
      }
    });
    
    // Если кнопок нет, вызываем setupSwipeControls для их создания
    if (backBtns.length === 0 || superBtns.length === 0) {
      console.log('[showCandidate] PRO-кнопки не найдены, вызываем setupSwipeControls');
      window.setupSwipeControls && window.setupSwipeControls();
    }
  } else {
    // Скрываем PRO-кнопки для обычных пользователей или с истекшим сроком
    document.querySelectorAll(".back-cnd-btn, .superlike_d").forEach(b => {
      if (b) {
        b.style.display = "none";
      }
    });
  }
}

export function shareInvite() {
  const text = "Привет! Нашёл удобное приложение для знакомств между соседями нашего ЖК.: https://t.me/SeligerTinderApp_bot/sta";
  if (navigator.share) {
    navigator.share({ text })
      .catch((err) => {
        if (err && err.name !== "AbortError") {
          alert("Ошибка шаринга: " + err.message);
        }
        // AbortError игнорируем
      });
  } else {
    navigator.clipboard.writeText(text)
      .then(() => alert("Текст скопирован в буфер обмена"))
      .catch(() => alert("Не удалось скопировать текст"));
  }
}
window.shareInvite = shareInvite;

export function customHideBadges(cardEl) {
  const likeB = cardEl.querySelector(".badge-like");
  const nopeB = cardEl.querySelector(".badge-nope");
  if (likeB) likeB.style.opacity = 0;
  if (nopeB) nopeB.style.opacity = 0;
}

export function moveToNextCandidate(direction = 'right') {
  // Удаляем кандидата только если это НЕ взаимный лайк
  if (!window._isBackAction && !window.inMutualMatch) {
    const currentCandidate = window.candidates[window.currentIndex];
    if (currentCandidate) {
      window.swipeHistory.push({ candidate: currentCandidate, index: window.currentIndex });
      window.candidates.splice(window.currentIndex, 1);
      if (window.currentIndex >= window.candidates.length) {
        window.currentIndex = 0;
      }
    }
  }
  
  // Сбрасываем флаги
  window._isBackAction = false;
  
  window.singleCard.style.transition = 'transform 0.5s ease';
  window.singleCard.style.transform = 'translate(1000px, 0) rotate(45deg)';
  window.customHideBadges && window.customHideBadges(window.singleCard);

  // Анимация свайпа
  let transformValue = 'translate(1000px, 0) rotate(45deg)';
  if (direction === 'left') {
    transformValue = 'translate(-1000px, 0) rotate(-45deg)';
  }
  // Всегда выставляем transition перед анимацией
  window.singleCard.style.transition = 'transform 0.5s ease';
  window.singleCard.style.transform = transformValue;
  window.singleCard.addEventListener('transitionend', function handler() {
    window.singleCard.removeEventListener('transitionend', handler);
    window.singleCard.style.transition = 'none';
    window.singleCard.style.transform = 'none';
    window.customHideBadges && window.customHideBadges(window.singleCard);
    
    // Переходим к следующему кандидату
    if (window.candidates.length > 0) {
      window.currentIndex = (window.currentIndex + 1) % window.candidates.length;
    } else {
      window.currentIndex = 0;
    }
    
    // ВСЕГДА сбрасываем кнопки к состоянию по умолчанию ПЕРЕД показом нового кандидата
    // Restore like/dislike buttons to default state
    let likeBtn = document.querySelector(".like_d");
    if (likeBtn) {
      // Полностью сбрасываем кнопку лайка
      likeBtn.innerHTML = `<svg class="like-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path class="st0" d="M40.2,19.3c-5.1-0.5-7.5,2.5-8.2,3.5c-0.6-1-3.1-4-8.2-3.5c-5.4,0.6-10.8,7-5.7,15.6c4.2,6.9,13.6,11.9,13.9,12.1l0,0l0,0l0,0l0,0c0.2-0.1,9.7-5.1,13.9-12.1C51,26.3,45.6,19.9,40.2,19.3L40.2,19.3z"/></svg>`;
      likeBtn.onclick = null;
      likeBtn.className = 'like_d'; // Сброс всех классов
      likeBtn.style.backgroundColor = '';
      likeBtn.style.fontSize = '';
      likeBtn.style.display = 'flex';
      // Удаляем все обработчики событий через клонирование
      const newLikeBtn = likeBtn.cloneNode(true);
      likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
      likeBtn = newLikeBtn;
      // Восстанавливаем обработчик события для Like
      likeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔄 [moveToNextCandidate] Кнопка лайка нажата (из moveToNextCandidate)');
        if (!window.candidates || window.candidates.length === 0 || window.currentIndex >= window.candidates.length) {
          window.showCandidate && window.showCandidate();
        } else {
          window.doLike && window.doLike();
        }
      });
    }
    let dislikeBtn = document.querySelector(".dislike_d");
    if (dislikeBtn) {
      // КРИТИЧНО: Проверяем, есть ли wave-btn или chat-btn перед сбросом
      const hadWaveBtn = dislikeBtn.classList.contains('wave-btn');
      const hadChatBtn = dislikeBtn.classList.contains('chat-btn');
      const hadWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
      const hadChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
      
      if (hadWaveBtn || hadChatBtn || hadWaveSvg || hadChatSvg) {
        console.error('🚨 [moveToNextCandidate transitionend] КРИТИЧНО: Обнаружена кнопка "Помахать" в transitionend! Сбрасываем...', {
          hadWaveBtn,
          hadChatBtn,
          hadWaveSvg,
          hadChatSvg,
          className: dislikeBtn.className,
          innerHTML: dislikeBtn.innerHTML.substring(0, 100)
        });
      }
      
      // Полностью сбрасываем кнопку дизлайка - удаляем все классы (wave-btn, chat-btn и т.д.)
      dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
      dislikeBtn.onclick = null;
      dislikeBtn.classList.remove('wave-btn', 'chat-btn'); // Явно удаляем классы
      dislikeBtn.className = 'dislike_d'; // Сброс всех классов (удаляем wave-btn, chat-btn и т.д.)
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
      dislikeBtn.style.display = 'flex';
      // Удаляем все обработчики событий через клонирование
      const newDislikeBtn = dislikeBtn.cloneNode(true);
      dislikeBtn.parentNode.replaceChild(newDislikeBtn, dislikeBtn);
      dislikeBtn = newDislikeBtn;
      // Восстанавливаем обработчик события для Dislike
      dislikeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔄 [moveToNextCandidate] Кнопка дизлайка нажата (из moveToNextCandidate)');
        if (!window.candidates || window.candidates.length === 0 || window.currentIndex >= window.candidates.length) {
          window.showCandidate && window.showCandidate();
        } else {
          window.doDislike && window.doDislike();
        }
      });
    }

    // Ensure buttons are visible
    document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = 'flex');
    
    // КРИТИЧНО: Показываем нового кандидата ПОСЛЕ сброса кнопок и переключения индекса
    window.showCandidate && window.showCandidate();
    
    // КРИТИЧНО: Переустанавливаем обработчики ПОСЛЕ showCandidate, чтобы они не перезаписывались
    // Это гарантирует, что обработчики из attachLikeHandler будут установлены последними
    setTimeout(() => {
      window.setupSwipeHandlers && window.setupSwipeHandlers();
      window.setupSwipeControls && window.setupSwipeControls();
      // ВАЖНО: attachLikeHandler должен вызываться ПОСЛЕ setupSwipeControls, чтобы обработчик не перезаписывался
      window.attachLikeHandler && window.attachLikeHandler();
      window.attachDislikeHandler && window.attachDislikeHandler();
    }, 100);
  });
}

export function onMutualLike() {
  console.log('🔄 [onMutualLike] ВЫЗВАН, версия:', SWIPE_MODULE_VERSION);
  
  // КРИТИЧНО: Сохраняем текущий индекс ДО любых изменений и вызовов других функций
  const savedIndex = window.currentIndex;
  console.log('🔄 [onMutualLike] Сохраняем индекс:', savedIndex, 'текущий currentIndex:', window.currentIndex);
  
  window.updateMatchesCount && window.updateMatchesCount();
  window.inMutualMatch = true;
  
  // Сохраняем текущего кандидата - НЕ удаляем из массива сразу!
  const currentCandidate = window.candidates[savedIndex];
  if (!currentCandidate) {
    console.warn('[onMutualLike] currentCandidate не найден!');
    return;
  }
  
  console.log('🔄 [onMutualLike] Сохраняем кандидата:', currentCandidate.id || currentCandidate.userId);
  
  // Сохраняем кандидата в истории для кнопки Back
  window.swipeHistory.push({ candidate: currentCandidate, index: savedIndex });
  
  console.log('🎬 [onMutualLike] Начинаем анимацию: карточка улетает вправо');
  // Свайп-карточка улетает вправо
  window.singleCard.style.transition = "transform 0.5s ease";
  window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
  
  setTimeout(() => {
    console.log('🎬 [onMutualLike] Возвращаем карточку в центр');
    // Возврат в центр с ТЕМ ЖЕ кандидатом
    window.singleCard.style.transition = "transform 0.3s ease";
    window.singleCard.style.transform = "none";
    window.customHideBadges && window.customHideBadges(window.singleCard);

    // КРИТИЧНО: Восстанавливаем индекс, чтобы показать правильного кандидата
    window.currentIndex = savedIndex;
    console.log('🔄 [onMutualLike] Восстановлен индекс:', window.currentIndex);
    
    // КРИТИЧНО: Сохраняем плашку перед fillCard
    const candidateId = String(currentCandidate.id || currentCandidate.userId || '');
    const existingBadge = window.singleCard.querySelector('.match-badge-pro');
    const shouldShowBadge = existingBadge && window.likesReceivedList && 
      window.likesReceivedList.has(candidateId);
    
    // Обновляем карточку с данными текущего кандидата (чтобы убедиться, что данные актуальны)
    fillCard(window.singleCard, currentCandidate);
    
    // КРИТИЧНО: Восстанавливаем плашку после fillCard, если она была
    if (shouldShowBadge && window.likesReceivedList && window.likesReceivedList.has(candidateId)) {
      const newBadge = document.createElement('div');
      newBadge.className = 'match-badge-pro';
      newBadge.textContent = 'Мэтч 💯';
      newBadge.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; background-color: #9f722f !important; color: #ffffff !important; padding: 8px 16px !important; border-radius: 20px !important; font-size: 14px !important; font-weight: bold !important; z-index: 10000 !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
      window.singleCard.appendChild(newBadge);
      console.log('[swipe.js] ✅ Плашка восстановлена после fillCard в onMutualLike для кандидата:', candidateId);
    }
    
    // Показываем плашку "Мэтч 💯" для PRO пользователей
    setTimeout(() => {
      window.showMatchBadgeIfLiked && window.showMatchBadgeIfLiked(window.singleCard, currentCandidate);
    }, 100);

    // Находим или создаем элемент .badge-match для анимации мэтча
    // Элемент уже есть в HTML (index.html строка 273), но может быть скрыт
    let matchBadge = window.singleCard.querySelector(".badge-match");
    if (!matchBadge) {
      console.warn('[swipe.js] ⚠️ Элемент .badge-match не найден в DOM, создаем его');
      matchBadge = document.createElement('div');
      matchBadge.className = 'badge-match';
      window.singleCard.appendChild(matchBadge);
      console.log('[swipe.js] ✅ Создан элемент .badge-match для анимации');
    } else {
      console.log('[swipe.js] ✅ Элемент .badge-match найден в DOM:', matchBadge);
    }
    
    // Убеждаемся, что элемент имеет правильные стили
    matchBadge.style.position = 'absolute';
    matchBadge.style.top = '50%';
    matchBadge.style.left = '50%';
    matchBadge.style.transform = 'translate(-50%, -50%)';
    matchBadge.style.zIndex = '1000';
    matchBadge.style.fontSize = '64px';
    matchBadge.style.pointerEvents = 'none';
    if (matchBadge) {
      console.log('🎬 [onMutualLike] Показываем эмодзи ❤️‍🔥 с анимацией');
      matchBadge.innerHTML = "❤️‍🔥";
      matchBadge.style.opacity = "1";
      matchBadge.style.display = "block";
      matchBadge.style.visibility = "visible";
      matchBadge.style.transform = "translate(-50%, -50%) scale(1)";
      // Принудительно перерисовываем для запуска анимации
      matchBadge.offsetWidth; // trigger reflow
      matchBadge.classList.add("match-animation");
      console.log('🎬 [onMutualLike] Класс match-animation добавлен, элемент:', matchBadge);
      matchBadge.addEventListener("animationend", () => {
        console.log('🎬 [onMutualLike] Анимация эмодзи завершена');
        matchBadge.classList.remove("match-animation");
        matchBadge.style.opacity = "0";
      }, { once: true });
    } else {
      console.error('[swipe.js] ❌ [onMutualLike] Элемент .badge-match не найден после создания!');
    }
    if ("vibrate" in navigator) {
      console.log('📳 [onMutualLike] Вибрация');
      navigator.vibrate([50,30,80,30,110,30,150]);
    }

    // Кнопки swipe: like -> Next, dislike -> Chat/Wave
    let likeBtn = document.querySelector(".like_d");
    if (likeBtn) {
      const btnClone = likeBtn.cloneNode(true);
      likeBtn.parentNode.replaceChild(btnClone, likeBtn);
      likeBtn = btnClone;
    }
    let dislikeBtn = document.querySelector(".dislike_d");
    if (dislikeBtn) {
      const btnClone = dislikeBtn.cloneNode(true);
      dislikeBtn.parentNode.replaceChild(btnClone, dislikeBtn);
      dislikeBtn = btnClone;
    }

    // Next - удаляем кандидата из массива только при нажатии
    if (likeBtn) {
      likeBtn.style.display = "flex";
      likeBtn.innerHTML = `<img class="next" src="/img/next.svg" alt="next" />`;
      likeBtn.onclick = () => {
        // Удаляем кандидата из массива только сейчас
        const idx = window.candidates.findIndex(c => String(c.id || c.userId) === String(currentCandidate.id || currentCandidate.userId));
        if (idx >= 0) {
          window.candidates.splice(idx, 1);
          if (window.currentIndex >= window.candidates.length) {
            window.currentIndex = 0;
          }
        }
        window.singleCard.style.transition = "transform 0.5s ease";
        window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
        setTimeout(() => {
          window.moveToNextCandidate && window.moveToNextCandidate();
          window.singleCard.style.transition = "none";
          window.singleCard.style.transform = "none";
        }, 500);
      };
    }
    // Chat / Wave (Chat button styled blue) - используем сохраненного кандидата
    // КРИТИЧНО: Проверяем, что мы все еще в mutual match режиме
    if (!window.inMutualMatch) {
      console.error('🚨 [onMutualLike setTimeout] КРИТИЧНО: inMutualMatch был сброшен до установки кнопки! Не устанавливаем кнопку "Помахать"');
      // Сбрасываем кнопку на всякий случай
      if (dislikeBtn) {
        dislikeBtn.classList.remove('wave-btn', 'chat-btn');
        dislikeBtn.className = 'dislike_d';
        dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
        dislikeBtn.style.backgroundColor = '';
        dislikeBtn.style.fontSize = '';
        dislikeBtn.onclick = null;
      }
      return; // Не устанавливаем кнопку, если mutual match уже сброшен
    }
    
    if (dislikeBtn) {
      console.log('🔵 [onMutualLike setTimeout] Устанавливаем кнопку "Помахать" для mutual match, inMutualMatch:', window.inMutualMatch);
      dislikeBtn.style.display = "flex";
      if (currentCandidate && currentCandidate.id && currentCandidate.id.startsWith('VALID_') && currentCandidate.username) {
        dislikeBtn.classList.remove('wave-btn');
        dislikeBtn.classList.add('chat-btn');
        dislikeBtn.style.backgroundColor = "#55a6ff"; // голубой
        dislikeBtn.innerHTML = `<img class="chat" src="/img/chat.svg" alt="chat" />`;
        dislikeBtn.onclick = () => {
          window.openChat && window.openChat(currentCandidate.username);
        };
      } else {
        // Для TEST_ пользователей или пользователей без username показываем Wave
        dislikeBtn.classList.remove('chat-btn');
        dislikeBtn.classList.add('wave-btn');
        // КРИТИЧНО: Убеждаемся, что иконка загружается правильно
        dislikeBtn.innerHTML = `<img class="wave" src="/img/wave.svg" alt="wave" style="width: 36px; height: 36px; display: block;" />`;
        dislikeBtn.style.backgroundColor = "#ff5e5e";
        dislikeBtn.style.fontSize = "36px";
        dislikeBtn.style.display = "flex";
        dislikeBtn.style.alignItems = "center";
        dislikeBtn.style.justifyContent = "center";
        console.log('🔵 [onMutualLike] Кнопка "Помахать" установлена, innerHTML:', dislikeBtn.innerHTML);
        dislikeBtn.onclick = async () => {
          const btn = dislikeBtn;
          try {
            sendPush({ senderId: window.currentUser.userId, senderUsername: window.currentUser.username || window.currentUser.name, receiverId: currentCandidate.id || currentCandidate.userId });
          } catch (err) {
            console.error("❌ /api/sendPush ошибка:", err);
          }
        };
      }
    }
    window.updateMatchesCount && window.updateMatchesCount();
  }, 500);
}

export function onSuperMatch() {
    window.inMutualMatch = true;

    // Сохраняем текущего кандидата в истории для кнопки Back
    const currentCandidate = window.candidates[window.currentIndex];
    if (currentCandidate) {
        window.swipeHistory.push({ candidate: currentCandidate, index: window.currentIndex });
    }

    // Изменяем кнопки на правильные для взаимного мэтча
    let likeBtn = document.querySelector(".like_d");
    if (likeBtn) {
        const btnClone = likeBtn.cloneNode(true);
        likeBtn.parentNode.replaceChild(btnClone, likeBtn);
        likeBtn = btnClone;
    }
    let dislikeBtn = document.querySelector(".dislike_d");
    if (dislikeBtn) {
        const btnClone = dislikeBtn.cloneNode(true);
        dislikeBtn.parentNode.replaceChild(btnClone, dislikeBtn);
        dislikeBtn = btnClone;
    }

    const cand = window.candidates.find(c => String(c.id || c.userId) === window.singleCard?.dataset?.userId);

    // Next
    if (likeBtn) {
        likeBtn.style.display = "flex";
        likeBtn.innerHTML = `<img class="next" src="/img/next.svg" alt="next" />`;
        likeBtn.onclick = () => {
            window.singleCard.style.transition = "transform 0.5s ease";
            window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
            setTimeout(() => {
                // УДАЛЯЕМ кандидата из массива при супер-мэтче
                if (currentCandidate) {
                    window.candidates.splice(window.currentIndex, 1);
                    if (window.currentIndex >= window.candidates.length) {
                        window.currentIndex = 0;
                    }
                }
                window.moveToNextCandidate && window.moveToNextCandidate();
                window.singleCard.style.transition = "none";
                window.singleCard.style.transform = "none";
            }, 500);
        };
    }

    // Chat / Wave
    if (dislikeBtn) {
        dislikeBtn.style.display = "flex";
        // Проверяем, является ли пользователь VALID_ (имеет валидный Telegram username)
        if (cand && cand.id && cand.id.startsWith('VALID_') && cand.username) {
            dislikeBtn.classList.remove('wave-btn');
            dislikeBtn.classList.add('chat-btn');
            dislikeBtn.style.backgroundColor = "#55a6ff"; // голубой
            dislikeBtn.innerHTML = `<img class="chat" src="/img/chat.svg" alt="chat" />`;
            dislikeBtn.onclick = () => {
                window.openChat && window.openChat(cand.username);
            };
        } else {
            // Для TEST_ пользователей или пользователей без username показываем Wave
            dislikeBtn.classList.remove('chat-btn');
            dislikeBtn.classList.add('wave-btn');
            dislikeBtn.innerHTML = `<img class="wave" src="/img/wave.svg" alt="wave" />`;
            dislikeBtn.style.backgroundColor = "#ff5e5e";
            dislikeBtn.style.fontSize = "36px";
            dislikeBtn.onclick = async () => {
                const btn = dislikeBtn;
                try {
                    sendPush({ senderId: window.currentUser.userId, senderUsername: window.currentUser.username || window.currentUser.name, receiverId: cand.id || cand.userId });
                } catch (err) {
                    console.error("❌ /api/sendPush ошибка:", err);
                }
            };
        }
    }

    const matchBadge = window.singleCard?.querySelector(".badge-match");
    if (matchBadge) {
        matchBadge.innerHTML = `<img src="/img/superlike.svg" alt="Super-Like" />`;
        matchBadge.style.opacity = "1";
        // Начальное состояние: небольшой и прозрачный
        matchBadge.style.transform = "scale(0.5)";
        matchBadge.classList.add("match-animation");
        matchBadge.addEventListener("animationend", () => {
            matchBadge.classList.remove("match-animation");
            matchBadge.style.opacity = "0";
            matchBadge.style.transform = "";
            // После анимации свайпаем карточку вправо
            window.singleCard.style.transition = "transform 0.5s ease";
            window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
            setTimeout(() => {
                // Возвращаем карточку в центр (как в onMutualLike)
                window.singleCard.style.transition = "transform 0.3s ease";
                window.singleCard.style.transform = "none";
                window.customHideBadges && window.customHideBadges(window.singleCard);

                // Анимация сердца
                const matchBadge = window.singleCard.querySelector(".badge-match");
                if (matchBadge) {
                    matchBadge.innerHTML = "❤️‍🔥";
                    matchBadge.style.opacity = "1";
                    matchBadge.style.transform = "";
                    matchBadge.classList.add("match-animation");
                    matchBadge.addEventListener("animationend", () => {
                        matchBadge.classList.remove("match-animation");
                        matchBadge.style.opacity = "0";
                    }, { once: true });
                }
                if ("vibrate" in navigator) navigator.vibrate([50,30,80,30,110,30,150]);

                window.updateMatchesCount && window.updateMatchesCount();
            }, 500);
        }, { once: true });
    } else {
    }
}

export function onSuperPending() {
  // Скрываем исходные кнопки
  document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = "none");
  // Отображаем бейдж pending
  let badge = window.singleCard?.querySelector(".badge-match");
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'badge-match';
    badge.style.opacity = '0';
    window.singleCard.appendChild(badge);
  }
  if (badge) {
    // Анимация сердца как при mutual like
    badge.innerHTML = "❤️‍🔥";
    badge.style.opacity = "1";
    badge.style.transform = "";
    badge.classList.add("match-animation");
    badge.addEventListener("animationend", () => {
      badge.classList.remove("match-animation");
      badge.style.opacity = "0";
    }, { once: true });
    // Эффект свайпа для SuperLike pending
    window.singleCard.style.transition = "transform 0.5s ease";
    window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
    setTimeout(() => {
      window.singleCard.style.transition = "transform 0.5s ease";
      window.singleCard.style.transform = "none";
      window.customHideBadges && window.customHideBadges(window.singleCard);
      // Анимация звезды при возврате карточки после SuperLike pending
      const returnBadge = window.singleCard.querySelector(".badge-match");
      if (returnBadge) {
        returnBadge.innerHTML = "\u2b50";
        returnBadge.style.opacity = "";
        returnBadge.style.transform = "";
        // eslint-disable-next-line no-unused-expressions
        returnBadge.offsetWidth;
        returnBadge.classList.add("match-animation");
        returnBadge.addEventListener("animationend", () => {
          returnBadge.classList.remove("match-animation");
          returnBadge.style.opacity = "0";
        }, { once: true });
      }
    }, 500);
    // авто-свайп карточки при SuperLike pending временно отключён для устранения мерцания
    // window.singleCard.style.transition = "transform 0.5s ease";
    // window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
    // setTimeout(() => {
    //   window.moveToNextCandidate && window.moveToNextCandidate();
    //   window.updateMatchesCount && window.updateMatchesCount();
    // }, 500);
  } else {
  }
  // Переходим к Next/Chat кнопкам
  let likeBtn = document.querySelector(".like_d");
  if (likeBtn) {
    const btnClone = likeBtn.cloneNode(true);
    likeBtn.parentNode.replaceChild(btnClone, likeBtn);
    likeBtn = btnClone;
  }
  let dislikeBtn = document.querySelector(".dislike_d");
  if (dislikeBtn) {
    const btnClone = dislikeBtn.cloneNode(true);
    dislikeBtn.parentNode.replaceChild(btnClone, dislikeBtn);
    dislikeBtn = btnClone;
  }
  const cand = window.candidates?.find(c => String(c.id || c.userId) === window.singleCard?.dataset?.userId);
  if (likeBtn) {
    likeBtn.style.display = "flex";
    likeBtn.innerHTML = `<img class="next" src="/img/next.svg" alt="next" />`;
    likeBtn.onclick = () => {
      window.singleCard.style.transition = "transform 0.5s ease";
      window.singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
      setTimeout(() => {
        // УБИРАЕМ удаление кандидата отсюда - оно будет в moveToNextCandidate
        // const idx = window.candidates?.findIndex(c => String(c.id || c.userId) === window.singleCard?.dataset?.userId);
        // if (idx >= 0) {
        //   window.swipeHistory?.push(window.candidates[idx]);
        //   window.candidates.splice(idx, 1);
        // }
        window.singleCard.style.transition = "none";
        window.singleCard.style.transform = "none";
        window.customHideBadges && window.customHideBadges(window.singleCard);
        window.moveToNextCandidate && window.moveToNextCandidate('right');
        window.showCandidate && window.showCandidate();
        window.setupSwipeControls && window.setupSwipeControls();
        window.updateMatchesCount && window.updateMatchesCount();
      }, 500);
    };
  }
  if (dislikeBtn) {
    dislikeBtn.style.display = "flex";
    if (cand && cand.username) {
      dislikeBtn.style.backgroundColor = "#55a6ff";
      dislikeBtn.innerHTML = `<img class="chat" src="/img/chat.svg" alt="chat" />`;
      dislikeBtn.onclick = () => {
        window.openChat && window.openChat(cand.username);
      };
    } else {
      dislikeBtn.innerHTML = "\ud83d\udc4b";
      dislikeBtn.style.backgroundColor = "#ff5e5e";
      dislikeBtn.style.fontSize = "36px";
      dislikeBtn.onclick = async () => {
        try {
          sendPush({ senderId: window.currentUser.userId, senderUsername: window.currentUser.username || window.currentUser.name, receiverId: cand.id || cand.userId });
        } catch (err) {
          console.error("\u274c /api/sendPush error after superlike pending:", err);
        }
      };
    }
  }
}

export function onSuperRejected() {
  const badge = window.singleCard?.querySelector(".badge-match");
  if (badge) {
    badge.textContent = "К сожалению, пользователь не ответил взаимностью…";
    badge.style.opacity = "1";
    badge.style.transform = "";
  } else {
  }
}

// Обработчик клика по кнопке Like (первый шаг: только проверки)
export function handleLikeClick() {
    // Проверка наличия кандидатов и текущего индекса
    if (!window.candidates || window.candidates.length === 0 || window.currentIndex >= window.candidates.length) {
        window.showCandidate && window.showCandidate();
    } else {
        window.doLike && window.doLike();
    }
}

// Функция для навешивания обработчика на кнопку Like
export function attachLikeHandler() {
    console.log('🔄 [attachLikeHandler] ВЫЗВАН, версия:', SWIPE_MODULE_VERSION);
    const likeBtn = document.querySelector('.like_d');
    if (likeBtn) {
        // Удаляем старые обработчики через клонирование
        const newLikeBtn = likeBtn.cloneNode(true);
        likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
        // Добавляем новый обработчик
        newLikeBtn.addEventListener('click', (e) => {
            console.log('🔄 [attachLikeHandler] Кнопка лайка нажата!');
            e.preventDefault();
            e.stopPropagation();
            handleLikeClick();
        });
        console.log('🔄 [attachLikeHandler] Обработчик лайка установлен');
    } else {
        console.warn('🔄 [attachLikeHandler] Кнопка .like_d не найдена!');
    }
}

// Асинхронная функция doLike (добавлена первая часть логики)
export async function doLike() {
    console.log('🔄 [doLike] ВЫЗВАН, версия:', SWIPE_MODULE_VERSION);
    console.log('🔄 [doLike] window.inMutualMatch:', window.inMutualMatch);
    
    if (window.inMutualMatch) {
        console.log('🔄 [doLike] В режиме mutual match, переходим к следующему кандидату');
        window.moveToNextCandidate && window.moveToNextCandidate('right');
        return;
    }
    const topUserId = window.singleCard?.dataset?.userId;
    console.log('🔄 [doLike] topUserId:', topUserId);

    const idx = window.candidates?.findIndex(c => String(c.id || c.userId) === String(topUserId));
    console.log('🔄 [doLike] idx:', idx);

    if (idx < 0) {
        console.warn('🔄 [doLike] Кандидат не найден в массиве');
        return;
    }
    const candidate = window.candidates[idx];
    console.log('🔄 [doLike] candidate:', candidate);
    
    try {
        console.log('🔄 [doLike] Отправляем лайк...');
        const json = await sendLike(window.currentUser.userId, topUserId);
        console.log('🔄 [doLike] Ответ от сервера:', json);
        console.log('🔄 [doLike] json.match:', json.match, 'json.isMatch:', json.isMatch, 'json.mutual:', json.mutual);

        
        if (json && json.success) {
            window.currentUser.likes = window.currentUser.likes || [];
            window.currentUser.likes.push(topUserId);
            
            // Обновляем данные пользователя после лайка
            await refreshCurrentUser();
            
            // Проверяем, есть ли взаимный лайк
            // ВАЖНО: бэкенд возвращает "match", а не "isMatch"
            console.log('🔄 [doLike] Проверяем мэтч: json.match =', json.match, 'json.isMatch =', json.isMatch);
            const isMatch = json.match === true || json.isMatch === true || ((candidate.id || candidate.userId) && (candidate.id || candidate.userId).startsWith('VALID_') && candidate.username);
            if (isMatch) {
                console.log('🔄 [doLike] МЭТЧ! Вызываем onMutualLike');
                window.onMutualLike && window.onMutualLike();
            } else {
                console.log('🔄 [doLike] Нет мэтча, улетаем вправо');
                // Анимация улетающей карточки вправо
                window.singleCard.style.transition = "transform 0.5s ease";
                window.singleCard.style.transform = `translate(1000px, 0) rotate(45deg)`;
                setTimeout(() => {
                    window.swipeHistory.push(window.candidates[idx]);
                    // УБИРАЕМ удаление кандидата отсюда - оно будет в moveToNextCandidate
                    // window.candidates.splice(idx, 1);
                    window.moveToNextCandidate && window.moveToNextCandidate('right');
                    window.updateMatchesCount && window.updateMatchesCount();
                }, 500);
            }
        } else {
            console.warn('🔄 [doLike] Лайк не успешен:', json);
        }
    } catch (err) {
        console.error('❌ Ошибка лайка:', err);
        window.showToast && window.showToast('Ошибка при лайке');
    }
}

// Обработчик клика по кнопке Dislike (первый шаг: только проверки)
export function handleDislikeClick() {
    // Проверка наличия кандидатов и текущего индекса
    if (!window.candidates || window.candidates.length === 0 || window.currentIndex >= window.candidates.length) {
        window.showCandidate && window.showCandidate();
    } else {
        window.doDislike && window.doDislike();
    }
}

// Функция для навешивания обработчика на кнопку Dislike
export function attachDislikeHandler() {
    console.log('🔄 [attachDislikeHandler] ВЫЗВАН, версия:', SWIPE_MODULE_VERSION);
    const dislikeBtn = document.querySelector('.dislike_d');
    if (dislikeBtn) {
        // Удаляем старые обработчики через клонирование
        const newDislikeBtn = dislikeBtn.cloneNode(true);
        dislikeBtn.parentNode.replaceChild(newDislikeBtn, dislikeBtn);
        // Добавляем новый обработчик
        newDislikeBtn.addEventListener('click', (e) => {
            console.log('🔄 [attachDislikeHandler] Кнопка дизлайка нажата!');
            e.preventDefault();
            e.stopPropagation();
            handleDislikeClick();
        });
        console.log('🔄 [attachDislikeHandler] Обработчик дизлайка установлен');
    } else {
        console.warn('🔄 [attachDislikeHandler] Кнопка .dislike_d не найдена!');
    }
}

// Асинхронная функция doDislike (добавлена первая часть логики)
export async function doDislike() {

    if (window.inMutualMatch) {

        window.moveToNextCandidate && window.moveToNextCandidate('left');
        return;
    }
    const topUserId = window.singleCard?.dataset?.userId;

    const idx = window.candidates?.findIndex(c => String(c.id || c.userId) === String(topUserId));

    if (idx < 0) return;
    // Удаляем кандидата из массива после дизлайка
    const candidate = window.candidates[idx];
    const url = `${window.API_URL}/dislike`;
    try {
        await sendDislike(window.currentUser.userId, topUserId);
        window.currentUser.dislikes = window.currentUser.dislikes || [];
        window.currentUser.dislikes.push(topUserId);
        
        // Обновляем данные пользователя после дизлайка
        await refreshCurrentUser();
        
        window.moveToNextCandidate && window.moveToNextCandidate('left');
    } catch (err) {
        console.error('❌ Ошибка дизлайка:', err);
        window.showToast && window.showToast('Ошибка при дизлайке');
    }
}

export function openChat(username) {
  const url = `https://t.me/${username}`;
  if (window.tg && window.tg.openTelegramLink) {
    window.tg.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
}

export function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '25px',
    maxWidth: '100%',
    zIndex: '2100',
    pointerEvents: 'none',
    opacity: '1',
    transition: 'opacity 0.5s ease',
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

// TODO: Вынести сюда остальной код свайпа по мере рефакторинга 

export function customRenderPaginator(paginatorEl, count, activeIndex) {
  paginatorEl.innerHTML = "";
  if (count < 2) {
    paginatorEl.style.display = "none";
    return;
  }
  paginatorEl.style.display = "flex";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = i === activeIndex ? "pag_active" : "pag";
    paginatorEl.appendChild(dot);
  }
}

export function cyclePhoto() {
  const singleCard = document.getElementById("singleCard");
  if (!singleCard) return;
  
  const rawPhotos = singleCard.dataset.photos ? JSON.parse(singleCard.dataset.photos) : [];
  if (rawPhotos.length < 2) {
    console.warn('[cyclePhoto] Меньше 2 фотографий, переключение невозможно');
    return;
  }
  
  // Инициализируем currentPhotoIndex если он не установлен
  if (window.currentPhotoIndex === undefined || window.currentPhotoIndex === null) {
    window.currentPhotoIndex = 0;
  }
  
  // Переключаем на следующее фото
  window.currentPhotoIndex = (window.currentPhotoIndex + 1) % rawPhotos.length;
  const nextPhotoUrl = rawPhotos[window.currentPhotoIndex];
  
  console.log('[cyclePhoto] Переключение фото:', {
    index: window.currentPhotoIndex,
    total: rawPhotos.length,
    url: nextPhotoUrl
  });
  
  if (!nextPhotoUrl) {
    console.error('[cyclePhoto] Пустой URL для фото:', window.currentPhotoIndex);
    return;
  }
  
  // Устанавливаем новое фото
  singleCard.style.backgroundImage = `url('${nextPhotoUrl}')`;
  singleCard.style.backgroundSize = "cover";
  singleCard.style.backgroundPosition = "center";
  singleCard.style.backgroundRepeat = "no-repeat";
  
  // Обновляем пагинатор
  const paginatorEl = singleCard.querySelector(".paginator");
  if (paginatorEl) {
    customRenderPaginator(paginatorEl, rawPhotos.length, window.currentPhotoIndex);
  }
  
  // Обновляем dataset.photoIndex для совместимости
  singleCard.dataset.photoIndex = window.currentPhotoIndex;
}

export function setupSwipeHandlers() {
  const singleCard = document.getElementById("singleCard");
  let isDragging = false, startX = 0, startY = 0, currentX = 0, currentY = 0;
  let hasMoved = false; // Флаг, чтобы отличить клик от свайпа
  let lastClickTime = 0; // Время последнего клика для предотвращения двойных срабатываний
  const maxDistance = 200, minFont = 64, maxFont = 128, threshold = 100;
  if (!singleCard) return;
  
  // Удаляем старые обработчики, если они есть, клонируя элемент
  const newCard = singleCard.cloneNode(true);
  singleCard.parentNode.replaceChild(newCard, singleCard);
  const card = document.getElementById("singleCard");
  // Обновляем глобальную ссылку на карточку
  window.singleCard = card;
  
  card.addEventListener("pointerdown", (e) => {
    if (window.currentIndex >= window.candidates.length) return;
    isDragging = true;
    hasMoved = false; // Сбрасываем флаг движения
    startX = e.clientX;
    startY = e.clientY;
    currentX = 0;
    currentY = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = "none";
  });
  
  card.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    
    // Если движение больше 5px, считаем это свайпом
    if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) {
      hasMoved = true;
    }
    
    const rot = (currentX / 200) * 20;
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rot}deg)`;
    card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
    const likeB = card.querySelector(".badge-like");
    const nopeB = card.querySelector(".badge-nope");
    let ratio = Math.min(Math.abs(currentX) / maxDistance, 1);
    let fontNow = minFont + (maxFont - minFont) * ratio;
    if (currentX > 0) {
      if (likeB) { likeB.style.opacity = ratio; likeB.style.fontSize = fontNow + "px"; }
      if (nopeB) { nopeB.style.opacity = 0; nopeB.style.fontSize = minFont + "px"; }
    } else {
      if (nopeB) { nopeB.style.opacity = ratio; nopeB.style.fontSize = fontNow + "px"; }
      if (likeB) { likeB.style.opacity = 0; likeB.style.fontSize = minFont + "px"; }
    }
  });
  
  card.addEventListener("pointerup", e => {
    const wasDragging = isDragging;
    const moved = hasMoved; // Сохраняем значение перед сбросом
    isDragging = false;
    card.releasePointerCapture(e.pointerId);
    const distX = Math.abs(currentX), distY = Math.abs(currentY);
    
    // Если это был просто клик (без движения) - переключаем фото
    if (wasDragging && !moved && distX < 10 && distY < 10) {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      // Предотвращаем двойное срабатывание
      if (now - lastClickTime > 300) {
        lastClickTime = now;
        window.cyclePhoto && window.cyclePhoto();
      }
      // Сбрасываем transform
      card.style.transition = "transform 0.3s ease";
      card.style.transform = "none";
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      window.customHideBadges && window.customHideBadges(card);
      currentX = 0;
      currentY = 0;
      hasMoved = false;
      return;
    }
    
    // Если это был свайп
    if (moved && distX > threshold) {
      const dir = currentX > 0 ? "right" : "left";
      if (dir === "right") {
        window.doLike && window.doLike();
      } else {
        window.doDislike && window.doDislike();
      }
    } else if (moved) {
      // плавный возврат при неполном свайпе
      card.style.transition = "transform 0.3s ease";
      card.style.transform = "none";
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      window.customHideBadges && window.customHideBadges(card);
      currentX = 0;
      currentY = 0;
    }
    
    hasMoved = false;
  });
}

export async function updateMatchesCount() {
  const badge = document.getElementById("matches-count");
  if (!badge) return;
  try {
    const url = `${window.API_URL}/matches?userId=${window.currentUser.userId}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data)) {
      badge.style.display = "none";
      return;
    }
    const count = new Set(json.data.map(m => m.id)).size;
    badge.textContent = count > 0 ? count : "";
    badge.style.display = count > 0 ? "inline-block" : "none";
  } catch (err) {
    console.error("❌ updateMatchesCount:", err);
  }
}

export function updateSwipeScreen() {
    window.updateMatchesCount && window.updateMatchesCount();
    const bigAvatar = document.querySelector("#screen-swipe .avatar_small_2");
    const userId2El = document.querySelector("#screen-swipe .user-id2");
    if (bigAvatar) {
        if (window.currentUser.photos && window.currentUser.photos.length > 0 && window.currentUser.photos[0]) {
            bigAvatar.src = window.currentUser.photos[0];
        } else {
            bigAvatar.src = '/img/avatar.svg'; // Fallback на корректную заглушку
        }
    }
    if (userId2El) {
        const displayName = window.currentUser.name.length > 10 ? window.currentUser.name.substring(0, 10) + '...' : window.currentUser.name;
        userId2El.innerHTML = `<span class="user-link">${displayName}</span>`;
    }
}

// Глобальная переменная для хранения списка пользователей, которые поставили лайк
window.likesReceivedList = new Set();

/**
 * Загружает список пользователей, которые поставили лайк текущему пользователю
 */
async function loadLikesReceived() {
  if (!window.currentUser?.userId) {
    console.log('[swipe.js] ⚠️ loadLikesReceived: нет userId');
    return;
  }
  
  try {
    console.log('[swipe.js] 🔵 Загружаем полученные лайки для userId:', window.currentUser.userId);
    const response = await fetchLikesReceived(window.currentUser.userId);
    console.log('[swipe.js] ✅ Ответ API для полученных лайков:', response);
    if (response && response.success) {
      // API возвращает массив пользователей в response.users
      const users = response.users || response.data || [];
      window.likesReceivedList = new Set(users.map(String));
      console.log('[swipe.js] ✅ Загружен список полученных лайков:', Array.from(window.likesReceivedList));
      console.log('[swipe.js] ✅ Количество полученных лайков:', window.likesReceivedList.size);
    } else {
      console.warn('[swipe.js] ⚠️ API вернул success=false или пустой ответ');
      window.likesReceivedList = new Set();
    }
  } catch (err) {
    console.error('[swipe.js] ❌ Ошибка загрузки полученных лайков:', err);
    window.likesReceivedList = new Set();
  }
}

/**
 * Показывает плашку "Мэтч 💯" в правом верхнем углу карточки, если кандидат поставил лайк и пользователь PRO
 */
function showMatchBadgeIfLiked(cardEl, candidate) {
  console.log('[swipe.js] 🔵 ========== showMatchBadgeIfLiked ВЫЗВАНА ==========');
  if (!cardEl || !candidate) {
    console.log('[swipe.js] ⚠️ showMatchBadgeIfLiked: нет cardEl или candidate', { cardEl: !!cardEl, candidate: !!candidate });
    return;
  }
  
  // Проверяем, является ли пользователь PRO
  const now = Date.now();
  const isPro = window.currentUser && 
    (window.currentUser.is_pro === true || window.currentUser.is_pro === 'true' || window.currentUser.is_pro === 1) &&
    window.currentUser.pro_end && 
    new Date(window.currentUser.pro_end).getTime() > now;
  
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: isPro =', isPro);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: currentUser.is_pro =', window.currentUser?.is_pro);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: currentUser.pro_end =', window.currentUser?.pro_end);
  
  if (!isPro) {
    // Удаляем плашку, если она есть, но пользователь не PRO
    const existingBadge = cardEl.querySelector('.match-badge-pro');
    if (existingBadge) existingBadge.remove();
    console.log('[swipe.js] ⚠️ showMatchBadgeIfLiked: пользователь не PRO, удаляем плашку');
    return;
  }
  
  // Проверяем, поставил ли кандидат лайк
  const candidateId = String(candidate.id || candidate.userId || '');
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: candidateId =', candidateId);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: candidate =', candidate);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: likesReceivedList =', window.likesReceivedList);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: likesReceivedList type =', typeof window.likesReceivedList);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: likesReceivedList size =', window.likesReceivedList?.size);
  
  if (!window.likesReceivedList) {
    console.warn('[swipe.js] ⚠️ showMatchBadgeIfLiked: likesReceivedList не загружен, инициализируем пустым Set');
    window.likesReceivedList = new Set();
  }
  
  const hasLiked = window.likesReceivedList.has(candidateId);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: hasLiked =', hasLiked, 'для candidateId', candidateId);
  console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: проверка Set.has:', window.likesReceivedList.has(candidateId));
  
  // Удаляем старую плашку, если она есть
  const existingBadge = cardEl.querySelector('.match-badge-pro');
  if (existingBadge) {
    console.log('[swipe.js] 🔵 showMatchBadgeIfLiked: удаляем существующую плашку');
    existingBadge.remove();
  }
  
  if (hasLiked) {
    // Создаем плашку "Мэтч 💯"
    const badge = document.createElement('div');
    badge.className = 'match-badge-pro';
    badge.textContent = 'Мэтч 💯';
    // Используем конкретные значения вместо CSS переменных для гарантированной видимости
    badge.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; background-color: #9f722f !important; color: #ffffff !important; padding: 8px 16px !important; border-radius: 20px !important; font-size: 14px !important; font-weight: bold !important; z-index: 10000 !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
    cardEl.appendChild(badge);
    console.log('[swipe.js] ✅ Плашка "Мэтч 💯" добавлена для кандидата:', candidateId);
    console.log('[swipe.js] ✅ Плашка добавлена в DOM, элемент:', badge);
    console.log('[swipe.js] ✅ Плашка стили:', badge.style.cssText);
    // Проверяем computed styles
    setTimeout(() => {
      const computed = window.getComputedStyle(badge);
      console.log('[swipe.js] ✅ Плашка computed styles:', {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        zIndex: computed.zIndex,
        position: computed.position,
        top: computed.top,
        right: computed.right
      });
    }, 100);
  } else {
    console.log('[swipe.js] ℹ️ showMatchBadgeIfLiked: кандидат', candidateId, 'не лайкнул, плашка не показывается');
  }
  console.log('[swipe.js] 🔵 ========== showMatchBadgeIfLiked ЗАВЕРШЕНА ==========');
}

// --- ДОБАВИТЬ: функция для обновления пользователя после изменений ---
export async function refreshCurrentUser() {
  try {
    const userId = window.currentUser?.userId;
    if (!userId) return;
    const updated = await window.getUser(userId);
    if (updated && updated.success && updated.data) {
      // Обновляем данные пользователя
      const d = updated.data;
      window.currentUser.likes = d.likes || window.currentUser.likes || [];
      window.currentUser.dislikes = d.dislikes || window.currentUser.dislikes || [];
      window.currentUser.matches = d.matches || window.currentUser.matches || [];
      if (typeof updateSwipeScreen === 'function') updateSwipeScreen();
      
      // Перезагружаем кандидатов, чтобы исключить уже лайкнутых/дизлайкнутых
      await loadCandidates();
    }
  } catch (e) {
    console.error('Ошибка обновления пользователя:', e);
  }
}

export async function loadCandidates() {
  const userId = window.currentUser?.userId;
  const gender = window.currentUser?.gender;
  
  if (!userId || !gender) {
    console.warn('[loadCandidates] Недостаточно данных: userId или gender отсутствует');
    window.candidates = [];
    window.currentIndex = 0;
    if (typeof updateSwipeScreen === 'function') updateSwipeScreen();
    return;
  }
  
  try {
    // Определяем противоположный пол
    const opposite = gender === "male" ? "female" : "male";
    const url = `${window.API_URL}/candidates?userId=${userId}&oppositeGender=${opposite}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (!json || !json.success) {
      window.showToast && window.showToast('Ошибка загрузки кандидатов: ' + (json?.error || 'Неизвестная ошибка'));
      window.candidates = [];
      window.currentIndex = 0;
      if (typeof updateSwipeScreen === 'function') updateSwipeScreen();
      return;
    }
    // Бэкенд возвращает данные в json.data, а не json.candidates
    const candidates = json.data || [];
    
    // Фильтруем уже лайкнутых/дизлайкнутых (на всякий случай, хотя бэкенд уже фильтрует)
    const liked = new Set((window.currentUser?.likes || []).map(String));
    const disliked = new Set((window.currentUser?.dislikes || []).map(String));
    const filtered = candidates.filter(c => 
      !liked.has(String(c.id || c.userId)) && 
      !disliked.has(String(c.id || c.userId))
    );
    
    window.candidates = filtered;
    window.currentIndex = 0;
    if (typeof updateSwipeScreen === 'function') updateSwipeScreen();
  } catch (e) {
    console.error('[loadCandidates] error:', e);
    window.candidates = [];
    window.currentIndex = 0;
    if (typeof updateSwipeScreen === 'function') updateSwipeScreen();
  }
}

export async function initSwipeScreen() {
  console.log('[swipe.js] 🔵 ========== initSwipeScreen ВЫЗВАНА ==========');
  showSwipeSkeleton();
  // setTimeout(() => { hideSwipeSkeleton(); }, 2000); // УБРАНО: отладочный таймаут
  // Обновляем UI (аватар, имя, бейдж)
  window.updateSwipeScreen && window.updateSwipeScreen();
  window.updateMatchesCount && window.updateMatchesCount();
  
  // Загружаем список полученных лайков для PRO пользователей
  const now = Date.now();
  console.log('[swipe.js] 🔵 initSwipeScreen: проверка PRO статуса');
  console.log('[swipe.js] 🔵 initSwipeScreen: window.currentUser =', window.currentUser);
  const isPro = window.currentUser && 
    (window.currentUser.is_pro === true || window.currentUser.is_pro === 'true' || window.currentUser.is_pro === 1) &&
    window.currentUser.pro_end && 
    new Date(window.currentUser.pro_end).getTime() > now;
  console.log('[swipe.js] 🔵 initSwipeScreen: isPro =', isPro);
  if (isPro) {
    console.log('[swipe.js] 🔵 initSwipeScreen: PRO активен, загружаем likesReceived');
    await loadLikesReceived();
    console.log('[swipe.js] ✅ initSwipeScreen: likesReceived загружен, список:', Array.from(window.likesReceivedList || []));
  } else {
    console.log('[swipe.js] ⚠️ initSwipeScreen: пользователь не PRO, пропускаем загрузку likesReceived');
  }

  // Навешиваем переход на профиль по клику на аватар
  const avatarFrame = document.querySelector("#screen-swipe .ava-frame");
  if (avatarFrame) {
    if (document.querySelector("#screen-swipe .header-pro-badge")) {
      avatarFrame.classList.add("has-pro");
    } else {
      avatarFrame.classList.remove("has-pro");
    }
    avatarFrame.style.cursor = "pointer";
    avatarFrame.onclick = () => {
      window.viewingCandidate = null;
      window.showScreen && window.showScreen("screen-profile");
    };
  }

  // Загружаем пользователя и кандидатов
  await window.loadCandidates();
  
  // ПОВТОРНО загружаем likesReceived после загрузки кандидатов (на случай если данные изменились)
  if (isPro) {
    console.log('[swipe.js] 🔵 initSwipeScreen: повторная загрузка likesReceived после loadCandidates');
    await loadLikesReceived();
    console.log('[swipe.js] ✅ initSwipeScreen: likesReceived перезагружен, список:', Array.from(window.likesReceivedList || []));
  }
  
  window.setupSwipeControls && window.setupSwipeControls();
  
  // После загрузки кандидатов и лайков показываем первого кандидата с бейджем
  if (window.candidates && window.candidates.length > 0) {
    window.showCandidate && window.showCandidate();
  }
  // Проверяем PRO статус с учетом срока действия (как в pro.js)
  // Используем переменные now и isPro, объявленные выше (строки 1531-1535)
  if (isPro) {
    sendPush({ userId: window.currentUser.userId });
  }
  if (window.currentUser.needPhoto === 1) {
    window.candidates = [];
    window.showCandidate && window.showCandidate();
    window.updateMatchesCount && window.updateMatchesCount();
    window.currentIndex = 0;
    hideSwipeSkeleton();
  } else {
    await window.loadCandidates();
    hideSwipeSkeleton();
  }
}

function showSwipeSkeleton() {
  let skeleton = document.getElementById('swipe-skeleton');
  if (!skeleton) {
    // Если skeleton был удалён, создаём его заново из шаблона
    const swipeScreen = document.getElementById('screen-swipe');
    if (swipeScreen) {
      const skeletonHTML = `
      <div class="card-container" id="swipe-skeleton" style="display: block;">
        <div class="photo-frame">
          <div class="card skeleton">
            <div class="user-info">
              <div class="name-age-container"></div>
              <div class="candidate-goals">
                <div class="skeleton skeleton--text" style="width: 80%; height: 14px;"></div>
              </div>
              <p class="user-bio">
                <span class="skeleton skeleton--text" style="width: 40%; height: 20px"></span>
                <span class="skeleton skeleton--text" style="width: 70%;"></span>
              </p>
            </div>
          </div>
        </div>
      </div>`;
      swipeScreen.insertAdjacentHTML('afterbegin', skeletonHTML);
    }
  }
}

function hideSwipeSkeleton() {
  const skeleton = document.getElementById('swipe-skeleton');
  if (skeleton) {
    skeleton.remove();
  }
} 

// КРИТИЧНО: Устанавливаем MutationObserver для отслеживания изменений кнопки "Помахать"
function setupWaveButtonObserver() {
  const observer = new MutationObserver((mutations) => {
    const dislikeBtn = document.querySelector(".dislike_d");
    if (dislikeBtn) {
      const hasWaveBtn = dislikeBtn.classList.contains('wave-btn');
      const hasChatBtn = dislikeBtn.classList.contains('chat-btn');
      const hasWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
      const hasChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
      
      // Если кнопка "Помахать" появилась, но мы НЕ в mutual match режиме - сбрасываем
      if ((hasWaveBtn || hasChatBtn || hasWaveSvg || hasChatSvg) && !window.inMutualMatch) {
        console.error('🚨 [MutationObserver] КРИТИЧНО: Кнопка "Помахать" обнаружена, но inMutualMatch=false! Сбрасываем...', {
          hasWaveBtn,
          hasChatBtn,
          hasWaveSvg,
          hasChatSvg,
          inMutualMatch: window.inMutualMatch
        });
        
        // АГРЕССИВНЫЙ СБРОС
        dislikeBtn.classList.remove('wave-btn', 'chat-btn');
        dislikeBtn.className = 'dislike_d';
        dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
        dislikeBtn.style.backgroundColor = '';
        dislikeBtn.style.fontSize = '';
        dislikeBtn.onclick = null;
      }
    }
  });
  
  // Наблюдаем за изменениями в DOM
  const targetNode = document.body;
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    console.log('✅ [MutationObserver] Наблюдатель за кнопкой "Помахать" установлен');
  }
}

// Устанавливаем наблюдатель после загрузки DOM
console.log('🔵 [setupWaveButtonObserver] Инициализация, readyState:', document.readyState);
if (document.readyState === 'loading') {
  console.log('🔵 [setupWaveButtonObserver] DOM еще загружается, ждем DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔵 [setupWaveButtonObserver] DOMContentLoaded, устанавливаем наблюдатель');
    setupWaveButtonObserver();
  });
} else {
  console.log('🔵 [setupWaveButtonObserver] DOM уже готов, устанавливаем наблюдатель сразу');
  setupWaveButtonObserver();
}

// Также устанавливаем периодическую проверку на всякий случай
let checkCount = 0;
const intervalId = setInterval(() => {
  checkCount++;
  const dislikeBtn = document.querySelector(".dislike_d");
  if (dislikeBtn) {
    const hasWaveBtn = dislikeBtn.classList.contains('wave-btn');
    const hasChatBtn = dislikeBtn.classList.contains('chat-btn');
    const hasWaveSvg = dislikeBtn.innerHTML.includes('wave.svg');
    const hasChatSvg = dislikeBtn.innerHTML.includes('chat.svg');
    const inMutualMatch = window.inMutualMatch;
    
    // Логируем каждые 50 проверок (5 секунд)
    if (checkCount % 50 === 0) {
      console.log('🔵 [setInterval] Проверка #' + checkCount + ', кнопка найдена:', !!dislikeBtn, 'inMutualMatch:', inMutualMatch, 'hasWaveBtn:', hasWaveBtn, 'hasWaveSvg:', hasWaveSvg);
    }
    
    if ((hasWaveBtn || hasChatBtn || hasWaveSvg || hasChatSvg) && !inMutualMatch) {
      console.error('🚨 [setInterval] КРИТИЧНО: Кнопка "Помахать" обнаружена в периодической проверке! Сбрасываем...', {
        checkCount,
        hasWaveBtn,
        hasChatBtn,
        hasWaveSvg,
        hasChatSvg,
        inMutualMatch,
        className: dislikeBtn.className,
        innerHTML: dislikeBtn.innerHTML.substring(0, 100)
      });
      dislikeBtn.classList.remove('wave-btn', 'chat-btn');
      dislikeBtn.className = 'dislike_d';
      dislikeBtn.innerHTML = `<svg class="dislike-icon" width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect class="st0" x="29.5" y="14.61" width="5" height="34.78" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/><rect class="st0" x="14.61" y="29.5" width="34.78" height="5" rx="2.5" ry="2.5" transform="translate(-13.25 32) rotate(-45)"/></svg>`;
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
      dislikeBtn.onclick = null;
    }
  }
}, 100); // Проверяем каждые 100ms
console.log('✅ [setInterval] Периодическая проверка установлена, intervalId:', intervalId);

// Экспортируем все функции в window для глобального доступа
window.showCandidate = showCandidate; 
window.setupSwipeControls = setupSwipeControls;
window.setupSwipeHandlers = setupSwipeHandlers;
window.doLike = doLike;
window.doDislike = doDislike;
window.moveToNextCandidate = moveToNextCandidate;
window.onMutualLike = onMutualLike;
window.onSuperMatch = onSuperMatch;
window.onSuperPending = onSuperPending;
window.onSuperRejected = onSuperRejected;
window.updateMatchesCount = updateMatchesCount;
window.loadCandidates = loadCandidates;
window.initSwipeScreen = initSwipeScreen;
window.updateSwipeScreen = updateSwipeScreen;
window.showPreviousCandidate = showPreviousCandidate;
window.customHideBadges = customHideBadges;
window.customRenderPaginator = customRenderPaginator;
window.cyclePhoto = cyclePhoto;
window.openChat = openChat;
window.showToast = showToast;
// КРИТИЧНО: Экспортируем обработчики кнопок лайк/дизлайк
window.attachLikeHandler = attachLikeHandler;
window.attachDislikeHandler = attachDislikeHandler;
window.handleLikeClick = handleLikeClick;
window.handleDislikeClick = handleDislikeClick;
window.showMatchBadgeIfLiked = showMatchBadgeIfLiked; 