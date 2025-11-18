// Вспомогательные функции, вынесенные из main.js

// Скрывает бейджи 'LIKE' и 'NOPE' на карточке
function hideBadges(card) {
  if (!card) return;
  const likeB = card.querySelector('.badge-like');
  const nopeB = card.querySelector('.badge-nope');
  if (likeB) { likeB.style.opacity = 0; likeB.style.fontSize = '64px'; }
  if (nopeB) { nopeB.style.opacity = 0; nopeB.style.fontSize = '64px'; }
}

// Отображает пагинатор (точки) для переключения между фотографиями кандидата
function renderPaginator(paginatorEl, total, current) {
  if (!paginatorEl) return;
  paginatorEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = (i === current ? 'pag_active' : 'pag');
    paginatorEl.appendChild(dot);
  }
}

// Делаем функции глобальными
window.hideBadges = hideBadges;
window.renderPaginator = renderPaginator;

// Здесь можно добавить другие утилиты по мере выноса

export { hideBadges, renderPaginator }; 