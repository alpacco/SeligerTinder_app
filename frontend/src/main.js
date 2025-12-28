// @ts-nocheck
/******************************************************************************
 * main.js — клиентский скрипт Tinder‑приложения
 * ----------------------------------------------------------------------------
 * Функциональность:
 *  - Инициализация Telegram.WebApp
 *  - Регистрация и загрузка данных пользователя
 *  - Отображение карточек кандидатов с бейджами (label)
 *  - Свайпы: лайк, дизлайк, взаимный мэтч (с анимацией горящего сердца)
 *  - Переключение фотографий и пагинатор
 *  - Логика для редактирования профиля (screen‑5) и перехода в режим редактирования (screen‑6)
 *    при нажатии "Редактировать", с кнопками "ОТМЕНА" и "ГОТОВО"
 *****************************************************************************/

// Версия приложения для обхода кэша Telegram
// ВАЖНО: версия должна быть СТАТИЧЕСКОЙ, иначе будет бесконечная перезагрузка!
const APP_VERSION = '2025-01-27-match-badge-like-animation-fix-v8';

// Импортируем CSS (Vite обработает и скомпилирует)
// CSS не собирается через Vite, загружается напрямую из /css/main.css
// import './css/main.css';

// Импортируем функции из profile.js
import { initProfileEditScreen, exitProfileEditMode, updateProfileScreen, enterProfileEditMode } from './profile.js';

// Импортируем функции из pro.js
import { renderProInfo, initProFeatures } from './pro.js';

// Импортируем функции из pro-modal.js
import { showProModal, initProModalHandlers } from './pro-modal.js';

// Импортируем функции из match.js
import { showCandidateProfile as showCandidateProfileFromMatch, renderMatches as renderMatchesFromMatch } from './match.js';

// Убеждаемся, что функции доступны глобально
window.initProfileEditScreen = initProfileEditScreen;
window.exitProfileEditMode = exitProfileEditMode;
window.updateProfileScreen = updateProfileScreen;
window.enterProfileEditMode = enterProfileEditMode;
window.renderProInfo = renderProInfo;
window.initProFeatures = initProFeatures;
window.showProModal = showProModal;
window.initProModalHandlers = initProModalHandlers;
window.showCandidateProfile = showCandidateProfileFromMatch; // Используем правильную версию из match.js
window.renderMatches = renderMatchesFromMatch; // Используем правильную версию из match.js

let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
  tg = window.Telegram.WebApp;
  tg.expand();
  tg.setHeaderColor("#ffffff");
  tg.setBackgroundColor("#f4f4f4");
}

// API_URL будет установлен из window.API_URL или конфига
const API_URL = (typeof window !== "undefined" && window.API_URL) 
  ? window.API_URL 
  : (typeof window !== "undefined" && window.API_BASE_URL)
    ? window.API_BASE_URL
    : "https://sta-black-dim.waw.amverum.cloud/api";
const BOT_LINK = "tg://resolve?domain=SeligerTinderApp_bot";
const isLocal = window.location.hostname === "localhost";
const WEB_APP_URL = (typeof window !== "undefined" && window.WEB_APP_URL) ? window.WEB_APP_URL : "https://sta-black-dim.waw.amverum.cloud";

let showScreenImpl = null;

export let currentUser = {
  userId: "UserID",
  name: "Username",
  username: "",
  photoUrl: "/img/logo.svg",
  gender: "", // Если уже задано в БД, то должно прийти непустым
  bio: "",
  age: 0,
  photos: [],
  registered: false,
  likes: [],
  dislikes: [],
  badge: "",
  needPhoto: 0,
  hideAge: false,
  API_URL: API_URL
};


// Извлечение данных пользователя из Telegram

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  const u = tg.initDataUnsafe.user;
  
  currentUser.userId = String(u.id || "UserID");
  currentUser.name = u.first_name || "Username";
  currentUser.username = u.username || "";
  if (u.photo_url && u.photo_url.startsWith("http")) {
    currentUser.photoUrl = u.photo_url;
  }
} else {
  }

// Устанавливаем window.currentUser и window.API_URL СРАЗУ (до DOMContentLoaded)
// Это нужно для того, чтобы имя отображалось на главном экране и проверка регистрации работала
window.currentUser = currentUser;
window.API_URL = API_URL;
window.API_BASE_URL = API_URL;
window.WEB_APP_URL = WEB_APP_URL;

// Обновляем имя на главном экране сразу, если DOM уже готов
function updateWelcomeScreenName() {
  if (document.readyState === 'loading') {
    // DOM еще не готов, попробуем позже
    setTimeout(updateWelcomeScreenName, 100);
    return;
  }
  
  const welcomeUserName = document.querySelector('#screen-welcome .user-name');
  if (welcomeUserName && currentUser && currentUser.name && currentUser.name !== "Username") {
    welcomeUserName.textContent = currentUser.name;
      }
}

// Пытаемся обновить имя сразу
updateWelcomeScreenName();

// Универсальная функция генерации пагинатора
function renderPaginator(paginatorEl, count, activeIndex) {
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

console.log("  - window.API_BASE_URL:", window.API_BASE_URL);

// Функция инициализации, которая будет вызвана когда DOM готов
function initMainJS() {
  console.log("▶ [MAIN.JS] initMainJS вызвана (DOM готов)...");
  console.log("  - document.readyState:", document.readyState);
  console.log("  - API_URL:", API_URL);
  console.log("  - currentUser:", currentUser);
  console.log("  - typeof showScreen:", typeof showScreen);
  
  // Инициализируем showScreenImpl
showScreenImpl = showScreen;
  console.log("  - showScreenImpl установлен:", typeof showScreenImpl);
  
  let selectedCandidateId = null;
  const singleCard = document.getElementById("singleCard");
  // Экспортируем singleCard в window для использования в swipe.js
  window.singleCard = singleCard;
  let candidates = [];
  let currentIndex = 0;
  let currentPhotoIndex = 0;
  // УДАЛЕНО: локальная переменная inMutualMatch - используется window.inMutualMatch из swipe.js
  let viewingCandidate = null;
  // Экспортируем переменные в window для использования в swipe.js
  window.candidates = candidates;
  window.currentIndex = currentIndex;

  // ВРЕМЕННАЯ функция showScreen (будет заменена настоящей позже)
  // Используем fallback для переключения экранов через классы
  function showScreenFallback(screenId) {
        const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
      screen.classList.remove('active');
      screen.style.display = 'none';
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
      targetScreen.style.display = 'flex';
      `);
  } else {
      console.error(`  ❌ Экран ${screenId} не найден!`);
  }
}

  // Устанавливаем временную функцию в window (будет заменена позже)
  ...");
  window.showScreen = showScreenFallback;
  :", typeof window.showScreen);

  // window.currentUser и window.API_URL уже установлены выше (до DOMContentLoaded)
  // Обновляем их на случай, если что-то изменилось
  window.currentUser = currentUser;
window.API_URL = API_URL;
  window.API_BASE_URL = API_URL;
  window.WEB_APP_URL = WEB_APP_URL;
      
  // Обновляем экран приветствия сразу после установки currentUser
  // (если экран уже виден)
  setTimeout(() => {
    const welcomeScreen = document.getElementById('screen-welcome');
    if (welcomeScreen && welcomeScreen.classList.contains('active')) {
            const welcomeUserName = document.querySelector('#screen-welcome .user-name');
      if (welcomeUserName && currentUser && currentUser.name) {
        welcomeUserName.textContent = currentUser.name;
        :", currentUser.name);
      } else {
              }
    }
  }, 100);

// Импортируем handlePhotoAddition из user-actions.js
import('./user-actions.js').then(module => {
  window.handlePhotoAddition = module.handlePhotoAddition;
  }).catch(err => {
  });

function fillCard(cardEl, cand) {
  let validPhotos = (cand.photos || []).filter(u => u && u.trim() !== "");
  if (validPhotos.length === 0) validPhotos = ["/img/photo.svg"];
  cardEl.style.backgroundImage = `url('${validPhotos[0]}')`;
  cardEl.dataset.photos = JSON.stringify(validPhotos);
  currentPhotoIndex = 0;
  cardEl.dataset.userId = cand.id;
  
  // Формируем HTML для badge
  let badgeHtml = "";
  if (cand.badge) {
    // Нормализуем badge: убираем пути, слэши и расширения
    let badgeName = String(cand.badge).trim();
    badgeName = badgeName.replace(/^.*\//, ''); // Убираем все до последнего слэша
    badgeName = badgeName.replace(/\.svg$/i, ''); // Убираем расширение .svg если есть
    badgeName = badgeName.replace(/[\/\\\.]+/g, ''); // Убираем лишние точки и слэши
    badgeHtml = '<div class="badge-wrapper"><img src="/img/labels/' + badgeName + '.svg" class="badge-image"></div>';
  }
  
  cardEl.innerHTML = `
    <div class="gradient-card"></div>
    <div class="user-info">
      ${badgeHtml}
      <div class="name-age-container">
        <span class="user-name">${cand.name}</span>
        ${(!currentUser.hideAge && cand.age) ? `<span class="user-age">${cand.age} лет</span>` : ""}
      </div>
      <p class="user-bio">${cand.bio || ""}</p>
      <div class="paginator"></div>
    </div>
    <div class="card-badge badge-like">😍</div>
    <div class="card-badge badge-nope">🚫</div>
    <div class="card-badge badge-match"></div>
  `;
  renderPaginator(cardEl.querySelector(".paginator"), validPhotos.length, 0);
}
  /* ------------------- Обработчики для экранов 1–4 ------------------- */

  // Обработчик для регистрации (screen‑1)
  function setupJoinButton() {
        console.log("  - document.readyState:", document.readyState);
    console.log("  - API_URL:", API_URL);
    console.log("  - typeof showScreen:", typeof showScreen);
    console.log("  - currentUser:", currentUser);
    console.log("  - window.showScreen:", typeof window.showScreen);
    console.log("  - window.currentUser:", window.currentUser);
    
  const joinButton = document.getElementById("join-button");
  if (joinButton) {
            console.log("  - joinButton:", joinButton);
      console.log("  - joinButton.onclick:", joinButton.onclick);
      
      // Проверяем, есть ли уже обработчик
      const hasExistingHandler = joinButton.getAttribute('data-main-handler') === 'true';
      if (hasExistingHandler) {
                return;
      }
      
      joinButton.setAttribute('data-main-handler', 'true');
            
    joinButton.addEventListener("click", () => {
              let tgUser = {};
      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tgUser = tg.initDataUnsafe.user;
          console.log("  - tgUser из initDataUnsafe:", tgUser);
        } else {
                }
        
      const registrationData = {
        userId: String(tgUser.id || "UserID"),
        name: tgUser.first_name || "Username",
        username: tgUser.username || "",
        photoUrl: (tgUser.photo_url && tgUser.photo_url.startsWith("http"))
                  ? tgUser.photo_url
                  : "/img/logo.svg",
        gender: "", // заполнится далее
        bio: ""
      };
                console.log("  - URL:", `${API_URL}/join`);
        
        // Отправляем Telegram initData в заголовке для валидации на сервере
        const headers = { "Content-Type": "application/json" };
        if (tg && tg.initData) {
          headers["X-Telegram-Init-Data"] = tg.initData;
        }
        
      fetch(`${API_URL}/join`, {
        method: "POST",
          headers: headers,
        body: JSON.stringify(registrationData)
      })
          .then(res => {
                        return res.json();
          })
        .then(data => {
                      if (!data.success) throw new Error(data.error || "Неизвестная ошибка");
                      currentUser.registered = true;
            window.currentUser = currentUser; // Обновляем глобальную переменную
            ");
            console.log("  - typeof showScreen:", typeof showScreen);
            console.log("  - typeof window.showScreen:", typeof window.showScreen);
            // Используем window.showScreen для надежности
            if (typeof window.showScreen === 'function') {
              window.showScreen("screen-gender");
            } else if (typeof showScreen === 'function') {
          showScreen("screen-gender");
            } else {
              console.error("❌ [MAIN.JS] showScreen не доступна!");
              // Fallback: переключаем вручную
              document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
              const genderScreen = document.getElementById('screen-gender');
              if (genderScreen) {
                genderScreen.style.display = 'block';
                              }
            }
          // Инициализировать чат с ботом: сначала WebApp sendData, затем deep link
          if (tg && tg.sendData) {
            tg.sendData(JSON.stringify({ action: "register", userId: registrationData.userId }));
          }
          const deepLinkUrl = `https://t.me/SeligerTinderApp_bot?start=${registrationData.userId}`;
          if (tg && tg.openLink) {
            tg.openLink(deepLinkUrl);
          } else {
            window.open(deepLinkUrl, "_blank");
          }
        })
        .catch(err => {
            console.error("❌ [MAIN.JS] Ошибка регистрации:", err);
          alert("Ошибка регистрации: " + err.message);
        });
    });
          } else {
      console.error("❌ [MAIN.JS] Кнопка join-button НЕ найдена!");
    }
  }
  
  // Вызываем setupJoinButton сразу, так как мы уже внутри DOMContentLoaded
  ...");
  setupJoinButton();
  
  // Также пробуем установить после небольшой задержки на случай, если кнопка появится позже
  setTimeout(() => {
        setupJoinButton();
  }, 500);
// Получаем элементы кнопок выбора пола
const maleBtn = document.getElementById("maleBtn");
const femaleBtn = document.getElementById("femaleBtn");

// Функция для установки выбранного пола
function selectGender(genderValue) {
  if (maleBtn && femaleBtn) {
    if (genderValue === "male") {
      maleBtn.classList.add("active");
      femaleBtn.classList.remove("active");
    } else if (genderValue === "female") {
      femaleBtn.classList.add("active");
      maleBtn.classList.remove("active");
    }
    // Сохраняем выбранный пол в currentUser
    currentUser.gender = genderValue;
    console.log("Пол выбран: " + currentUser.gender);
  }
}
const continueButton = document.getElementById("continue-button");
if (continueButton) {
  continueButton.addEventListener("click", async () => {
    console.log("Нажата кнопка 'ПРОДОЛЖИТЬ', currentUser.gender = '" + currentUser.gender + "'");
    // Проверяем, выбран ли пол
    if (!currentUser.gender || (currentUser.gender !== "male" && currentUser.gender !== "female")) {
      alert("Пожалуйста, выберите свой пол, нажав одну из кнопок 'МУЖЧИНА' или 'ЖЕНЩИНА'.");
      return;
    }
    
    // Если режим не локальный, отправляем запрос на обновление пола в БД с проверками
    if (!isLocal) {
      try {
        const response = await fetch(`${API_URL}/updateGender`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userId: currentUser.userId, 
            gender: currentUser.gender,
            photoUrl: currentUser.photoUrl 
          })
        });
        
        const result = await response.json();
        
        if (!result.success) {
          // Если есть ошибка с фото, показываем кнопку "добавить фото"
          if (result.error && (result.error.includes('мем') || result.error.includes('пол') || result.error.includes('лицо'))) {
            // Показываем экран с кнопкой "добавить фото"
            showPhotoErrorScreen(result.error);
            return;
          }
          alert("Ошибка обновления пола: " + result.error);
          return;
        }
        
        // Обновляем данные пользователя после успешного ответа сервера
        await loadUserData();
      } catch (err) {
        console.error("Ошибка обновления пола:", err);
        alert("Ошибка обновления пола.");
        return;
      }
    }
    
    // После успешного сохранения переходим на экран свайпов
    showScreen("screen-swipe");
  });
}

// Обработчики кликов для кнопок
if (maleBtn) {
  maleBtn.addEventListener("click", () => selectGender("male"));
}
if (femaleBtn) {
  femaleBtn.addEventListener("click", () => selectGender("female"));
}

  // Обработчики для переключения экрана (например, переход на профайл, матчи)
  // Обработчик для кнопки MATCHES (как в старом коде - просто и сразу)
  const matchesButton = document.getElementById("matches-button");
  if (matchesButton) {
    matchesButton.addEventListener("click", () => {
      updateMatchesCount();
      showScreen("screen-matches");
    });
  }
// Для экрана Matches (screen4)
const matchesBackBtn = document.getElementById("back-button");
if (matchesBackBtn) {
  matchesBackBtn.addEventListener("click", () => {
    console.log("▶ Back из Matches -> переход на screen-swipe");
    showScreen("screen-swipe");
  });
}

// Функция для установки обработчика кнопки "Назад" в профиле
function setupProfileBackButton() {
const profileBackBtn = document.getElementById("profile-back-button");
if (profileBackBtn) {
    // Удаляем старые обработчики, чтобы избежать дублирования
    const newBtn = profileBackBtn.cloneNode(true);
    profileBackBtn.parentNode.replaceChild(newBtn, profileBackBtn);
    
    // Устанавливаем новый обработчик
    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("▶ Back из Profile нажата");
      // Используем window.viewingCandidate вместо локальной переменной
      if (window.viewingCandidate) {
        console.log("▶ Back из Profile кандидата -> переход на screen-matches");
        window.viewingCandidate = null;
      showScreen("screen-matches");
      } else {
      console.log("▶ Back из Profile -> переход на screen-swipe");
      showScreen("screen-swipe");
    }
  });
    
    // Убеждаемся, что кнопка кликабельна
    newBtn.style.pointerEvents = "auto";
    newBtn.style.cursor = "pointer";
    newBtn.disabled = false;
  }
}

// Делаем функцию доступной глобально для использования в других модулях
window.setupProfileBackButton = setupProfileBackButton;

// Для экрана Profile (screen5) - устанавливаем обработчик при инициализации
setupProfileBackButton();

// Для экрана Profile Edit (screen6)
const profileEditBackBtn = document.getElementById("profile-edit-back-button");
if (profileEditBackBtn) {
  // ! важно: сделать padding до 16–20px, чтобы зона клика была удобной
  profileEditBackBtn.style.padding = "24px";
  profileEditBackBtn.style.margin = "-24px"; // чтобы внешний вид не изменился
  profileEditBackBtn.addEventListener("click", () => {
    console.log("▶ Back из Profile Edit -> выход из режима редактирования");
    exitProfileEditMode();
  });
}
  // Меню для бота
  function getInlineKeyboard() {
    return {
      reply_markup: { inline_keyboard: [
          [{ text: "✨Открыть Seliger Tinder✨", web_app: { url: WEB_APP_URL } }],
          [{ text: "Загрузить фото", callback_data: "upload_photo" }, { text: "Добавить о себе", callback_data: "add_bio" }],
          [{ text: "Добавить возраст", callback_data: "update_age" }, { text: "Удалить профиль", callback_data: "delete_user" }],
          [{ text: "Запросить бейдж", callback_data: "request_badge" }],
          [{ text: "Пожаловаться/Ошибка/Проблема", callback_data: "dev_message" }]
      ]}
    };
  }
  // Модальное окно для PUSH
  const tgModal = document.getElementById("tg-modal");
  const tgModalOk = document.getElementById("tg-modal-ok");
  const tgModalCancel = document.getElementById("tg-modal-cancel");
  function showTelegramModal() {
    if (tgModal) tgModal.style.display = "flex";
  }
  const addPhotoBtn = document.getElementById("add-photo-btn");
  if (addPhotoBtn) {
    addPhotoBtn.addEventListener("click", showTelegramModal);
  }

  function hideTelegramModal() {
    if (tgModal) tgModal.style.display = "none";
  }
  if (tgModalOk) {
    tgModalOk.addEventListener("click", async () => {
      console.log("🌟 specialPush triggered, payload:", {
        userId: currentUser.userId,
        message:  "Чтобы продолжить пользоваться приложением и оценивать анкеты, загрузите 1–3 качественных фото одним сообщением. 📸✨\n" +
        "Это займет всего минуту!\n",
        keyboard: getInlineKeyboard()
      });
      try {
        const resp = await fetch(`${API_URL}/specialPush`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.userId,
            message: "Чтобы продолжить пользоваться приложением и оценивать анкеты, загрузите 1–3 качественных фото одним сообщением. 📸✨\n" +
"Это займет всего минуту!\n",
            keyboard: getInlineKeyboard()
          })
        });
        const json = await resp.json();
                if (!json.success) console.error("Push error:", json.error);
      } catch (err) {
        console.error("❌ Ошибка в запросе /api/specialPush:", err);
      }
      hideTelegramModal();
    });
  }
  if (tgModalCancel) {
    tgModalCancel.addEventListener("click", hideTelegramModal);
  }
  // ------------------- Показываем кандидата или "Нет новых" -------------------
  // УДАЛЕНО: функция showCandidate() - теперь используется версия из swipe.js
  // Все вызовы заменены на window.showCandidate()

  // ------------------- Обработка взаимного мэтча -------------------
  // УДАЛЕНО: локальная функция onMutualLike() - используется window.onMutualLike из swipe.js
  // Эта функция устанавливала кнопку "Помахать" без правильной проверки inMutualMatch
  // Все вызовы заменены на window.onMutualLike && window.onMutualLike()

  // Вспомогательная функция для кнопок «Пригласить», теперь везде одна
  function shareInvite() {
    const text = "Привет! Нашёл удобное приложение для знакомств между соседями нашего ЖК.: https://t.me/SeligerTinderApp_bot/sta";
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text)
        .then(() => alert("Текст скопирован в буфер обмена"))
        .catch(() => alert("Не удалось скопировать текст"));
    }
  }
  // Обработчики свайпов теперь в swipe.js через setupSwipeHandlers()
  // Удалены старые обработчики отсюда, чтобы избежать конфликтов
  
  // animateCardOut function removed

    // +++ Обработка клика по кнопкам «лайк» / «дизлайк» (как в старом коде - просто и сразу)
    const likeBtnControl = document.querySelector(".like_d");
    const dislikeBtnControl = document.querySelector(".dislike_d");
    if (likeBtnControl) {
      likeBtnControl.addEventListener("click", () => {
        if (!candidates || candidates.length === 0 || currentIndex >= candidates.length) {
          window.showCandidate && window.showCandidate();
        } else {
          doLike();
        }
      });
    }
    if (dislikeBtnControl) {
      dislikeBtnControl.addEventListener("click", () => {
        if (!candidates || candidates.length === 0 || currentIndex >= candidates.length) {
          window.showCandidate && window.showCandidate();
        } else {
          doDislike();
        }
      });
    }

    async function doDislike() {
      const topUserId = singleCard.dataset.userId;
      const idx = candidates.findIndex(c => String(c.id) === String(topUserId));
      if (idx >= 0) {
        try {
          await fetch(`${API_URL}/dislike`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fromUser: currentUser.userId, toUser: topUserId })
          });
        } catch (err) {
          console.error("❌ /api/dislike ошибка:", err);
        }
      }
      // Анимация улетающей карточки влево
      singleCard.style.transition = "transform 0.5s ease";
      singleCard.style.transform = `translate(-1000px, 0) rotate(-45deg)`;
      setTimeout(() => {
        if (idx >= 0) {
          candidates.splice(idx, 1);
          window.candidates = candidates;
        }
        moveToNextCandidate();
        updateMatchesCount();
      }, 500);
    }
   // ------------------- Обновление счётчика матчей в шапке -------------------
   async function updateMatchesCount() {
    const badge = document.getElementById("matches-count");
    if (!badge) return;
    if (isLocal) {
      badge.textContent = "2";
      badge.style.display = "inline-block";
      return;
    }
    try {
      const url = `${API_URL}/matches?userId=${currentUser.userId}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!json.success || !Array.isArray(json.data)) {
        badge.style.display = "none";
        return;
      }
      const count = json.data.length;
      badge.textContent = count > 0 ? count : "";
      badge.style.display = count > 0 ? "inline-block" : "none";
    } catch (err) {
      console.error("❌ updateMatchesCount:", err);
    }
  }
   // ------------------- Загрузка кандидатов (screen‑3) -------------------
   async function loadCandidates() {
    if (!currentUser.gender) return;
    // Если нужно фото — просто показываем заглушку
    if (currentUser.needPhoto === 1) {
      candidates = [];
      window.candidates = candidates;
      window.showCandidate && window.showCandidate();
      updateMatchesCount();
      return;
    }
    // Определяем противоположный пол и запрашиваем кандидатов
    const opposite = currentUser.gender === "male" ? "female" : "male";
    const url = `${API_URL}/candidates?oppositeGender=${opposite}&userId=${currentUser.userId}`;
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.success && Array.isArray(json.data)) {
        // Фильтруем уже лайкнутых/дизлайкнутых
        const liked = new Set(currentUser.likes);
        const disliked = new Set(currentUser.dislikes);
        candidates = json.data.filter(c =>
          !liked.has(c.id) &&
          !disliked.has(c.id) &&
          Number(c.needPhoto || 0) === 0
        );
        currentIndex = 0;
        // Синхронизируем с window для swipe.js
        window.candidates = candidates;
        window.currentIndex = currentIndex;
      }
      window.showCandidate && window.showCandidate();
      updateMatchesCount();
    } catch (err) {
      console.error("❌ loadCandidates:", err);
      candidates = [];
      window.candidates = candidates;
      window.showCandidate && window.showCandidate();
      updateMatchesCount();
    }
  }
// (no stray END loadCandidates comment; ensure only one closing brace)

  async function doLike() {
    if (window.inMutualMatch) {
      moveToNextCandidate();
      return;
    }
    const topUserId = singleCard.dataset.userId;
    const idx = candidates.findIndex(c => String(c.id) === String(topUserId));
    if (idx < 0) return;
    try {
      const resp = await fetch(`${API_URL}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUser: currentUser.userId, toUser: topUserId })
      });
      const json = await resp.json();
      if (json.success && json.mutual) {
        window.onMutualLike && window.onMutualLike();
      } else {
        // Анимация улетающей карточки вправо
        singleCard.style.transition = "transform 0.5s ease";
        singleCard.style.transform = `translate(1000px, 0) rotate(45deg)`;
        setTimeout(() => {
          candidates.splice(idx, 1);
          window.candidates = candidates;
          moveToNextCandidate();
          updateMatchesCount();
        }, 500);
      }
    } catch (err) {
      console.error("❌ /api/like ошибка:", err);
    }
  }
  // +++ Обработка свайпов: переход к следующему кандидату
  function moveToNextCandidate() {
    if (window.inMutualMatch) {
      // Remove the matched candidate so it won't be shown again
      const idx = candidates.findIndex(c => String(c.id) === singleCard.dataset.userId);
      if (idx >= 0) {
        candidates.splice(idx, 1);
        window.candidates = candidates;
      }
    }
    window.inMutualMatch = false;
    singleCard.style.transition = 'none';
    singleCard.style.transform = 'none';
    hideBadges(singleCard);

    // Restore like/dislike buttons to default state
    const likeBtn = document.querySelector(".like_d");
    const dislikeBtn = document.querySelector(".dislike_d");
    if (likeBtn) {
      likeBtn.innerHTML = `<img class="like" src="/img/like.svg" alt="like" />`;
      likeBtn.onclick = null;
      likeBtn.style.backgroundColor = '';
      likeBtn.style.fontSize = '';
    }
    if (dislikeBtn) {
      dislikeBtn.innerHTML = `<img class="dislike" src="/img/dislike.svg" alt="dislike" />`;
      dislikeBtn.onclick = null;
      dislikeBtn.style.backgroundColor = '';
      dislikeBtn.style.fontSize = '';
    }

    // Ensure buttons are visible and move to next
    document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = 'flex');
    window.showCandidate && window.showCandidate();
  }
  
  // Обновление экрана «Матчи»
  function updateMatchesScreen() {
    console.log("▶ updateMatchesScreen()");
  }

 // Универсальная функция переключения экранов
function showScreen(screenId) {
  // If we're showing a candidate's profile, skip default profile load
  // ВАЖНО: Используем window.viewingCandidate, а не локальную переменную viewingCandidate
  if (screenId === "screen-profile" && window.viewingCandidate) {
    console.log('[main.js] showScreen: показываем профиль кандидата, window.viewingCandidate:', window.viewingCandidate);
    document.querySelectorAll(".screen").forEach(scr => scr.style.display = "none");
    document.getElementById("screen-profile").style.display = "block";
    // Используем импортированную функцию из match.js
    showCandidateProfileFromMatch(window.viewingCandidate);
    return;
  }
  // 1. Скрываем все
  document.querySelectorAll(".screen").forEach(scr => scr.style.display = "none");
  // 2. Показываем нужный
  const el = document.getElementById(screenId);
  if (!el) {
    console.error(`❌ Нет элемента с id="${screenId}"`);
    return;
  }
  el.style.display = "block";
  console.log(`▶ Переход на экран: ${screenId}`);

  // Обновляем PRO-информацию при переключении на экраны profile и matches
  if ((screenId === "screen-profile" || screenId === "screen-matches") && window.renderProInfo && window.currentUser) {
    window.renderProInfo(window.currentUser);
  }

  // 3. Специальная логика для каждого экрана:
  if (screenId === "screen-welcome") {
    updateWelcomeScreen();
  }

  if (screenId === "screen-gender") {
    updateGenderScreen();
  }

    if (screenId === "screen-swipe") {
    // КРИТИЧНО: Вызываем initSwipeScreen для полной инициализации экрана свайпов
    // Это загрузит кандидатов, likesReceived для PRO пользователей и покажет первого кандидата
    if (window.initSwipeScreen) {
            window.initSwipeScreen();
    } else {
            // Fallback: обновляем UI (аватар, имя, бейдж)
      updateSwipeScreen();
      updateMatchesCount();
      
      // Attach profile navigation to the avatar frame (как в старом коде - внутри showScreen)
      const avatarFrame = document.querySelector("#screen-swipe .ava-frame");
      if (avatarFrame) {
        avatarFrame.style.cursor = "pointer";
        avatarFrame.addEventListener("click", () => {
          window.viewingCandidate = null;
          showScreen("screen-profile");
        });
      }
    }
    }

  if (screenId === "screen-matches") {
    updateMatchesCount();
    window.renderMatches && window.renderMatches(); // Используем версию из match.js
  }

  if (screenId === "screen-profile") {
    // Переустанавливаем обработчик кнопки "Назад" при показе экрана профиля
    setupProfileBackButton();
    
    // Если это профиль кандидата (window.viewingCandidate), показываем его профиль
    if (window.viewingCandidate) {
      console.log('[main.js] showScreen: показываем профиль кандидата через window.viewingCandidate:', window.viewingCandidate);
      showCandidateProfileFromMatch(window.viewingCandidate); // Используем импортированную функцию из match.js
      // Переустанавливаем обработчик после показа профиля кандидата
      setTimeout(() => setupProfileBackButton(), 100);
      return;
    }
    
    // Восстановить заголовок «Ваш профиль»
    const headerTitle = document.querySelector('#screen-profile .profile-header h2');
    if (headerTitle) headerTitle.textContent = 'Ваш профиль';
    // Restore "Настроить" on own profile and remove candidate buttons
    const editBtn = document.getElementById("edit-profile-button");
    if (editBtn) editBtn.style.display = "";
    const candidateActions = document.querySelector("#screen-profile .profile-actions");
    if (candidateActions) candidateActions.remove();
    // Remove candidate delete button on own profile
    const candidateDelBtn = document.getElementById("candidate-delete-btn");
    if (candidateDelBtn) candidateDelBtn.remove();
    // Сначала отрисовываем контейнер профиля (заглушки, спиннеры и т.п.), если нужно:
    // (например, показать «Loading…»)
    // потом подгружаем данные и рендерим полностью
    loadUserData()
      .then(() => {
        updateProfileScreen();
        // Переустанавливаем обработчик после обновления экрана
        setupProfileBackButton();
        // Re-attach edit-button handler in case previous listener was lost
        const editBtn = document.getElementById("edit-profile-button");
        if (editBtn) {
          editBtn.style.cursor = "pointer";
          editBtn.addEventListener("click", () => {
            console.log("▶ Нажата кнопка 'Редактировать' на экране профиля");
            enterProfileEditMode();
          });
        }
      })
      .catch(err => console.error("Ошибка загрузки профиля:", err));
  }

  if (screenId === "screen-profile-edit") {
    // Инициализируем экран редактирования профиля
    if (typeof window.initProfileEditScreen === 'function') {
      window.initProfileEditScreen();
    }
  }
}

  function updateWelcomeScreen() {
        console.log("  - currentUser:", currentUser);
    console.log("  - currentUser.name:", currentUser?.name);
    
    // Используем глобальную функцию updateWelcomeScreenName
    updateWelcomeScreenName();
  }
  function updateGenderScreen() {
    const smallAvatar = document.querySelector("#screen-gender .user-avatar-small");
    const userIdEl = document.querySelector("#screen-gender .user-id h3");
    if (smallAvatar) smallAvatar.src = currentUser.photoUrl;
    if (userIdEl) userIdEl.textContent = currentUser.name;
  }
    function updateSwipeScreen() {
        const bigAvatar = document.querySelector("#screen-swipe .avatar_small_2");
        const userId2El = document.querySelector("#screen-swipe .user-id2");
        if (bigAvatar) bigAvatar.src = currentUser.photoUrl;
        if (userId2El) {
          // Показываем только имя, возраст рядом с аватаром убран
          userId2El.innerHTML = `<span class="user-link">${currentUser.name}</span>`;
        }
      }
  
  // Обновление экрана профиля (screen‑5) - функция импортируется из profile.js
// Функция renderMatches теперь импортируется из match.js
async function renderMatchesOld() {
  const matchesListEl = document.getElementById("matches-list");
  if (!matchesListEl) return;
  matchesListEl.innerHTML = ""; // очистили

  try {
    const resp = await fetch(`${API_URL}/matches?userId=${currentUser.userId}`);
    const json = await resp.json();
    if (!json.success) {
      matchesListEl.innerHTML = "<p class='no-matches'>Ошибка получения матчей</p>";
      return;
    }

    const data = json.data;
    if (!Array.isArray(data) || data.length === 0) {
      matchesListEl.innerHTML = `
        <div class="no-matches invite-wrapper">
          <p>Нет матчей</p>
          <button id="invite-matches" class="invite-button">Пригласить</button>
        </div>
      `;
      document.getElementById("invite-matches").addEventListener("click", shareInvite);
      return;
    }

    data.forEach(m => {
      // Выбираем аватар: сначала photo1, иначе photoUrl, иначе заглушка
      const avatarUrl = m.avatar || "/img/logo.svg";

      const div = document.createElement("div");
      div.className = "match-card";

      // Генерируем HTML кнопок
      let btnHTML = "";
      if (m.username && m.username.trim() !== "") {
        // у пользователя есть публичный username
        btnHTML = `<button class="match-write-btn">НАПИСАТЬ</button>`;
      } else {
        // нет username → волна
        if (m.pushSent) {
          btnHTML = `<button class="match-push-btn" disabled>ВЫ ПОМАХАЛИ</button>`;
        } else {
          btnHTML = `<button class="match-push-btn">ПОМАХАТЬ 👋</button>`;
        }
      }

      // Новая структура: .match-user и .match-actions в одной строке
      div.innerHTML = `
        <div class="match-user">
          <img class="match-avatar" src="${avatarUrl}" alt="${m.name}" />
          <span class="match-name">${m.name}${m.age?`, ${m.age}`:""}</span>
        </div>
        <div class="match-actions">
          ${btnHTML}
        </div>
      `;
      // Обработчик волны / чата
      const waveBtn = div.querySelector(".match-push-btn");
      if (waveBtn) {
        waveBtn.addEventListener("click", async () => {
          if (waveBtn.disabled) return;
          try {
            const respPush = await fetch(`${API_URL}/sendPush`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                senderId: currentUser.userId,
                senderUsername: currentUser.username || currentUser.name,
                receiverId: m.id
              })
            });
            const jsonPush = await respPush.json();
            if (jsonPush.success) {
              waveBtn.textContent = "ВЫ ПОМАХАЛИ";
              waveBtn.disabled = true;
              waveBtn.classList.add("match-push-sent");
            } else {
              alert("Ошибка отправки push: " + jsonPush.error);
            }
          } catch (err) {
            console.error("❌ Ошибка в /api/sendPush:", err);
            alert("Ошибка отправки push.");
          }
        });
      }

      // Обработчик «Написать»
      const writeBtn = div.querySelector(".match-write-btn");
      if (writeBtn) {
        writeBtn.addEventListener("click", () => {
          window.open(`https://t.me/${m.username}`, "_blank");
        });
      }
      // Кнопка подарков удалена

      matchesListEl.appendChild(div);
      // Открыть детальную карточку кандидата по клику на аватар+имя
      // ВАЖНО: Эта функция renderMatchesOld не используется, используется renderMatches из match.js
      // Но оставляем обработчик на случай, если эта функция все еще вызывается
      const matchUserEl = div.querySelector('.match-user');
      if (matchUserEl) {
        matchUserEl.addEventListener('click', () => {
          console.log('[main.js] renderMatchesOld: клик на match-user для', m.name, 'm:', m);
        viewingCandidate = m;
          window.viewingCandidate = m;
          // Импортируем showCandidateProfile из match.js
          import('./match.js').then(module => {
            console.log('[main.js] renderMatchesOld: импортирован модуль match.js, вызываем showCandidateProfile');
            module.showCandidateProfile(m);
          }).catch(err => {
            console.error('[main.js] renderMatchesOld: ошибка импорта match.js:', err);
          });
      });
      }
    });

    // Обновляем PRO-информацию на экране Matches
    if (window.renderProInfo) {
      window.renderProInfo(currentUser);
    }

  } catch (err) {
    console.error("❌ renderMatches:", err);
    matchesListEl.innerHTML = "<p class='no-matches'>Ошибка загрузки матчей</p>";
  }
}
  // Функция showCandidateProfile теперь импортируется из match.js
  // Старая версия удалена, так как она не показывала last login
  /* ----------------- Логика редактирования профиля (screen‑6) ----------------- */
  // Функция входа в режим редактирования
  function enterProfileEditMode() {
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

  // Обработчик age-toggle-icon теперь только в profile.js (initProfileEditScreen)
  // Удален отсюда, чтобы избежать конфликтов
  function handlePhotoDeletion(index) {
    currentUser.photos.splice(index, 1);
    initProfileEditScreen();
  }
  function handlePhotoAddition() {
    // если у вас уже есть функция showTelegramModal(), используйте её
    if (typeof showTelegramModal === 'function') {
      showTelegramModal();
    } else {
      const modal = document.getElementById("tg-modal");
      if (modal) modal.style.display = "flex";
    }
  }
  // Функция выхода из режима редактирования (при нажатии "Отмена" или после сохранения "Готово")
  function exitProfileEditMode() {
    const pictureEl = document.getElementById("profileCard");
    const infoContainer = document.querySelector("#screen-profile .user-info");
    const editScreen = document.getElementById("screen-profile-edit");
  
    if (!pictureEl || !infoContainer || !editScreen) {
      console.error("Не найдены необходимые элементы для выхода из режима редактирования.");
      showScreen("screen-profile");
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
  
  // Делаем функцию глобально доступной
  window.exitProfileEditMode = exitProfileEditMode;
  
  // Также экспортируем для использования в других модулях
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.exitProfileEditMode = exitProfileEditMode;
  }
  // Attach edit entry on Profile screen
  const profileScreen = document.getElementById("screen-profile");
  if (profileScreen) {
    profileScreen.querySelectorAll(".edit-button").forEach(btn => {
      btn.style.cursor = "pointer";
      btn.addEventListener("click", () => {
        console.log("▶ Нажата кнопка 'Редактировать'");
        enterProfileEditMode();
      });
    });
  }
  // Проверяем оба варианта ID (для совместимости)
  const cancelBtn = document.getElementById("cancel-edit-button") 
                    || document.getElementById("edit-cancel-button");
  const saveBtn = document.getElementById("save-edit-button")
                  || document.getElementById("edit-save-button");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      console.log("▶ Нажата кнопка 'Отмена'");
      exitProfileEditMode();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const bioInput = document.getElementById("edit-bio-input");
      const ageInput = document.getElementById("edit-age-input");
      const newBio   = bioInput.value.trim();
      let   newAge   = null;

      // если возраст скрыт — оставляем newAge = null, иначе валидируем
      if (!currentUser.hideAge) {
        newAge = parseInt(ageInput.value, 10);
        if (isNaN(newAge) || newAge < 1 || newAge > 99) {
          alert("Введите корректный возраст (от 1 до 99)");
          return;
        }
      }

      const profileData = {
        userId: currentUser.userId,
        bio:    newBio,
        age:    newAge,
        photos: currentUser.photos
      };

      fetch(`${API_URL}/updateProfile`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(profileData)
      })
        .then(resp => resp.json())
        .then(result => {
          if (!result.success) {
            alert("Ошибка сохранения профиля: " + result.error);
            return;
          }
          // применяем новые данные в текущем юзере
          currentUser.bio = newBio;
          currentUser.age = newAge;
          exitProfileEditMode();
        })
        .catch(err => {
          console.error("Ошибка при сохранении профиля:", err);
          alert("Ошибка при сохранении профиля");
        });
    });
  }

    // ------------------- Проверка регистрации -------------------
    async function checkIfRegistered() {
      if (isLocal) return false;
      try {
        const resp = await fetch(`${API_URL}/users`);
        const result = await resp.json();
        console.log("🔍 checkIfRegistered response:", result);
        
        if (!result.success || !Array.isArray(result.data)) {
          console.warn("❌ checkIfRegistered: неверный формат ответа");
          return false;
        }
        
        const found = result.data.find(u => String(u.userId) === currentUser.userId);
        console.log("🔍 checkIfRegistered: ищем пользователя", currentUser.userId, "найден:", !!found);
        
        if (!found) return false;

        // Заполняем currentUser данными из БД
        currentUser.registered = true;
        currentUser.gender    = found.gender;
        currentUser.bio       = found.bio;
        currentUser.age       = found.age;
        currentUser.photos    = [];
        if (found.photo1) currentUser.photos.push(found.photo1);
        if (found.photo2) currentUser.photos.push(found.photo2);
        if (found.photo3) currentUser.photos.push(found.photo3);
        if (currentUser.photos.length === 0) {
          currentUser.photos.push(found.photoUrl || "/img/logo.svg");
        }
        currentUser.photoUrl  = currentUser.photos[0];
        currentUser.username  = found.username || currentUser.username;
        currentUser.likes     = JSON.parse(found.likes || "[]");
        currentUser.dislikes  = JSON.parse(found.dislikes || "[]");
        currentUser.badge     = found.badge || "";
        currentUser.needPhoto = Number(found.needPhoto || 0);

        // Загружаем цели пользователя
        try {
          const goalsResp = await fetch(`${API_URL}/goals?userId=${currentUser.userId}`);
          const goalsJson = await goalsResp.json();
          if (goalsJson.success) {
            currentUser.goals = goalsJson.goals || [];
          } else {
            currentUser.goals = [];
          }
        } catch (err) {
          console.error("❌ Ошибка загрузки целей в checkIfRegistered:", err);
          currentUser.goals = [];
        }

        // Обновляем window.currentUser после загрузки данных
        window.currentUser = currentUser;
        // Обновляем имя на главном экране
        updateWelcomeScreenName();

                return true;
      } catch (err) {
        console.error("❌ checkIfRegistered:", err);
        return false;
      }
    }
    updateMatchesCount();
    // ------------------- Загрузка данных текущего пользователя -------------------
    // Функция loadUserData теперь импортируется из user-actions.js
    // Если она еще не загружена, используем временную заглушку
    async function loadUserData() {
      // Если loadUserData уже импортирована из user-actions.js, используем её
      if (window.loadUserData && window.loadUserData !== loadUserData) {
        return await window.loadUserData();
      }
      // Иначе ждем загрузки модуля
      const module = await import('./user-actions.js');
      window.loadUserData = module.loadUserData;
      return await module.loadUserData();
    }

    /* ------------------- Поток инициализации ------------------- */
    // КРИТИЧНО: Проверяем регистрацию ДО показа любого экрана
    (async function initFlow() {
      console.log("▶ initFlow()...");
      console.log("🔍 currentUser.userId:", currentUser.userId);
      
      // Сначала скрываем все экраны (на случай, если какой-то был показан по умолчанию)
      const allScreens = document.querySelectorAll('.screen');
      allScreens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
      });
      
      // Выполняем проверку регистрации
      const isReg = await checkIfRegistered();
      console.log("🔍 checkIfRegistered результат:", isReg);
      
      if (!isReg) {
        console.log("❌ Пользователь не зарегистрирован, показываем welcome");
        showScreen("screen-welcome");
        return;
      }
      
            await loadUserData();
      
      // Если пол ещё не задан — сначала экран выбора пола, иначе — свайпы
      // Проверяем, что gender не пустая строка и не null/undefined
      if (!currentUser.gender || currentUser.gender.trim() === "") {
        console.log("🔍 Пол не задан, показываем экран выбора пола");
        showScreen("screen-gender");
      } else {
        console.log("🔍 Пол задан, показываем экран свайпов");
        showScreen("screen-swipe");
        updateMatchesCount();
      }
    })();
    updateMatchesCount();
    setInterval(async () => {
      if (currentUser.needPhoto === 1) {
        try {
          await fetch(`${API_URL}/specialPush`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: currentUser.userId,
              message: "Пожалуйста, загрузите фото, добавьте описание и укажите возраст, чтобы продолжить.",
              keyboard: getInlineKeyboard()
            })
          });
        } catch (e) {
          console.error("Ошибка автопуша needPhoto:", e);
        }
      }
    }, 5 * 60 * 1000);

  // Присваиваем реализацию showScreen переменной showScreenImpl
showScreenImpl = showScreen;

  // КРИТИЧНО: Заменяем window.showScreen на настоящую реализацию
    window.showScreen = showScreen;
    console.log("  - showScreenImpl:", typeof showScreenImpl);
  
  // НЕ экспортируем showCandidate из main.js - используем версию из swipe.js
  // window.showCandidate должен быть установлен в swipe.js
  if (window.showCandidate) {
    :", typeof window.showCandidate);
  } else {
      }
}

// Вызываем initMainJS в зависимости от состояния документа
if (document.readyState === 'loading') {
  // DOM еще загружается, ждем DOMContentLoaded
  document.addEventListener("DOMContentLoaded", initMainJS);
  } else {
  // DOM уже готов (interactive или complete), вызываем сразу
    initMainJS();
}

  // Скрыть бейджи like/nope
  function hideBadges(cardEl) {
    const likeB = cardEl.querySelector(".badge-like");
    const nopeB = cardEl.querySelector(".badge-nope");
    if (likeB) likeB.style.opacity = 0;
    if (nopeB) nopeB.style.opacity = 0;
}

  // Функция для показа экрана с ошибкой фото
  function showPhotoErrorScreen(errorMessage) {
    // Создаем модальное окно для ошибки фото
    const modal = document.createElement('div');
    modal.className = 'photo-error-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin: 20px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Проблема с фото';
    title.style.cssText = `
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
    `;
    
    const message = document.createElement('p');
    message.textContent = errorMessage;
    message.style.cssText = `
      margin: 0 0 24px 0;
      color: #666;
      line-height: 1.5;
    `;
    
    const addPhotoBtn = document.createElement('button');
    addPhotoBtn.textContent = 'Добавить фото';
    addPhotoBtn.style.cssText = `
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      margin-right: 12px;
    `;
    addPhotoBtn.onclick = () => {
      document.body.removeChild(modal);
      showTelegramModal();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.cssText = `
      background: #F2F2F7;
      color: #007AFF;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
    `;
    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
    };
    
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(addPhotoBtn);
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}
