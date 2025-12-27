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
    
    // Проверяем статус ответа
    if (!resp.ok) {
      console.error(`❌ [loadUserData] HTTP ошибка: ${resp.status} ${resp.statusText}`);
      return;
    }
    
    // Читаем текст ответа
    const text = await resp.text();
    if (!text || text.trim().length === 0) {
      console.error("❌ [loadUserData] Пустой ответ от сервера");
      return;
    }
    
    // Парсим JSON
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      console.error("❌ [loadUserData] Ошибка парсинга JSON:", parseError);
      console.error("❌ [loadUserData] Текст ответа:", text.substring(0, 200));
      return;
    }
    
    console.log("📥 [loadUserData] Ответ сервера:", json);
    console.log("📥 [loadUserData] json.success:", json?.success);
    console.log("📥 [loadUserData] json.data:", json?.data);
    console.log("📥 [loadUserData] json.data.super_likes_count:", json?.data?.super_likes_count);
    if (!json || !json.success) {
      console.log("📥 [loadUserData] Неуспешный ответ, пропускаем");
      return;
    }

    const d = json.data;
    console.log("📥 [loadUserData] Данные пользователя:", d);
    console.log("📥 [loadUserData] d.super_likes_count (прямой доступ):", d?.super_likes_count);
    console.log("📥 [loadUserData] d.super_likes_count (тип):", typeof d?.super_likes_count);
    currentUser.name     = d.name     || currentUser.name;
    currentUser.username = d.username || currentUser.username;
    currentUser.gender   = d.gender;
    currentUser.bio      = d.bio      || currentUser.bio;
    currentUser.age      = d.age      || currentUser.age;
    
    // Используем массив photos из ответа, если он есть, иначе формируем из photo1, photo2, photo3
    if (d.photos && Array.isArray(d.photos) && d.photos.length > 0) {
      // Фильтруем дефолтные фото
      currentUser.photos = d.photos.filter(photo => 
        photo && photo.trim() && photo !== '/img/logo.svg' && photo !== '/img/avatar.svg'
      );
    } else {
      // Fallback: формируем из photo1, photo2, photo3
      currentUser.photos = [];
      if (d.photo1 && d.photo1.trim() && d.photo1 !== '/img/logo.svg' && d.photo1 !== '/img/avatar.svg') {
        currentUser.photos.push(d.photo1);
      }
      if (d.photo2 && d.photo2.trim() && d.photo2 !== '/img/logo.svg' && d.photo2 !== '/img/avatar.svg') {
        currentUser.photos.push(d.photo2);
      }
      if (d.photo3 && d.photo3.trim() && d.photo3 !== '/img/logo.svg' && d.photo3 !== '/img/avatar.svg') {
        currentUser.photos.push(d.photo3);
      }
    }
    
    // Если нет фото, используем photoUrl как fallback
    if (currentUser.photos.length === 0) {
      const fallbackUrl = d.photoUrl || "/img/logo.svg";
      if (fallbackUrl && fallbackUrl !== '/img/logo.svg' && fallbackUrl !== '/img/avatar.svg') {
        currentUser.photos.push(fallbackUrl);
    }
    }
    
    // Устанавливаем photoUrl из первого фото или из d.photoUrl
    currentUser.photoUrl = currentUser.photos.length > 0 ? currentUser.photos[0] : (d.photoUrl || "/img/logo.svg");
    
    console.log('✅ [loadUserData] photos загружены:', currentUser.photos, 'photoUrl:', currentUser.photoUrl);
    
    // Парсим likes и dislikes с проверкой типа
    try {
      currentUser.likes = typeof d.likes === 'string' ? JSON.parse(d.likes || "[]") : (d.likes || []);
    } catch (e) {
      console.warn("⚠️ [loadUserData] Ошибка парсинга likes:", e);
      currentUser.likes = [];
    }
    try {
      currentUser.dislikes = typeof d.dislikes === 'string' ? JSON.parse(d.dislikes || "[]") : (d.dislikes || []);
    } catch (e) {
      console.warn("⚠️ [loadUserData] Ошибка парсинга dislikes:", e);
      currentUser.dislikes = [];
    }
    
    currentUser.badge = d.badge || "";
    
    // Парсим goals с проверкой
    try {
      if (Array.isArray(d.goals)) {
        currentUser.goals = d.goals;
      } else if (typeof d.goals === 'string') {
    currentUser.goals = JSON.parse(d.goals || "[]");
      } else {
        currentUser.goals = [];
      }
    } catch (e) {
      console.warn("⚠️ [loadUserData] Ошибка парсинга goals:", e);
      currentUser.goals = [];
    }
    
    // Проверяем, что pro доступен
    if (window.pro && window.pro.updateProStatus) {
      window.pro.updateProStatus(currentUser, Number(json.data.is_pro) === 1, json.data.pro_end);
    }
    
    // Загружаем superLikesCount из БД - используем значение напрямую, без автоматического выделения
    console.log("🔵 [loadUserData] ========== ЗАГРУЗКА СУПЕРЛАЙКОВ ==========");
    console.log("🔵 [loadUserData] json.data:", json.data);
    console.log("🔵 [loadUserData] json.data.super_likes_count (raw):", json.data?.super_likes_count);
    console.log("🔵 [loadUserData] json.data.super_likes_count (тип):", typeof json.data?.super_likes_count);
    console.log("🔵 [loadUserData] d.super_likes_count:", d?.super_likes_count);
    console.log("🔵 [loadUserData] d.super_likes_count (тип):", typeof d?.super_likes_count);
    const dbSuperLikes = Number(d?.super_likes_count || json.data?.super_likes_count || 0);
    console.log("🔵 [loadUserData] dbSuperLikes (parsed):", dbSuperLikes);
    console.log("🔵 [loadUserData] isNaN(dbSuperLikes):", isNaN(dbSuperLikes));
    
    currentUser.needPhoto = Number(d.needPhoto || 0);
    currentUser.is_pro = Number(d.is_pro) === 1;
    currentUser.pro_end = d.pro_end;
    currentUser.hideAge = Number(d.hideAge || 0) === 1;
    
    // Обновляем PRO-класс на body для применения стилей
    if (window.initProFeatures) {
      window.initProFeatures(currentUser);
    }
    
    // ВАЖНО: Суперлайки выделяются только при покупке/выдаче PRO в БД
    // Используем значение из БД напрямую, но проверяем localStorage для актуального значения после использования
    console.log("🔵 [loadUserData] Проверяем localStorage для superLikesCount");
    const stored = localStorage.getItem('superLikesCount');
    console.log("🔵 [loadUserData] localStorage superLikesCount:", stored);
    
    if (stored !== null) {
      const storedCount = parseInt(stored, 10);
      console.log("🔵 [loadUserData] storedCount (parsed):", storedCount);
      if (!isNaN(storedCount) && storedCount >= 0) {
        // Используем значение из localStorage, если оно не больше значения из БД
        // (защита от манипуляций)
        if (storedCount <= dbSuperLikes) {
          currentUser.superLikesCount = storedCount;
          console.log("✅ [loadUserData] SuperLikes из localStorage:", currentUser.superLikesCount);
        } else {
          console.log("⚠️ [loadUserData] localStorage значение больше БД, используем БД:", dbSuperLikes);
          currentUser.superLikesCount = dbSuperLikes;
          // Синхронизируем localStorage с БД
          localStorage.setItem('superLikesCount', String(dbSuperLikes));
        }
      } else {
        console.log("⚠️ [loadUserData] storedCount невалидный, используем БД:", dbSuperLikes);
        currentUser.superLikesCount = dbSuperLikes;
      }
    } else {
      // Если localStorage пустой, используем значение из БД
      console.log("✅ [loadUserData] localStorage пустой, используем БД:", dbSuperLikes);
      currentUser.superLikesCount = dbSuperLikes;
      // Синхронизируем localStorage с БД
      if (dbSuperLikes > 0) {
        localStorage.setItem('superLikesCount', String(dbSuperLikes));
        console.log("✅ [loadUserData] Сохранили в localStorage:", dbSuperLikes);
      }
    }
    
    console.log("✅ [loadUserData] ФИНАЛЬНОЕ значение superLikesCount:", currentUser.superLikesCount);
    console.log("🔵 [loadUserData] ========== КОНЕЦ ЗАГРУЗКИ СУПЕРЛАЙКОВ ==========");
    
    // Обновляем время последнего входа
    try {
      const { updateLastLogin } = await import('./api.js');
      await updateLastLogin(currentUser.userId);
      console.log("✅ [loadUserData] lastLogin обновлён");
    } catch (err) {
      console.warn("⚠️ [loadUserData] Ошибка обновления lastLogin:", err);
    }
    
    console.log("✅ [loadUserData] currentUser обновлён:", currentUser);
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
        const index = parseInt(photoIndex) - 1;
        
        console.log(`🔵 [handlePhotoAddition] Обновляем photos: index=${index}, текущая длина=${window.currentUser.photos.length}`);
        
        // Правильно обновляем массив photos - заполняем до нужного индекса если нужно
        while (window.currentUser.photos.length <= index) {
          window.currentUser.photos.push('');
        }
        // Устанавливаем фото в нужный слот
        window.currentUser.photos[index] = result.photoUrl;
        
        // Удаляем пустые элементы в конце
        while (window.currentUser.photos.length > 0 && !window.currentUser.photos[window.currentUser.photos.length - 1]) {
          window.currentUser.photos.pop();
        }
        
        // Обновляем photoUrl если это photo1
        if (photoIndex === '1' && result.hasFace) {
          window.currentUser.photoUrl = result.photoUrl;
          console.log(`🔵 [handlePhotoAddition] Обновлен photoUrl: ${result.photoUrl}`);
        }
        
        // Обновляем needPhoto из результата
        if (result.needPhoto !== undefined) {
          window.currentUser.needPhoto = result.needPhoto;
          console.log(`🔵 [handlePhotoAddition] needPhoto обновлен: ${result.needPhoto}, hasFace: ${result.hasFace}`);
        }
        
        console.log(`✅ [handlePhotoAddition] photos обновлен:`, window.currentUser.photos);
        
        // Обновляем UI сразу, не дожидаясь loadUserData
        if (isCard && window.initProfileEditScreen) {
          addEl.innerHTML = '';
          addEl.classList.remove('loading');
          console.log(`🔵 [handlePhotoAddition] Вызываем initProfileEditScreen для обновления карусели`);
          window.initProfileEditScreen();
        } else if (!isCard && window.updateProfileScreen) {
        addEl.disabled = false;
        addEl.textContent = 'Фото добавлено';
          window.updateProfileScreen();
        }
        
        // Затем обновляем данные с сервера для синхронизации
        if (window.loadUserData) {
          await window.loadUserData();
          // После загрузки данных снова обновляем карусель
          if (isCard && window.initProfileEditScreen) {
            window.initProfileEditScreen();
          }
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