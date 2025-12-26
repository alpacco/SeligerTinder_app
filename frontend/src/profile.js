console.log('profile.js loaded');
// Модуль profile.js: ВСЯ ЛОГИКА ПРОФИЛЯ пользователя (просмотр, редактирование, фото, цели, статистика)
// Экспортируемые функции:
// - updateProfileScreen() - отрисовка профиля пользователя (имя, возраст, фото, бейдж, цели)
// - enterProfileEditMode() - вход в режим редактирования профиля с анимацией
// - initProfileEditScreen() - инициализация экрана редактирования (поля, фото-карусель, цели)
// - handlePhotoAddition() - добавление нового фото (загрузка, сохранение, обновление UI)
// - handlePhotoDeletion(index) - удаление фото по индексу (локально и на сервере)
// - exitProfileEditMode() - выход из режима редактирования с анимацией возврата
// 
// Перенесено из main.js:
// - updateProfileScreen (была функция обновления экрана профиля)
// - enterProfileEditMode (была функция входа в режим редактирования)
// - initProfileEditScreen (была функция инициализации экрана редактирования)
// - handlePhotoAddition (была функция добавления фото)
// - handlePhotoDeletion (была функция удаления фото)
// - exitProfileEditMode (была функция выхода из режима редактирования)
// - Вся логика работы с целями
// - Обработчики кнопок редактирования профиля
// - Логика фото-карусели в режиме редактирования
// - Сохранение изменений профиля

console.log("🔍 [profile.js] Начало загрузки profile.js");

// Импортируем необходимые функции и переменные
import { updateProfile, saveGoals, fetchGoals, sendPush } from './api.js';
import { renderPaginator } from './utils.js';
import { fillCard, renderCardGoals } from './card.js';
import { openChat } from './swipe.js';
import { showGiftModal } from './gift.js';
import { showProModal, initProModalHandlers } from './pro-modal.js';
// Динамический импорт user-actions для избежания проблем с Vite
let loadUserData, handlePhotoAddition;
import('./user-actions.js').then(module => {
  loadUserData = module.loadUserData;
  handlePhotoAddition = module.handlePhotoAddition;
}).catch(err => {
  console.warn('Не удалось загрузить user-actions:', err);
});
// import { showScreen } from './main.js';

// updateProfileScreen — отрисовка профиля пользователя
export function updateProfileScreen() {
  const currentUser = window.currentUser;
  if (!currentUser) {
    console.error("currentUser не найден");
    return;
  }

  const picture = document.getElementById("profileCard");
  const userInfo = document.querySelector("#screen-profile .user-info");
  const nameEl = document.querySelector("#screen-profile .name-age-container .user-name");
  const ageEl = document.querySelector("#screen-profile .name-age-container .user-age");
  const bioEl = document.querySelector("#screen-profile .user-info .user-bio");
  let paginator = document.querySelector("#screen-profile .user-info .paginator");

  // Восстанавливаем отображение всех элементов профиля
    if (userInfo) userInfo.style.display = "";
    if (nameEl) nameEl.style.display = "";
    if (ageEl) ageEl.style.display = "";
    if (bioEl) bioEl.style.display = "";
    if (paginator) paginator.style.display = "";

  if (picture && userInfo) {
    // Очищаем старые данные
    const oldBadge = userInfo.querySelector(".badge-wrapper");
    if (oldBadge) oldBadge.remove();
    
    // Очищаем футтер кандидата (если был)
    const profileContainer = document.querySelector('#screen-profile .profile-container');
    if (profileContainer) {
      const oldFooter = profileContainer.querySelector('.profile-footer');
      if (oldFooter) {
        oldFooter.remove();
      }
    }
    
    // Обновляем имя и возраст
    if (nameEl) {
      nameEl.textContent = currentUser.name || 'Пользователь';
    }
    if (ageEl) {
      if (!currentUser.hideAge && currentUser.age) {
        ageEl.textContent = `${currentUser.age} лет`;
        ageEl.style.display = "";
      } else {
        ageEl.style.display = "none";
      }
    }
    
    // Обновляем био
    if (bioEl) {
      bioEl.textContent = currentUser.bio || "";
    }
    
    // Обновляем бейдж
    if (currentUser.badge && currentUser.badge.trim() !== "") {
      const badgeDiv = document.createElement("div");
      badgeDiv.className = "badge-wrapper";
      // Нормализуем badge: убираем пути, слэши и расширения
      let badgeName = String(currentUser.badge).trim();
      badgeName = badgeName.replace(/^.*\//, ''); // Убираем все до последнего слэша
      badgeName = badgeName.replace(/\.svg$/i, ''); // Убираем расширение .svg если есть
      badgeName = badgeName.replace(/[\/\\\.]+/g, ''); // Убираем лишние точки и слэши
      badgeDiv.innerHTML = `<img src="/img/labels/${badgeName}.svg" alt="Badge" class="badge-image">`;
      userInfo.prepend(badgeDiv);
    }
    
    // Обновляем фото
    let photosArr = currentUser.photos || [];
    if (photosArr.length === 0) {
      photosArr = ["/img/photo.svg"];
    }
    
    const photoUrl = photosArr[0];
    const finalUrl = photoUrl.startsWith('data:') ? photoUrl : `${photoUrl}?cb=${Date.now()}`;
    picture.style.backgroundImage = `url('${finalUrl}')`;
    // Явно выставляем стили для фото профиля
    picture.style.backgroundSize = "cover";
    picture.style.backgroundPosition = "center";
    picture.style.backgroundRepeat = "no-repeat";
    
    // --- Градиент снизу ---
    let gradient = picture.querySelector('.gradient-card');
    if (!gradient) {
      gradient = document.createElement('div');
      gradient.className = 'gradient-card';
      picture.appendChild(gradient);
    }
    
    // Пагинатор только если фото больше одного
    if (currentUser.photos && currentUser.photos.length > 1) {
      if (!paginator && userInfo) {
        paginator = document.createElement('div');
        paginator.className = 'paginator';
        userInfo.appendChild(paginator);
      }
      if (paginator) {
        import('./utils.js').then(({ renderPaginator }) => {
          renderPaginator(paginator, currentUser.photos.length, 0);
        });
      }
    } else {
      // Если фото 1 или нет — удаляем пагинатор если он был
      if (paginator) paginator.remove();
    }
    
    // Настраиваем переключение фото
    let profilePhotoIndex = 0;
    picture.onclick = () => {
      if (photosArr.length < 2) return;
      profilePhotoIndex = (profilePhotoIndex + 1) % photosArr.length;
      const nextPhotoUrl = photosArr[profilePhotoIndex];
      const nextFinalUrl = nextPhotoUrl.startsWith('data:') ? nextPhotoUrl : `${nextPhotoUrl}?cb=${Date.now()}`;
      picture.style.backgroundImage = `url('${nextFinalUrl}')`;
      
      // Обновляем пагинатор при переключении фото
      if (paginator) {
        import('./utils.js').then(({ renderPaginator }) => {
          renderPaginator(paginator, photosArr.length, profilePhotoIndex);
        });
      }
    };
    
    // --- Цели профиля ---
    // Удаляем старый контейнер целей, если есть
    let oldGoals = picture.querySelector('.candidate-goals');
    if (oldGoals) oldGoals.remove();
    // Создаем контейнер для целей, если его нет
    let goalsContainer = picture.querySelector('.candidate-goals');
    if (!goalsContainer) {
      goalsContainer = document.createElement('div');
      goalsContainer.className = 'candidate-goals left';
      picture.appendChild(goalsContainer);
    }
    // Пытаемся отрендерить цели
    import('./card.js').then(({ renderCardGoals }) => {
      renderCardGoals(picture, currentUser.userId || currentUser.id);
    });
  }
}

// Вход в режим редактирования профиля
export function enterProfileEditMode() {
  const pictureEl = document.getElementById("profileCard");
  const infoContainer = document.querySelector("#screen-profile .user-info");
  if (!pictureEl || !infoContainer) {
    console.error("Элементы карточки или информации не найдены");
    return;
  }
  pictureEl.style.transition = "transform 0.4s ease";
  pictureEl.style.transformOrigin = "top center";
  pictureEl.style.transform = "scale(0.5)";
  infoContainer.style.transition = "opacity 0.4s ease, transform 0.4s ease";
  infoContainer.style.opacity = "0";
  infoContainer.style.transform = "translateY(2vh)";
  setTimeout(() => {
    showScreen("screen-profile-edit");
    initProfileEditScreen();
  }, 400);
}

// Инициализация экрана редактирования профиля
export function initProfileEditScreen() {
  const currentUser = window.currentUser;
  // Гарантируем глобальные ссылки
  if (typeof window.handlePhotoAddition !== 'function' && typeof handlePhotoAddition === 'function') {
    window.handlePhotoAddition = handlePhotoAddition;
  }
  if (typeof window.loadUserData !== 'function' && typeof loadUserData === 'function') {
    window.loadUserData = loadUserData;
  }
  // --- Общая переменная для скрытых кнопок ---
  let removedButtons = null;
  // --- Initialize basic fields ---
  const bioInput = document.getElementById('edit-bio-input');
  if (bioInput) {
    bioInput.value = currentUser.bio || '';
    // Стилизация: отступы и цвет
    bioInput.style.paddingLeft = '20px';
    bioInput.style.paddingRight = '20px';
    bioInput.style.color = '#202022';
    bioInput.addEventListener('input', function() {
      bioInput.style.color = '#202022';
    });
    
    // Добавляем обработчики для поля био
    bioInput.addEventListener('focus', function() {
      const carousel = document.querySelector('.edit-photo-carousel');
      const ageContainer = document.querySelector('.edit-age-container');
      const goalContainer = document.querySelector('.goal-container');
      const buttonsContainer = document.querySelector('.edit-buttons-container');
      // Функция для полного скрытия всего кроме bio
      function hideAllExceptBio() {
        if (carousel) carousel.style.display = 'none';
        if (ageContainer) ageContainer.style.display = 'none';
        if (goalContainer) goalContainer.style.display = 'none';
        if (buttonsContainer && buttonsContainer.parentNode) {
          removedButtons = buttonsContainer;
          buttonsContainer.parentNode.removeChild(buttonsContainer);
        }
        // Абсолютное позиционирование bioInput
        bioInput.style.position = 'fixed';
        bioInput.style.top = '50%';
        bioInput.style.left = '0';
        bioInput.style.right = '0';
        bioInput.style.transform = 'translateY(-50%)';
        bioInput.style.zIndex = '2000';
        bioInput.style.width = '100%';
        bioInput.style.maxWidth = '400px';
        bioInput.style.margin = '0 auto';
        bioInput.style.background = '#fff';
        bioInput.style.paddingBottom = 'env(safe-area-inset-bottom, 30px)';
      }
      // Многократное повторение скрытия для борьбы с гонками событий
      let repeat = 0;
      function repeatHide() {
        hideAllExceptBio();
        repeat++;
        if (repeat < 5) {
          setTimeout(repeatHide, 60);
        } else {
          requestAnimationFrame(hideAllExceptBio);
        }
      }
      repeatHide();
    });
    
    function restoreEditButtons() {
      const carousel = document.querySelector('.edit-photo-carousel');
      const ageContainer = document.querySelector('.edit-age-container');
      const goalContainer = document.querySelector('.goal-container');
      if (carousel) carousel.style.display = 'flex';
      if (ageContainer) ageContainer.style.display = 'flex';
      if (goalContainer) goalContainer.style.display = 'block';
      if (removedButtons && !document.body.contains(removedButtons)) {
        // Вставляем кнопки обратно в DOM
        const parent = document.querySelector('.profile-edit-content') || document.body;
        parent.appendChild(removedButtons);
        removedButtons = null;
      }
      bioInput.style.position = '';
      bioInput.style.top = '';
      bioInput.style.left = '';
      bioInput.style.transform = '';
      bioInput.style.zIndex = '';
      bioInput.style.width = '';
      bioInput.style.maxWidth = '';
      bioInput.style.margin = '';
      bioInput.style.background = '';
      bioInput.style.paddingBottom = '';
    }
    
    bioInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        restoreEditButtons();
        bioInput.blur();
      }
    });
    document.addEventListener('click', function(e) {
      if (e.target !== bioInput && bioInput.style.position === 'fixed') {
        restoreEditButtons();
      }
    });
  }
  const ageInput = document.getElementById('edit-age-input');
  if (ageInput) {
    ageInput.value = currentUser.age || '';
    // Стилизация: цвет
    ageInput.style.color = '#202022';
    // --- Аналогичное скрытие кнопок и элементов при фокусе на ageInput ---
    ageInput.addEventListener('focus', function() {
      const buttonsContainer = document.querySelector('.edit-buttons-container');
      if (buttonsContainer && buttonsContainer.parentNode) {
        removedButtons = buttonsContainer;
        buttonsContainer.parentNode.removeChild(buttonsContainer);
      }
    });
    function restoreEditButtonsAge() {
      if (removedButtons && !document.body.contains(removedButtons)) {
        const parent = document.querySelector('.profile-edit-content') || document.body;
        parent.appendChild(removedButtons);
        removedButtons = null;
      }
    }
    ageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        restoreEditButtonsAge();
        ageInput.blur();
      }
    });
    document.addEventListener('click', function(e) {
      if (e.target !== ageInput && removedButtons) {
        restoreEditButtonsAge();
      }
    });
  }
  // --- Age toggle logic ---
  const ageToggleIcon = document.getElementById('age-toggle-icon');
  const ageLabel = document.querySelector('.age-label');
  const ageContainer = document.querySelector('.edit-age-container');
  
  console.log('[AGE TOGGLE][INIT] Инициализация:', {
    ageToggleIcon: !!ageToggleIcon,
    ageInput: !!ageInput,
    ageLabel: !!ageLabel,
    ageContainer: !!ageContainer,
    currentUserHideAge: currentUser.hideAge
  });
  
  if (ageToggleIcon && ageInput) {
    // Удаляем старые обработчики, если есть
    const newAgeToggleIcon = ageToggleIcon.cloneNode(true);
    ageToggleIcon.parentNode.replaceChild(newAgeToggleIcon, ageToggleIcon);
    const freshAgeToggleIcon = document.getElementById('age-toggle-icon');
    
    // Инициализация состояния
    if (currentUser.hideAge) {
      freshAgeToggleIcon.classList.remove('active');
      freshAgeToggleIcon.style.backgroundImage = "url('/img/eye_close.svg')";
      ageInput.disabled = true;
      ageInput.setAttribute('disabled', 'disabled');
      ageInput.style.filter = "grayscale(100%) opacity(0.5)";
      ageInput.style.opacity = "0.5";
      if (ageLabel) {
        ageLabel.style.color = "#999";
        ageLabel.style.opacity = "0.5";
      }
      console.log('[AGE TOGGLE][INIT] Возраст неактивен при инициализации');
    } else {
      freshAgeToggleIcon.classList.add('active');
      freshAgeToggleIcon.style.backgroundImage = "url('/img/eye_open.svg')";
      ageInput.disabled = false;
      ageInput.removeAttribute('disabled');
      ageInput.style.filter = "none";
      ageInput.style.opacity = "1";
      if (ageLabel) {
        ageLabel.style.color = "";
        ageLabel.style.opacity = "1";
      }
      console.log('[AGE TOGGLE][INIT] Возраст активен при инициализации');
    }
    
    // Устанавливаем обработчик клика
    freshAgeToggleIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🔵 [AGE TOGGLE][CLICK] Клик по иконке глаза!');
      console.log('  - Элемент:', freshAgeToggleIcon);
      console.log('  - ID:', freshAgeToggleIcon.id);
      console.log('  - Класс до:', freshAgeToggleIcon.className);
      console.log('  - backgroundImage до:', freshAgeToggleIcon.style.backgroundImage);
      console.log('  - currentUser.hideAge до:', currentUser.hideAge);
      console.log('  - ageInput.disabled до:', ageInput.disabled);
      console.log('  - ageLabel до:', ageLabel ? ageLabel.textContent : 'не найден');
      console.log('  - ageContainer до:', ageContainer ? ageContainer.style.display : 'не найден');
      
      const isNowVisible = freshAgeToggleIcon.classList.toggle('active');
      console.log('  - isNowVisible после toggle:', isNowVisible);
      
      if (isNowVisible) {
        // Активируем возраст
        console.log('  ✅ [AGE TOGGLE] Активируем возраст');
        freshAgeToggleIcon.style.backgroundImage = "url('/img/eye_open.svg')";
        ageInput.disabled = false;
        ageInput.removeAttribute('disabled');
        ageInput.style.filter = "none";
        ageInput.style.opacity = "1";
        ageInput.style.color = "rgb(32, 32, 34)";
        if (ageLabel) {
          ageLabel.style.color = "";
          ageLabel.style.opacity = "1";
        }
        currentUser.hideAge = false;
        window.currentUser.hideAge = false;
        console.log('  ✅ [AGE TOGGLE] После активации: disabled=', ageInput.disabled, 'opacity=', ageInput.style.opacity);
        // Сохраняем на сервер
        saveHideAgeToServer(false);
      } else {
        // Деактивируем возраст (бледнеет, но остается видимым)
        console.log('  ❌ [AGE TOGGLE] Деактивируем возраст (бледнеет)');
        freshAgeToggleIcon.style.backgroundImage = "url('/img/eye_close.svg')";
        ageInput.disabled = true;
        ageInput.setAttribute('disabled', 'disabled');
        ageInput.style.filter = "grayscale(100%) opacity(0.5)";
        ageInput.style.opacity = "0.5";
        if (ageLabel) {
          ageLabel.style.color = "#999";
          ageLabel.style.opacity = "0.5";
          console.log('  ❌ [AGE TOGGLE] Лейбл затемнен');
          }
        currentUser.hideAge = true;
        window.currentUser.hideAge = true;
        console.log('  ❌ [AGE TOGGLE] После деактивации: disabled=', ageInput.disabled, 'opacity=', ageInput.style.opacity);
        // Сохраняем на сервер
        saveHideAgeToServer(true);
      }
      
      console.log('🔵 [AGE TOGGLE][CLICK] Финальное состояние:', {
        className: freshAgeToggleIcon.className,
        backgroundImage: freshAgeToggleIcon.style.backgroundImage,
        hideAge: currentUser.hideAge,
        ageInputDisabled: ageInput.disabled,
        ageInputOpacity: ageInput.style.opacity,
        ageLabelOpacity: ageLabel ? ageLabel.style.opacity : 'не найден',
        ageLabelColor: ageLabel ? ageLabel.style.color : 'не найден'
      });
    });
    
    console.log('[AGE TOGGLE][INIT] Обработчик клика установлен');
  } else {
    console.error('[AGE TOGGLE][INIT] Ошибка: не найдены элементы', {
      ageToggleIcon: !!ageToggleIcon,
      ageInput: !!ageInput
    });
  }
  // --- Initialize Photo Carousel ---
  const carousel = document.querySelector('.edit-photo-carousel');
  if (carousel) {
    carousel.innerHTML = '';
    const ghostLeft = document.createElement('div');
    ghostLeft.className = 'ghost-card';
    setTimeout(() => {
      const editPhotoCard = carousel.querySelector('.edit-photo-card');
      ghostLeft.style.width = editPhotoCard ? (editPhotoCard.offsetWidth / 2) + 'px' : '48px';
    }, 0);
    carousel.appendChild(ghostLeft);
    const photos = currentUser.photos || [];
    const photoCount = Math.min(photos.length, 3);
    for (let i = 0; i < photoCount; i++) {
      let card = document.createElement('div');
      card.className = 'edit-photo-card has-photo';
      card.innerHTML = '';
      const photoUrl = photos[i];
      const finalUrl = photoUrl.startsWith('data:') ? photoUrl : `${photoUrl}?cb=${Date.now()}`;
      card.style.backgroundImage = `url('${finalUrl}')`;
      // Main badge
      const mainBadge = document.createElement('div');
      mainBadge.className = 'main-badge';
      if (i === 0) {
        mainBadge.innerHTML = `<img src="/img/main_on.svg" alt="Главная"> <span>Главная</span>`;
      } else {
        mainBadge.innerHTML = `<img src="/img/main_off.svg" alt="Сделать главной"> <span>Сделать главной</span>`;
        mainBadge.onclick = () => {
          if (i > 0) {
            [photos[0], photos[i]] = [photos[i], photos[0]];
            initProfileEditScreen();
          }
        };
      }
      card.appendChild(mainBadge);
      // Delete button
      const delBtn = document.createElement('div');
      delBtn.className = 'delete-photo-btn';
      delBtn.innerHTML = `<img src="/img/dislike.svg" alt="Удалить">`;
      delBtn.onclick = (e) => {
        e.stopPropagation();
        photos.splice(i, 1);
        initProfileEditScreen();
      };
      card.appendChild(delBtn);
      carousel.appendChild(card);
    }
    // Add empty slots for new photos
    if (photoCount < 3) {
      for (let i = 0; i < 3 - photoCount; i++) {
        let card = document.createElement('div');
        card.className = 'edit-photo-card add-photo';
        card.innerHTML = '';
        card.onclick = function() {
          if (window.handlePhotoAddition) {
            window.handlePhotoAddition.call(this);
          } else {
            alert('Ошибка: функция загрузки фото не найдена!');
          }
        };
        carousel.appendChild(card);
      }
    }
    const ghostRight = document.createElement('div');
    ghostRight.className = 'ghost-card';
    setTimeout(() => {
      const editPhotoCard = carousel.querySelector('.edit-photo-card');
      ghostRight.style.width = editPhotoCard ? (editPhotoCard.offsetWidth / 2) + 'px' : '48px';
    }, 0);
    carousel.appendChild(ghostRight);
  }
  // --- Goals Logic for Edit Screen ---
  const existingGoalContainer = document.querySelector('.goal-container');
  if (existingGoalContainer) {
    existingGoalContainer.remove();
  }
  const goalContainer = document.createElement('div');
  goalContainer.className = 'goal-container';
  const goalLabel = document.createElement('label');
  goalLabel.className = 'goal-label';
  goalLabel.textContent = 'Цель знакомства:';
  goalContainer.appendChild(goalLabel);
  const goalList = document.createElement('div');
  goalList.className = 'goal-list';
  goalList.style.display = 'flex';
  goalList.style.overflowX = 'auto';
  goalList.style.gap = '12px';
  goalList.style.padding = '8px 0';
  const ghostGoalStart = document.createElement('div');
  ghostGoalStart.className = 'ghost-card';
  goalList.appendChild(ghostGoalStart);
  const allGoals = ['Серьезные отношения', 'Романтика и любовь', 'Дружба и общение', 'Создание семьи', 'Встречи без обязательств'];
  const userGoals = new Set(currentUser.goals || []);
  allGoals.forEach(goalText => {
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    goalItem.innerHTML = `<span>${goalText}</span><img src="/img/main_off.svg" class="goal-icon" />`;
    goalItem.style.scrollSnapAlign = 'center';
    if (userGoals.has(goalText)) {
      goalItem.classList.add('selected');
      const icon = goalItem.querySelector('img.goal-icon');
      if (icon) icon.src = '/img/main_on.svg';
    }
    goalItem.addEventListener('click', () => {
      const selectedCount = goalList.querySelectorAll('.goal-item.selected').length;
      if (!goalItem.classList.contains('selected') && selectedCount >= 3) {
        window.showToast('Можно выбрать не более 3 целей');
        return;
      }
      goalItem.classList.toggle('selected');
      const icon = goalItem.querySelector('img.goal-icon');
      icon.src = goalItem.classList.contains('selected') ? '/img/main_on.svg' : '/img/main_off.svg';
    });
    goalList.appendChild(goalItem);
  });
  const ghostGoalEnd = document.createElement('div');
  ghostGoalEnd.className = 'ghost-card';
  goalList.appendChild(ghostGoalEnd);
  goalContainer.appendChild(goalList);
  const parentContainer = document.querySelector('.profile-edit-content');
  const bioInputRef = document.getElementById('edit-bio-input');
  if (parentContainer && bioInputRef) {
    parentContainer.insertBefore(goalContainer, bioInputRef);
  } else {
    console.error('Не удалось найти контейнер для вставки блока целей: .profile-edit-content или #edit-bio-input');
  }
  // --- ДОБАВИТЬ: пример сохранения целей
  const saveGoalsBtn = document.getElementById('save-goals-btn');
  if (saveGoalsBtn) {
    saveGoalsBtn.onclick = async () => {
      const selectedGoals = Array.from(document.querySelectorAll('.goal-item.selected')).map(el => el.textContent.trim());
      try {
        const resp = await window.updateProfile({
          userId: window.currentUser.userId,
          goals: selectedGoals
        });
        const result = await resp.json();
        if (!result || !result.success) {
          const errorMsg = result ? result.error : "Сервер недоступен";
          window.showToast && window.showToast("Ошибка сохранения целей: " + errorMsg);
        } else {
          await refreshCurrentUser();
          window.showToast && window.showToast("Цели успешно сохранены");
        }
      } catch (err) {
        window.showToast && window.showToast("Ошибка запроса при сохранении целей");
      }
    };
  }

  // --- НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ КНОПОК "ОТМЕНА" И "ГОТОВО" ---
  const cancelBtn = document.getElementById("cancel-edit-button")
                   || document.getElementById("edit-cancel-button")
                   || document.querySelector(".edit-cancel-button");
  const saveBtn   = document.getElementById("save-edit-button")
                   || document.getElementById("edit-save-button")
                   || document.querySelector(".edit-save-button");

  if (cancelBtn) {
    // Удаляем старые обработчики
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newCancelBtn.style.pointerEvents = "auto";
    newCancelBtn.addEventListener("click", () => {
      console.log("▶ Нажата кнопка 'Отмена'");
      console.log("🔍 Пытаемся вызвать exitProfileEditMode (Отмена)...");
      if (window.exitProfileEditMode) {
        console.log("✅ Функция exitProfileEditMode найдена, вызываем...");
        window.exitProfileEditMode();
      } else {
        console.error("❌ Функция exitProfileEditMode не найдена");
        console.log("🔍 Доступные функции:", Object.keys(window).filter(k => k.includes('exit')));
        showScreen("screen-profile");
      }
    });
  }

  if (saveBtn) {
    // Удаляем старые обработчики
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.style.pointerEvents = "auto";
    newSaveBtn.addEventListener("click", () => {
      console.log("▶ Нажата кнопка 'Готово'");
      // reuse existing save logic
      const bioInput = document.getElementById("edit-bio-input");
      const ageInput = document.getElementById("edit-age-input");
      const newBio   = bioInput.value.trim();
      let   newAge   = null;
      if (!currentUser.hideAge) {
        newAge = parseInt(ageInput.value, 10);
        if (isNaN(newAge) || newAge < 1 || newAge > 99) {
          alert("Введите корректный возраст (от 1 до 99)");
          return;
        }
      }
      // Gather selected goals
      const selectedGoals = Array.from(document.querySelectorAll('.goal-item.selected')).map(el => el.textContent.trim());
      console.log('saveProfile: selectedGoals', selectedGoals);
      const profileData = {
        userId: currentUser.userId,
        bio:    newBio,
        age:    newAge,
        photos: currentUser.photos,
        goals:  selectedGoals,
        hideAge: currentUser.hideAge || false
      };
      fetch(`${window.API_URL}/updateProfile`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(profileData)
      })
        .then(resp => resp.json())
        .then(result => {
          console.log('updateProfile result:', result);
          if (!result.success) {
            alert("Ошибка сохранения профиля: " + result.error);
            return;
          }
          // First update profile fields in memory
          currentUser.bio = newBio;
          currentUser.age = newAge;
          // Then save goals
          return fetch(`${window.API_URL}/goals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUser.userId, goals: selectedGoals })
          });
        })
        .then(resp => {
          if (!resp) return; // previous block errored, bail out
          return resp.json();
        })
        .then(goalsResult => {
          if (!goalsResult) return;
          console.log('updateGoals result:', goalsResult);
          if (!goalsResult.success) {
            alert("Ошибка сохранения целей: " + goalsResult.error);
            return;
          }
          console.log("🔍 Пытаемся вызвать exitProfileEditMode...");
          if (window.exitProfileEditMode) {
            console.log("✅ Функция exitProfileEditMode найдена, вызываем...");
            window.exitProfileEditMode();
          } else {
            console.error("❌ Функция exitProfileEditMode не найдена");
            console.log("🔍 Доступные функции:", Object.keys(window).filter(k => k.includes('exit')));
            showScreen("screen-profile");
          }
        })
        .catch(err => {
          console.error("Ошибка при сохранении профиля или целей:", err);
          alert("Ошибка при сохранении профиля или целей");
        });
    });
  }
}

// Удаление фото
export async function handlePhotoDeletion(index) {
  const currentUser = window.currentUser;
  currentUser.photos.splice(index, 1);
  window.profile.initProfileEditScreen();
  // Persist deletion to server
  try {
    const profileData = {
      userId: currentUser.userId,
      bio: currentUser.bio,
      age: currentUser.age,
      photos: currentUser.photos,
      goals: Array.isArray(currentUser.goals) ? currentUser.goals : []
    };
    const resp = await window.updateProfile(profileData);
    const result = await resp.json();
    if (!result || !result.success) {
      const errorMsg = result ? result.error : "Сервер недоступен";
      console.error("Ошибка сохранения после удаления фото:", errorMsg);
      window.showToast && window.showToast("Ошибка сохранения после удаления фото");
    } else {
      await refreshCurrentUser(); // <--- ДОБАВЛЕНО
    }
  } catch (err) {
    console.error("Ошибка запроса updateProfile:", err);
    window.showToast && window.showToast("Ошибка запроса updateProfile");
  }
}

// Выход из режима редактирования
export function exitProfileEditMode() {
  const pictureEl = document.getElementById("profileCard");
  const infoContainer = document.querySelector("#screen-profile .user-info");
  const editScreen = document.getElementById("screen-profile-edit");
  if (!pictureEl || !infoContainer || !editScreen) {
    console.error("Не найдены необходимые элементы для выхода из режима редактирования.");
    showScreen("screen-profile");
    // --- ДОБАВЛЕНО: рендер пагинатора даже при ошибке ---
    let paginator = document.querySelector("#screen-profile .paginator");
    if (!paginator && infoContainer) {
      paginator = document.createElement('div');
      paginator.className = 'paginator';
      infoContainer.appendChild(paginator);
    }
    if (paginator) {
      import('./utils.js').then(({ renderPaginator }) => {
        renderPaginator(paginator, window.currentUser.photos.length, 0);
      });
    }
    return;
  }
  pictureEl.style.transition = "transform 0.4s ease";
  pictureEl.style.transformOrigin = "top center";
  pictureEl.style.transform = "scale(1)";
  infoContainer.style.transition = "opacity 0.4s ease, transform 0.4s ease";
  infoContainer.style.opacity = "1";
  infoContainer.style.transform = "translateY(0)";
  setTimeout(() => {
    showScreen("screen-profile");
    editScreen.style.display = "none";
    // --- ДОБАВЛЕНО: рендер пагинатора после возврата на профиль ---
    let paginator = document.querySelector("#screen-profile .paginator");
    if (!paginator && infoContainer) {
      paginator = document.createElement('div');
      paginator.className = 'paginator';
      infoContainer.appendChild(paginator);
    }
    if (paginator) {
      import('./utils.js').then(({ renderPaginator }) => {
        renderPaginator(paginator, window.currentUser.photos.length, 0);
      });
    }
    const gradientEl = document.querySelector("#screen-profile .gradient-card");
    if (gradientEl) {
      gradientEl.style.transition = "opacity 0.3s ease";
      gradientEl.style.opacity = "0";
      setTimeout(() => { gradientEl.style.opacity = "1"; }, 100);
    }
    if (infoContainer) {
      infoContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      infoContainer.style.opacity = "0";
      infoContainer.style.transform = "translateY(20px)";
      setTimeout(() => {
        infoContainer.style.opacity = "1";
        infoContainer.style.transform = "translateY(0)";
      }, 100);
    }
  }, 400);
}

// Универсальный рендер футтера для чужих профилей/кандидатов/мэтчей
export function renderProfileFooter(profileData, container) {
  // Удаляем старый футтер
  container.querySelector('.profile-footer')?.remove();

  // Если это твой профиль — не показываем футтер (усиленное условие)
  const currentId = String(window.currentUser?.userId || '').trim().toLowerCase();
  const profileId = String(profileData.userId || profileData.id || '').trim().toLowerCase();
  if (!profileId || profileId === currentId) {
    return;
  }

  // Создаём футтер
  const footer = document.createElement('div');
  footer.className = 'profile-footer';

  // Пример: если это мэтч с username
  if ((profileData.userId || profileData.id || '').startsWith('VALID_') && profileData.username && profileData.username.trim()) {
    footer.innerHTML = `
      <button id="candidate-write-btn" class="profile-button">Написать</button>
    `;
  } else {
    const waveText = profileData.pushSent ? "Вы помахали" : "Помахать";
    const disabledAttr = profileData.pushSent ? "disabled" : "";
    footer.innerHTML = `
      <button id="candidate-wave-btn" class="profile-button" ${disabledAttr}>${waveText}</button>
    `;
  }

  container.appendChild(footer);

  // Навешиваем обработчики на кнопки
  const waveBtn = footer.querySelector('#candidate-wave-btn');
  if (waveBtn) {
    waveBtn.addEventListener('click', async () => {
      waveBtn.disabled = true;
      waveBtn.textContent = 'Вы помахали';
      // Отправка push (аналогично match.js)
      const jsonPush = await sendPush({ senderId: window.currentUser.userId, senderUsername: window.currentUser.username || window.currentUser.name, receiverId: profileData.userId || profileData.id });
      if (!jsonPush.success) {
        waveBtn.textContent = 'Помахать 👋';
        waveBtn.disabled = false;
      }
    });
  }
  const writeBtn = footer.querySelector('#candidate-write-btn');
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
      openChat && openChat(profileData.username);
    });
  }
  const giftBtn = footer.querySelector('#candidate-gift-btn');
  if (giftBtn) {
    giftBtn.addEventListener('click', () => {
      window.selectedCandidateId = profileData.userId || profileData.id;
      showGiftModal();
    });
  }
}

// Навешиваем обработчик на .header-pro-info (только один раз)
document.addEventListener('DOMContentLoaded', () => {
  initProModalHandlers();
});

// --- ДОБАВИТЬ: функция для обновления пользователя после изменений ---
// Функция для сохранения hideAge на сервер
async function saveHideAgeToServer(hideAge) {
  try {
    const currentUser = window.currentUser;
    if (!currentUser || !currentUser.userId) return;
    
    const response = await fetch(`${window.API_URL}/updateProfile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.userId,
        hideAge: hideAge
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('[AGE TOGGLE] hideAge сохранен на сервер:', hideAge);
    } else {
      console.error('[AGE TOGGLE] Ошибка сохранения hideAge:', result.error);
    }
  } catch (err) {
    console.error('[AGE TOGGLE] Ошибка запроса сохранения hideAge:', err);
  }
}

async function refreshCurrentUser() {
  try {
    const userId = window.currentUser?.userId;
    if (!userId) return;
    const updated = await window.getUser(userId);
    if (updated && updated.success && updated.user) {
      window.currentUser = updated.user;
      if (typeof updateProfileScreen === 'function') updateProfileScreen();
    }
  } catch (e) {
    console.error('Ошибка обновления пользователя:', e);
  }
}