const proSlides = [
  {
    img: '/img/pro/swipe.png',
    title: 'Экран Свайпа',
    descTitle: 'Дополнительная навигация',
    desc: 'Вы всегда можете вернуться к предыдущему кандидату'
  },
    {
    img: '/img/pro/swipe.png',
    title: 'Экран Свайпа',
    descTitle: 'Супер-лайки',
    desc: 'Даже если вам поставили Dislike, кандидат получит пуш и увидит вашу анкету первой в выдаче'
  },
  {
    img: '/img/pro/matches.png',
    title: 'Экран Мэтчей',
    descTitle: 'Сколько всего лайков',
    desc: 'Теперь вы видите сколько всего вам поставили лайков'
  },
  {
    img: '/img/pro/candidate.png',
    title: 'Экран Анкеты',
    descTitle: 'Последнее посещение',
    desc: 'Узнайте когда ваш Мэтч был последний раз в приложении'
  },
  {
    img: '/img/pro/profile.png',
    title: 'Экран Профиля',
    descTitle: 'Стильный дизайн',
    desc: 'Новая черная тема во всем приложении'
  }
];

let proCurrentSlide = 0;
let isAnimating = false;

function showProModal() {
  let modal = document.getElementById('pro-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pro-modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="pro-modal-backdrop"></div>
    <div class="pro-modal-content pro-sheet">
      <div class="pro-modal-header-row">
        <span class="pro-badge">PRO</span>
        <span class="pro-modal-title">Преимущества</span>
        <button class="pro-modal-close" aria-label="Закрыть"><img src="/img/dislike.svg" alt="Закрыть" class="pro-close-img"></button>
      </div>
      <div class="pro-modal-carousel">
        <div class="pro-carousel-slide">
          <div class="pro-carousel-slide-title"></div>
          <img class="pro-carousel-img" src="" alt="pro screenshot" />
        </div>
      </div>
      <div class="pro-carousel-dots"></div>
      <div class="pro-carousel-desc-title"></div>
      <div class="pro-carousel-desc"></div>
      <button class="pro-modal-buy">КУПИТЬ</button>
    </div>
  `;
  modal.style.display = 'flex';
  // Закрытие
  modal.querySelector('.pro-modal-close').onclick = hideProModal;
  modal.querySelector('.pro-modal-backdrop').onclick = hideProModal;
  // Кнопка купить
  modal.querySelector('.pro-modal-buy').onclick = function() {
    window.open('/pro', '_blank');
  };
  // Карусель свайпом
  const img = modal.querySelector('.pro-carousel-img');
  let startX = null;
  img.addEventListener('touchstart', e => {
    if (e.touches.length === 1) startX = e.touches[0].clientX;
  });
  img.addEventListener('touchmove', e => {
    if (startX !== null && e.touches.length === 1 && !isAnimating) {
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) proAnimatedSetSlide(proCurrentSlide + 1, modal);
        else proAnimatedSetSlide(proCurrentSlide - 1, modal);
        startX = null;
      }
    }
  });
  img.addEventListener('touchend', () => { startX = null; });
  img.addEventListener('click', () => {
    if (!isAnimating) proAnimatedSetSlide(proCurrentSlide + 1, modal);
  });
  proRenderDots(modal);
  proSetSlide(proCurrentSlide, modal);
}

function hideProModal() {
  const modal = document.getElementById('pro-modal');
  if (modal) modal.style.display = 'none';
}

// Делаем функции глобальными
window.showProModal = showProModal;
window.hideProModal = hideProModal;

export { showProModal, hideProModal };

export function initProModalHandlers() {
  document.querySelectorAll('.header-pro-info').forEach(el => {
    if (!el.dataset.proHandler) {
      el.addEventListener('click', showProModal);
      el.style.cursor = 'pointer';
      el.dataset.proHandler = '1';
    }
  });
}

function proSetSlide(idx, modal = document.getElementById('pro-modal')) {
  if (!modal) return;
  if (idx < 0) idx = proSlides.length - 1;
  if (idx >= proSlides.length) idx = 0;
  proCurrentSlide = idx;
  const slide = proSlides[idx];
  modal.querySelector('.pro-carousel-img').src = slide.img;
  modal.querySelector('.pro-carousel-slide-title').textContent = slide.title;
  modal.querySelector('.pro-carousel-desc-title').textContent = slide.descTitle;
  modal.querySelector('.pro-carousel-desc').textContent = slide.desc;
  proRenderDots(modal);
}

function proRenderDots(modal) {
  const dots = modal.querySelector('.pro-carousel-dots');
  dots.innerHTML = '';
  for (let i = 0; i < proSlides.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'pro-dot' + (i === proCurrentSlide ? ' active' : '');
    dot.onclick = () => proSetSlide(i, modal);
    dots.appendChild(dot);
  }
}

function proAnimatedSetSlide(nextIdx, modal = document.getElementById('pro-modal')) {
  if (!modal) return;
  if (isAnimating) return;
  isAnimating = true;
  const img = modal.querySelector('.pro-carousel-img');
  img.classList.remove('pro-slide-in-right');
  img.classList.add('pro-slide-out-left');
  img.addEventListener('animationend', function handler() {
    img.removeEventListener('animationend', handler);
    proSetSlide(nextIdx, modal);
    img.classList.remove('pro-slide-out-left');
    img.classList.add('pro-slide-in-right');
    img.addEventListener('animationend', function handler2() {
      img.removeEventListener('animationend', handler2);
      img.classList.remove('pro-slide-in-right');
      isAnimating = false;
    });
  });
} 