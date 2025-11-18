// Модуль gift.js: ВСЯ ЛОГИКА ПОДАРКОВ (Gift Modal, обработка заказа, toasts)
// Экспортируемые функции:
// - showGiftModal, hideGiftModal, showToast, handleGiftOrder, setupGiftDetailBtn
// - setSelectedCandidateId, getSelectedCandidateId, initGiftModal

import { sendGift } from './api.js';

/**
 * Открыть модальное окно подарка
 */
function showGiftModal() {
  const backdrop = document.querySelector('.gift-backdrop');
  if (backdrop) backdrop.classList.add('open');
  document.getElementById("gift-modal").classList.add("open");
}

/**
 * Закрыть модальное окно подарка
 */
function hideGiftModal() {
  const backdrop = document.querySelector('.gift-backdrop');
  if (backdrop) backdrop.classList.remove('open');
  document.getElementById("gift-modal").classList.remove("open");
}

/**
 * Показать тост-сообщение
 */
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

/**
 * Обработчик заказа подарка
 */
async function handleGiftOrder(button, currentUser, selectedCandidateId, API_URL) {
  event.stopPropagation && event.stopPropagation();
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
      message: `🎉 Отличный выбор! Уверен, это произведёт отличное впечатление.\nВы выбрали подарок: ${giftName} — ${giftPrice}`
    };
    const kb = {
      reply_markup: {
        inline_keyboard: [
          [ { text: "Оплатить", callback_data: `pay_${giftId}_${candidateId}` } ],
          [ { text: "Отмена", callback_data: "cancel_special" } ]
        ]
      }
    };
    payload.keyboard = kb;
    sendGift(payload);
  } catch (err) {
    console.error('Ошибка при отправке specialPush:', err);
  }
  hideGiftModal();
  showToast('Отправили Пуш');
}

/**
 * Обработчик «Узнать подробнее» о подарках
 */
function setupGiftDetailBtn(currentUser, API_URL) {
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
      const kb = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Заказать", callback_data: "order_now" }],
            [{ text: "Отмена", callback_data: "cancel_special" }]
          ]
        }
      };
      sendGift({
        userId: currentUser.userId,
        message: infoText,
        keyboard: kb
      });
    });
  }
}

// --- Управление выбранным кандидатом для подарка ---
let selectedCandidateId = null;
function setSelectedCandidateId(id) { selectedCandidateId = id; }
function getSelectedCandidateId() { return selectedCandidateId; }

/**
 * Инициализация обработчиков gift-modal (закрытие, узнать подробнее)
 */
function initGiftModal(currentUser, API_URL) {
  const closeBtn = document.getElementById("gift-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", hideGiftModal);
  setupGiftDetailBtn(currentUser, API_URL);
} 

// Делаем функции глобальными
window.showGiftModal = showGiftModal;
window.hideGiftModal = hideGiftModal;
window.showToast = showToast;
window.handleGiftOrder = handleGiftOrder;
window.setupGiftDetailBtn = setupGiftDetailBtn;
window.setSelectedCandidateId = setSelectedCandidateId;
window.getSelectedCandidateId = getSelectedCandidateId;
window.initGiftModal = initGiftModal;

export { 
  showGiftModal, 
  hideGiftModal, 
  showToast, 
  handleGiftOrder, 
  setupGiftDetailBtn,
  setSelectedCandidateId,
  getSelectedCandidateId,
  initGiftModal
}; 