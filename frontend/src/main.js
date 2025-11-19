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
const APP_VERSION = '2025-01-19-handlers-fix-v1';
console.log('🔄 [CACHE] main.js загружен, версия:', APP_VERSION);
console.log('🔄 [CACHE] Время загрузки:', new Date().toISOString());
console.log('🔄 [CACHE] Уникальный ID:', Math.random().toString(36).substr(2, 9));

// Импортируем CSS (Vite обработает и скомпилирует)
import './css/main.css';

// Импортируем функции из profile.js
import { initProfileEditScreen, exitProfileEditMode, updateProfileScreen, enterProfileEditMode } from './profile.js';

// Импортируем функции из pro.js
import { renderProInfo, initProFeatures } from './pro.js';

// Импортируем функции из pro-modal.js
import { showProModal, initProModalHandlers } from './pro-modal.js';

// Убеждаемся, что функции доступны глобально
window.initProfileEditScreen = initProfileEditScreen;
window.exitProfileEditMode = exitProfileEditMode;
window.updateProfileScreen = updateProfileScreen;
window.enterProfileEditMode = enterProfileEditMode;
window.renderProInfo = renderProInfo;
window.initProFeatures = initProFeatures;
window.showProModal = showProModal;
window.initProModalHandlers = initProModalHandlers;

let tg = null;
if (window.Telegram && window.Telegram.WebApp) {
  tg = window.Telegram.WebApp;
  tg.expand();
  tg.setHeaderColor("#ffffff");
  tg.setBackgroundColor("#f4f4f4");
  console.log("✅ Telegram.WebApp подключен:", tg);
  console.log("ℹ️ tg.initData:", tg.initData);
  console.log("ℹ️ tg.initDataUnsafe:", tg.initDataUnsafe);
} else {
  console.warn("⚠ Telegram.WebApp не найден (серверный/локальный режим?)");
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

console.log("ℹ️ Изначальный currentUser:", currentUser);

// Извлечение данных пользователя из Telegram
console.log("🔍 tg объект:", tg);
console.log("🔍 tg.initDataUnsafe:", tg?.initDataUnsafe);
console.log("🔍 tg.initDataUnsafe.user:", tg?.initDataUnsafe?.user);

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  const u = tg.initDataUnsafe.user;
  console.log("ℹ️ tg.initDataUnsafe.user =", u);
  console.log("🔍 u.id:", u.id, "тип:", typeof u.id);
  console.log("🔍 u.first_name:", u.first_name, "тип:", typeof u.first_name);
  console.log("🔍 u.username:", u.username, "тип:", typeof u.username);
  console.log("🔍 u.photo_url:", u.photo_url, "тип:", typeof u.photo_url);
  
  currentUser.userId = String(u.id || "UserID");
  currentUser.name = u.first_name || "Username";
  currentUser.username = u.username || "";
  if (u.photo_url && u.photo_url.startsWith("http")) {
    currentUser.photoUrl = u.photo_url;
  }
  console.log("✅ currentUser обновлён из tg.initDataUnsafe:", currentUser);
} else {
  console.warn("⚠ Не получили initDataUnsafe.user — используем заглушку");
  console.log("🔍 tg:", !!tg);
  console.log("🔍 tg.initDataUnsafe:", !!tg?.initDataUnsafe);
  console.log("🔍 tg.initDataUnsafe.user:", !!tg?.initDataUnsafe?.user);
}

// Устанавливаем window.currentUser и window.API_URL СРАЗУ (до DOMContentLoaded)
// Это нужно для того, чтобы имя отображалось на главном экране и проверка регистрации работала
console.log("🔵 [MAIN.JS] Устанавливаем window.currentUser и window.API_URL СРАЗУ...");
window.currentUser = currentUser;
window.API_URL = API_URL;
window.API_BASE_URL = API_URL;
window.WEB_APP_URL = WEB_APP_URL;
console.log("  ✅ window.currentUser установлен:", window.currentUser);
console.log("  ✅ window.API_URL установлен:", window.API_URL);

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
    console.log("  ✅ Имя пользователя обновлено на главном экране:", currentUser.name);
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

console.log("🔵 [MAIN.JS] Скрипт main.js загружен (до DOMContentLoaded)");
console.log("  - document.readyState:", document.readyState);
console.log("  - window.API_URL:", window.API_URL);
console.log("  - window.API_BASE_URL:", window.API_BASE_URL);

document.addEventListener("DOMContentLoaded", () => {
  console.log("▶ [MAIN.JS] DOMContentLoaded: init main.js...");
  console.log("  - document.readyState:", document.readyState);
  console.log("  - API_URL:", API_URL);
  console.log("  - currentUser:", currentUser);
  console.log("  - typeof showScreen:", typeof showScreen);
  
  // Инициализируем showScreenImpl
  showScreenImpl = showScreen;
  console.log("  - showScreenImpl установлен:", typeof showScreenImpl);
  
  let selectedCandidateId = null;
  const giftModal = document.getElementById("gift-modal");
  if (giftModal) giftModal.classList.remove("open");
  const giftBackdrop = document.querySelector('.gift-backdrop');
  if (giftBackdrop) giftBackdrop.classList.remove('open');
  const singleCard = document.getElementById("singleCard");
  // Экспортируем singleCard в window для использования в swipe.js
  window.singleCard = singleCard;
  let candidates = [];
  let currentIndex = 0;
  let currentPhotoIndex = 0;
  let inMutualMatch = false;
  let viewingCandidate = null;
  // Экспортируем переменные в window для использования в swipe.js
  window.candidates = candidates;
  window.currentIndex = currentIndex;

  // ВРЕМЕННАЯ функция showScreen (будет заменена настоящей позже)
  // Используем fallback для переключения экранов через классы
  function showScreenFallback(screenId) {
    console.log(`🔵 [MAIN.JS] showScreenFallback вызвана с screenId: ${screenId}`);
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
      screen.classList.remove('active');
      screen.style.display = 'none';
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
      targetScreen.style.display = 'flex';
      console.log(`  ✅ Переключили на экран ${screenId} (fallback)`);
    } else {
      console.error(`  ❌ Экран ${screenId} не найден!`);
    }
  }

  // Устанавливаем временную функцию в window (будет заменена позже)
  console.log("🔵 [MAIN.JS] Устанавливаем временный window.showScreen (fallback)...");
  window.showScreen = showScreenFallback;
  console.log("  ✅ window.showScreen установлен (временный):", typeof window.showScreen);

  // window.currentUser и window.API_URL уже установлены выше (до DOMContentLoaded)
  // Обновляем их на случай, если что-то изменилось
  console.log("🔵 [MAIN.JS] Обновляем window.currentUser и window.API_URL...");
  window.currentUser = currentUser;
  window.API_URL = API_URL;
  window.API_BASE_URL = API_URL;
  window.WEB_APP_URL = WEB_APP_URL;
  console.log("  ✅ window.currentUser обновлён:", window.currentUser);
  console.log("  ✅ window.API_URL обновлён:", window.API_URL);
  
  // Обновляем экран приветствия сразу после установки currentUser
  // (если экран уже виден)
  setTimeout(() => {
    const welcomeScreen = document.getElementById('screen-welcome');
    if (welcomeScreen && welcomeScreen.classList.contains('active')) {
      console.log("🔵 [MAIN.JS] Экран приветствия активен, обновляем имя...");
      const welcomeUserName = document.querySelector('#screen-welcome .user-name');
      if (welcomeUserName && currentUser && currentUser.name) {
        welcomeUserName.textContent = currentUser.name;
        console.log("  ✅ Имя пользователя обновлено (вручную):", currentUser.name);
      } else {
        console.warn("  ⚠️ Не удалось обновить имя:", {
          welcomeUserName: !!welcomeUserName,
          currentUser: !!currentUser,
          userName: currentUser?.name
        });
      }
    }
  }, 100);

// Импортируем handlePhotoAddition из user-actions.js
import('./user-actions.js').then(module => {
  window.handlePhotoAddition = module.handlePhotoAddition;
  console.log('✅ handlePhotoAddition загружен в глобальную область');
}).catch(err => {
  console.warn('⚠ Не удалось загрузить handlePhotoAddition:', err);
});

function fillCard(cardEl, cand) {
  let validPhotos = (cand.photos || []).filter(u => u && u.trim() !== "");
  if (validPhotos.length === 0) validPhotos = ["/img/photo.svg"];
  cardEl.style.backgroundImage = `url('${validPhotos[0]}')`;
  cardEl.dataset.photos = JSON.stringify(validPhotos);
  currentPhotoIndex = 0;
  cardEl.dataset.userId = cand.id;
  cardEl.innerHTML = `
    <div class="gradient-card"></div>
    <div class="user-info">
      ${cand.badge ? `<div class="badge-wrapper"><img src="https://sta-black-dim.waw.amverum.cloud${cand.badge}" class="badge-image"></div>` : ""}
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
    console.log("🔵 [MAIN.JS] setupJoinButton вызвана");
    console.log("  - document.readyState:", document.readyState);
    console.log("  - API_URL:", API_URL);
    console.log("  - typeof showScreen:", typeof showScreen);
    console.log("  - currentUser:", currentUser);
    console.log("  - window.showScreen:", typeof window.showScreen);
    console.log("  - window.currentUser:", window.currentUser);
    
    const joinButton = document.getElementById("join-button");
    if (joinButton) {
      console.log("✅ [MAIN.JS] Кнопка join-button найдена, добавляем обработчик");
      console.log("  - joinButton:", joinButton);
      console.log("  - joinButton.onclick:", joinButton.onclick);
      
      // Проверяем, есть ли уже обработчик
      const hasExistingHandler = joinButton.getAttribute('data-main-handler') === 'true';
      if (hasExistingHandler) {
        console.log("  ⚠️ [MAIN.JS] Обработчик уже установлен, пропускаем");
        return;
      }
      
      joinButton.setAttribute('data-main-handler', 'true');
      console.log("  🔵 [MAIN.JS] Добавляем обработчик click...");
      
      joinButton.addEventListener("click", () => {
        console.log("🔵 [MAIN.JS] Клик по join-button - начало обработки");
        let tgUser = {};
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
          tgUser = tg.initDataUnsafe.user;
          console.log("  - tgUser из initDataUnsafe:", tgUser);
        } else {
          console.warn("  ⚠️ tg.initDataUnsafe.user не найден");
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
        console.log("🔵 [MAIN.JS] Отправка регистрации с данными:", registrationData);
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
            console.log("🔵 [MAIN.JS] Ответ от сервера:", res.status, res.statusText);
            return res.json();
          })
          .then(data => {
            console.log("🔵 [MAIN.JS] Данные от сервера:", data);
            if (!data.success) throw new Error(data.error || "Неизвестная ошибка");
            console.log("✅ [MAIN.JS] Регистрация прошла успешно:", data);
            currentUser.registered = true;
            console.log("🔵 [MAIN.JS] Вызов showScreen('screen-gender')");
            showScreen("screen-gender");
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
      console.log("✅ [MAIN.JS] Обработчик join-button установлен");
    } else {
      console.error("❌ [MAIN.JS] Кнопка join-button НЕ найдена!");
    }
  }
  
  // Устанавливаем обработчик сразу и после загрузки
  console.log("🔵 [MAIN.JS] Настройка вызова setupJoinButton...");
  console.log("  - document.readyState:", document.readyState);
  
  if (document.readyState === 'loading') {
    console.log("  🔵 [MAIN.JS] DOM еще загружается, ждем DOMContentLoaded");
    document.addEventListener('DOMContentLoaded', () => {
      console.log("  ✅ [MAIN.JS] DOMContentLoaded произошел, вызываем setupJoinButton");
      setupJoinButton();
    });
  } else {
    console.log("  ✅ [MAIN.JS] DOM уже готов, вызываем setupJoinButton сразу");
    setupJoinButton();
  }
  
  // Также пробуем установить после небольших задержек
  console.log("  🔵 [MAIN.JS] Устанавливаем таймеры для повторных попыток...");
  setTimeout(() => {
    console.log("  🔵 [MAIN.JS] Таймер 500ms: вызываем setupJoinButton");
    setupJoinButton();
  }, 500);
  
  setTimeout(() => {
    console.log("  🔵 [MAIN.JS] Таймер 1000ms: вызываем setupJoinButton");
    setupJoinButton();
  }, 1000);
  
  setTimeout(() => {
    console.log("  🔵 [MAIN.JS] Таймер 2000ms: вызываем setupJoinButton");
    setupJoinButton();
  }, 2000);
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

// Для экрана Profile (screen5)
const profileBackBtn = document.getElementById("profile-back-button");
if (profileBackBtn) {
  profileBackBtn.addEventListener("click", () => {
    if (viewingCandidate) {
      viewingCandidate = null;
      showScreen("screen-matches");
      } else {
      console.log("▶ Back из Profile -> переход на screen-swipe");
      showScreen("screen-swipe");
    }
  });
}

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
        console.log("✅ specialPush response:", json);
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
  function showCandidate() {
    if (currentUser.needPhoto === 1) {
      console.log('[showCandidate] needPhoto=1, показываем кнопку "Добавить фото"');
      singleCard.style.backgroundImage = "none";
      singleCard.style.backgroundColor = "#fff";
      singleCard.innerHTML = `
        <div class="no-users invite-wrapper">
          <h3>Пожалуйста, загрузите 1-3 фото с лицом, чтобы просматривать анкеты.</h3>
          <button id="add-photo-swipe-btn" class="invite-button">Добавить фото</button>
        </div>
      `;
      singleCard.style.boxShadow = "none";
      document.querySelectorAll(".back-cnd-btn, .superlike_d, .like_d, .dislike_d").forEach(b => b.style.display = "none");
      const btn = document.getElementById("add-photo-swipe-btn");
      if (btn) {
        // Удаляем старые обработчики
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener("click", function() { 
          if (window.handlePhotoAddition) {
            window.handlePhotoAddition.call(newBtn);
          } else {
            console.warn('handlePhotoAddition не найден');
          }
        });
        console.log('[showCandidate] Кнопка найдена, навешиваем обработчик handlePhotoAddition');
      }
      return;
    }
    
    if (!candidates || candidates.length === 0 || currentIndex >= candidates.length) {
      singleCard.style.backgroundImage = "none";
      singleCard.style.backgroundColor = "#fff";
      singleCard.innerHTML = `
        <div class="no-users invite-wrapper">
          <h3>Нет новых пользователей</h3>
          <button id="invite-button" class="invite-button">Пригласить</button>
        </div>
      `;
      singleCard.style.boxShadow = "none";
      document.querySelectorAll(".like_d, .dislike_d").forEach(b => b.style.display = "none");
      document.getElementById("invite-button").addEventListener("click", shareInvite);
      return;
    }
  
  
  // Иначе — обычная карточка
  fillCard(singleCard, candidates[currentIndex]);
  singleCard.classList.remove("show-match", "returning");
  document.querySelectorAll(".like_d, .dislike_d")
          .forEach(b => b.style.display = currentUser.needPhoto ? "none" : "flex");
  }

  // ------------------- Обработка взаимного мэтча -------------------
  function onMutualLike() {
    inMutualMatch = true;
    // Свайп-карточка улетает вправо
    singleCard.style.transition = "transform 0.5s ease";
    singleCard.style.transform = "translate(1000px, 0) rotate(45deg)";
    setTimeout(() => {
      // Возврат в центр и подготовка
      singleCard.style.transition = "transform 0.3s ease";
      singleCard.style.transform = "none";
      hideBadges(singleCard);

      // Анимация сердца
      const matchBadge = singleCard.querySelector(".badge-match");
      if (matchBadge) {
        matchBadge.innerHTML = "❤️‍🔥";
        matchBadge.style.opacity = "";
        matchBadge.style.transform = "";
        matchBadge.classList.add("match-animation");
        matchBadge.addEventListener("animationend", () => {
          matchBadge.classList.remove("match-animation");
        }, { once: true });
      }
      if ("vibrate" in navigator) navigator.vibrate([50,30,80,30,110,30,150]);

      // Кнопки swipe: like -> Next, dislike -> Chat/Wave
      const likeBtn = document.querySelector(".like_d");
      const dislikeBtn = document.querySelector(".dislike_d");
      const cand = candidates.find(c => String(c.id) === singleCard.dataset.userId);

      // Next
      if (likeBtn) {
        likeBtn.style.display = "flex";
        likeBtn.innerHTML = `<img class="next" src="/img/next.svg" alt="next" />`;
        likeBtn.onclick = () => {
            moveToNextCandidate();
        };
      }
      // Chat / Wave (Chat button styled blue)
      if (dislikeBtn) {
        dislikeBtn.style.display = "flex";
        if (cand && cand.username) {
          dislikeBtn.style.backgroundColor = "#55a6ff"; // голубой
          dislikeBtn.innerHTML = `<img class="chat" src="/img/chat.svg" alt="chat" />`;
          dislikeBtn.onclick = () => window.open(`https://t.me/${cand.username}`, "_blank");
        } else {
          dislikeBtn.innerHTML = "👋";
          dislikeBtn.style.backgroundColor = "#ff5e5e";
          dislikeBtn.style.fontSize = "36px";
          dislikeBtn.onclick = async () => {
            const btn = dislikeBtn;
            try {
              const resp = await fetch(`${API_URL}/sendPush`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  senderId: currentUser.userId,
                  senderUsername: currentUser.username || currentUser.name,
                  receiverId: cand.id
                })
              });
              const resJson = await resp.json();
              if (resJson.success) {
                btn.textContent = "👋";
                btn.disabled = true;
                btn.style.backgroundColor = "#ccc";
              }
            } catch (err) {
              console.error("❌ /api/sendPush ошибка:", err);
            }
          };
        }
      }

      updateMatchesCount();
    }, 500);
  }

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
  // Обработчики свайпов (pointer events)
  
  let isDragging = false, startX = 0, startY = 0, currentX = 0, currentY = 0;
  const maxDistance = 200, minFont = 64, maxFont = 128, threshold = 100;
  if (singleCard) {
    singleCard.addEventListener("pointerdown", (e) => {
      if (currentIndex >= candidates.length) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      singleCard.setPointerCapture(e.pointerId);
      singleCard.style.transition = "none";
    });
    singleCard.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;
      const rot = (currentX / 200) * 20;
      singleCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rot}deg)`;
      singleCard.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      const likeB = singleCard.querySelector(".badge-like");
      const nopeB = singleCard.querySelector(".badge-nope");
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
    singleCard.addEventListener("pointerup", e => {
      isDragging = false;
      singleCard.releasePointerCapture(e.pointerId);
      const distX = Math.abs(currentX), distY = Math.abs(currentY);
      if (distX < 10 && distY < 10) {
        cyclePhoto();
      } else if (distX > threshold) {
        const dir = currentX > 0 ? "right" : "left";
        if (dir === "right") {
          doLike();
        } else {
          doDislike();
        }
      } else {
        // плавный возврат при неполном свайпе
        singleCard.style.transition = "transform 0.3s ease";
        singleCard.style.transform = "none";
        singleCard.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        hideBadges(singleCard);
        currentX = 0;
        currentY = 0;
      }
    });
  }
  function cyclePhoto() {
    const rawPhotos = singleCard.dataset.photos ? JSON.parse(singleCard.dataset.photos) : [];
    if (rawPhotos.length < 2) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % rawPhotos.length;
    singleCard.style.backgroundImage = `url('${rawPhotos[currentPhotoIndex]}')`;
    const paginatorEl = singleCard.querySelector(".paginator");
    if (paginatorEl) {
      renderPaginator(paginatorEl, rawPhotos.length, currentPhotoIndex);
    }
  }
  
  // animateCardOut function removed

    // +++ Обработка клика по кнопкам «лайк» / «дизлайк» (как в старом коде - просто и сразу)
    const likeBtnControl = document.querySelector(".like_d");
    const dislikeBtnControl = document.querySelector(".dislike_d");
    if (likeBtnControl) {
      likeBtnControl.addEventListener("click", () => {
        if (!candidates || candidates.length === 0 || currentIndex >= candidates.length) {
          showCandidate();
        } else {
          doLike();
        }
      });
    }
    if (dislikeBtnControl) {
      dislikeBtnControl.addEventListener("click", () => {
        if (!candidates || candidates.length === 0 || currentIndex >= candidates.length) {
          showCandidate();
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
      showCandidate();
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
      showCandidate();
      updateMatchesCount();
    } catch (err) {
      console.error("❌ loadCandidates:", err);
      candidates = [];
      window.candidates = candidates;
      showCandidate();
      updateMatchesCount();
    }
  }
// (no stray END loadCandidates comment; ensure only one closing brace)

  async function doLike() {
    if (inMutualMatch) {
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
        onMutualLike();
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
    if (inMutualMatch) {
      // Remove the matched candidate so it won't be shown again
      const idx = candidates.findIndex(c => String(c.id) === singleCard.dataset.userId);
      if (idx >= 0) {
        candidates.splice(idx, 1);
        window.candidates = candidates;
      }
    }
    inMutualMatch = false;
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
    showCandidate();
  }
  
  // Обновление экрана «Матчи»
  function updateMatchesScreen() {
    console.log("▶ updateMatchesScreen()");
  }

 // Универсальная функция переключения экранов
function showScreen(screenId) {
  // If we're showing a candidate's profile, skip default profile load
  if (screenId === "screen-profile" && viewingCandidate) {
    document.querySelectorAll(".screen").forEach(scr => scr.style.display = "none");
    document.getElementById("screen-profile").style.display = "block";
    showCandidateProfile(viewingCandidate);
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

  // 3. Специальная логика для каждого экрана:
  if (screenId === "screen-welcome") {
    updateWelcomeScreen();
  }

  if (screenId === "screen-gender") {
    updateGenderScreen();
  }

    if (screenId === "screen-swipe") {
      // Сначала обновляем UI (аватар, имя, бейдж)
      updateSwipeScreen();
      updateMatchesCount();
      
      // Attach profile navigation to the avatar frame (как в старом коде - внутри showScreen)
      const avatarFrame = document.querySelector("#screen-swipe .ava-frame");
      if (avatarFrame) {
        avatarFrame.style.cursor = "pointer";
        avatarFrame.addEventListener("click", () => {
          viewingCandidate = null;
          showScreen("screen-profile");
        });
      }
      
      // Потом подгружаем актуального пользователя и кандидатов
      loadUserData()
        .then(() => {
          if (currentUser.needPhoto === 1) {
            candidates = [];
            window.candidates = candidates;
            showCandidate();
            updateMatchesCount();
          } else {
            loadCandidates();
          }
        })
        .catch(err => console.error("Ошибка загрузки пользователя на свайпе:", err));
    }

  if (screenId === "screen-matches") {
    updateMatchesCount();
    renderMatches();
  }

  if (screenId === "screen-profile") {
    // Если это профиль кандидата (viewingCandidate), показываем его профиль
    if (viewingCandidate) {
      showCandidateProfile(viewingCandidate);
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
    console.log("🔵 [MAIN.JS] updateWelcomeScreen вызвана");
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
async function renderMatches() {
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
          <button class="match-gift-btn">
            <img src="/img/gift.svg" alt="gift" />
          </button>
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
      // Обработчик «Подарок»
      const giftBtn = div.querySelector(".match-gift-btn");
      if (giftBtn) giftBtn.addEventListener("click", () => {
        selectedCandidateId = m.id;
        showGiftModal();
      });

      matchesListEl.appendChild(div);
      // Открыть детальную карточку кандидата по клику на аватар+имя
      div.querySelector('.match-user').addEventListener('click', () => {
        viewingCandidate = m;
        showScreen("screen-profile");
      });
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
  // Показать детальный профиль кандидата (при клике на матч)
  function showCandidateProfile(match) {
    viewingCandidate = match;
    // Поменять заголовок на «Ваш Match»
const headerTitle = document.querySelector('#screen-profile .profile-header h2');
if (headerTitle) headerTitle.textContent = 'Ваш Match';
    const pic = document.getElementById("profileCard");
    const firstPhoto = (match.photos && match.photos.length > 0)
      ? match.photos[0]
      : (match.avatar || "/img/photo.svg");
    pic.style.backgroundImage = `url('${firstPhoto}')`;

    const nameEl = document.querySelector("#screen-profile .name-age-container .user-name");
    const ageEl = document.querySelector("#screen-profile .name-age-container .user-age");
    if (nameEl) nameEl.textContent = match.name;
    if (ageEl) {
      if (match.age) {
        ageEl.textContent = `${match.age} лет`;
        ageEl.style.display = "";
      } else {
        ageEl.style.display = "none";
      }
    }

    const bioEl = document.querySelector("#screen-profile .user-bio");
    if (bioEl) bioEl.textContent = match.bio || "";

    const paginator = document.querySelector("#screen-profile .paginator");
    renderPaginator(paginator, (match.photos || []).length, 0);

    const editBtn = document.getElementById("edit-profile-button");
    if (editBtn) {
      editBtn.style.display = "none";
      const oldActions = document.querySelector("#screen-profile .profile-actions");
      if (oldActions) oldActions.remove();
      const actions = document.createElement("div");
      actions.className = "profile-actions";
      actions.innerHTML = `
        <button id="candidate-write-btn">Написать</button>
        <button id="candidate-gift-btn">Подарок</button>
      `;
      editBtn.insertAdjacentElement("afterend", actions);

      let deleteBtn = document.getElementById("candidate-delete-btn");
      if (deleteBtn) deleteBtn.remove();
      deleteBtn = document.createElement("button");
      deleteBtn.id = "candidate-delete-btn";
      deleteBtn.className = "delete-match-btn";
      deleteBtn.innerHTML = `<img src="/img/unlike.svg" alt="Удалить" width="24" height="24" /> Удалить Мэтч`;
      pic.appendChild(deleteBtn);
      deleteBtn.addEventListener("click", async () => {
        try {
          // Remove mutual like so candidate no longer appears in Matches
          await fetch(`${API_URL}/like`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fromUser: currentUser.userId, toUser: match.id })
          });
          // Add a dislike so candidate won't reappear in swipes
          await fetch(`${API_URL}/dislike`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fromUser: currentUser.userId, toUser: match.id })
          });
          await renderMatches();
          showScreen("screen-matches");
          updateMatchesCount();
        } catch (err) {
          console.error("Ошибка удаления из матчей:", err);
          window.Telegram.WebApp.showAlert("Не удалось удалить из Мэтчей");
        }
      });
    }

    // Обработчики для кнопок "Написать" и "Подарок" (удаляем старые, добавляем новые)
    const writeBtn = document.getElementById("candidate-write-btn");
    if (writeBtn) {
      const newWriteBtn = writeBtn.cloneNode(true);
      writeBtn.parentNode.replaceChild(newWriteBtn, writeBtn);
      
      newWriteBtn.addEventListener("click", () => {
        if (match.username) {
          window.open(`https://t.me/${match.username}`, "_blank");
        } else {
          window.Telegram.WebApp.showAlert("Пользователь не указал username");
        }
      });
    }

    const giftBtn = document.getElementById("candidate-gift-btn");
    if (giftBtn) {
      const newGiftBtn = giftBtn.cloneNode(true);
      giftBtn.parentNode.replaceChild(newGiftBtn, giftBtn);
      
      newGiftBtn.addEventListener("click", () => {
        selectedCandidateId = match.id;
        showGiftModal();
      });
    }
  }
  // === Инициализация gift-modal as bottom sheet ===
  window.showGiftModal = function() {
    const backdrop = document.querySelector('.gift-backdrop');
    if (backdrop) backdrop.classList.add('open');
    document.getElementById("gift-modal").classList.add("open");
  };
  window.hideGiftModal = function() {
    const backdrop = document.querySelector('.gift-backdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.getElementById("gift-modal").classList.remove("open");
  };

  function showToast(message) {
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
  // +++ Обработчик заказа подарков +++
  window.handleGiftOrder = async function(button) {
    event.stopPropagation && event.stopPropagation();
    // Find wrapping .gift-card and read data attributes, name and price from its children
    const cardEl = button.closest('.gift-card');
    const giftId = cardEl.dataset.giftId;
    const giftName = cardEl.querySelector('.gift-desc')?.textContent.trim() || '';
    const giftPrice = cardEl.querySelector('.gift-price')?.textContent.trim() || '';
    const candidateId = selectedCandidateId;
    try {
      const payload = {
        userId: currentUser.userId,
        candidateId,
        giftId,
        message: "🎉 Отличный выбор! Уверен, это произведёт отличное впечатление.\n" + `Вы выбрали подарок: ${giftName} — ${giftPrice}`
      };
      // Build a two-button keyboard: Оплатить и Отмена
      const kb = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Оплатить", callback_data: `pay_${giftId}_${candidateId}` }
            ],
            [
              { text: "Отмена", callback_data: "cancel_special" }
            ]
          ]
          
        }
      };
      payload.keyboard = kb;
      const resp = await fetch(`${API_URL}/specialPush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!json.success) console.error('Ошибка specialPush:', json.error);
    } catch (err) {
      console.error('Ошибка при отправке specialPush:', err);
    }
    hideGiftModal();
    showToast('Отправили Пуш');
  }

  // Закрыть модалку
  document.getElementById("gift-modal-close")
          .addEventListener("click", hideGiftModal);

// Обработчик «Узнать подробнее» с собственной inline-клавиатурой
const giftDetailBtn = document.getElementById('gift-detail-btn');
if (giftDetailBtn) {
  giftDetailBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const infoText = [
      "Наша платформа знакомит вас не только онлайн, но и дарит реальные эмоции! 🎁\n" + 
      "Мы отправляем выбранный вами подарок напрямую вашему соседу: вам не нужно знать адрес — мы всё организуем и доставим ваш презент точно в руки.\n" + 
      "Перед доставкой вышлем фото-отчёт 📸, а после подтвердим вручение.\n" +
      "Если что-то пойдёт не так — вернём деньги без лишних вопросов.\n",
    ].join('\n\n');

    // Собственные inline-кнопки для «Узнать подробнее»
    const kb = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Заказать", callback_data: "order_now" }],
          [{ text: "Отмена", callback_data: "cancel_special" }]
        ]
      }
    };
    fetch(`${API_URL}/specialPush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.userId,
        message: infoText,
        keyboard: kb
      })
    })
      .then(res => res.json())
      .then(json => {
        if (!json.success) throw new Error(json.error);
        console.log("push sent:", json);
      })
      .catch(err => {
        console.error("❌ specialPush error:", err);
        alert("Не удалось отправить сообщение.");
      })
      .finally(() => {
        hideGiftModal();  // прячем модалку
        showToast('Отправили Пуш');
      });
  });
}
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

  const ageToggleIcon = document.getElementById("age-toggle-icon");
  const ageInput     = document.getElementById("edit-age-input");
  const ageLabel     = document.querySelector(".age-label");

ageToggleIcon.classList.add("active");
ageToggleIcon.style.backgroundImage = "url('/img/eye_open.svg')";
ageToggleIcon.addEventListener("click", () => {
  const isNowVisible = ageToggleIcon.classList.toggle("active");
  if (isNowVisible) {
    ageToggleIcon.style.backgroundImage = "url('/img/eye_open.svg')";
    ageInput.disabled = false;
    ageInput.style.filter = "none";
    if (ageLabel) ageLabel.style.color = "";        // вернём нормальный цвет
    currentUser.hideAge = false;
  } else {
    ageToggleIcon.style.backgroundImage = "url('/img/eye_close.svg')";
    ageInput.disabled = true;
    ageInput.style.filter = "grayscale(100%)";
    if (ageLabel) ageLabel.style.color = "#999";    // серый цвет
    currentUser.hideAge = true;
  }
});
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
        
        console.log("✅ checkIfRegistered: пользователь найден и данные загружены");
        return true;
      } catch (err) {
        console.error("❌ checkIfRegistered:", err);
        return false;
      }
    }
    updateMatchesCount();
    // ------------------- Загрузка данных текущего пользователя -------------------
    async function loadUserData() {
      if (isLocal) return;
      try {
        const resp = await fetch(`${API_URL}/getUser?userId=${currentUser.userId}`);
        const json = await resp.json();
        if (!json.success) return;

        const d = json.data;
        currentUser.name     = d.name     || currentUser.name;
        currentUser.username = d.username || currentUser.username;
        currentUser.gender   = d.gender;
        currentUser.bio      = d.bio      || currentUser.bio;
        currentUser.age      = d.age      || currentUser.age;
        currentUser.photos   = [];
        if (d.photo1) currentUser.photos.push(d.photo1);
        if (d.photo2) currentUser.photos.push(d.photo2);
        if (d.photo3) currentUser.photos.push(d.photo3);
        if (currentUser.photos.length === 0) {
          currentUser.photos.push(d.photoUrl || "/img/logo.svg");
        }
        currentUser.photoUrl = currentUser.photos[0];
        currentUser.likes    = JSON.parse(d.likes    || "[]");
        currentUser.dislikes = JSON.parse(d.dislikes || "[]");
        currentUser.badge    = d.badge    || "";
        currentUser.needPhoto = Number(d.needPhoto || 0);
        currentUser.is_pro    = Number(d.is_pro) === 1;
        currentUser.pro_end   = d.pro_end;
        
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
          console.error("❌ Ошибка загрузки целей:", err);
          currentUser.goals = [];
        }
        
        // Обновляем window.currentUser после загрузки данных
        window.currentUser = currentUser;
        // Обновляем имя на главном экране
        updateWelcomeScreenName();
        
        // Инициализируем PRO-функции
        if (window.initProFeatures) {
          window.initProFeatures(currentUser);
        }
      } catch (err) {
        console.error("❌ loadUserData:", err);
      }
    }

    /* ------------------- Поток инициализации ------------------- */
    (async function initFlow() {
      console.log("▶ initFlow()...");
      console.log("🔍 currentUser.userId:", currentUser.userId);
      
      const isReg = await checkIfRegistered();
      console.log("🔍 checkIfRegistered результат:", isReg);
      
      if (!isReg) {
        console.log("❌ Пользователь не зарегистрирован, показываем welcome");
        showScreen("screen-welcome");
        return;
      }
      
      console.log("✅ Пользователь зарегистрирован, загружаем данные");
      await loadUserData();
      
      // Если пол ещё не задан — сначала экран выбора пола, иначе — свайпы
      if (!currentUser.gender) {
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
  console.log("🔵 [MAIN.JS] Заменяем window.showScreen на настоящую реализацию...");
  window.showScreen = showScreen;
  console.log("  ✅ window.showScreen заменен на настоящую реализацию:", typeof window.showScreen);
  console.log("  - showScreenImpl:", typeof showScreenImpl);
  
  // Также экспортируем showCandidate если он определен
  if (typeof showCandidate !== 'undefined') {
    window.showCandidate = showCandidate;
    console.log("  ✅ window.showCandidate установлен");
  }

}); 

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
