/******************************************************************************
 * bot.js
 * ----------------------------------------------------------------------------
 * Полный код Telegram‑бота для SeligerTinder:
 *  - Команды для загрузки фото, обновления данных, рассылки, установки label
 *  - Обработка входящих фотографий для загрузки фото через API Telegram с передачей fileUniqueId
 *  - Команда /addbadge обновляет бейдж (доступна только администратору 307954967)
 *  - Реализована функция отправки пуш‑сообщения: для пользователей с ограниченной конфиденциальностью
 *    формируется сообщение с inline‑клавиатурой, содержащей кнопку "НАПИСАТЬ", которая ведёт в чат с отправителем.
 *  - В командах /stats, /stats_users и /masssend теперь вместо username используется userId.
 *****************************************************************************/

const dotenv = require("dotenv");
dotenv.config();
// Убеждаемся, что WEB_APP_URL всегда содержит https://
let WEB_APP_URL = process.env.WEB_APP_URL || 'https://sta-black-dim.waw.amverum.cloud';
if (WEB_APP_URL && !WEB_APP_URL.startsWith('http://') && !WEB_APP_URL.startsWith('https://')) {
  WEB_APP_URL = `https://${WEB_APP_URL}`;
}
const { Telegraf } = require("telegraf");
const { fileURLToPath } = require("url");
// Using native fetch API (available in Node.js 18+)
const fs = require("fs");
const path = require("path");
// GIFT_IMAGES_DIR must be absolute path for file operations
const GIFT_IMAGES_DIR = "/data/giftimg";



const BOT_TOKEN = process.env.BOT_TOKEN;
const DEV_CHAT_ID = 307954967;
// API_URL использует тот же домен, что и WEB_APP_URL
const API_URL = `${WEB_APP_URL}/api`;

// Создаем экземпляр бота
const bot = new Telegraf(BOT_TOKEN);

// Handle WebApp registration payload
bot.on('web_app_data', async (ctx) => {
  try {
    const payload = JSON.parse(ctx.webAppData.data);
    if (payload.action === 'register') {
      console.log('💡 Received web_app_data register:', payload);
      await ctx.reply(
        '🎉 Добро пожаловать в Seliger-Tinder! Я бот, который поможет вам пользоваться приложением.',
        getStartKeyboard()
      );
    }
  } catch (err) {
    console.error('Ошибка при обработке web_app_data:', err);
  }
});

// Состояния пользователей
const userState = {};

// Храним альбомы (media_group_id), если понадобится в дальнейшем
const mediaGroups = {};

const giftState = {}; // временное хранилище для процесса добавления подарков
/**
 * Функция формирования inline‑клавиатуры для пуш‑сообщения.
 * Принимает публичный никнейм отправителя (без символа "@").
 * Если никнейма нет – формируется динамическая ссылка с использованием userId.
 */
function getPushKeyboard(senderId, senderUsername) {
  const chatUrl = senderUsername && senderUsername.trim() !== ""
    ? `https://t.me/${senderUsername}`
    : `tg://user?id=${senderId}`;
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "НАПИСАТЬ", url: chatUrl }]
      ]
    }
  };
}

// ===================== Регистрируем команды =====================
bot.telegram
  .setMyCommands([
    { command: "delete_user", description: "Удалить профиль" },
    { command: "clear_photos", description: "Удалить все фото" },
    { command: "stats", description: "Статистика (за день)" },
    { command: "stats_users", description: "Статистика (м/ж)" },
    { command: "masssend", description: "Рассылка (простой текст)" },
    { command: "sendto", description: "Отправить сообщение пользователю (userId и текст)" },
    { command: "addbadge", description: "Установить label (P, S, L)" },
    { command: "addgift", description: "Добавить подарок" },
    { command: "giftedit", description: "Редактировать подарок" },
    { command: "giftdel", description: "Удалить подарок" },
    { command: "grantpro", description: "Выдать PRO-подписку" },
  ])
  .then(() => console.log("✅ Команды бота успешно зарегистрированы."))
  .catch((err) => console.error("❌ Ошибка setMyCommands:", err.message));

// === Команда /addgift: добавление нового подарка ===
bot.command("addgift", async (ctx) => {
  const userId = ctx.from.id;
  if (userId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Доступно только администратору.");
  }
  giftState[userId] = {};
  userState[userId] = "addingGiftPhoto";
  await ctx.reply("Шаг 1/5. Пришлите фото подарка");
});

// === Команда /giftedit: редактирование существующего подарка ===
bot.command("giftedit", async (ctx) => {
  const userId = ctx.from.id;
  if (userId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Доступно только администратору.");
  }
  try {
    const resp = await fetch(`${API_URL}/gifts`);
    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      return ctx.reply("Список подарков пуст или не доступен.");
    }
    const list = json.data
      .map((g, i) => `${i + 1}. ${g.AboutGift} — ${g.PriceGift} руб.`)
      .join("\n");
    userState[userId] = "selectGiftToEdit";
    await ctx.reply("Выберите номер подарка для редактирования:\n" + list);
  } catch (err) {
    console.error("❌ /giftedit ошибка:", err);
    await ctx.reply("Ошибка при получении списка подарков.");
  }
});
// === Команда /giftdel: удаление подарка ===
bot.command("giftdel", async (ctx) => {
  const userId = ctx.from.id;
  if (userId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Доступно только администратору.");
  }
  try {
    const resp = await fetch(`${API_URL}/gifts`);
    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      return ctx.reply("Список подарков пуст или недоступен.");
    }
    const list = json.data
      .map((g, i) => `${i + 1}. ${g.AboutGift} — ${g.PriceGift} руб.`)
      .join("\n");
    userState[userId] = "selectGiftToDelete";
    await ctx.reply("Выберите номер подарка для удаления:\n" + list);
  } catch (err) {
    console.error("❌ /giftdel ошибка:", err);
    await ctx.reply("Ошибка при получении списка подарков.");
  }
});
// ===================== /start =====================
function getStartKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [ // первая строка
          { text: "✨Открыть Seliger Tinder✨", web_app: { url: WEB_APP_URL } }
        ],
        [ // вторая строка
          { text: "Меню", callback_data: "show_menu" }
        ]
      ]
    }
  };
}

/**
 * Alias to getStartKeyboard for reply_markup reuse
 */
function getInlineKeyboard() {
  return getStartKeyboard();
}

bot.start(async (ctx) => {
  console.log(`Пользователь ${ctx.from.id} запустил бота (/start).`);
  await ctx.reply("Добро пожаловать в SeligerTinder!", getStartKeyboard());
});

// ===================== Команда /addbadge (только для администратора) =====================
bot.command("addbadge", async (ctx) => {
  const senderId = ctx.from.id;
  if (senderId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /addbadge доступна только администратору.");
  }
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(" ");
    if (parts.length < 3) {
      return ctx.reply("Использование: /addbadge <userId> <badge>. Например: /addbadge 307954967 S");
    }
    const targetUserId = parts[1];
    const badgeLetter = parts[2].toUpperCase();
    if (!["P", "S", "L", "DN", "LV"].includes(badgeLetter)) {
      return ctx.reply("Badge должен быть одним из: P, S, L, DN, LV");
    }
    const badgeUrl = `/label/${badgeLetter}.svg`;
    console.log(`Обновляем бейдж для userId=${targetUserId} на ${badgeUrl}`);
    const response = await fetch(`${API_URL}/updateBadge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, badge: badgeUrl })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }
    const result = await response.json();
    console.log("Результат обновления бейджа:", result);
    if (result.success) {
      // подставляем человекочитаемое имя бейджа
      const names = { S: "Seliger City", P: "Пик", L: "Любовь и голуби", DN: "DN", LV: "LV" };
      const badgeName = names[badgeLetter] || badgeLetter;
      // уведомляем админа
      await ctx.reply("Бэйдж обновлён успешно!");
      // и сразу шлём пользователю
      await bot.telegram.sendMessage(
        targetUserId,
        `Бэйдж «${badgeName}» успешно добавлен`
      );
    } else {

      ctx.reply(`Ошибка: ${result.error}`);
    }
    
  } catch (err) {
    console.error("❌ Ошибка /addbadge:", err.message);
    ctx.reply("❌ Ошибка при обновлении бейджа.");
  }
});

// ===================== Обработка входящих фотографий =====================
// При получении фото выбирается фотография с наивысшим качеством и передаётся fileUniqueId
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;

  // 1) Обработка фото для подарка
  if (userState[userId] === "addingGiftPhoto") {
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    const fileInfo = await bot.telegram.getFile(bestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
    const filename = `${bestPhoto.file_unique_id}.jpg`;
    // Сохраняем в папку gift images
    const dest = path.join(GIFT_IMAGES_DIR, filename);
    const res = await fetch(fileUrl);
    const buffer = await res.buffer();
    fs.writeFileSync(dest, buffer);
    // Запоминаем путь для последующей записи в БД
    giftState[userId].photo = `/giftimg/${filename}`;
    userState[userId] = "addingGiftDescription";
    return ctx.reply("Шаг 2/5. Фото сохранено. Введите описание подарка");
  }

  // 2) Обычная загрузка фото профиля
  if (userState[userId] !== "waitingPhoto") return;
  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    return ctx.reply("Фото не получено. Попробуйте ещё раз.");
  }
  // Используем только наилучшее фото (последний элемент массива)
  const bestPhoto = photos[photos.length - 1];
  try {
    const file = await bot.telegram.getFile(bestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const fileUniqueId = bestPhoto.file_unique_id;
    await fetch(`${API_URL}/uploadPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(userId),
        fileUrl,
        fileUniqueId
      })
    });
    await ctx.reply("Ваше фото успешно загружено!");
  } catch (e) {
    console.error("Ошибка при загрузке фото:", e.message);
    await ctx.reply("Ошибка при загрузке фото.");
  }
  userState[userId] = "";
});

// === Обработчик нажатий inline-кнопок ===
bot.on("callback_query", async (ctx) => {
  const data   = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  // ———— обработка "order_now" ————
  if (data === "order_now") {
    await ctx.answerCbQuery();
    // удалить предыдущий пуш
    try { await ctx.deleteMessage(); } catch (_) {}
    // получить список подарков
    const resp = await fetch(`${API_URL}/gifts`);
    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data)) {
      return ctx.reply("❌ Ошибка получения списка подарков.");
    }
    const list = json.data.map((g, i) => `${i+1}. ${g.AboutGift} — ${g.PriceGift} руб.`).join("\n");
    userState[userId] = "";
    return ctx.reply(
      "У нас в наличии сейчас следующие подарки:\n" +
      list +
      "\n\nВы можете посмотреть на фото и отправить любой из них на странице Matches",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Перейти",
                web_app: { url: WEB_APP_URL + "?screen=screen-matches" }
              }
            ],
            [
              { text: "Отмена", callback_data: "cancel_special" }
            ]
          ]
        }
      }
    );
  }




  // ———— обработка "Удалить профиль" ————
  if (data === "delete_user") {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Вы точно уверены, что хотите удалить ваш профиль? 😢",
      { reply_markup: {
          inline_keyboard: [[
            { text: "Да, удалить",      callback_data: "confirm_delete" },
            { text: "Нет, передумал",   callback_data: "cancel_delete" }
          ]]
      } }
    );
  }

  // 0) Отмена любого действия
  if (data === "cancel_action") {
    await ctx.answerCbQuery("Действие отменено");
    try { await ctx.deleteMessage(); } catch(_) {}
    await ctx.reply("Главное меню", getInlineKeyboard());
    userState[userId] = "";
  }

  // 1) Запрос бейджа — показываем выбор ЖК
  if (data === "request_badge") {
    await ctx.answerCbQuery();
    await ctx.reply("Выберите бейдж вашего ЖК:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Seliger City",    callback_data: "req_badge_S" },
            { text: "Пик",             callback_data: "req_badge_P" },
            { text: "Любовь и голуби", callback_data: "req_badge_L" }
          ],
          [
            { text: "Отмена", callback_data: "cancel_action" }
          ]
        ]
      }
    });
    return;
  }
  if (data === "show_menu") {
    await ctx.answerCbQuery();
    return ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [{ text: "✨Открыть Seliger Tinder✨", web_app: { url: WEB_APP_URL } }],
        [
          { text: "Удалить профиль",       callback_data: "delete_user" }
        ],
        [
          { text: "Запросить бейдж",       callback_data: "request_badge" },
          { text: "Советы",                callback_data: "show_advice" }
        ],
        [
          { text: "Пожаловаться/Ошибка/Проблема", callback_data: "dev_message" }
        ]
      ]
    });
  }

  // показать текст советов
  if (data === "show_advice") {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Вот несколько советов по использованию SeligerTinder:\n" +
      "•	Расскажите в описании короткую историю: например, как вы проводите летние вечера во дворе или чем увлекаетесь в выходные.\n" +
      "•	Выбирайте фото, где вы заняты любимым делом — прогулка с собакой, барбекю с соседями или утренний кофе на скамейке.\n" +
      "•	При первом сообщении задайте лёгкий вопрос по био: «Увидел, что вы любите цветы — какой букет ваш любимый?»\n" +
      "•	Проявляйте искренний интерес: читайте профиль собеседника и уточняйте детали, а не просто «привет, как дела».\n" +
      "•	Предлагайте небольшие совместные активности во дворе: совместная прогулка, настолки на свежем воздухе или мини-пикник.\n" +
      "•	Поддерживайте позитивный тон и юмор — пара тёплых шуток помогает растопить лёд и запомниться.\n" +
      "•	Будьте открыты к новым знакомствам: не бойтесь первыми проявить инициативу и назначить встречу в любимом уголке вашего ЖК.\n",
      {
        reply_markup: {
          inline_keyboard: [
            [ { text: "Обратно в Seliger-Tinder", callback_data: "back_to_start" } ]
          ]
        }
      }
    );
    return;
  }

  // вернуть пользователя назад на /start
  if (data === "back_to_start") {
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch(_) {}
    return bot.start(ctx);
  }

  // 2) Пользователь выбрал ЖК — шлём админу
  if (data.startsWith("req_badge_")) {
    const badgeLetter = data.split("_")[2];
    const names       = { S: "Seliger City", P: "Пик", L: "Любовь и голуби" };
    const badgeName   = names[badgeLetter];
    const userName    = ctx.from.username ? `@${ctx.from.username}` : `ID:${ctx.from.id}`;

    await bot.telegram.sendMessage(
      DEV_CHAT_ID,
      `Запрос бейджа «${badgeName}» от пользователя ${userName} (userID: ${ctx.from.id}).`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Выдать бейдж", callback_data: `grant_badge_${ctx.from.id}_${badgeLetter}` },
              { text: "Оспорить",      callback_data: `dispute_badge_${ctx.from.id}_${badgeLetter}` }
            ],
            [
              { text: "Отмена", callback_data: "cancel_action" }
            ]
          ]
        }
      }
    );
    await ctx.answerCbQuery("Ваш запрос отправлен администратору.");
    return;
  }

  // 3) Админ нажал «Выдать бейдж»
  if (data.startsWith("grant_badge_")) {
    const [ , , targetId, badgeLetter ] = data.split("_");
    const names     = { S: "Seliger City", P: "Пик", L: "Любовь и голуби" };
    const badgeName = names[badgeLetter];
    const badgeUrl  = `/label/${badgeLetter}.svg`;

    try {
      const res = await fetch(`${API_URL}/updateBadge`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: targetId, badge: badgeUrl })
      });
      const j = await res.json();
      if (j.success) {
        await bot.telegram.sendMessage(targetId, `Бэйдж «${badgeName}» успешно добавлен`);
        await ctx.answerCbQuery("Бэйдж успешно выдан.");
      } else {
        await ctx.answerCbQuery(`Ошибка: ${j.error}`);
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery("Ошибка выдачи бейджа.");
    }
    return;
  }

  // 4) Админ нажал «Оспорить»
  if (data.startsWith("dispute_badge_")) {
    const [ , , targetId ] = data.split("_");
    try {
      const chat     = await ctx.telegram.getChat(targetId);
      const userName = chat.username ? `@${chat.username}` : `${targetId}`;
      await ctx.telegram.sendMessage(
        targetId,
        `${userName}, привет! Для выдачи бэйджа нам нужно убедиться, что вы проживаете в ЖК (Seliger City или Пик).\n` +
        `Скиньте, пожалуйста, скриншот любого закрытого чата пользователю @al_pacco с текстом "хочу бэйдж" — и мы выдадим вам бэйдж.`
      );
      await ctx.answerCbQuery("Запрос на уточнение отправлен пользователю.");
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery("Ошибка при отправке запроса.");
    }
    return;
  }

  // 5) Остальные ваши ветки
  if (data === "dev_message") {
    await ctx.answerCbQuery();
    await ctx.reply("Опишите проблему, я передам её разработчикам.", {
      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel_action" }]] }
    });
    userState[userId] = "devMessage";
    return;
  }

  // Подтверждение удаления профиля
  if (data === "confirm_delete") {
    await ctx.answerCbQuery();  // скрываем «часики» над кнопкой
    try {
      const resp = await fetch(`${API_URL}/delete_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(userId) })
      });
      const json = await resp.json();
      if (json.success) {
        await ctx.reply("✅ Ваш профиль удалён. Чтобы начать заново, отправьте /start");
      } else {
        await ctx.reply(`❌ Не удалось удалить профиль: ${json.error}`, getInlineKeyboard());
      }
    } catch (err) {
      console.error("Ошибка delete_user:", err);
      await ctx.reply("❌ Ошибка при удалении профиля.", getInlineKeyboard());
    }
    userState[userId] = "";
    return;
  }

  // Отмена удаления
  if (data === "cancel_delete") {
    await ctx.answerCbQuery("Удаление отменено");
    userState[userId] = "";
    await ctx.reply("Главное меню", getInlineKeyboard());
    return;
  }
  // если нужно — можете добавить ещё обработчики здесь


    // ———— обработка оплаты ————
    if (data.startsWith("pay_")) {
      await ctx.answerCbQuery();
      // удалить сообщение с кнопкой оплаты
      try { await ctx.deleteMessage(); } catch (_) {}
      const [ , giftId, candidateId ] = data.split("_");
      // получаем информацию о подарке
      let gift;
      try {
        const resp = await fetch(`${API_URL}/gifts`);
        const json = await resp.json();
        gift = json.data.find(g => String(g.id) === giftId);
      } catch (e) {}
      // сохраняем заказ
      userState[userId] = "";
      giftState[userId] = { gift, candidateId };
      // отправляем инструкции об оплате
      return ctx.reply(
        "Оплатить можно переводом на карту Тинькофф банка (2200 7004 7148 6653) на имя Дмитрия А.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Оплатил", callback_data: `paid_${giftId}_${candidateId}` }
              ],
              [
                { text: "Отмена", callback_data: "cancel_special" }
              ]
            ]
          }
        }
      );
    }
  
    // ———— обработка отмены специального пуша ————
    if (data === "cancel_special") {
      await ctx.answerCbQuery("Отменено");
      try { await ctx.deleteMessage(); } catch (_) {}
      return;
    }
  // ———— пользователь подтвердил оплату ————
  if (data.startsWith("paid_")) {
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (_) {}
    await ctx.reply(
      "Мы уже занимаемся вашим заказом и скоро свяжемся с вами",
      {
        reply_markup: {
          inline_keyboard: [
            [ { text: "Связаться", callback_data: "dev_message" } ]
          ]
        }
      }
    );
    const [ , giftId2, candidateId2 ] = data.split("_");
    const giftObj = giftState[userId] || {};
    const gift = giftObj.gift || {};
    const candidateId = giftObj.candidateId;
    const user = ctx.from;
    await bot.telegram.sendMessage(
      DEV_CHAT_ID,
      `Заказ подарка ${gift.AboutGift} — ${gift.PriceGift} руб. от пользователя ${user.first_name}${user.username?`(@${user.username})`:``} (ID:${userId}), для кандидата: ${candidateId}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Подтвердить", callback_data: `confirm_order_${userId}_${candidateId2}` },
              { text: "Отмена",      callback_data: `cancel_order_${userId}` }
            ]
          ]
        }
      }
    );
    return;
  }

  // ———— админ подтвердил заказ ————
  if (data.startsWith("confirm_order_")) {
    const targetId = data.split("_")[2];
    await ctx.answerCbQuery();
    // Запрос имени или анонимности
    userState[targetId] = "order_confirmed_awaiting_name";
    await bot.telegram.sendMessage(
      targetId,
      "Ваш заказ подтвержден, вы можете добавить ваше реальное имя или короткий текст, или остаться анонимом. Если вы нажмёте «Пропустить», мы запишем только ваш никнейм.",
      {
        reply_markup: {
          inline_keyboard: [
            [ { text: "Написать", callback_data: `order_write_${targetId}` } ],
            [ { text: "Пропустить", callback_data: `order_skip_${targetId}` } ]
          ]
        }
      }
    );
    return;
  }

  // ———— пользователь выбрал «Написать» после подтверждения заказа ————
  if (data.startsWith("order_write_")) {
    const targetId = data.split("_")[2];
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (_) {}
    await ctx.reply(
      "Пожалуйста, напишите сообщение администратору:",
      { reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel_action" }]] } }
    );
    userState[targetId] = "order_user_message";
    return;
  }

  // ———— пользователь выбрал «Пропустить» после подтверждения заказа ————
  if (data.startsWith("order_skip_")) {
    const targetId = data.split("_")[2];
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (_) {}
    await bot.telegram.sendMessage(
      targetId,
      "Спасибо! Мы всё поняли и уже работаем. Если у вас будут вопросы, вы всегда можете написать нам.",
      { reply_markup: { inline_keyboard: [[{ text: "Связаться", callback_data: "dev_message" }]] } }
    );
    // уведомляем администратора
    await bot.telegram.sendMessage(
      DEV_CHAT_ID,
      `Пользователь ${targetId} ничего не написал при подтверждении заказа.`
    );
    userState[targetId] = "";
    return;
  }

  // ———— админ отменил заказ ————
  if (data.startsWith("cancel_order_")) {
    const targetId = data.split("_")[2];
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (_) {}
    await bot.telegram.sendMessage(
      targetId,
      "Ваш заказ не подтвержден. Вы можете связаться с нами, если что-то пошло не так",
      {
        reply_markup: {
          inline_keyboard: [
            [ { text: "Написать", callback_data: "dev_message" } ]
          ]
        }
      }
    );
    return;
  }
});

// ===================== Команды для фото, био, возраста и пр. =====================
bot.command("clear_photos", async (ctx) => {
  const userId = ctx.from.id;
  try {
    const response = await fetch(`${API_URL}/clearPhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    const json = await response.json();
    if (json.success) {
      await ctx.reply("Все фото удалены. Загрузите новые", getInlineKeyboard());
      userState[userId] = "waitingPhoto";
    } else {
      await ctx.reply("❌ Не удалось удалить фото. Попробуйте позже.", getInlineKeyboard());
    }
  } catch (err) {
    console.error("Ошибка при /clear_photos:", err.message);
    await ctx.reply("❌ Ошибка при сбросе фото.", getInlineKeyboard());
  }
});


bot.command("delete_user", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.reply("Вы точно уверены, что хотите удалить ваш профиль? 😢", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Да, удалить", callback_data: "confirm_delete" },
          { text: "Нет, передумал", callback_data: "cancel_delete" }
        ]
      ]
    }
  });
});

// Команда /stats – статистика (используем userId)
bot.command("stats", async (ctx) => {
  const currentUserId = ctx.from.id;
  if (currentUserId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /stats доступна только администратору.");
  }
  try {
    const response = await fetch(`${API_URL}/statsDay`);
    const json = await response.json();
    if (json.success) {
      const visits24h = json.visits24h || 0;
      // Используем userId для статистики (в данном случае API подсчитывает уникальные userId)
      await ctx.reply(
        `За последние 24 часа зашли ${visits24h} пользователей (по userID).`,
        getInlineKeyboard()
      );
    } else {
      await ctx.reply("❌ Не удалось получить статистику.", getInlineKeyboard());
    }
  } catch (err) {
    console.error("❌ Ошибка /stats:", err.message);
    await ctx.reply("❌ Ошибка при получении статистики.", getInlineKeyboard());
  }
});

// Команда /stats_users – статистика по полу (используем userId)
bot.command("stats_users", async (ctx) => {
  const currentUserId = ctx.from.id;
  if (currentUserId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /stats_users доступна только администратору.");
  }
  try {
    const response = await fetch(`${API_URL}/users`);
    const users = await response.json();
    if (!Array.isArray(users)) {
      return ctx.reply("❌ /api/users не вернул массив.", getInlineKeyboard());
    }
    let menCount = 0;
    let womenCount = 0;
    // Обходим всех пользователей и считаем по gender, используя их userId как идентификатор
    users.forEach(u => {
      // Даже если у пользователя отсутствует username, его идентификация будет по userId.
      if (u.gender === "male") menCount++;
      if (u.gender === "female") womenCount++;
    });
    await ctx.reply(
      `Пользователи (по userID):\nМужчин: ${menCount}\nЖенщин: ${womenCount}`,
      getInlineKeyboard()
    );
  } catch (err) {
    console.error("❌ Ошибка /stats_users:", err.message);
    await ctx.reply("❌ Ошибка при получении статистики пользователей.", getInlineKeyboard());
  }
});

// Команда /masssend – массовая рассылка (используем userId для отправки)
bot.command("masssend", async (ctx) => {
  const fromAdmin = ctx.from.id;
  if (fromAdmin !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /masssend доступна только администратору.");
  }
  
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) {
    return ctx.reply("Формат: /masssend <текст сообщения>");
  }
  
  try {
    // Получаем список пользователей из API
    const response = await fetch(`${API_URL}/users`);
    const users = await response.json();
    if (!Array.isArray(users)) {
      return ctx.reply("❌ /api/users не вернул массив.");
    }
    
    let count = 0;
    
    // Проходим по списку и для каждого незаблокированного пользователя отправляем сообщение,
    // используя его userId. Это гарантирует, что даже если у пользователя ограничена приватность
    // (и нет username), сообщение будет доставлено.
    for (const u of users) {
      if (!u.blocked) {
        try {
          await bot.telegram.sendMessage(u.userId, text, getInlineKeyboard());
          count++;
        } catch (err) {
          console.error(`❌ Не удалось отправить сообщение userId=${u.userId}:`, err.message);
        }
      }
    }
    
    await ctx.reply(`✅ Сообщение отправлено ${count} пользователям.`);
  } catch (err) {
    console.error("❌ Ошибка masssend:", err.message);
    await ctx.reply("❌ Ошибка отправки сообщения.");
  }
});

// Команда /sendto – отправка сообщения конкретному пользователю (по userId)
bot.command("sendto", async (ctx) => {
  const fromAdmin = ctx.from.id;
  if (fromAdmin !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /sendto доступна только администратору.");
  }
  const parts = ctx.message.text.split(" ");
  if (parts.length < 3) {
    return ctx.reply("Формат: /sendto <userId> <текст сообщения>");
  }
  const targetUserId = parts[1];
  const text = parts.slice(2).join(" ");
  try {
    await bot.telegram.sendMessage(targetUserId, text, getInlineKeyboard());
    console.log(`✅ Админ ${fromAdmin} отправил сообщение пользователю ${targetUserId}`);
    await ctx.reply(`Сообщение успешно отправлено пользователю ${targetUserId}!`);
  } catch (err) {
    console.error("❌ Ошибка /sendto:", err.message);
    await ctx.reply("❌ Ошибка отправки сообщения. Проверьте формат.");
  }
});

// === Команда /grantpro – выдача PRO-подписки (только администратор) ===
bot.command("grantpro", async (ctx) => {
  const senderId = ctx.from.id;
  if (senderId !== DEV_CHAT_ID) {
    return ctx.reply("❌ Команда /grantpro доступна только администратору.");
  }
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length < 3) {
    return ctx.reply("Использование: /grantpro <userId> <days>. Например: /grantpro 307954967 30");
  }
  const targetUserId = parts[1];
  const days = parseInt(parts[2], 10);
  if (isNaN(days) || days < 1) {
    return ctx.reply("Количество дней должно быть положительным числом.");
  }
  try {
    const resp = await fetch(`${API_URL}/grantPro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, days })
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`❌ /api/grantPro HTTP ${resp.status}: ${text}`);
      return ctx.reply(`❌ Ошибка сервера ${resp.status}: ${text}`);
    }
    let json;
    try {
      json = await resp.json();
    } catch (e) {
      const text = await resp.text();
      console.error("❌ Unexpected response from /grantPro:", text);
      return ctx.reply(`❌ Ошибка сервера: ${text}`);
    }
    if (json.success) {
      const endDate = new Date(json.end).toLocaleDateString("ru-RU");
      await ctx.reply(`✅ PRO-подписка выдана пользователю ${targetUserId} на ${days} дней (до ${endDate}).`);
      await bot.telegram.sendMessage(
        targetUserId,
        `🎉 Вам выдан PRO на ${days} дней! Подписка активна до ${endDate}.`
      );
    } else {
      await ctx.reply(`❌ Не удалось выдать PRO: ${json.error}`);
    }
  } catch (err) {
    console.error("❌ /grantpro ошибка:", err);
    ctx.reply("❌ Ошибка при выдаче PRO. Попробуйте позже.");
  }
});

// Обработка произвольного текста от пользователей
bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text.trim();
  const state = userState[userId] || "";

  // ———— обработка сообщения пользователя об имени/тексте после подтверждения заказа ————
  if (state === "order_user_message") {
    // отправляем текст администратору
    await bot.telegram.sendMessage(
      DEV_CHAT_ID,
      `Сообщение от пользователя ${userId} по заказу: ${text}`
    );
    await ctx.reply("Ваше сообщение отправлено администратору.", getInlineKeyboard());
    userState[userId] = "";
    return;
  }

  // ———— обработка выбора подарка после "order_now" ————
  if (state === "choosingGift") {
    const idx = parseInt(ctx.message.text.trim(), 10) - 1;
    try {
      const resp = await fetch(`${API_URL}/gifts`);
      const json = await resp.json();
      if (!json.success || !Array.isArray(json.data) || idx < 0 || idx >= json.data.length) {
        return ctx.reply("Неверный выбор. Пожалуйста, отправьте цифру из списка.");
      }
      const gift = json.data[idx];
      userState[userId] = ""; // сброс состояния
      return ctx.reply(
        `Вы выбрали: ${gift.AboutGift} — ${gift.PriceGift} руб.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Оплатить", callback_data: `pay_${gift.id}` }]
            ]
          }
        }
      );
    } catch (err) {
      console.error("❌ Ошибка выбора подарка:", err);
      return ctx.reply("Ошибка при выборе подарка.");
    }
  }

  // === Выбор подарка для редактирования ===
  if (userState[userId] === "selectGiftToEdit") {
    const idx = parseInt(text, 10) - 1;
    try {
      const resp = await fetch(`${API_URL}/gifts`);
      const json = await resp.json();
      if (!json.success || !Array.isArray(json.data) || idx < 0 || idx >= json.data.length) {
        return ctx.reply("Неверный номер. Попробуйте ещё раз.");
      }
      const gift = json.data[idx];
      giftState[userId] = { id: gift.id };
      userState[userId] = "addingGiftPhoto";
      return ctx.reply("Шаг 1/5. Пришлите новое фото подарка");
    } catch (err) {
      console.error("❌ selectGiftToEdit ошибка:", err);
      return ctx.reply("Ошибка при выборе подарка.");
    }
  }
  // === Выбор подарка для удаления ===
  if (userState[userId] === "selectGiftToDelete") {
    const idx = parseInt(text, 10) - 1;
    try {
      const resp = await fetch(`${API_URL}/gifts`);
      const json = await resp.json();
      if (!json.success || !Array.isArray(json.data) || idx < 0 || idx >= json.data.length) {
        return ctx.reply("Неверный номер. Попробуйте ещё раз.");
      }
      const giftId = json.data[idx].id;
      const del = await fetch(`${API_URL}/deletegift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: giftId })
      });
      const j2 = await del.json();
      if (j2.success) {
        await ctx.reply("✅ Подарок удалён.");
      } else {
        await ctx.reply("❌ Ошибка удаления: " + j2.error);
      }
    } catch (err) {
      console.error("❌ /deleteGift ошибка:", err);
      await ctx.reply("Ошибка при удалении подарка.");
    }
    userState[userId] = "";
    return;
  }
  // === Шаги добавления подарка ===
  if (userState[userId] === "addingGiftDescription") {
    giftState[userId].description = text;
    userState[userId] = "addingGiftPrice";
    return ctx.reply("Шаг 3/5. Описание сохранено. Укажите цену подарка (число)");
  }

  if (userState[userId] === "addingGiftPrice") {
    const price = parseFloat(text);
    if (isNaN(price)) return ctx.reply("Введите число для цены");
    giftState[userId].price = price;
    userState[userId] = "addingGiftSale";
    return ctx.reply("Шаг 4/5. Цена сохранена. Укажите скидку (0 — без скидки или 1–99)");
  }

  if (userState[userId] === "addingGiftSale") {
    let sale = parseInt(text, 10);
    if (isNaN(sale) || sale < 0 || sale > 99) {
      return ctx.reply("Скидка должна быть числом от 0 до 99");
    }
    giftState[userId].sale = sale;
    // Отправляем на сервер
    const payload = {
      PhotoGift: giftState[userId].photo,
      AboutGift: giftState[userId].description,
      PriceGift: giftState[userId].price,
      SaleGift: giftState[userId].sale,
      StopGift: 1
    };
    try {
      const resp = await fetch(`${API_URL}/addgift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await resp.json();
      if (j.success) {
        await ctx.reply("✅ Подарок успешно добавлен!");
      } else {
        await ctx.reply("❌ Ошибка при добавлении: " + j.error);
      }
    } catch (err) {
      console.error("❌ Ошибка /addGift:", err);
      await ctx.reply("❌ Сетевая ошибка при добавлении подарка.");
    }
    userState[userId] = "";
    delete giftState[userId];
    return;
  }
  if (state === "devMessage") {
    try {
      const userIdentifier = String(userId);
      await bot.telegram.sendMessage(DEV_CHAT_ID, `Сообщение от ${userIdentifier}:\n${text}`);
      await ctx.reply("Ваше сообщение отправлено разработчикам!", getInlineKeyboard());
    } catch (err) {
      console.error("❌ Ошибка devMessage:", err.message);
      await ctx.reply("❌ Не удалось отправить сообщение разработчикам.", getInlineKeyboard());
    }
    userState[userId] = "";
    return;
  }
  if (state === "waitingBio") {
    if (text.length > 120) {
      return ctx.reply("Описание не более 120 символов, попробуйте сократить.");
    }
    try {
      const r = await fetch(`${API_URL}/update_bio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, bio: text })
      });
      const j = await r.json();
      if (j.success) {
        await ctx.reply("✅ Описание обновлено! Заходите в SeligerTinder и проверьте.", getInlineKeyboard());
      } else {
        await ctx.reply("❌ Ошибка при обновлении описания. Попробуйте позже.", getInlineKeyboard());
      }
    } catch (err) {
      console.error("❌ Ошибка update_bio:", err.message);
      await ctx.reply("❌ Не удалось обновить описание.", getInlineKeyboard());
    }
    userState[userId] = "";
    return;
  }
  if (state === "waitingAge") {
    const ageNum = parseInt(text, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      return ctx.reply("Возраст должен быть числом от 1 до 120. Попробуйте ещё раз.");
    }
    try {
      const r = await fetch(`${API_URL}/updateAge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, age: ageNum })
      });
      const j = await r.json();
      if (j.success) {
        await ctx.reply(`✅ Ваш возраст (${ageNum}) сохранён!`, getInlineKeyboard());
      } else {
        await ctx.reply("❌ Ошибка при сохранении возраста. Попробуйте позже.", getInlineKeyboard());
      }
    } catch (err) {
      console.error("❌ Ошибка updateAge:", err.message);
      await ctx.reply("❌ Не удалось сохранить возраст. Попробуйте позже.", getInlineKeyboard());
    }
    userState[userId] = "";
    return;
  }
  if (state === "waitingMassText") {
    userState[userId] = "";
    if (userId !== DEV_CHAT_ID) {
      return ctx.reply("❌ Массовая рассылка доступна только администратору.");
    }
    try {
      console.log(`Админ ${userId} вводит текст для массовой рассылки: ${text}`);
      await ctx.reply(`Принято. Сообщение:\n"${text}" будет отправлено всем пользователям.`);
    } catch (err) {
      console.error("❌ Ошибка masssend text:", err.message);
      await ctx.reply("❌ Не удалось выполнить рассылку.");
    }
    return;
  }

  userState[userId] = "";
  delete giftState[userId];
  return;
});

// Запускаем polling только если файл запущен напрямую:
if (require.main === module) {
  bot.launch()
    .then(() => console.log('Бот запущен!'))
    .catch((err) => console.error('Ошибка запуска бота:', err));

  // Обработка завершения процесса
  function stopBot(signal) {
    console.log(`Получен сигнал ${signal}. Останавливаем бота...`);
    try {
      const stopPromise = bot.stop(signal);
      if (stopPromise && typeof stopPromise.then === 'function') {
        stopPromise
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Ошибка при остановке бота:', err);
        process.exit(1);
      });
      } else {
        console.log('Бот остановлен');
        process.exit(0);
      }
    } catch (err) {
      console.error('Ошибка при остановке бота:', err);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => stopBot("SIGINT"));
  process.on("SIGTERM", () => stopBot("SIGTERM"));
}

// Экспортируем бота для использования в других модулях
module.exports = { bot };