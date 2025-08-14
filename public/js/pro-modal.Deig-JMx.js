const n=[{img:"/img/pro/swipe.png",title:"Экран Свайпа",descTitle:"Дополнительная навигация",desc:"Вы всегда можете вернуться к предыдущему кандидату"},{img:"/img/pro/swipe.png",title:"Экран Свайпа",descTitle:"Супер-лайки",desc:"Даже если вам поставили Dislike, кандидат получит пуш и увидит вашу анкету первой в выдаче"},{img:"/img/pro/matches.png",title:"Экран Мэтчей",descTitle:"Сколько всего лайков",desc:"Теперь вы видите сколько всего вам поставили лайков"},{img:"/img/pro/candidate.png",title:"Экран Анкеты",descTitle:"Последнее посещение",desc:"Узнайте когда ваш Мэтч был последний раз в приложении"},{img:"/img/pro/profile.png",title:"Экран Профиля",descTitle:"Стильный дизайн",desc:"Новая черная тема во всем приложении"}];let s=0,l=!1;function p(){let e=document.getElementById("pro-modal");e||(e=document.createElement("div"),e.id="pro-modal",document.body.appendChild(e)),e.innerHTML=`
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
  `,e.style.display="flex",e.querySelector(".pro-modal-close").onclick=c,e.querySelector(".pro-modal-backdrop").onclick=c,e.querySelector(".pro-modal-buy").onclick=function(){window.open("/pro","_blank")};const o=e.querySelector(".pro-carousel-img");let t=null;o.addEventListener("touchstart",i=>{i.touches.length===1&&(t=i.touches[0].clientX)}),o.addEventListener("touchmove",i=>{if(t!==null&&i.touches.length===1&&!l){const r=i.touches[0].clientX-t;Math.abs(r)>40&&(r<0?d(s+1,e):d(s-1,e),t=null)}}),o.addEventListener("touchend",()=>{t=null}),o.addEventListener("click",()=>{l||d(s+1,e)}),u(e),a(s,e)}function c(){const e=document.getElementById("pro-modal");e&&(e.style.display="none")}window.showProModal=p;window.hideProModal=c;function m(){document.querySelectorAll(".header-pro-info").forEach(e=>{e.dataset.proHandler||(e.addEventListener("click",p),e.style.cursor="pointer",e.dataset.proHandler="1")})}function a(e,o=document.getElementById("pro-modal")){if(!o)return;e<0&&(e=n.length-1),e>=n.length&&(e=0),s=e;const t=n[e];o.querySelector(".pro-carousel-img").src=t.img,o.querySelector(".pro-carousel-slide-title").textContent=t.title,o.querySelector(".pro-carousel-desc-title").textContent=t.descTitle,o.querySelector(".pro-carousel-desc").textContent=t.desc,u(o)}function u(e){const o=e.querySelector(".pro-carousel-dots");o.innerHTML="";for(let t=0;t<n.length;t++){const i=document.createElement("span");i.className="pro-dot"+(t===s?" active":""),i.onclick=()=>a(t,e),o.appendChild(i)}}function d(e,o=document.getElementById("pro-modal")){if(!o||l)return;l=!0;const t=o.querySelector(".pro-carousel-img");t.classList.remove("pro-slide-in-right"),t.classList.add("pro-slide-out-left"),t.addEventListener("animationend",function i(){t.removeEventListener("animationend",i),a(e,o),t.classList.remove("pro-slide-out-left"),t.classList.add("pro-slide-in-right"),t.addEventListener("animationend",function r(){t.removeEventListener("animationend",r),t.classList.remove("pro-slide-in-right"),l=!1})})}export{m as i,p as s};
