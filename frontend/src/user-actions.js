// user-actions.js
// Вынесено из main.js для корректной работы import/export в production

// Используем глобальные переменные вместо импортов
const currentUser = window.currentUser;
const pro = window.pro;

export async function loadUserData() {
  // Проверяем, что currentUser доступен
  const currentUser = window.currentUser;
  if (!currentUser || !currentUser.userId) {
    console.error("❌ [loadUserData] currentUser не найден:", currentUser);
    return;
  }
  
  console.log("📥 [loadUserData] Начинаем загрузку данных для userId:", currentUser.userId);
  try {
    console.log("📥 [loadUserData] Запрашиваем /api/getUser");
    const resp = await fetch(`${currentUser.API_URL || window.API_URL}/getUser?userId=${currentUser.userId}`);
    const json = await resp.json();
    console.log("📥 [loadUserData] Ответ сервера:", json);
    if (!json || !json.success) {
      console.log("📥 [loadUserData] Неуспешный ответ, пропускаем");
      return;
    }

    const d = json.data;
    console.log("📥 [loadUserData] Данные пользователя:", d);
    currentUser.name     = d.name     || currentUser.name;
    currentUser.username = d.username || currentUser.username;
    currentUser.gender   = d.gender;
    currentUser.bio      = d.bio      || currentUser.bio;
    currentUser.age      = d.age      || currentUser.age;
    currentUser.photos   = [];
    if (d.photo1) currentUser.photos.push(d.photo1);
    if (d.photo2) currentUser.photos.push(d.photo2);
    if (d.photo3) currentUser.photos.push(d.photo3);
    console.log('📥 [loadUserData] После photo1/2/3:', currentUser.photos);
    if (currentUser.photos.length === 0) {
      currentUser.photos.push(d.photoUrl || "/img/logo.svg");
      console.log('📥 [loadUserData] После photoUrl fallback:', currentUser.photos);
    }
    if (currentUser.photos.length === 0) {
      if (d.photoUrl) currentUser.photos.push(d.photoUrl);
      if (d.photoUrl2) currentUser.photos.push(d.photoUrl2);
      if (d.photoUrl3) currentUser.photos.push(d.photoUrl3);
      console.log('📥 [loadUserData] После photoUrl2/3:', currentUser.photos);
    }
    currentUser.photoUrl = currentUser.photos[0];
    currentUser.likes    = JSON.parse(d.likes    || "[]");
    currentUser.dislikes = JSON.parse(d.dislikes || "[]");
    currentUser.badge    = d.badge    || "";
    currentUser.goals = JSON.parse(d.goals || "[]");
    currentUser.goals = Array.isArray(json.data.goals) ? json.data.goals : currentUser.goals;
    
    // Проверяем, что pro доступен
    if (window.pro && window.pro.updateProStatus) {
      window.pro.updateProStatus(currentUser, Number(json.data.is_pro) === 1, json.data.pro_end);
    }
    
    currentUser.superLikesCount = Number(json.data.super_likes_count) || 0;
    currentUser.needPhoto = Number(d.needPhoto || 0);
    if (currentUser.is_pro) {
      console.log("▶ Allocating 3 SuperLikes for PRO user");
      currentUser.superLikesCount = 3;
    }
    const stored = localStorage.getItem('superLikesCount');
    if (stored !== null) {
      currentUser.superLikesCount = parseInt(stored, 10);
    }
    console.log("📥 [loadUserData] currentUser обновлён:", currentUser);
  } catch (err) {
    console.error("❌ [loadUserData] Ошибка:", err);
  }
}

export function handlePhotoAddition() {
  const addEl = this;
  const isCard = addEl.classList && addEl.classList.contains('add-photo');
  // Loader UI
  if (isCard) {
    addEl.innerHTML = `<img src="/img/preloader.svg" class="preloader-btn" alt="Загрузка..." />`;
    addEl.classList.add('loading');
  } else {
  addEl.disabled = true;
  const origText = addEl.textContent;
  addEl.dataset.origText = origText;
  addEl.innerHTML = `<img src="/img/preloader.svg" class="preloader-btn" alt="Загрузка..." /> ${origText}`;
  }
  // Create hidden file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) {
      document.body.removeChild(input);
      if (isCard) {
        addEl.innerHTML = '';
        addEl.classList.remove('loading');
      } else {
      addEl.disabled = false;
        addEl.textContent = addEl.dataset.origText || 'Добавить фото';
      }
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', window.currentUser.userId);
    
    // Определяем photoIndex (находим первый свободный слот)
    // Если photo1 пустой или photoUrl дефолтный, загружаем в photo1
    const currentPhotos = window.currentUser.photos || [];
    const photoUrl = window.currentUser.photoUrl || '';
    const defaultPhotoUrls = ['/img/logo.svg', '/img/avatar.svg', ''];
    const isDefaultPhotoUrl = !photoUrl || defaultPhotoUrls.includes(photoUrl);
    
    let photoIndex = '1';
    // Если photo1 пустой или photoUrl дефолтный, всегда загружаем в photo1
    if (currentPhotos.length === 0 || !currentPhotos[0] || isDefaultPhotoUrl) {
      photoIndex = '1';
      console.log(`🔵 [handlePhotoAddition] photo1 пустой или photoUrl дефолтный, загружаем в photo1`);
    } else if (currentPhotos.length >= 1 && currentPhotos[0]) {
      photoIndex = '2';
      if (currentPhotos.length >= 2 && currentPhotos[1]) {
        photoIndex = '3';
      }
    }
    formData.append('photoIndex', photoIndex);
    
    console.log(`🔵 [handlePhotoAddition] Загружаем фото: userId=${window.currentUser.userId}, photoIndex=${photoIndex}`);
    
    if (window.tg && window.tg.showProgressBar) window.tg.showProgressBar();
    try {
      const response = await fetch(`${window.API_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      
      console.log(`🔵 [handlePhotoAddition] Ответ от сервера: status=${response.status}`);
      const result = await response.json();
      console.log(`🔵 [handlePhotoAddition] Результат:`, result);
      
      if (result.success && result.photoUrl) {
        window.currentUser.photos = window.currentUser.photos || [];
        // Обновляем или добавляем фото в нужный слот
        const index = parseInt(photoIndex) - 1;
        if (window.currentUser.photos[index]) {
          window.currentUser.photos[index] = result.photoUrl;
        } else {
          window.currentUser.photos.push(result.photoUrl);
        }
        // Обновляем needPhoto из результата
        if (result.needPhoto !== undefined) {
          window.currentUser.needPhoto = result.needPhoto;
          console.log(`🔵 [handlePhotoAddition] needPhoto обновлен: ${result.needPhoto}, hasFace: ${result.hasFace}`);
        }
        
        // --- Главное исправление: всегда обновлять профиль и UI ---
        if (window.loadUserData) await window.loadUserData();
        if (isCard && window.initProfileEditScreen) {
          addEl.innerHTML = '';
          addEl.classList.remove('loading');
          window.initProfileEditScreen();
        } else if (!isCard && window.updateProfileScreen) {
        addEl.disabled = false;
        addEl.textContent = 'Фото добавлено';
          window.updateProfileScreen();
        }
      } else {
        const errorMsg = result.error || result.detail || 'Неизвестная ошибка';
        console.error(`❌ [handlePhotoAddition] Ошибка загрузки фото: ${errorMsg}`);
        alert('Ошибка загрузки фото: ' + errorMsg);
        if (isCard) {
          addEl.innerHTML = '';
          addEl.classList.remove('loading');
        } else {
        addEl.disabled = false;
          addEl.textContent = addEl.dataset.origText || 'Добавить фото';
        }
      }
    } catch (err) {
      alert('Ошибка JS: ' + err);
      if (isCard) {
        addEl.innerHTML = '';
        addEl.classList.remove('loading');
      } else {
      addEl.disabled = false;
        addEl.textContent = addEl.dataset.origText || 'Добавить фото';
      }
    } finally {
      if (window.tg && window.tg.hideProgressBar) window.tg.hideProgressBar();
      document.body.removeChild(input);
    }
  });
  input.click();
}

// Экспорт по умолчанию для совместимости с Vite
export default {
  loadUserData,
  handlePhotoAddition
}; 