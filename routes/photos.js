// routes/photos.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { bot } = require('../bot');
const vision = require('@google-cloud/vision');
const sharp = require('sharp');
const visionKeyPath = path.join(__dirname, '../Google Vision/vision-key.json');
let visionClient = null;
if (fs.existsSync(visionKeyPath)) {
  try {
    visionClient = new vision.ImageAnnotatorClient({ keyFilename: visionKeyPath });
    console.log('✅ Google Vision API инициализирован успешно');
    console.log('🔍 [Vision] Готов к проверке лиц и мемов/фейков');
  } catch (error) {
    console.error('❌ Ошибка инициализации Google Vision API:', error.message);
    visionClient = null;
  }
} else {
  console.warn('⚠️ Файл Google Vision ключа не найден:', visionKeyPath);
  console.log('🔍 [Vision] Google Vision API недоступен - проверка лиц и мемов/фейков отключена');
  visionClient = null;
}
// Функция для конвертации HEIC в JPEG
async function convertHeicToJpeg(buffer) {
  try {
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    console.log('🔧 [Image] HEIC успешно конвертирован в JPEG');
    return jpegBuffer;
  } catch (error) {
    console.error('❌ [Image] Ошибка конвертации HEIC:', error);
    return buffer; // Возвращаем оригинальный буфер если конвертация не удалась
  }
}

async function faceDetector(imagePath) {
  console.log(`🔍 [Vision] Начинаем проверку лица через Google Vision API...`);
  console.log(`🔍 [Vision] Путь к файлу: ${imagePath}`);
  
  try {
    // Проверяем, что файл существует
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ [Vision] Файл не найден: ${imagePath}`);
      return false;
    }
    
    // Получаем размер файла
    const stats = fs.statSync(imagePath);
    console.log(`🔍 [Vision] Размер файла: ${stats.size} байт`);
    
  const [result] = await visionClient.faceDetection(imagePath);
  const faces = result.faceAnnotations;
    const hasFace = Array.isArray(faces) && faces.length > 0;
    
    console.log(`🔍 [Vision] Результат проверки лица: ${hasFace ? 'ЛИЦО НАЙДЕНО' : 'ЛИЦО НЕ НАЙДЕНО'} (количество лиц: ${faces?.length || 0})`);
    
    if (faces && faces.length > 0) {
      console.log(`🔍 [Vision] Детали найденных лиц:`);
      faces.forEach((face, index) => {
        console.log(`  Лицо ${index + 1}: confidence=${face.detectionConfidence}, joy=${face.joyLikelihood}, sorrow=${face.sorrowLikelihood}`);
      });
    }
    
    return hasFace;
  } catch (error) {
    console.error('❌ [Vision] Ошибка при проверке лица:', error.message);
    console.error('❌ [Vision] Полная ошибка:', error);
    return false;
  }
}

// Новый вариант для работы с буфером
async function faceDetectorBuffer(imageBuffer) {
  if (!visionClient) {
    console.log('🔍 [Vision] Клиент не инициализирован, пропускаем проверку лица');
    return false;
  }
  console.log('🔍 [Vision] Начинаем проверку лица через Google Vision API (буфер)...');
  try {
    // Конвертируем HEIC в JPEG если нужно
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > 0) {
  try {
        processedBuffer = await convertHeicToJpeg(imageBuffer);
      } catch (error) {
        console.log('🔍 [Vision] Конвертация HEIC не удалась, используем оригинальный буфер');
      }
    }
    
    const [result] = await visionClient.faceDetection({
      image: { content: processedBuffer.toString('base64') }
    });
    const faces = result.faceAnnotations;
    const hasFace = Array.isArray(faces) && faces.length > 0;
    console.log(`🔍 [Vision] Результат проверки лица (буфер): ${hasFace ? 'ЛИЦО НАЙДЕНО' : 'ЛИЦО НЕ НАЙДЕНО'} (количество лиц: ${faces?.length || 0})`);
    return hasFace;
  } catch (error) {
    console.error('❌ [Vision] Ошибка при проверке лица (буфер):', error.message);
    return false;
  }
}
global.faceDetectorBuffer = faceDetectorBuffer;
    
// Функция для проверки наличия лица на фотографии через Google Vision
async function checkFaceInPhoto(visionClient, imageBuffer) {
  console.log(`🔍 [Vision] Начинаем проверку наличия лица на фотографии`);
  
  if (!visionClient) {
    console.log('🔍 [Vision] Клиент не инициализирован, пропускаем проверку лица');
    return { success: false, error: 'Сервис проверки лица недоступен' };
  }
  
  try {
    console.log('🔍 [Vision] Отправляем фото в Google Vision API для проверки лица...');
    
    // Конвертируем HEIC в JPEG если нужно
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > 0) {
      try {
        processedBuffer = await convertHeicToJpeg(imageBuffer);
      } catch (error) {
        console.log('🔍 [Vision] Конвертация HEIC не удалась, используем оригинальный буфер');
      }
    }
    
    const [result] = await visionClient.faceDetection({
      image: { content: processedBuffer.toString('base64') }
    });

    const faces = result.faceAnnotations;
    console.log(`🔍 [Vision] Получен ответ от Vision API, количество лиц: ${faces?.length || 0}`);
    
    if (!faces || faces.length === 0) {
      console.log('🔍 [Vision] Лицо не обнаружено на фотографии');
      return { success: false, error: 'Лицо не обнаружено на фотографии' };
    }

    console.log(`🔍 [Vision] ✅ Лицо обнаружено на фотографии (количество лиц: ${faces.length})`);
    return { 
      success: true, 
      faceCount: faces.length 
    };
    
  } catch (error) {
    console.error('❌ [Vision] Ошибка при проверке лица через Vision API:', error);
    return { 
      success: false, 
      error: 'Ошибка при анализе фотографии. Попробуйте еще раз.' 
    };
  }
}

// --- Функция для проверки мемов и фейковых изображений через Vision ---
async function isMemeOrFake(visionClient, imageBuffer) {
  console.log('🔍 [Vision] Начинаем проверку на мемы/фейки через Google Vision API...');
  
  if (!visionClient) {
    console.log('🔍 [Vision] Клиент не инициализирован, пропускаем проверку мемов/фейков');
    return { isMeme: false };
  }
  
  try {
    // Конвертируем HEIC в JPEG если нужно
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > 0) {
      try {
        processedBuffer = await convertHeicToJpeg(imageBuffer);
      } catch (error) {
        console.log('🔍 [Vision] Конвертация HEIC не удалась, используем оригинальный буфер');
      }
    }
    
    // SafeSearch
    console.log('🔍 [Vision] Отправляем запрос SafeSearch для проверки на фейки...');
    const [safeResult] = await visionClient.safeSearchDetection({ 
      image: { content: processedBuffer.toString('base64') } 
    });
    const safe = safeResult.safeSearchAnnotation || {};
    const spoof = safe.spoof || 'UNKNOWN';
    const spoofMap = { 
      'VERY_LIKELY': 0.9, 
      'LIKELY': 0.7, 
      'POSSIBLE': 0.5, 
      'UNLIKELY': 0.3, 
      'VERY_UNLIKELY': 0.1, 
      'UNKNOWN': 0.5 
    };
    const spoofScore = spoofMap[spoof] || 0.5;
    
    console.log(`🔍 [Vision] SafeSearch результат: spoof=${spoof} (score=${spoofScore})`);
    
    if (spoofScore >= 0.7) {
      console.log(`🔍 [Vision] ОШИБКА: Обнаружен фейк/мем через SafeSearch (${spoof})`);
      return { isMeme: true, reason: `SafeSearch spoofLikelihood=${spoof}` };
    }
    
    // Web Detection
    console.log('🔍 [Vision] Отправляем запрос Web Detection для проверки на мемы...');
    const [webResult] = await visionClient.webDetection({ 
      image: { content: processedBuffer.toString('base64') } 
    });
    const web = webResult.webDetection || {};
    
    console.log(`🔍 [Vision] Web Detection результат:`, {
      bestGuessLabels: web.bestGuessLabels?.length || 0,
      webEntities: web.webEntities?.length || 0
    });
    
    if (web.bestGuessLabels && web.bestGuessLabels.length) {
      const label = web.bestGuessLabels[0].label || '';
      console.log(`🔍 [Vision] Лучший лейбл: "${label}"`);
      // Более мягкая проверка - только явные мемы
      if (/meme|deepfake|ai generated|artificial intelligence|generated|screenshot|screen capture/i.test(label)) {
        console.log(`🔍 [Vision] ОШИБКА: Обнаружен мем/фейк через Web Detection (label: ${label})`);
        return { isMeme: true, reason: `WebDetection label: ${label}` };
      }
    }
    
    if (web.webEntities && web.webEntities.length) {
      console.log(`🔍 [Vision] Проверяем ${web.webEntities.length} веб-сущностей...`);
      for (const ent of web.webEntities) {
        if (ent.description && /meme|deepfake|ai generated|artificial intelligence|generated|screenshot|screen capture/i.test(ent.description)) {
          console.log(`🔍 [Vision] ОШИБКА: Обнаружен мем/фейк через Web Detection (entity: ${ent.description})`);
          return { isMeme: true, reason: `WebDetection entity: ${ent.description}` };
        }
      }
    }
    
    console.log('🔍 [Vision] ✅ Проверка на мемы/фейки пройдена успешно');
    return { isMeme: false };
    
  } catch (err) {
    console.error('❌ [Vision] Ошибка при проверке мемов/фейков:', err);
    return { isMeme: false };
  }
}

const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

// Логи для Face++ инициализации
if (FACEPP_API_KEY && FACEPP_API_SECRET) {
  console.log('🔍 [Face++] API ключи настроены, готов к определению пола');
} else {
  console.log('🔍 [Face++] API ключи не настроены, определение пола отключено');
}

async function detectGenderFacePlusPlus(imageBuffer, apiKey, apiSecret) {
  console.log('🔍 [Face++] Начинаем определение пола через Face++ API...');
  
  if (!apiKey || !apiSecret) {
    console.log('🔍 [Face++] API ключи не настроены, пропускаем определение пола');
    return { success: false, error: 'Сервис определения пола недоступен' };
  }
  
  try {
    // Конвертируем HEIC в JPEG если нужно
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > 0) {
      try {
        processedBuffer = await convertHeicToJpeg(imageBuffer);
      } catch (error) {
        console.log('🔍 [Face++] Конвертация HEIC не удалась, используем оригинальный буфер');
      }
    }
    
    const base64 = processedBuffer.toString('base64');
    console.log(`🔍 [Face++] Подготавливаем данные для отправки (размер изображения: ${processedBuffer.length} байт)`);
    
  const formData = new URLSearchParams();
  formData.append('api_key', apiKey);
  formData.append('api_secret', apiSecret);
  formData.append('image_base64', base64);
  formData.append('return_attributes', 'gender');
    
    console.log('🔍 [Face++] Отправляем запрос в Face++ API...');
  const resp = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
    
    console.log(`🔍 [Face++] Получен ответ от Face++ API, статус: ${resp.status}`);
    
  if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`🔍 [Face++] Ошибка Face++ API: ${resp.status} - ${errorText}`);
    throw new Error(`Face++ API error: ${resp.statusText}`);
  }
    
  const data = await resp.json();
    console.log(`🔍 [Face++] Ответ Face++ API:`, {
      face_num: data.face_num,
      faces_count: data.faces?.length || 0,
      error_message: data.error_message
    });
    
  if (!data.faces || data.faces.length === 0) {
      console.log('🔍 [Face++] Лицо не обнаружено на фотографии');
    return { success: false, error: 'Лицо не обнаружено' };
  }
    
    const face = data.faces[0];
    const gender = face.attributes.gender.value; // 'Male' или 'Female'
    const confidence = face.attributes.gender.confidence;
    
    console.log(`🔍 [Face++] ✅ Определен пол: ${gender} (уверенность: ${confidence}%)`);
    return { 
      success: true, 
      gender,
      confidence: confidence / 100 // конвертируем в десятичную дробь
    };
    
  } catch (error) {
    console.error('❌ [Face++] Ошибка при определении пола через Face++ API:', error);
    return { 
      success: false, 
      error: 'Ошибка при определении пола. Попробуйте еще раз.' 
    };
  }
}

function photosRouter(db, logger, IMG_DIR, BOT_TOKEN, visionClient) {
  const router = express.Router();

  // Парсим JSON тела
  router.use(express.json());

  // Настраиваем multer для multipart/form-data
  // В CommonJS __dirname уже доступен, используем его напрямую
  const upload = multer({ dest: path.join(__dirname, '../uploads') });
  // Using native fetch API (available in Node.js 18+)

  /**
   * multipart upload
   * POST /api/photos/upload  и  POST /api/photos/uploadPhoto
   * поля: file (файл), userId
   */
  // --- Проверка фото пользователя ---
  // Используем только Face++ для пола, Vision — только для лица и мемов/фейков
  router.post(['/upload', '/uploadPhoto'], upload.single('file'), async (req, res) => {
    try {
      const { userId } = req.body;
      console.log(`[uploadPhoto] userId=${userId}, temp file: ${req.file?.path}`);
      if (!userId || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: 'userId и file обязательны' });
      }
      const tmpPath = req.file.path;
      const buffer = fs.readFileSync(tmpPath);
      fs.unlinkSync(tmpPath);
      // Получаем пол пользователя из БД для проверки
      const userRow = await new Promise((resolve, reject) =>
        db.get('SELECT gender FROM users WHERE userId = ?', [userId], (err, r) => err ? reject(err) : resolve(r))
      );
      if (!userRow || !userRow.gender) {
        return res.status(400).json({ success: false, error: 'Пол пользователя не указан. Сначала укажите свой пол.' });
      }
      // 1. Проверка наличия лица через Vision
      let hasFace = true;
      if (visionClient) {
        try {
          hasFace = await faceDetector(tmpPath);
          console.log(`[uploadPhoto] Vision: лицо найдено: ${hasFace}`);
        } catch (err) {
          console.error(`[uploadPhoto] Vision: ошибка при поиске лица:`, err);
          return res.status(500).json({ success: false, error: 'Ошибка сервиса распознавания лиц' });
        }
      } else {
        console.warn('[uploadPhoto] Vision не работает, лицо не проверяется!');
      }
      if (!hasFace) {
        console.warn('[uploadPhoto] Лицо не обнаружено, файл не добавлен');
        return res.status(400).json({ success: false, error: 'Лицо не обнаружено. Загрузите другое фото.', needPhoto: 1 });
      }
      // 2. Проверка на мемы/фейки через Vision
      if (visionClient) {
        const memeCheck = await isMemeOrFake(visionClient, buffer);
        console.log(`[uploadPhoto] Vision: meme/fake check:`, memeCheck);
        if (memeCheck.isMeme) {
          console.warn(`[uploadPhoto] Vision: мем/фейк (${memeCheck.reason})`);
          return res.status(400).json({ success: false, error: 'На фото обнаружен мем, фейк или кадр из фильма. Загрузите реальное фото.', needPhoto: 1 });
      }
      }
      // 3. Проверка пола через Face++
      if (FACEPP_API_KEY && FACEPP_API_SECRET) {
        try {
          const faceResult = await detectGenderFacePlusPlus(buffer, FACEPP_API_KEY, FACEPP_API_SECRET);
          console.log(`[uploadPhoto] Face++ gender:`, faceResult);
          if (!faceResult.success) {
            console.warn(`[uploadPhoto] Face++: ${faceResult.error}`);
            return res.status(400).json({ success: false, error: faceResult.error, needPhoto: 1 });
          }
          if ((userRow.gender === 'male' && faceResult.gender === 'Female') ||
              (userRow.gender === 'female' && faceResult.gender === 'Male')) {
            console.warn(`[uploadPhoto] Face++: Пол на фото не совпадает с полом пользователя`);
            return res.status(400).json({ success: false, error: 'На фото обнаружено несоответствие пола. Если вы ошиблись — удалите анкету и выберите корректный пол.', needPhoto: 1 });
          }
        } catch (err) {
          console.error(`[uploadPhoto] Face++ error:`, err);
          return res.status(500).json({ success: false, error: 'Ошибка сервиса Face++', needPhoto: 1 });
        }
      } else {
        console.warn('[uploadPhoto] Face++ не настроен, пол не проверяется!');
      }

      // Подготовка папки пользователя
      const ext = '.jpg';
      const userDir = path.join(IMG_DIR, userId);
      console.log(`[uploadPhoto] Проверяю папку пользователя: ${userDir}`);
      try {
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
          console.log(`[uploadPhoto] ✅ Создана папка пользователя: ${userDir}`);
        }
      } catch (mkdirErr) {
        console.error(`[uploadPhoto] ❌ Ошибка создания папки пользователя ${userDir}: ${mkdirErr.message}`);
        return res.status(500).json({ success: false, error: 'Ошибка создания папки пользователя' });
      }

      // Получаем текущие слоты из БД
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT photo1, photo2, photo3 FROM users WHERE userId = ?', [userId],
               (err, r) => err ? reject(err) : resolve(r))
      );
      let p1 = (row.photo1 || '').trim();
      let p2 = (row.photo2 || '').trim();
      let p3 = (row.photo3 || '').trim();
      console.log(`Current slots before upload: p1="${p1}", p2="${p2}", p3="${p3}"`);

      // Verify actual file existence; clear stale DB entries
      for (const [col, urlRef] of [['photo1', p1], ['photo2', p2], ['photo3', p3]]) {
        if (urlRef) {
          const file = path.basename(urlRef);
          const fp = path.join(userDir, file);
          if (!fs.existsSync(fp)) {
            console.warn(`Stale DB entry for ${col}: file not found ${fp}, clearing slot`);
            db.run(`UPDATE users SET ${col} = "" WHERE userId = ?`, [userId], err => {
              if (err) console.error(`Failed to clear stale ${col}: ${err.message}`);
            });
            if (col === 'photo1') p1 = '';
            if (col === 'photo2') p2 = '';
            if (col === 'photo3') p3 = '';
          }
        }
      }

      let chosenSlot;

      let fileName;
      if (!p1) {
        chosenSlot = 'photo1';
        console.log(`Chosen slot: ${chosenSlot}`);
        fileName = `Photo1${ext}`;
      } else if (!p2) {
        chosenSlot = 'photo2';
        console.log(`Chosen slot: ${chosenSlot}`);
        fileName = `Photo2${ext}`;
      } else if (!p3) {
        chosenSlot = 'photo3';
        console.log(`Chosen slot: ${chosenSlot}`);
        fileName = `Photo3${ext}`;
      } else {
        chosenSlot = 'rotate';
        console.log('Chosen slot: rotate (cyclic shift)');
        const archiveDir = path.join(userDir, 'archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        // 1) Архивируем photo1
        if (p1) {
          const f1 = path.basename(p1);
          fs.renameSync(path.join(userDir, f1), path.join(archiveDir, f1));
        }
        // 2) Сдвигаем photo2 → Photo1.jpg
        if (p2) {
          const f2 = path.basename(p2);
          fs.renameSync(path.join(userDir, f2), path.join(userDir, `Photo1${ext}`));
        }
        // 3) Сдвигаем photo3 → Photo2.jpg
        if (p3) {
          const f3 = path.basename(p3);
          fs.renameSync(path.join(userDir, f3), path.join(userDir, `Photo2${ext}`));
        }
        // Новый файл в Photo3.jpg
        fileName = `Photo3${ext}`;
      }

      // Сохраняем новое фото
      const destPath = path.join(userDir, fileName);
      console.log(`Writing file to ${destPath}`);
      fs.writeFileSync(destPath, buffer);
      const slotUrl = `/data/img/${userId}/${fileName}`;

      // При rotate обновляем сразу все три слота, иначе только выбранный
      if (chosenSlot === 'rotate') {
        const url1 = p2 ? `/data/img/${userId}/Photo1${ext}` : '';
        const url2 = p3 ? `/data/img/${userId}/Photo2${ext}` : '';
        const url3 = slotUrl;
        await new Promise((resolve, reject) =>
          db.run(
            `UPDATE users SET photo1 = ?, photo2 = ?, photo3 = ?, needPhoto = 0, warned = 0 WHERE userId = ?`,
            [url1, url2, url3, userId],
            err => err ? reject(err) : resolve()
          )
        );
      } else {
        const column = fileName.startsWith('Photo1') ? 'photo1'
                     : fileName.startsWith('Photo2') ? 'photo2'
                     : 'photo3';
        await new Promise((resolve, reject) =>
          db.run(
            `UPDATE users SET ${column} = ?, needPhoto = 0, warned = 0 WHERE userId = ?`,
            [slotUrl, userId],
            err => err ? reject(err) : resolve()
          )
        );
      }
      console.log(`Successfully updated DB for slot ${chosenSlot}, URL: ${slotUrl}`);

      // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
      // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
      if (visionClient) {
        // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
        await new Promise((resolve, reject) => {
          db.run('UPDATE users SET needPhoto = 0 WHERE userId = ?', [userId], function(err) {
            if (err) reject(err); else resolve();
          });
        });
        console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
      } else {
        // Google Vision не работает, оставляем needPhoto = 1
        console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
      }
      // Вернуть актуального пользователя
      const userRowFull = await new Promise((resolve, reject) =>
        db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, r) => err ? reject(err) : resolve(r))
      );
      res.json({ success: true, url: `/data/img/${userId}/${fileName}`, user: userRowFull });

    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error(`/api/photos/upload error: ${err.message}\n${err.stack}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * JSON-upload
   * POST /api/photos/uploadUrl  и  POST /api/photos/webUploadPhoto
   * body: { userId, fileUrl }
   */
  router.post(['/uploadUrl', '/webUploadPhoto'], upload.single('file'), async (req, res) => {
    // Если multipart с файлом — эталонная логика
    if (req.file) {
        const { userId } = req.body;
        const localPath = req.file.path;
      try {
        console.log(`[webUploadPhoto] Начало загрузки файла для userId=${userId}`);
        console.log(`[webUploadPhoto] Временный файл: ${localPath}, размер: ${fs.statSync(localPath).size} байт`);
        
        // Диагностика файла
        const fileBuffer = fs.readFileSync(localPath);
        const fileHash = require('crypto').createHash('md5').update(fileBuffer).digest('hex');
        console.log(`[webUploadPhoto] Хеш исходного файла: ${fileHash}`);
        console.log(`[webUploadPhoto] Тип файла: ${req.file.mimetype}`);
        console.log(`[webUploadPhoto] Оригинальное имя: ${req.file.originalname}`);
        
        // 1. Проверяем и создаём /data, если нужно
        const dataDir = '/data';
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
          console.log(`[webUploadPhoto] ✅ Создана папка /data: ${dataDir}`);
        }
        // 2. Проверяем и создаём IMG_DIR, если нужно
        if (!fs.existsSync(IMG_DIR)) {
          fs.mkdirSync(IMG_DIR, { recursive: true });
          console.log(`[webUploadPhoto] ✅ Создана папка IMG_DIR: ${IMG_DIR}`);
        }
        // 3. Проверяем и создаём userFolder
        const userFolder = path.join(IMG_DIR, String(userId));
        if (!fs.existsSync(userFolder)) {
          fs.mkdirSync(userFolder, { recursive: true });
          console.log(`[webUploadPhoto] ✅ Создана папка пользователя: ${userFolder}`);
        }
        // 4. Отправляем файл в Telegram
        console.log(`[webUploadPhoto] Отправляем файл в Telegram...`);
        const { bot } = require('../bot');
        const tgMsg = await bot.telegram.sendPhoto(
          String(userId),
          { source: fs.createReadStream(localPath) }
        );
        const messageId = tgMsg.message_id;
        const fileId = tgMsg.photo.pop().file_id;
        console.log(`[webUploadPhoto] ✅ Фото отправлено в Telegram, messageId=${messageId}, fileId=${fileId}`);
        
        // Сохраняем messageId для последующего удаления
        const messageIdsToDelete = [];
        messageIdsToDelete.push(messageId);
        
        // 5. Получаем file_path и скачиваем оригинал с Telegram
        console.log(`[webUploadPhoto] Получаем file_path...`);
        const tgFile = await bot.telegram.getFile(fileId);
        const telegramPath = tgFile.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${telegramPath}`;
        console.log(`[webUploadPhoto] Скачиваем с Telegram: ${downloadUrl}`);
        
        const resp = await fetch(downloadUrl);
        if (!resp.ok) throw new Error(`Telegram download failed: ${resp.statusText}`);
        // Исправляем для совместимости со старыми версиями Node.js
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`[webUploadPhoto] ✅ Скачан файл с Telegram, размер: ${buffer.length} байт`);
        
        // Диагностика скачанного файла
        const downloadedHash = require('crypto').createHash('md5').update(buffer).digest('hex');
        console.log(`[webUploadPhoto] Хеш скачанного файла: ${downloadedHash}`);
        console.log(`[webUploadPhoto] Файлы ${fileHash === downloadedHash ? 'ИДЕНТИЧНЫ' : 'РАЗЛИЧАЮТСЯ'}!`);
        
        // Получаем пол пользователя из БД для проверки
        const userRow = await new Promise((resolve, reject) =>
          db.get('SELECT gender FROM users WHERE userId = ?', [userId],
                 (err, r) => err ? reject(err) : resolve(r))
        );
        
        if (!userRow || !userRow.gender) {
          return res.status(400).json({ success: false, error: 'Пол пользователя не указан. Сначала укажите свой пол.' });
        }

        // Проверяем наличие лица на фотографии через Google Vision
        if (visionClient) {
          console.log(`[webUploadPhoto] Проверяем наличие лица на фотографии для пользователя ${userId}`);
          const faceCheck = await checkFaceInPhoto(visionClient, buffer);
          
          if (!faceCheck.success) {
            console.warn(`[webUploadPhoto] Проверка лица не пройдена для пользователя ${userId}: ${faceCheck.error}`);
            
            // Удаляем сообщения из Telegram при ошибке
            for (const msgId of messageIdsToDelete) {
              try {
                await bot.telegram.deleteMessage(String(userId), msgId);
                console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram (ошибка лица)`);
              } catch (deleteErr) {
                console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
              }
            }
            
            return res.status(400).json({ success: false, error: faceCheck.error });
          }
          
          console.log(`[webUploadPhoto] Проверка лица пройдена для пользователя ${userId}: найдено лиц (количество: ${faceCheck.faceCount})`);
        }

        // Face++ gender check
        if (FACEPP_API_KEY && FACEPP_API_SECRET) {
          try {
            const faceResult = await detectGenderFacePlusPlus(buffer, FACEPP_API_KEY, FACEPP_API_SECRET);
            console.log(`[webUploadPhoto] Face++ gender:`, faceResult);
            if (!faceResult.success) {
              console.warn(`[webUploadPhoto] Face++: ${faceResult.error}`);
              
              // Удаляем сообщения из Telegram при ошибке
              for (const msgId of messageIdsToDelete) {
                try {
                  await bot.telegram.deleteMessage(String(userId), msgId);
                  console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram (ошибка Face++)`);
                } catch (deleteErr) {
                  console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
                }
              }
              
              return res.status(400).json({ success: false, error: faceResult.error });
            }
            if ((userRow.gender === 'male' && faceResult.gender === 'Female') ||
                (userRow.gender === 'female' && faceResult.gender === 'Male')) {
              console.warn(`[webUploadPhoto] Face++: Пол на фото не совпадает с полом пользователя`);
              
              // Удаляем сообщения из Telegram при ошибке
              for (const msgId of messageIdsToDelete) {
                try {
                  await bot.telegram.deleteMessage(String(userId), msgId);
                  console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram (несоответствие пола)`);
                } catch (deleteErr) {
                  console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
                }
              }
              
              return res.status(400).json({ success: false, error: 'На фото обнаружено несоответствие пола. Если вы ошиблись — удалите анкету и выберите корректный пол.' });
            }
          } catch (err) {
            console.error(`[webUploadPhoto] Face++ error:`, err);
            
            // Удаляем сообщения из Telegram при ошибке
            for (const msgId of messageIdsToDelete) {
              try {
                await bot.telegram.deleteMessage(String(userId), msgId);
                console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram (ошибка Face++)`);
              } catch (deleteErr) {
                console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
              }
            }
            
            return res.status(500).json({ success: false, error: 'Ошибка сервиса Face++' });
        }
        }

        // Проверка на мемы/фейки
        if (visionClient) {
          const memeCheck = await isMemeOrFake(visionClient, buffer);
          console.log(`[webUploadPhoto] Meme check:`, memeCheck);
          if (memeCheck.isMeme) {
            console.warn(`[webUploadPhoto] Отклонено: мем/фейк (${memeCheck.reason})`);
            
            // Удаляем сообщения из Telegram при ошибке
            for (const msgId of messageIdsToDelete) {
              try {
                await bot.telegram.deleteMessage(String(userId), msgId);
                console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram (мем/фейк)`);
              } catch (deleteErr) {
                console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
              }
            }
            
            return res.status(400).json({ success: false, error: 'На фото обнаружен мем, фейк или кадр из фильма. Загрузите реальное фото.' });
          }
        }
        
        if (fileHash === downloadedHash) {
          // Успешная загрузка через Telegram - файлы идентичны
          console.log(`[webUploadPhoto] ✅ Telegram вернул оригинальный файл, сохраняем...`);
          
          // Определяем свободный слот
          let photoSlot = 'Photo1.jpg';
          if (fs.existsSync(path.join(userFolder, 'Photo1.jpg'))) {
            if (fs.existsSync(path.join(userFolder, 'Photo2.jpg'))) {
              if (fs.existsSync(path.join(userFolder, 'Photo3.jpg'))) {
                // Все слоты заняты, архивируем и сдвигаем
                console.log(`[webUploadPhoto] Все слоты заняты, архивируем...`);
                if (fs.existsSync(path.join(userFolder, 'archive'))) {
                  fs.rmSync(path.join(userFolder, 'archive'), { recursive: true, force: true });
        }
                fs.mkdirSync(path.join(userFolder, 'archive'), { recursive: true });
                fs.renameSync(path.join(userFolder, 'Photo3.jpg'), path.join(userFolder, 'archive', 'Photo3.jpg'));
                fs.renameSync(path.join(userFolder, 'Photo2.jpg'), path.join(userFolder, 'Photo3.jpg'));
                fs.renameSync(path.join(userFolder, 'Photo1.jpg'), path.join(userFolder, 'Photo2.jpg'));
                photoSlot = 'Photo1.jpg';
              } else {
                photoSlot = 'Photo3.jpg';
              }
            } else {
              photoSlot = 'Photo2.jpg';
            }
          } else {
            photoSlot = 'Photo1.jpg';
          }
          console.log(`[webUploadPhoto] Выбран слот: ${photoSlot}`);
          
          // Сохраняем скачанный файл
          const finalPath = path.join(userFolder, photoSlot);
          fs.writeFileSync(finalPath, buffer);
          console.log(`[webUploadPhoto] ✅ Файл сохранён: ${finalPath} (${buffer.length} байт)`);
          
                  // Обновляем БД
          const serverDomain = process.env.SERVER_DOMAIN || process.env.WEB_APP_URL || 'https://sta-black-dim.waw.amverum.cloud';
          const photoUrl = `${serverDomain}/data/img/${userId}/${photoSlot}`;
          console.log(`[webUploadPhoto] URL для БД: ${photoUrl}`);
          console.log(`[webUploadPhoto] Сохраняем в БД...`);
          await updateUserPhotosInDb(db, userId, photoUrl);
          console.log(`[webUploadPhoto] ✅ URL сохранён в БД`);
          
          // Удаляем временный файл
          try {
            fs.unlinkSync(localPath);
            console.log(`[webUploadPhoto] ✅ Временный файл удалён: ${localPath}`);
          } catch (unlinkError) {
            console.log(`[webUploadPhoto] ⚠️ Не удалось удалить временный файл:`, unlinkError.message);
          }
          
          console.log(`[webUploadPhoto] ✅ Загрузка завершена успешно (Telegram режим)`);
          
          // Удаляем сообщения из Telegram
          for (const msgId of messageIdsToDelete) {
            try {
              await bot.telegram.deleteMessage(String(userId), msgId);
              console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram`);
            } catch (deleteErr) {
              console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
            }
          }
          
          res.json({ success: true, url: photoUrl });
          return;
        } else {
          // Хеши не совпадают - используем прямой режим
          console.log(`[webUploadPhoto] ⚠️ ВНИМАНИЕ: Telegram вернул другой файл!`);
          console.log(`[webUploadPhoto] Возможные причины: формат не поддерживается, файл повреждён, Telegram кэшировал другое фото`);
          console.log(`[webUploadPhoto] 🔄 Используем прямой режим загрузки (без Telegram)...`);
          
          // Альтернативный режим: сохраняем оригинальный файл напрямую
          const fileExtension = path.extname(req.file.originalname) || '.jpg';
          console.log(`[webUploadPhoto] Расширение из оригинального файла: ${fileExtension}`);
          
          // Определяем свободный слот
          let photoSlot = 'Photo1.jpg';
          if (fs.existsSync(path.join(userFolder, 'Photo1.jpg'))) {
            if (fs.existsSync(path.join(userFolder, 'Photo2.jpg'))) {
              if (fs.existsSync(path.join(userFolder, 'Photo3.jpg'))) {
                // Все слоты заняты, архивируем и сдвигаем
                console.log(`[webUploadPhoto] Все слоты заняты, архивируем...`);
                if (fs.existsSync(path.join(userFolder, 'archive'))) {
                  fs.rmSync(path.join(userFolder, 'archive'), { recursive: true, force: true });
                }
                fs.mkdirSync(path.join(userFolder, 'archive'), { recursive: true });
                fs.renameSync(path.join(userFolder, 'Photo3.jpg'), path.join(userFolder, 'archive', 'Photo3.jpg'));
                fs.renameSync(path.join(userFolder, 'Photo2.jpg'), path.join(userFolder, 'Photo3.jpg'));
                fs.renameSync(path.join(userFolder, 'Photo1.jpg'), path.join(userFolder, 'Photo2.jpg'));
                photoSlot = 'Photo1.jpg';
        } else {
                photoSlot = 'Photo3.jpg';
              }
            } else {
              photoSlot = 'Photo2.jpg';
            }
          } else {
            photoSlot = 'Photo1.jpg';
          }
          console.log(`[webUploadPhoto] Выбран слот: ${photoSlot}`);
          
          // Сохраняем оригинальный файл
          const finalPath = path.join(userFolder, photoSlot);
          fs.copyFileSync(localPath, finalPath);
          console.log(`[webUploadPhoto] ✅ Оригинальный файл сохранён: ${finalPath} (${fs.statSync(localPath).size} байт)`);
          
          // Обновляем БД
          const serverDomain = process.env.SERVER_DOMAIN || process.env.WEB_APP_URL || 'https://sta-black-dim.waw.amverum.cloud';
          const photoUrl = `${serverDomain}/data/img/${userId}/${photoSlot}`;
          console.log(`[webUploadPhoto] URL для БД: ${photoUrl}`);
          console.log(`[webUploadPhoto] Сохраняем в БД...`);
          await updateUserPhotosInDb(db, userId, photoUrl);
          console.log(`[webUploadPhoto] ✅ URL сохранён в БД`);
          
          // Удаляем временный файл
          try {
            fs.unlinkSync(localPath);
            console.log(`[webUploadPhoto] ✅ Временный файл удалён: ${localPath}`);
          } catch (unlinkError) {
            console.log(`[webUploadPhoto] ⚠️ Не удалось удалить временный файл:`, unlinkError.message);
          }
          
          console.log(`[webUploadPhoto] ✅ Загрузка завершена успешно (прямой режим)`);
          
          // Удаляем сообщения из Telegram
          for (const msgId of messageIdsToDelete) {
            try {
              await bot.telegram.deleteMessage(String(userId), msgId);
              console.log(`[webUploadPhoto] ✅ Сообщение ${msgId} удалено из Telegram`);
            } catch (deleteErr) {
              console.log(`[webUploadPhoto] ⚠️ Не удалось удалить сообщение ${msgId}:`, deleteErr.message);
            }
          }
          
          res.json({ success: true, url: photoUrl });
          return;
        }
      } catch (err) {
        console.error("❌ /api/webUploadPhoto error:", err);
        console.error("❌ Stack trace:", err.stack);
        
        // Пытаемся удалить временный файл даже при ошибке
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
            console.log(`[webUploadPhoto] ✅ Временный файл удалён при ошибке: ${localPath}`);
          } catch (unlinkErr) {
            console.error(`[webUploadPhoto] ❌ Не удалось удалить временный файл:`, unlinkErr);
          }
        }
        
        res.status(500).json({ success: false, error: err.message });
        return;
      }
    }
    // Старый режим: JSON с fileUrl (оставить для uploadUrl)
    try {
      const { userId, fileUrl } = req.body;
      console.log(`uploadUrl called for user ${userId}, fileUrl: ${fileUrl}`);
      if (!userId || !fileUrl) {
        return res.status(400).json({ success: false, error: 'userId и fileUrl обязательны' });
      }
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.statusText}`);
      // Исправляем для совместимости со старыми версиями Node.js
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Получаем пол пользователя из БД для проверки
      const userRow = await new Promise((resolve, reject) =>
        db.get('SELECT gender FROM users WHERE userId = ?', [userId],
               (err, r) => err ? reject(err) : resolve(r))
      );
      
      if (!userRow || !userRow.gender) {
        return res.status(400).json({ success: false, error: 'Пол пользователя не указан. Сначала укажите свой пол.' });
      }

      // Проверяем наличие лица на фотографии через Google Vision
      if (visionClient) {
        console.log(`Проверяем наличие лица на фотографии для пользователя ${userId}`);
        const faceCheck = await checkFaceInPhoto(visionClient, buffer);
        
        if (!faceCheck.success) {
          console.warn(`Проверка лица не пройдена для пользователя ${userId}: ${faceCheck.error}`);
          return res.status(400).json({ success: false, error: faceCheck.error });
        }
        
        console.log(`Проверка лица пройдена для пользователя ${userId}: найдено лиц (количество: ${faceCheck.faceCount})`);
      }

      // Face++ gender check
      if (FACEPP_API_KEY && FACEPP_API_SECRET) {
        try {
          const faceResult = await detectGenderFacePlusPlus(buffer, FACEPP_API_KEY, FACEPP_API_SECRET);
          console.log(`[uploadUrl] Face++ gender:`, faceResult);
          if (!faceResult.success) {
            console.warn(`[uploadUrl] Face++: ${faceResult.error}`);
            return res.status(400).json({ success: false, error: faceResult.error });
          }
          if ((userRow.gender === 'male' && faceResult.gender === 'Female') ||
              (userRow.gender === 'female' && faceResult.gender === 'Male')) {
            console.warn(`[uploadUrl] Face++: Пол на фото не совпадает с полом пользователя`);
            return res.status(400).json({ success: false, error: 'На фото обнаружено несоответствие пола. Если вы ошиблись — удалите анкету и выберите корректный пол.' });
          }
        } catch (err) {
          console.error(`[uploadUrl] Face++ error:`, err);
          return res.status(500).json({ success: false, error: 'Ошибка сервиса Face++' });
        }
      }

      // Проверка на мемы/фейки
      if (visionClient) {
        const memeCheck = await isMemeOrFake(visionClient, buffer);
        console.log(`[uploadUrl] Meme check:`, memeCheck);
        if (memeCheck.isMeme) {
          console.warn(`[uploadUrl] Отклонено: мем/фейк (${memeCheck.reason})`);
          return res.status(400).json({ success: false, error: 'На фото обнаружен мем, фейк или кадр из фильма. Загрузите реальное фото.' });
        }
      }

      // Определяем расширение и пути
      const ext = '.jpg';
      const targetFolder = path.join(IMG_DIR, userId);
      const archiveFolder = path.join(targetFolder, 'archive');

      // Прочитать текущие слоты
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT photo1, photo2, photo3 FROM users WHERE userId = ?', [userId], (e, r) => e ? reject(e) : resolve(r))
      );
      console.log(`Debug slots (JSON) for user ${userId}: photo1="${row.photo1}", photo2="${row.photo2}", photo3="${row.photo3}"`);
      let p1 = (row.photo1 || '').trim();
      let p2 = (row.photo2 || '').trim();
      let p3 = (row.photo3 || '').trim();
      console.log(`Debug slots for user ${userId}: p1="${p1}", p2="${p2}", p3="${p3}"`);
      console.log(`JSON handler current slots: p1="${p1}", p2="${p2}", p3="${p3}"`);

      // Verify actual file existence; clear stale DB entries
      for (const [col, urlRef] of [['photo1', p1], ['photo2', p2], ['photo3', p3]]) {
        if (urlRef) {
          const file = path.basename(urlRef);
          const fp = path.join(targetFolder, file);
          if (!fs.existsSync(fp)) {
            console.warn(`Stale DB entry for ${col}: file not found ${fp}, clearing slot`);
            db.run(`UPDATE users SET ${col} = "" WHERE userId = ?`, [userId], err => {
              if (err) console.error(`Failed to clear stale ${col}: ${err.message}`);
            });
            if (col === 'photo1') p1 = '';
            if (col === 'photo2') p2 = '';
            if (col === 'photo3') p3 = '';
          }
        }
      }

      let chosenSlot;
      // Создать папку пользователя
      console.log(`[uploadUrl] Проверяю папку пользователя: ${targetFolder}`);
      try {
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
          console.log(`[uploadUrl] ✅ Создана папка пользователя: ${targetFolder}`);
        }
      } catch (mkdirErr) {
        console.error(`[uploadUrl] ❌ Ошибка создания папки пользователя ${targetFolder}: ${mkdirErr.message}`);
        return res.status(500).json({ success: false, error: 'Ошибка создания папки пользователя' });
      }
      // Слот 1
      if (!p1) {
        chosenSlot = 'photo1';
        console.log(`Chosen slot: ${chosenSlot}`);
        const fileName = `Photo1${ext}`;
        const destPath = path.join(targetFolder, fileName);
        console.log(`Writing file to ${destPath}`);
        fs.writeFileSync(destPath, buffer);
        const url = `/data/img/${userId}/${fileName}`;
        await new Promise((resolve, reject) =>
          db.run('UPDATE users SET photo1=? WHERE userId=?', [url, userId], err => err ? reject(err) : resolve())
        );
        
        // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
        // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
        if (visionClient) {
          // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
          await new Promise((resolve, reject) => {
            db.run('UPDATE users SET needPhoto = 0, warned = 0 WHERE userId = ?', [userId], function(err) {
              if (err) reject(err); else resolve();
            });
          });
          console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
        } else {
          // Google Vision не работает, оставляем needPhoto = 1
          console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
        }
        console.log(`Successfully updated DB for slot ${chosenSlot}, URL: ${url}`);
        return res.json({ success: true, url });
      }
      // Слот 2
      else if (!p2) {
        chosenSlot = 'photo2';
        console.log(`Chosen slot: ${chosenSlot}`);
        const fileName = `Photo2${ext}`;
        const destPath = path.join(targetFolder, fileName);
        console.log(`Writing file to ${destPath}`);
        fs.writeFileSync(destPath, buffer);
        const url = `/data/img/${userId}/${fileName}`;
        await new Promise((resolve, reject) =>
          db.run('UPDATE users SET photo2=? WHERE userId=?', [url, userId], err => err ? reject(err) : resolve())
        );
        
        // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
        // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
        if (visionClient) {
          // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
          await new Promise((resolve, reject) => {
            db.run('UPDATE users SET needPhoto = 0, warned = 0 WHERE userId = ?', [userId], function(err) {
              if (err) reject(err); else resolve();
            });
          });
          console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
        } else {
          // Google Vision не работает, оставляем needPhoto = 1
          console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
        }
        console.log(`Successfully updated DB for slot ${chosenSlot}, URL: ${url}`);
        return res.json({ success: true, url });
      }
      // Слот 3
      else if (!p3) {
        chosenSlot = 'photo3';
        console.log(`Chosen slot: ${chosenSlot}`);
        const fileName = `Photo3${ext}`;
        const destPath = path.join(targetFolder, fileName);
        console.log(`Writing file to ${destPath}`);
        fs.writeFileSync(destPath, buffer);
        const url = `/data/img/${userId}/${fileName}`;
        await new Promise((resolve, reject) =>
          db.run('UPDATE users SET photo3=? WHERE userId=?', [url, userId], err => err ? reject(err) : resolve())
        );
        
        // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
        // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
        if (visionClient) {
          // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
          await new Promise((resolve, reject) => {
            db.run('UPDATE users SET needPhoto = 0, warned = 0 WHERE userId = ?', [userId], function(err) {
              if (err) reject(err); else resolve();
            });
          });
          console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
        } else {
          // Google Vision не работает, оставляем needPhoto = 1
          console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
        }
        console.log(`Successfully updated DB for slot ${chosenSlot}, URL: ${url}`);
        return res.json({ success: true, url });
      }
      else {
        chosenSlot = 'rotate';
        console.log(`Chosen slot: rotate (cyclic shift)`);
        // Ensure archive folder exists
        if (!fs.existsSync(archiveFolder)) fs.mkdirSync(archiveFolder, { recursive: true });
        // Archive photo1
        if (p1) {
          const file1 = path.basename(p1);
          fs.renameSync(path.join(targetFolder, file1), path.join(archiveFolder, file1));
        }
        // Shift photo2 -> Photo1
        if (p2) {
          const file2 = path.basename(p2);
          fs.renameSync(path.join(targetFolder, file2), path.join(targetFolder, `Photo1${ext}`));
        }
        // Shift photo3 -> Photo2
        if (p3) {
          const file3 = path.basename(p3);
          fs.renameSync(path.join(targetFolder, file3), path.join(targetFolder, `Photo2${ext}`));
        }
        // Save new upload as Photo3
        const newName = `Photo3${ext}`;
        const destPath = path.join(targetFolder, newName);
        console.log(`Writing file to ${destPath}`);
        fs.writeFileSync(destPath, buffer);
        // Build URLs
        const url1 = p2 ? `/data/img/${userId}/Photo1${ext}` : '';
        const url2 = p3 ? `/data/img/${userId}/Photo2${ext}` : '';
        const url3 = `/data/img/${userId}/${newName}`;
        // Update all three columns at once
        await new Promise((resolve, reject) =>
          db.run(
            `UPDATE users SET photo1 = ?, photo2 = ?, photo3 = ? WHERE userId = ?`,
            [url1, url2, url3, userId],
            err => err ? reject(err) : resolve()
          )
        );
        
        // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
        // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
        if (visionClient) {
          // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
          await new Promise((resolve, reject) => {
            db.run('UPDATE users SET needPhoto = 0, warned = 0 WHERE userId = ?', [userId], function(err) {
              if (err) reject(err); else resolve();
            });
          });
          console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
        } else {
          // Google Vision не работает, оставляем needPhoto = 1
          console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
        }
        console.log(`Successfully rotated and updated DB: photo1=${url1}, photo2=${url2}, photo3=${url3}`);
        return res.json({ success: true, url: url3 });
      }
    } catch (err) {
      console.error(`/api/photos/uploadUrl error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Base64 upload
   * POST /api/photos/uploadBase64
   * body: { userId, photos: [base64string] }
   */
  router.post('/uploadBase64', async (req, res) => {
    try {
      const { userId, photos } = req.body;
      console.log(`uploadBase64 called for user ${userId}, photos count: ${photos?.length || 0}`);
      
      if (!userId || !photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ success: false, error: 'userId и массив photos обязательны' });
      }

      // Получаем пол пользователя из БД для проверки
      const userRow = await new Promise((resolve, reject) =>
        db.get('SELECT gender FROM users WHERE userId = ?', [userId],
               (err, r) => err ? reject(err) : resolve(r))
      );
      
      if (!userRow || !userRow.gender) {
        return res.status(400).json({ success: false, error: 'Пол пользователя не указан. Сначала укажите свой пол.' });
      }

      const targetFolder = path.join(IMG_DIR, userId);
      console.log(`[uploadBase64] Проверяю папку пользователя: ${targetFolder}`);
      try {
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
          console.log(`[uploadBase64] ✅ Создана папка пользователя: ${targetFolder}`);
        }
      } catch (mkdirErr) {
        console.error(`[uploadBase64] ❌ Ошибка создания папки пользователя ${targetFolder}: ${mkdirErr.message}`);
        return res.status(500).json({ success: false, error: 'Ошибка создания папки пользователя' });
      }

      // Прочитать текущие слоты
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT photo1, photo2, photo3 FROM users WHERE userId = ?', [userId], (e, r) => e ? reject(e) : resolve(r))
      );
      
      let p1 = (row.photo1 || '').trim();
      let p2 = (row.photo2 || '').trim();
      let p3 = (row.photo3 || '').trim();

      const uploadedUrls = [];
      let needPhotoUpdated = false;

      for (let i = 0; i < Math.min(photos.length, 3); i++) {
        const base64Data = photos[i];
        if (!base64Data || !base64Data.startsWith('data:image/')) {
          console.warn(`Пропускаем невалидное фото ${i + 1} для пользователя ${userId}`);
          continue;
        }

        // Извлекаем base64 данные
        const base64Match = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (!base64Match) {
          console.warn(`Неверный формат base64 для фото ${i + 1} пользователя ${userId}`);
          continue;
        }

        const [, imageType, base64String] = base64Match;
        const buffer = Buffer.from(base64String, 'base64');

        // Проверяем наличие лица на фотографии через Google Vision
        if (visionClient) {
          console.log(`Проверяем наличие лица на фотографии ${i + 1} для пользователя ${userId}`);
          const faceCheck = await checkFaceInPhoto(visionClient, buffer);
          
          if (!faceCheck.success) {
            console.warn(`Проверка лица не пройдена для фото ${i + 1} пользователя ${userId}: ${faceCheck.error}`);
            continue; // Пропускаем это фото, но продолжаем с другими
          }
          
          console.log(`Проверка лица пройдена для фото ${i + 1} пользователя ${userId}: найдено лиц (количество: ${faceCheck.faceCount})`);
        }

        // Face++ gender check
        if (FACEPP_API_KEY && FACEPP_API_SECRET) {
          try {
            const faceResult = await detectGenderFacePlusPlus(buffer, FACEPP_API_KEY, FACEPP_API_SECRET);
            console.log(`[uploadBase64] Face++ gender:`, faceResult);
            if (!faceResult.success) {
              console.warn(`[uploadBase64] Face++: ${faceResult.error}`);
              continue;
            }
            if ((userRow.gender === 'male' && faceResult.gender === 'Female') ||
                (userRow.gender === 'female' && faceResult.gender === 'Male')) {
              console.warn(`[uploadBase64] Face++: Пол на фото не совпадает с полом пользователя`);
              continue;
            }
          } catch (err) {
            console.error(`[uploadBase64] Face++ error:`, err);
            continue;
          }
        }

        // Проверка на мемы/фейки
        if (visionClient) {
          const memeCheck = await isMemeOrFake(visionClient, buffer);
          console.log(`[uploadBase64] Meme check:`, memeCheck);
          if (memeCheck.isMeme) {
            console.warn(`[uploadBase64] Отклонено: мем/фейк (${memeCheck.reason})`);
            continue;
          }
        }

        // Определяем слот для сохранения
        let slotColumn = null;
        let fileName = null;
        
        if (!p1) {
          slotColumn = 'photo1';
          fileName = 'Photo1.jpg';
          p1 = 'filled';
        } else if (!p2) {
          slotColumn = 'photo2';
          fileName = 'Photo2.jpg';
          p2 = 'filled';
        } else if (!p3) {
          slotColumn = 'photo3';
          fileName = 'Photo3.jpg';
          p3 = 'filled';
        } else {
          // Все слоты заняты, пропускаем
          console.log(`Все слоты заняты для пользователя ${userId}, пропускаем фото ${i + 1}`);
          continue;
        }

        // Сохраняем файл
        const destPath = path.join(targetFolder, fileName);
        console.log(`Сохраняем фото ${i + 1} в ${destPath}`);
        fs.writeFileSync(destPath, buffer);
        
        const url = `/data/img/${userId}/${fileName}`;
        uploadedUrls.push(url);

        // Обновляем БД
        await new Promise((resolve, reject) =>
          db.run(`UPDATE users SET ${slotColumn} = ? WHERE userId = ?`, [url, userId], err => err ? reject(err) : resolve())
        );
        
        needPhotoUpdated = true;
        console.log(`Фото ${i + 1} успешно сохранено: ${url}`);
      }

      // Обновляем needPhoto если хотя бы одно фото было загружено
      if (needPhotoUpdated) {
        // Обновить needPhoto - если Google Vision работает и проверка прошла успешно, то needPhoto = 0
        // Если Google Vision не работает, то needPhoto остается 1 (нужно фото)
        if (visionClient) {
          // Google Vision работает, проверка прошла успешно, устанавливаем needPhoto = 0
          await new Promise((resolve, reject) => {
            db.run('UPDATE users SET needPhoto = 0, warned = 0 WHERE userId = ?', [userId], function(err) {
              if (err) reject(err); else resolve();
            });
          });
          console.log(`Google Vision работает, needPhoto установлен в 0 для пользователя ${userId}`);
        } else {
          // Google Vision не работает, оставляем needPhoto = 1
          console.log(`Google Vision не работает, needPhoto остается 1 для пользователя ${userId}`);
        }
      }

      // Возвращаем актуального пользователя
      const userRowFull = await new Promise((resolve, reject) =>
        db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, r) => err ? reject(err) : resolve(r))
      );

      res.json({ 
        success: true, 
        uploadedUrls,
        user: userRowFull 
      });

    } catch (err) {
      console.error(`/api/photos/uploadBase64 error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Удалить фото
   * POST /api/photos/deletePhoto
   * body: { userId, photoUrl }
   */
  router.post('/deletePhoto', express.json(), async (req, res) => {
    const { userId, photoUrl } = req.body;
    console.log(`[POST /api/deletePhoto] for user ${userId}, photo: ${photoUrl}`);

    if (!userId || !photoUrl) {
      return res.status(400).json({ success: false, error: 'userId and photoUrl are required' });
    }

    try {
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT photo1, photo2, photo3 FROM users WHERE userId = ?', [userId], (err, r) => err ? reject(err) : resolve(r));
      });

      if (!row) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      let columnToUpdate = null;
      if (row.photo1 === photoUrl) columnToUpdate = 'photo1';
      else if (row.photo2 === photoUrl) columnToUpdate = 'photo2';
      else if (row.photo3 === photoUrl) columnToUpdate = 'photo3';

      if (!columnToUpdate) {
        console.warn(`[POST /api/deletePhoto] Photo URL ${photoUrl} not found for user ${userId}`);
        return res.json({ success: true, message: 'Photo not found or already deleted' });
      }

      // Delete file from filesystem
      const userDir = path.join(IMG_DIR, userId);
      const photoPath = path.join(userDir, path.basename(photoUrl));
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log(`[POST /api/deletePhoto] Deleted file ${photoPath}`);
      } else {
        console.warn(`[POST /api/deletePhoto] File not found at path ${photoPath}, but proceeding to update DB.`);
      }

      // Update DB
      await new Promise((resolve, reject) => {
        db.run(`UPDATE users SET ${columnToUpdate} = "" WHERE userId = ?`, [userId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log(`[POST /api/deletePhoto] Photo slot ${columnToUpdate} cleared for user ${userId}`);
      res.json({ success: true, message: 'Photo deleted successfully' });

    } catch (err) {
      console.error(`/api/photos/deletePhoto error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Очистить все фото пользователя (незадокументировано)
   * POST /api/photos/clear
   * body: { userId }
   */
  router.post('/clear', express.json(), (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId обязателен' });
    
    console.log(`[POST /api/clear] Clearing all photos for user ${userId}`);
    
    const userDir = path.join(IMG_DIR, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
      console.log(`[POST /api/clear] Deleted directory ${userDir}`);
    }
    
    db.run('UPDATE users SET photo1 = "", photo2 = "", photo3 = "" WHERE userId = ?', [userId], err => {
      if (err) {
        console.error(`/api/photos/clear error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
      }
      console.log(`[POST /api/clear] Cleared all photo slots in DB for user ${userId}`);
      res.json({ success: true, message: 'All photos cleared' });
    });
  });

  /**
   * Проверка photoUrl (например, Telegram-аватара) через Vision
   * POST /api/photos/checkPhotoUrl
   * body: { userId, photoUrl, gender }
   */
  router.post('/checkPhotoUrl', async (req, res) => {
    const { userId, photoUrl, gender } = req.body;
    console.log(`[POST /api/photos/checkPhotoUrl] userId=${userId}, photoUrl=${photoUrl}, gender=${gender}`);
    if (!userId || !photoUrl || !gender) {
      console.warn('[POST /api/photos/checkPhotoUrl] Не хватает обязательных параметров');
      return res.status(400).json({ success: false, error: 'userId, photoUrl, gender обязательны' });
    }
    if (!visionClient) {
      console.error('[POST /api/photos/checkPhotoUrl] Vision API не инициализирован');
      return res.status(500).json({ success: false, error: 'Vision API не инициализирован' });
    }
    try {
      console.log(`[POST /api/photos/checkPhotoUrl] Начинаю fetch photoUrl: ${photoUrl}`);
      const resp = await fetch(photoUrl);
      console.log(`[POST /api/photos/checkPhotoUrl] fetch завершён, status: ${resp.status}`);
      if (!resp.ok) throw new Error(`Не удалось скачать фото: ${resp.statusText}`);
      // Исправляем для совместимости со старыми версиями Node.js
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[POST /api/photos/checkPhotoUrl] Фото скачано, размер: ${buffer.length} байт`);
      // Проверяем лицо через Vision
      console.log(`[POST /api/photos/checkPhotoUrl] Отправляю фото в Vision для userId=${userId}`);
      const faceCheck = await checkFaceInPhoto(visionClient, buffer);
      console.log(`[POST /api/photos/checkPhotoUrl] Ответ Vision:`, faceCheck);
      if (!faceCheck.success) {
        console.warn(`[POST /api/photos/checkPhotoUrl] Vision не прошёл: ${faceCheck.error}`);
        // needPhoto=1
        await new Promise((resolve, reject) =>
          db.run('UPDATE users SET needPhoto = 1 WHERE userId = ?', [userId], err => err ? reject(err) : resolve())
        );
        console.log(`[POST /api/photos/checkPhotoUrl] needPhoto=1 установлен для userId=${userId}`);
        return res.json({ success: false, error: faceCheck.error, needPhoto: 1 });
      }
      // Всё ок, needPhoto=0
      await new Promise((resolve, reject) =>
        db.run('UPDATE users SET needPhoto = 0 WHERE userId = ?', [userId], err => err ? reject(err) : resolve())
      );
      console.log(`[POST /api/photos/checkPhotoUrl] Лицо обнаружено, needPhoto=0 для userId=${userId}`);
      return res.json({ success: true, needPhoto: 0 });
    } catch (err) {
      console.error(`[POST /api/photos/checkPhotoUrl] Ошибка: ${err.message}`);
      await new Promise((resolve, reject) =>
        db.run('UPDATE users SET needPhoto = 1 WHERE userId = ?', [userId], err2 => err2 ? reject(err2) : resolve())
      );
      console.log(`[POST /api/photos/checkPhotoUrl] needPhoto=1 установлен (ошибка) для userId=${userId}`);
      return res.status(500).json({ success: false, error: err.message, needPhoto: 1 });
    }
  });

  return router;
}

// ===== Хелпер для обновления фото пользователя (простая версия) =====
async function updateUserPhotosInDb(db, userId, newPhotoUrl) {
  return new Promise((resolve, reject) => {
    const sqlSel = `SELECT photo1, photo2, photo3 FROM users WHERE userId=?`;
    db.get(sqlSel, [String(userId)], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error("Пользователь не найден"));
      
      const p1 = (row.photo1 ?? "").trim();
      const p2 = (row.photo2 ?? "").trim();
      const p3 = (row.photo3 ?? "").trim();
      
      console.log(`[updateUserPhotosInDb] Текущие слоты для ${userId}: p1="${p1}", p2="${p2}", p3="${p3}"`);
      
      if (p1 === "") {
        // Слот 1 пустой
        console.log(`[updateUserPhotosInDb] Слот 1 пустой, используем photo1`);
        const sqlUpd = `UPDATE users SET photo1=? WHERE userId=?`;
        db.run(sqlUpd, [newPhotoUrl, userId], function(err2) {
          if (err2) return reject(err2);
          db.run(`UPDATE users SET needPhoto=0, warned=0 WHERE userId=?`, [userId]);
          return resolve();
        });
      }
      else if (p2 === "") {
        // Слот 2 пустой
        console.log(`[updateUserPhotosInDb] Слот 2 пустой, используем photo2`);
        const sqlUpd = `UPDATE users SET photo2=? WHERE userId=?`;
        db.run(sqlUpd, [newPhotoUrl, userId], function(err2) {
          if (err2) return reject(err2);
          db.run(`UPDATE users SET needPhoto=0, warned=0 WHERE userId=?`, [userId]);
          return resolve();
        });
      }
      else if (p3 === "") {
        // Слот 3 пустой
        console.log(`[updateUserPhotosInDb] Слот 3 пустой, используем photo3`);
        const sqlUpd = `UPDATE users SET photo3=? WHERE userId=?`;
        db.run(sqlUpd, [newPhotoUrl, userId], function(err2) {
          if (err2) return reject(err2);
          db.run(`UPDATE users SET needPhoto=0, warned=0 WHERE userId=?`, [userId]);
          return resolve();
        });
      }
      else {
        // Все слоты заняты, сдвигаем в БД
        console.log(`[updateUserPhotosInDb] Все слоты заняты, сдвигаем в БД`);
        const sqlShift = `
          UPDATE users
          SET photo1 = photo2,
              photo2 = photo3,
              photo3 = ?
          WHERE userId = ?
        `;
        db.run(sqlShift, [newPhotoUrl, String(userId)], function(err2) {
          if (err2) return reject(err2);
          db.run(`UPDATE users SET needPhoto=0, warned=0 WHERE userId=?`, [userId]);
          console.log(`[updateUserPhotosInDb] БД обновлена, новое фото в photo3`);
          return resolve();
        });
      }
    });
  });
}

// Экспортируем функции в глобальную область для использования в других модулях
global.checkFaceInPhoto = checkFaceInPhoto;
global.isMemeOrFake = isMemeOrFake;
global.detectGenderFacePlusPlus = detectGenderFacePlusPlus;
global.faceDetector = faceDetector;
global.faceDetectorBuffer = faceDetectorBuffer;

module.exports = photosRouter;