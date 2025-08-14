import{f as i}from"./api.u-GyJUGh.js";function a(e){const o=document.querySelector("#screen-swipe .ava-frame"),s=o==null?void 0:o.querySelector(".user-id2");if(!s)return;let n=o.querySelector(".pro-container");if(!n){n=document.createElement("div"),n.className="pro-container";const r=o.querySelector("img.avatar_small_2");o.insertBefore(n,r.nextSibling),n.appendChild(s)}if(e.is_pro){if(!n.querySelector(".header-pro-badge")){const r=document.createElement("span");r.className="header-pro-badge",r.textContent="PRO",n.insertBefore(r,s)}o.classList.add("has-pro")}else{const r=n.querySelector(".header-pro-badge");r&&r.remove(),o.classList.remove("has-pro")}}function c(e){const o=document.querySelector(".profile-header .header-pro-info");if(o)if(o.innerHTML="",e.is_pro){const n=new Date,r=new Date(e.pro_end),t=Math.max(0,Math.ceil((r-n)/(1e3*60*60*24)));o.innerHTML=`<strong>PRO</strong> ${t} дн.`}else o.innerHTML="<strong>Купить PRO</strong>",o.style.cursor="pointer",o.onclick=()=>{window.showProModal&&window.showProModal()};const s=document.querySelector(".matches-header .header-pro-info");if(s)if(s.innerHTML="",e.is_pro){const n=new Date,r=new Date(e.pro_end),t=Math.max(0,Math.ceil((r-n)/(1e3*60*60*24)));s.innerHTML=`<strong>PRO</strong> ${t} дн.`}else s.innerHTML="<strong>Купить PRO</strong>",s.style.cursor="pointer",s.onclick=()=>{window.showProModal&&window.showProModal()}}function d(e){if(window.viewingCandidate||!e.is_pro)return;const o=document.querySelector(".profile-header .header-sub-row");if(!o)return;o.innerHTML="";const s=e.likes.length;o.innerHTML=`
    <div class="profile-likes-stats">
      <span class="likes-made-line">
        Вы: <span class="likes-made-count">${s}</span>
        <img src='/img/your_like.svg' alt='like'/>
      </span>
      <span class="likes-rec-line">
        Вам: <span class="likes-rec-count">…</span>
        <img src='/img/for_your_like.svg' alt='like'/>
      </span>
    </div>
  `,i(e.userId).then(n=>{n&&n.success&&(o.querySelector(".likes-rec-count").textContent=n.count)})}function l(e){if(!e.is_pro)return;const o=document.querySelector(".matches-header .header-sub-row");if(!o)return;o.innerHTML="";const s=e.likes.length;o.innerHTML=`
    <div class="matches-likes-stats">
      <span class="likes-made-line">
        Вы: <span class="likes-made-count">${s}</span>
        <img src='/img/your_like.svg' alt='like'/>
      </span>
      <span class="likes-rec-line">
        Вам: <span class="likes-rec-count">…</span>
        <img src='/img/for_your_like.svg' alt='like'/>
      </span>
    </div>
  `,i(e.userId).then(n=>{n&&n.success&&(o.querySelector(".likes-rec-count").textContent=n.count)})}function p(){const e=document.querySelector("#screen-swipe .ava-frame");e&&(document.querySelector("#screen-swipe .header-pro-badge")?e.classList.add("has-pro"):e.classList.remove("has-pro"))}function u(e,o,s){e.is_pro=o,e.pro_end=s}function m(e){f(e),a(e),c(e),d(e),l(e),p()}function f(e){const o=Date.now();e.is_pro&&e.pro_end&&new Date(e.pro_end).getTime()>o?(document.body.classList.add("is-pro"),console.log("PRO mode enabled, pro.css active")):(document.body.classList.remove("is-pro"),console.log("PRO mode disabled, pro.css inactive"))}window.renderProBadge=a;window.renderProInfo=c;window.renderProLikesStats=d;window.renderProMatchesStats=l;window.toggleProLayout=p;window.updateProStatus=u;window.initProFeatures=m;export{m as i,c as r};
