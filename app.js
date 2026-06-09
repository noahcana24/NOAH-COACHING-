// ============================================================
// NOAHCANA COACHING v2 — APP.JS
// ============================================================

const ADMIN_CODE = 'NOAHCANA-ADMIN';
let CU = null; // current user
let activeResFilter = 'all', activePostFilter = 'all', activeGlosFilter = 'all', activeTipsFilter = 'all', activeFAQFilter = 'all';
let selectedRating = 0;
let pendingPostImg = null;

// ---- LEVELS ----
const LEVELS = [
  { name:'Starter', min:0, color:'Starter' },
  { name:'Bronze', min:200, color:'Bronze' },
  { name:'Silver', min:600, color:'Silver' },
  { name:'Gold', min:1200, color:'Gold' },
  { name:'Elite', min:2500, color:'Elite' }
];
function getLevel(xp) { let l=LEVELS[0]; for(const v of LEVELS){if(xp>=v.min)l=v;} return l; }

// ---- BADGES ----
const BADGE_DEFS = [
  { id:'first_login', icon:'🚀', label:'Premier pas', cond: u => true },
  { id:'first_module', icon:'📚', label:'Premier module', cond: u => (u.completedLessons||[]).length >= 1 },
  { id:'first_defi', icon:'🏆', label:'Premier défi', cond: u => (u.completedDefis||[]).length >= 1 },
  { id:'first_post', icon:'💬', label:'Première publication', cond: u => (u.postCount||0) >= 1 },
  { id:'5_defis', icon:'🔥', label:'5 défis relevés', cond: u => (u.completedDefis||[]).length >= 5 },
  { id:'body_tracking', icon:'📏', label:'Suivi corporel', cond: u => DB.getArr('body_'+u.code).length >= 1 },
  { id:'transformation', icon:'📸', label:'Transformation', cond: u => DB.getArr('transfo_'+u.code).length >= 1 },
];
function checkBadges(user) {
  if(!user.badges) user.badges = [];
  let earned = false;
  for(const b of BADGE_DEFS) {
    if(!user.badges.includes(b.id) && b.cond(user)) {
      user.badges.push(b.id);
      earned = true;
      showToast('🏅 Badge débloqué : ' + b.label, 'gold');
    }
  }
  if(earned) { saveCU(); }
}

// ---- DB ----
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('nc2_'+k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem('nc2_'+k, JSON.stringify(v)),
  getArr: k => { try { return JSON.parse(localStorage.getItem('nc2_'+k)) || []; } catch { return []; } },
};

function saveCU() {
  DB.set('session', CU);
  if(!CU.isAdmin) {
    const members = DB.getArr('members');
    const i = members.findIndex(m => m.code === CU.code);
    if(i >= 0) members[i] = { ...members[i], ...CU };
    else members.push(CU);
    DB.set('members', members);
  }
}

// ============================================================
// AUTH
// ============================================================
window.addEventListener("load", () => {
  const s = DB.get('session');
  if(s) { CU = s; s.isAdmin ? showAdminPage() : showMemberPage(); }

  // tip theme toggle
  const tipTheme = document.getElementById('tip-theme');
  if(tipTheme) tipTheme.addEventListener('change', () => {
    document.getElementById('tip-besoin-wrap').style.display = tipTheme.value === 'Compléments' ? 'block' : 'none';
  });
});

function handleLogin() {
  const code = (document.getElementById('invite-code').value||'').trim().toUpperCase();
  const name = (document.getElementById('member-name').value||'').trim();
  const err = document.getElementById('login-error');
  if(!name) { err.textContent = 'Entre ton prénom'; return; }
  if(!code) { err.textContent = 'Entre ton code d\'invitation'; return; }
  if(code === ADMIN_CODE) {
    CU = { name:'Noah Cana', isAdmin:true };
    DB.set('session', CU);
    err.textContent = '';
    showAdminPage();
    return;
  }
  const invites = DB.getArr('invites');
  const inv = invites.find(i => i.code === code);
  if(!inv) { err.textContent = 'Code invalide. Vérifie ton code.'; return; }
  inv.used = true; inv.usedBy = name; inv.usedAt = new Date().toISOString();
  DB.set('invites', invites);
  const members = DB.getArr('members');
  let member = members.find(m => m.code === code);
  if(!member) {
    member = { id:Date.now(), name, code, joinedAt:new Date().toISOString(), xp:0, completedLessons:[], completedDefis:[], badges:['first_login'], postCount:0, streak:1, lastLogin:new Date().toDateString(), favRepas:[] };
    members.push(member);
    DB.set('members', members);
  } else {
    // streak
    const today = new Date().toDateString();
    if(member.lastLogin !== today) {
      const yesterday = new Date(Date.now()-86400000).toDateString();
      member.streak = member.lastLogin === yesterday ? (member.streak||0)+1 : 1;
      member.lastLogin = today;
    }
  }
  CU = { ...member, isAdmin:false };
  DB.set('session', CU);
  err.textContent = '';
  checkBadges(CU);
  showMemberPage();
}

function logout() { DB.set('session', null); CU = null; showPage('login'); document.getElementById('invite-code').value=''; document.getElementById('member-name').value=''; }

// ============================================================
// NAVIGATION
// ============================================================
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
}

function showMemberPage() {
  showPage('member');
  renderNavProfile();
  bindMemberNav();
  showSection('dashboard');
}

function renderNavProfile() {
  const init = initials(CU.name);
  const lv = getLevel(CU.xp||0);
  document.getElementById('tb-name').textContent = 'Bonjour '+CU.name.split(' ')[0]+' 👋';
  document.getElementById('tb-xp-val').textContent = (CU.xp||0)+' XP';
  document.getElementById('sb-profile').innerHTML = `
    <div class="sbp-av">${init}</div>
    <div><div class="sbp-name">${CU.name}</div><div class="sbp-role"><span class="level-pill level-${lv.name}">${lv.name}</span></div></div>
  `;
}

function bindMemberNav() {
  document.querySelectorAll('#page-member .nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showSection(el.dataset.section);
    });
  });
}

function showSection(name) {
  document.querySelectorAll('#page-member .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#page-member .nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('section-'+name);
  if(sec) sec.classList.add('active');
  const navEl = document.querySelector(`#page-member .nav-item[data-section="${name}"]`);
  if(navEl) navEl.classList.add('active');
  if(name==='dashboard') renderDashboard();
  if(name==='modules') renderModules();
  if(name==='repas') renderRepas();
  if(name==='defis') renderDefis();
  if(name==='community') renderCommunity();
  if(name==='resources') renderResources();
  if(name==='body') renderBody();
  if(name==='transformation') renderTransfo();
  if(name==='temoignage') renderTemoignage();
  if(name==='glossaire') renderGlossaire();
  if(name==='tips') renderTips();
  if(name==='faq') renderFAQ();
  closeSidebar();
}

function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebar-overlay')?.classList.remove('active'); }

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const modules = DB.getArr('modules');
  const totalLessons = modules.reduce((s,m) => s+m.lessons.length, 0);
  const doneLessons = (CU.completedLessons||[]).length;
  const pct = totalLessons ? Math.round(doneLessons/totalLessons*100) : 0;
  const defis = DB.getArr('defis');
  const doneDefis = (CU.completedDefis||[]).length;
  const xp = CU.xp||0;
  const lv = getLevel(xp);
  const badges = (CU.badges||[]).map(bid => { const b=BADGE_DEFS.find(x=>x.id===bid); return b ? `<div class="badge-pill">${b.icon} ${b.label}</div>` : ''; }).join('');

  // coach message
  const msg = DB.get('coach_message');
  const banner = document.getElementById('coach-message-banner');
  banner.innerHTML = msg ? `<div class="coach-banner"><div class="cb-icon">⚡</div><div><div class="cb-label">Message de Noah</div><div class="cb-msg">${escHtml(msg)}</div></div></div>` : '';

  document.getElementById('dash-hero').innerHTML = `
    <div class="dh-left">
      <h2>Content de te voir, ${CU.name.split(' ')[0]} 💪</h2>
      <p>${pct}% de ta formation complétée · Continue comme ça !</p>
      <div class="progress-bar-wrap" style="max-width:280px; margin-top:14px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div style="margin-top:14px">${badges||'<span style="font-size:12px;color:rgba(255,255,255,.4)">Complete des leçons pour débloquer des badges !</span>'}</div>
    </div>
    <div class="dh-xp">
      <div class="dh-xp-val">${xp}</div>
      <div class="dh-xp-label">points XP</div>
      <div class="dh-level">${lv.name}</div>
    </div>
  `;

  document.getElementById('dash-grid').innerHTML = `
    <div class="dash-stats">
      <div class="dstat"><div class="dstat-icon">📚</div><div class="dstat-val">${doneLessons}</div><div class="dstat-label">Leçons complétées</div></div>
      <div class="dstat"><div class="dstat-icon">🏆</div><div class="dstat-val">${doneDefis}</div><div class="dstat-label">Défis relevés</div></div>
      <div class="dstat"><div class="dstat-icon">📅</div><div class="dstat-val">${modules.length}</div><div class="dstat-label">Modules disponibles</div></div>
      <div class="dstat"><div class="dstat-icon">🔥</div><div class="dstat-val">${CU.streak||1}</div><div class="dstat-label">Jours de streak</div></div>
    </div>
  `;

  const nextDefi = defis.find(d => !(CU.completedDefis||[]).includes(d.id));
  document.getElementById('dash-bottom').innerHTML = `
    <div class="dash-bottom-grid">
      <div class="db-card" onclick="showSection('modules')">
        <div class="dbc-header"><div class="dbc-icon" style="background:var(--blue-light);color:var(--blue)"><i class="fa-solid fa-graduation-cap"></i></div><div><div class="dbc-title">Ma Formation</div><div class="dbc-sub">${pct}% complété</div></div></div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </div>
      ${nextDefi ? `
      <div class="db-card" onclick="showSection('defis')">
        <div class="dbc-header"><div class="dbc-icon" style="background:var(--gold-light);color:var(--gold)">${nextDefi.icon||'🏆'}</div><div><div class="dbc-title">Prochain défi</div><div class="dbc-sub">${nextDefi.type}</div></div></div>
        <div style="font-size:14px;color:var(--text2);margin-top:6px">${escHtml(nextDefi.title)}</div>
        <div style="font-size:13px;color:var(--gold);margin-top:4px">+${nextDefi.xp} XP</div>
      </div>` : `<div class="db-card"><div class="dbc-header"><div class="dbc-icon" style="background:var(--green-light);color:var(--green)">✅</div><div><div class="dbc-title">Défis</div><div class="dbc-sub">Tous complétés !</div></div></div></div>`}
    </div>
  `;
}

// ============================================================
// MODULES
// ============================================================
function renderModules(filter='all') {
  const modules = DB.getArr('modules');
  const grid = document.getElementById('modules-grid');
  document.querySelectorAll('#modules-filter .ftab').forEach(b => { b.classList.toggle('active', b.dataset.filter===(filter)); });
  const filtered = filter==='all' ? modules : modules.filter(m=>m.domain===filter);
  if(!filtered.length) { grid.innerHTML='<div class="empty-state"><i class="fa-solid fa-graduation-cap"></i><p>Aucun module disponible.</p></div>'; return; }
  grid.innerHTML = filtered.map(m => {
    const done = m.lessons.filter(l=>(CU.completedLessons||[]).includes(m.id+'-'+l.id)).length;
    const total = m.lessons.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const allDone = pct===100;
    return `
    <div class="mod-card" onclick="viewModule(${m.id})">
      <div class="mod-card-banner domain-${m.domain}">${m.icon||'📚'}</div>
      <div class="mod-card-body">
        <div class="mod-card-domain">${m.domain}</div>
        <div class="mod-card-title">${escHtml(m.title)}</div>
        <div class="mod-card-desc">${escHtml(m.desc||'')}</div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${done}/${total} leçons · ${pct}%</div>
      </div>
      <div class="mod-card-footer">
        <span>${total} leçon${total>1?'s':''}</span>
        ${allDone ? '<span class="mod-done-badge">✅ Terminé</span>' : '<span class="mod-start">'+((done>0)?'Continuer':'Commencer')+' <i class="fa-solid fa-arrow-right"></i></span>'}
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('#modules-filter .ftab').forEach(b => {
    b.onclick = () => renderModules(b.dataset.filter);
  });
}

function viewModule(id) {
  const modules = DB.getArr('modules');
  const m = modules.find(x=>x.id===id);
  if(!m) return;
  showSection('module-detail');
  const done = m.lessons.filter(l=>(CU.completedLessons||[]).includes(m.id+'-'+l.id)).length;
  document.getElementById('module-detail-content').innerHTML = `
    <div class="mod-detail-header">
      <div class="mdh-icon">${m.icon||'📚'}</div>
      <div>
        <div class="mdh-domain">${m.domain}</div>
        <div class="mdh-title">${escHtml(m.title)}</div>
        <div class="mdh-desc">${escHtml(m.desc||'')} · ${done}/${m.lessons.length} leçons</div>
      </div>
    </div>
    ${done===m.lessons.length && m.lessons.length>0 ? `<div class="cert-banner"><div class="cert-icon">🏅</div><div class="cert-text"><h4>Module complété !</h4><p>Tu as validé toutes les leçons de ce module. Excellent travail !</p></div></div>` : ''}
    <div class="lessons-list">
      ${m.lessons.map((l,i)=>{
        const isDone=(CU.completedLessons||[]).includes(m.id+'-'+l.id);
        return `<div class="lesson-item" onclick="openLesson(${m.id},'${l.id}')">
          <div class="lesson-num ${isDone ? 'done' : ''}">${isDone ? '<i class="fa-solid fa-check"></i>' : (i+1)}</div>
          <div><div class="lesson-title">${escHtml(l.title)}</div>${l.duration?`<div class="lesson-duration"><i class="fa-regular fa-clock"></i> ${l.duration}</div>`:''}</div>
          <div class="lesson-status">${isDone?'✅':'▶️'}</div>
        </div>`;
      }).join('')}
    </div>
  `;
  document.querySelectorAll('#page-member .nav-item').forEach(n=>n.classList.remove('active'));
}

function openLesson(moduleId, lessonId) {
  const modules = DB.getArr('modules');
  const m = modules.find(x=>x.id===moduleId);
  if(!m) return;
  const l = m.lessons.find(x=>x.id===lessonId);
  if(!l) return;
  const isDone = (CU.completedLessons||[]).includes(m.id+'-'+l.id);
  const videoHtml = l.videoUrl ? `<iframe class="lesson-video" src="${l.videoUrl}" allowfullscreen></iframe>` : '';
  const quizHtml = l.quiz && l.quiz.question ? `
    <div class="lesson-quiz">
      <div class="lq-title">📝 Quiz : ${escHtml(l.quiz.question)}</div>
      <div class="lq-options">
        ${(l.quiz.options||[]).map((o,i)=>`<button class="lq-opt" onclick="answerQuiz(this,${i},${l.quiz.correct})">${escHtml(o)}</button>`).join('')}
      </div>
    </div>` : '';
  document.getElementById('modal-content').innerHTML = `
    <h3>${escHtml(l.title)}</h3>
    ${videoHtml}
    <div class="lesson-body">${escHtml(l.content||'Contenu à venir.')}</div>
    ${quizHtml}
    <button class="btn-mark-done ${isDone?'undone':''}" onclick="toggleLessonDone(${moduleId},'${lessonId}')">
      ${isDone?'<i class="fa-solid fa-rotate-left"></i> Marquer non complété':'<i class="fa-solid fa-check"></i> Marquer comme complété'}
    </button>
  `;
  openModal();
}

function answerQuiz(btn, idx, correct) {
  const opts = btn.closest('.lq-options').querySelectorAll('.lq-opt');
  opts.forEach(o=>o.disabled=true);
  if(idx===correct) { btn.classList.add('correct'); showToast('✅ Bonne réponse !','success'); }
  else { btn.classList.add('wrong'); opts[correct].classList.add('correct'); showToast('❌ Mauvaise réponse','error'); }
}

function toggleLessonDone(moduleId, lessonId) {
  const key = moduleId+'-'+lessonId;
  if(!CU.completedLessons) CU.completedLessons=[];
  const idx = CU.completedLessons.indexOf(key);
  if(idx>=0) { CU.completedLessons.splice(idx,1); CU.xp=Math.max(0,(CU.xp||0)-20); }
  else { CU.completedLessons.push(key); CU.xp=(CU.xp||0)+20; showToast('✅ Leçon validée ! +20 XP','success'); }
  saveCU();
  checkBadges(CU);
  document.getElementById('tb-xp-val').textContent=(CU.xp||0)+' XP';
  closeModal();
  viewModule(moduleId);
}

// ============================================================
// REPAS
// ============================================================
function renderRepas(filter='all') {
  const repas = DB.getArr('repas');
  const grid = document.getElementById('repas-grid');
  document.querySelectorAll('#repas-filter .ftab').forEach(b => { b.classList.toggle('active', b.dataset.filter===filter); b.onclick=()=>renderRepas(b.dataset.filter); });
  const filtered = filter==='all' ? repas : repas.filter(r=>r.cat===filter);
  if(!filtered.length) { grid.innerHTML='<div class="empty-state"><i class="fa-solid fa-utensils"></i><p>Aucun repas disponible.</p></div>'; return; }
  const favs = CU.favRepas||[];
  const catLabels = {'petit-dejeuner':'Petit-déjeuner','dejeuner':'Déjeuner','diner':'Dîner','snack':'Snack','collation':'Collation'};
  grid.innerHTML = filtered.map(r => `
    <div class="repas-card">
      ${r.photo?`<img src="${r.photo}" class="repas-img" alt="${escHtml(r.nom)}" onerror="this.parentNode.innerHTML='<div class=repas-img-placeholder>🍽️</div>'+this.parentNode.innerHTML.replace(this.outerHTML,'')">` : '<div class="repas-img-placeholder">🍽️</div>'}
      <div class="repas-body">
        <div class="repas-cat-tag">${catLabels[r.cat]||r.cat}</div>
        <div class="repas-name">${escHtml(r.nom)}</div>
        <div class="repas-macros">
          <div class="rm-item"><div class="rm-val">${r.cal}</div><div class="rm-label">kcal</div></div>
          <div class="rm-item"><div class="rm-val">${r.prot}g</div><div class="rm-label">Prot.</div></div>
          <div class="rm-item"><div class="rm-val">${r.gluc}g</div><div class="rm-label">Gluc.</div></div>
          <div class="rm-item"><div class="rm-val">${r.lip}g</div><div class="rm-label">Lip.</div></div>
        </div>
        ${r.desc?`<div style="font-size:12px;color:var(--text3);margin-top:8px">${escHtml(r.desc)}</div>`:''}
        <button class="repas-fav-btn ${favs.includes(r.id)?'active':''}" onclick="toggleFavRepas(${r.id},this)">
          <i class="fa-${favs.includes(r.id)?'solid':'regular'} fa-star"></i> ${favs.includes(r.id)?'Favori':'Ajouter aux favoris'}
        </button>
      </div>
    </div>
  `).join('');
}

function toggleFavRepas(id, btn) {
  if(!CU.favRepas) CU.favRepas=[];
  const i = CU.favRepas.indexOf(id);
  if(i>=0) { CU.favRepas.splice(i,1); btn.classList.remove('active'); btn.innerHTML='<i class="fa-regular fa-star"></i> Ajouter aux favoris'; }
  else { CU.favRepas.push(id); btn.classList.add('active'); btn.innerHTML='<i class="fa-solid fa-star"></i> Favori'; }
  saveCU();
}

// ============================================================
// DEFIS
// ============================================================
function renderDefis() {
  const defis = DB.getArr('defis');
  const xp = CU.xp||0;
  const lv = getLevel(xp);
  const nextLv = LEVELS[LEVELS.indexOf(lv)+1];
  document.getElementById('defi-xp-card').innerHTML = `
    <div class="xc-circle"><div class="xc-val">${xp}</div><div class="xc-unit">XP</div></div>
    <div class="xc-info">
      <h3>Niveau : ${lv.name}</h3>
      <p>${nextLv?`Plus que ${nextLv.min-xp} XP pour atteindre ${nextLv.name}`:'Tu es au niveau maximum 🏆'}</p>
      <span class="level-pill level-${lv.name}">${lv.name}</span>
    </div>
  `;
  if(!defis.length) { document.getElementById('defis-grid').innerHTML='<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>Aucun défi disponible.</p></div>'; return; }
  const done = CU.completedDefis||[];
  document.getElementById('defis-grid').innerHTML = defis.map(d=>`
    <div class="defi-card ${done.includes(d.id)?'completed':''}">
      <div class="dc-header">
        <div class="dc-icon">${d.icon||'🏆'}</div>
        <div><div class="dc-type">${d.type}</div><div class="dc-title">${escHtml(d.title)}</div></div>
      </div>
      <div class="dc-desc">${escHtml(d.desc||'')}</div>
      <div class="dc-footer">
        <span class="dc-xp"><i class="fa-solid fa-bolt"></i> +${d.xp} XP</span>
        <button class="btn-validate ${done.includes(d.id)?'done':''}" onclick="validateDefi(${d.id})" ${done.includes(d.id)?'disabled':''}>
          ${done.includes(d.id)?'✅ Complété':'Valider'}
        </button>
      </div>
    </div>
  `).join('');
}

function validateDefi(id) {
  if(!CU.completedDefis) CU.completedDefis=[];
  if(CU.completedDefis.includes(id)) return;
  const defi = DB.getArr('defis').find(d=>d.id===id);
  if(!defi) return;
  CU.completedDefis.push(id);
  CU.xp=(CU.xp||0)+(parseInt(defi.xp)||0);
  saveCU();
  checkBadges(CU);
  document.getElementById('tb-xp-val').textContent=(CU.xp||0)+' XP';
  showToast(`🏆 Défi validé ! +${defi.xp} XP`,'gold');
  renderDefis();
}

// ============================================================
// COMMUNITY
// ============================================================
function renderCommunity() {
  const init = initials(CU.name);
  document.getElementById('post-composer').innerHTML = `
    <div class="pc-top">
      <div class="pc-av">${init}</div>
      <textarea id="post-text" placeholder="Partage ta progression, une question, une victoire..."></textarea>
    </div>
    <div class="pc-bottom">
      <select class="pc-cat-select" id="post-cat">
        <option>Transformation</option><option>Question</option><option>Motivation</option><option>Victoire</option>
      </select>
      <label class="pc-img-btn"><i class="fa-solid fa-image"></i> Photo<input type="file" accept="image/*" style="display:none" onchange="handlePostImg(this)"></label>
      <div id="pc-img-preview"></div>
      <button class="btn-publish" onclick="publishPost()"><i class="fa-solid fa-paper-plane"></i> Publier</button>
    </div>
  `;
  renderPosts();
}

function filterPosts(f, btn) {
  activePostFilter=f;
  document.querySelectorAll('#section-community .filter-tabs .ftab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderPosts();
}

function renderPosts() {
  let posts = DB.getArr('posts');
  if(activePostFilter!=='all') posts=posts.filter(p=>p.cat===activePostFilter);
  posts.sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || new Date(b.createdAt)-new Date(a.createdAt));
  const feed=document.getElementById('posts-feed');
  if(!posts.length){feed.innerHTML='<div class="empty-state"><i class="fa-solid fa-comments"></i><p>Aucun post. Sois le premier !</p></div>';return;}
  const colors=['#1a6bbf','#2d7a4f','#c9972a','#d35400','#7c3aed'];
  feed.innerHTML=posts.map(p=>{
    const c=colors[p.authorId%colors.length];
    const liked=(p.likedBy||[]).includes(CU.code);
    const isOwn=p.authorCode===CU.code||CU.isAdmin;
    return `
    <div class="post-card ${p.pinned?'post-pinned':''}">
      ${p.pinned?'<div class="post-pin-badge"><i class="fa-solid fa-thumbtack"></i> Épinglé par le coach</div>':''}
      <div class="post-header">
        <div class="post-av" style="background:${c}20;color:${c}">${initials(p.author)}</div>
        <div><div class="post-author">${escHtml(p.author)}</div><div class="post-time">${timeAgo(p.createdAt)}</div></div>
        <span class="post-cat-tag post-cat-${p.cat}">${p.cat}</span>
      </div>
      <div class="post-body">${escHtml(p.body)}</div>
      ${p.image?`<img src="${p.image}" class="post-image" alt="photo">`:''}
      <div class="post-actions">
        <button class="pact-btn ${liked?'liked':''}" onclick="likePost(${p.id})"><i class="fa-${liked?'solid':'regular'} fa-heart"></i> ${p.likes||0}</button>
        ${isOwn?`<button class="pact-btn pact-del" onclick="deletePost(${p.id})"><i class="fa-solid fa-trash"></i></button>`:''}
      </div>
    </div>`;
  }).join('');
}

function handlePostImg(input) {
  const f=input.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=e=>{pendingPostImg=e.target.result;document.getElementById('pc-img-preview').innerHTML=`<img src="${e.target.result}" style="max-height:50px;border-radius:6px;">`;}; r.readAsDataURL(f);
}

function publishPost() {
  const text=(document.getElementById('post-text')?.value||'').trim();
  const cat=document.getElementById('post-cat')?.value||'Motivation';
  if(!text&&!pendingPostImg) return;
  const posts=DB.getArr('posts');
  posts.push({id:Date.now(),author:CU.name,authorCode:CU.code,authorId:CU.id||0,body:text,cat,image:pendingPostImg||null,createdAt:new Date().toISOString(),likes:0,likedBy:[],pinned:false});
  DB.set('posts',posts);
  CU.postCount=(CU.postCount||0)+1; CU.xp=(CU.xp||0)+10;
  saveCU(); checkBadges(CU);
  pendingPostImg=null;
  showToast('Post publié ! +10 XP 🔥','success');
  renderCommunity();
}

function likePost(id) {
  const posts=DB.getArr('posts'); const p=posts.find(x=>x.id===id); if(!p) return;
  if(!p.likedBy) p.likedBy=[];
  const i=p.likedBy.indexOf(CU.code);
  if(i>=0){p.likedBy.splice(i,1);p.likes=Math.max(0,(p.likes||1)-1);}
  else{p.likedBy.push(CU.code);p.likes=(p.likes||0)+1;}
  DB.set('posts',posts); renderPosts();
}

function deletePost(id) {
  DB.set('posts',DB.getArr('posts').filter(p=>p.id!==id));
  renderPosts(); showToast('Post supprimé');
}

// ============================================================
// RESOURCES
// ============================================================
function filterResources(f,btn){activeResFilter=f;document.querySelectorAll('#section-resources .filter-tabs .ftab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderResources();}

function renderResources() {
  const q=(document.getElementById('res-search')?.value||'').toLowerCase();
  let list=DB.getArr('resources');
  if(activeResFilter!=='all') list=list.filter(r=>r.cat===activeResFilter);
  if(q) list=list.filter(r=>r.title.toLowerCase().includes(q)||r.desc?.toLowerCase().includes(q));
  const icons={pdf:'📄',video:'🎥',excel:'📊',link:'🔗'};
  const grid=document.getElementById('resources-grid');
  if(!list.length){grid.innerHTML='<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Aucune ressource.</p></div>';return;}
  grid.innerHTML=list.map(r=>`
    <div class="res-card">
      <div class="res-icon ${r.type}">${icons[r.type]||'📎'}</div>
      <div><div class="res-title">${escHtml(r.title)}</div><div class="res-desc">${escHtml(r.desc||'')}</div><a href="${r.url}" target="_blank" class="res-dl"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir</a></div>
    </div>`).join('');
}

// ============================================================
// BODY TRACKING
// ============================================================
function renderBody() {
  const entries=DB.getArr('body_'+CU.code).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const last=entries[0]||{};
  document.getElementById('body-stats-grid').innerHTML = [
    {l:'Poids',v:last.poids,u:'kg'},{l:'Tour de taille',v:last.taille,u:'cm'},
    {l:'Tour de bras',v:last.bras,u:'cm'},{l:'Tour de cuisse',v:last.cuisse,u:'cm'},
    {l:'Tour de hanches',v:last.hanches,u:'cm'},{l:'Masse grasse',v:last.mg,u:'%'}
  ].map(s=>`<div class="bsg-card"><div class="bsg-label">${s.l}</div><div class="bsg-val">${s.v||'—'}<span class="bsg-unit">${s.v?s.u:''}</span></div></div>`).join('');
  const cont=document.getElementById('body-entries');
  if(!entries.length){cont.innerHTML='<div class="empty-state"><i class="fa-solid fa-chart-line"></i><p>Aucune mesure. Commence ton suivi !</p></div>';return;}
  cont.innerHTML=entries.map(e=>`
    <div class="body-entry">
      <span class="be-date">${fmtDate(e.date)}</span>
      <div class="be-metrics">
        ${e.poids?`<span class="be-metric"><strong>${e.poids}</strong> kg</span>`:''}
        ${e.taille?`<span class="be-metric">Taille: <strong>${e.taille}</strong>cm</span>`:''}
        ${e.bras?`<span class="be-metric">Bras: <strong>${e.bras}</strong>cm</span>`:''}
        ${e.cuisse?`<span class="be-metric">Cuisse: <strong>${e.cuisse}</strong>cm</span>`:''}
        ${e.hanches?`<span class="be-metric">Hanches: <strong>${e.hanches}</strong>cm</span>`:''}
        ${e.mg?`<span class="be-metric">MG: <strong>${e.mg}</strong>%</span>`:''}
      </div>
      <button class="be-del" onclick="deleteBodyEntry(${e.id})"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}

function openBodyForm() {
  document.getElementById('modal-content').innerHTML = `
    <h3 style="font-family:var(--font-d);font-size:18px;margin-bottom:20px">Nouvelle mesure</h3>
    <div class="form-group"><label>Date</label><input type="date" id="bf-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-row-3">
      <div class="form-group"><label>Poids (kg)</label><input type="number" id="bf-poids" placeholder="Ex: 82.5" step="0.1"></div>
      <div class="form-group"><label>Taille (cm)</label><input type="number" id="bf-taille" placeholder="Ex: 78"></div>
      <div class="form-group"><label>Bras (cm)</label><input type="number" id="bf-bras" placeholder="Ex: 36"></div>
    </div>
    <div class="form-row-3">
      <div class="form-group"><label>Cuisse (cm)</label><input type="number" id="bf-cuisse" placeholder="Ex: 58"></div>
      <div class="form-group"><label>Hanches (cm)</label><input type="number" id="bf-hanches" placeholder="Ex: 90"></div>
      <div class="form-group"><label>Masse grasse (%)</label><input type="number" id="bf-mg" placeholder="Ex: 18" step="0.1"></div>
    </div>
    <button class="btn-primary" onclick="saveBodyEntry()"><i class="fa-solid fa-save"></i> Enregistrer</button>
  `;
  openModal();
}

function saveBodyEntry() {
  const entry={id:Date.now(),date:document.getElementById('bf-date').value,poids:document.getElementById('bf-poids').value,taille:document.getElementById('bf-taille').value,bras:document.getElementById('bf-bras').value,cuisse:document.getElementById('bf-cuisse').value,hanches:document.getElementById('bf-hanches').value,mg:document.getElementById('bf-mg').value};
  const entries=DB.getArr('body_'+CU.code); entries.push(entry); DB.set('body_'+CU.code,entries);
  CU.xp=(CU.xp||0)+15; saveCU(); checkBadges(CU);
  document.getElementById('tb-xp-val').textContent=(CU.xp||0)+' XP';
  closeModal(); renderBody(); showToast('Mesures enregistrées ! +15 XP','success');
}

function deleteBodyEntry(id) {
  DB.set('body_'+CU.code, DB.getArr('body_'+CU.code).filter(e=>e.id!==id));
  renderBody();
}

// ============================================================
// TRANSFORMATION
// ============================================================
function renderTransfo() {
  const entries=DB.getArr('transfo_'+CU.code).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const grid=document.getElementById('transfo-grid');
  if(!entries.length){grid.innerHTML='<div class="empty-state"><i class="fa-solid fa-camera"></i><p>Ajoute tes photos avant/après !</p></div>';return;}
  grid.innerHTML=entries.map(e=>`
    <div class="transfo-card">
      ${e.image?`<img src="${e.image}" class="transfo-img" alt="transformation">`:'<div class="transfo-img-placeholder">📸</div>'}
      <div class="transfo-body">
        <div class="transfo-date">${fmtDate(e.date)}</div>
        <div class="transfo-comment">${escHtml(e.comment||'')}</div>
        <button class="btn-danger btn-sm transfo-del" onclick="deleteTransfo(${e.id})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      </div>
    </div>`).join('');
}

function openTransfoForm() {
  document.getElementById('modal-content').innerHTML = `
    <h3 style="font-family:var(--font-d);font-size:18px;margin-bottom:20px">Nouvelle photo</h3>
    <div class="form-group"><label>Date</label><input type="date" id="tf-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Photo (depuis ton appareil)</label><input type="file" id="tf-img" accept="image/*"></div>
    <div class="form-group"><label>Commentaire</label><textarea id="tf-comment" placeholder="Ex: -4kg en 6 semaines, je me sens bien !"></textarea></div>
    <button class="btn-primary" onclick="saveTransfo()"><i class="fa-solid fa-save"></i> Enregistrer</button>
  `;
  openModal();
}

function saveTransfo() {
  const file=document.getElementById('tf-img').files[0];
  const date=document.getElementById('tf-date').value;
  const comment=document.getElementById('tf-comment').value.trim();
  if(file) {
    const r=new FileReader(); r.onload=e=>{
      const entries=DB.getArr('transfo_'+CU.code);
      entries.push({id:Date.now(),date,image:e.target.result,comment});
      DB.set('transfo_'+CU.code,entries);
      CU.xp=(CU.xp||0)+25; saveCU(); checkBadges(CU);
      document.getElementById('tb-xp-val').textContent=(CU.xp||0)+' XP';
      closeModal(); renderTransfo(); showToast('Photo enregistrée ! +25 XP 📸','success');
    }; r.readAsDataURL(file);
  } else {
    const entries=DB.getArr('transfo_'+CU.code);
    entries.push({id:Date.now(),date,image:null,comment});
    DB.set('transfo_'+CU.code,entries);
    closeModal(); renderTransfo(); showToast('Entrée ajoutée !','success');
  }
}

function deleteTransfo(id) {
  DB.set('transfo_'+CU.code, DB.getArr('transfo_'+CU.code).filter(e=>e.id!==id));
  renderTransfo();
}

// ============================================================
// TEMOIGNAGE
// ============================================================
function renderTemoignage() {
  const saved=DB.get('temoignage_'+CU.code);
  const cont=document.getElementById('temoignage-content');
  if(saved) {
    const stars='⭐'.repeat(saved.note);
    cont.innerHTML=`
      <div class="temo-display">
        <div class="td-stars">${stars}</div>
        <div class="td-field"><div class="td-label">Points forts</div><div class="td-val">${escHtml(saved.pointsForts)}</div></div>
        <div class="td-field"><div class="td-label">Résultats obtenus</div><div class="td-val">${escHtml(saved.resultats)}</div></div>
        <div class="td-field"><div class="td-label">Recommandation</div><div class="td-val">${escHtml(saved.reco)}</div></div>
        <button class="btn-secondary" style="margin-top:16px" onclick="renderTemoignageForm()"><i class="fa-solid fa-pen"></i> Modifier</button>
      </div>`;
  } else { renderTemoignageForm(); }
}

function renderTemoignageForm() {
  selectedRating=0;
  const cont=document.getElementById('temoignage-content');
  cont.innerHTML=`
    <div class="temoignage-form">
      <div class="tf-title">Partage ton expérience</div>
      <div class="tf-sub">Ton témoignage est visible uniquement par toi et Noah.</div>
      <div class="form-group"><label>Note globale</label>
        <div class="star-rating" id="star-rating">
          ${[1,2,3,4,5].map(i=>`<button class="star-btn" onclick="setRating(${i})" data-val="${i}">★</button>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Points forts du coaching</label><textarea id="tem-points" placeholder="Ce qui t'a le plus aidé, les points positifs..."></textarea></div>
      <div class="form-group"><label>Résultats obtenus</label><textarea id="tem-resultats" placeholder="Tes transformations physiques et mentales..."></textarea></div>
      <div class="form-group"><label>Recommanderais-tu ce coaching ?</label><textarea id="tem-reco" placeholder="Pourquoi oui ou non, à qui..."></textarea></div>
      <button class="btn-primary" onclick="saveTemoignage()"><i class="fa-solid fa-paper-plane"></i> Envoyer mon témoignage</button>
    </div>`;
}

function setRating(val) {
  selectedRating=val;
  document.querySelectorAll('.star-btn').forEach(b=>{ b.classList.toggle('active', parseInt(b.dataset.val)<=val); });
}

function saveTemoignage() {
  const data={note:selectedRating,pointsForts:document.getElementById('tem-points').value.trim(),resultats:document.getElementById('tem-resultats').value.trim(),reco:document.getElementById('tem-reco').value.trim(),createdAt:new Date().toISOString()};
  if(!data.note) { showToast('Donne une note !','error'); return; }
  DB.set('temoignage_'+CU.code, data);
  showToast('Témoignage enregistré ! Merci 🙏','success');
  renderTemoignage();
}

// ============================================================
// GLOSSAIRE
// ============================================================
function filterGlossaire(f,btn){activeGlosFilter=f;document.querySelectorAll('#section-glossaire .filter-tabs .ftab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderGlossaire();}

function renderGlossaire() {
  const q=(document.getElementById('glossaire-search')?.value||'').toLowerCase();
  let list=DB.getArr('glossaire');
  if(activeGlosFilter!=='all') list=list.filter(g=>g.cat===activeGlosFilter);
  if(q) list=list.filter(g=>g.term.toLowerCase().includes(q)||g.def.toLowerCase().includes(q));
  list.sort((a,b)=>a.term.localeCompare(b.term));
  const cont=document.getElementById('glossaire-list');
  if(!list.length){cont.innerHTML='<div class="empty-state"><i class="fa-solid fa-book"></i><p>Aucun terme.</p></div>';return;}
  cont.innerHTML=list.map(g=>`
    <div class="glos-item">
      <div class="glos-emoji">${g.emoji||'📖'}</div>
      <div>
        <div class="glos-term">${escHtml(g.term)}</div>
        <span class="glos-cat-tag">${g.cat}</span>
        <div class="glos-def">${escHtml(g.def)}</div>
      </div>
    </div>`).join('');
}

// ============================================================
// TIPS
// ============================================================
function filterTips(f,btn){activeTipsFilter=f;document.querySelectorAll('#section-tips .filter-tabs .ftab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderTips();}

function renderTips() {
  let list=DB.getArr('tips');
  if(activeTipsFilter!=='all') list=list.filter(t=>t.theme===activeTipsFilter);
  const grid=document.getElementById('tips-grid');
  if(!list.length){grid.innerHTML='<div class="empty-state"><i class="fa-solid fa-heart-pulse"></i><p>Aucun tip disponible.</p></div>';return;}
  grid.innerHTML=list.map(t=>`
    <div class="tip-card priority-${t.priority}">
      <div class="tip-header">
        <div class="tip-icon">${t.icon||'💡'}</div>
        <div><div class="tip-theme-tag">${t.theme}</div><div class="tip-title">${escHtml(t.title)}</div></div>
      </div>
      <div class="tip-content">${escHtml(t.content)}</div>
      ${t.besoin?`<div class="tip-besoin"><i class="fa-solid fa-bullseye"></i> Pour : ${escHtml(t.besoin)}</div>`:''}
    </div>`).join('');
}

// ============================================================
// FAQ
// ============================================================
function filterFAQ(f,btn){activeFAQFilter=f;document.querySelectorAll('#section-faq .filter-tabs .ftab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderFAQ();}

function renderFAQ() {
  const q=(document.getElementById('faq-search')?.value||'').toLowerCase();
  let list=DB.getArr('faq');
  if(activeFAQFilter!=='all') list=list.filter(f=>f.theme===activeFAQFilter);
  if(q) list=list.filter(f=>f.q.toLowerCase().includes(q)||f.a.toLowerCase().includes(q));
  const cont=document.getElementById('faq-list');
  if(!list.length){cont.innerHTML='<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>Aucune question.</p></div>';return;}
  cont.innerHTML=list.map(f=>`
    <div class="faq-item" onclick="toggleFAQ(this)">
      <div class="faq-question">
        <span>${escHtml(f.q)}</span>
        <span class="faq-cat-tag">${f.theme}</span>
        <i class="fa-solid fa-chevron-down faq-chevron"></i>
      </div>
      <div class="faq-answer">${escHtml(f.a)}</div>
    </div>`).join('');
}

function toggleFAQ(el) { el.classList.toggle('open'); }

// ============================================================
// ADMIN PAGE
// ============================================================
function showAdminPage() { showPage('admin'); bindAdminNav(); showAdminSection('adashboard'); }

function bindAdminNav() {
  document.querySelectorAll('#page-admin .nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); showAdminSection(el.dataset.asection); });
  });
}

function showAdminSection(name) {
  document.querySelectorAll('#page-admin .section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('#page-admin .nav-item').forEach(n=>n.classList.remove('active'));
  const sec=document.getElementById('section-'+name);
  if(sec) sec.classList.add('active');
  const nav=document.querySelector(`#page-admin .nav-item[data-asection="${name}"]`);
  if(nav) nav.classList.add('active');
  if(name==='adashboard') renderAdminDashboard();
  if(name==='amodules') renderAdminModules();
  if(name==='arepas') renderAdminRepas();
  if(name==='adefis') renderAdminDefis();
  if(name==='ainvites') renderAdminInvites();
  if(name==='amembers') renderAdminMembers();
  if(name==='acommunity') renderAdminCommunity();
  if(name==='aresources') renderAdminResources();
  if(name==='aglossaire') renderAdminGlossaire();
  if(name==='atips') renderAdminTips();
  if(name==='afaq') renderAdminFAQ();
  if(name==='amessage') { const m=DB.get('coach_message'); if(m) document.getElementById('coach-msg-input').value=m; }
}

function renderAdminDashboard() {
  const stats=[
    {i:'👥',v:DB.getArr('members').length,l:'Membres'},
    {i:'📚',v:DB.getArr('modules').length,l:'Modules'},
    {i:'🏆',v:DB.getArr('defis').length,l:'Défis'},
    {i:'✉️',v:DB.getArr('invites').filter(i=>!i.used).length,l:'Invitations en attente'},
    {i:'💬',v:DB.getArr('posts').length,l:'Posts'},
    {i:'🍽️',v:DB.getArr('repas').length,l:'Repas'},
    {i:'📖',v:DB.getArr('glossaire').length,l:'Termes glossaire'},
    {i:'⭐',v:DB.getArr('members').filter(m=>DB.get('temoignage_'+m.code)).length,l:'Témoignages'},
  ];
  document.getElementById('admin-dashboard-content').innerHTML = `
    <div class="section-title-row"><h2>Dashboard Admin</h2></div>
    <div class="dash-stats">${stats.map(s=>`<div class="dstat"><div class="dstat-icon">${s.i}</div><div class="dstat-val">${s.v}</div><div class="dstat-label">${s.l}</div></div>`).join('')}</div>
  `;
}

// ---- ADMIN MODULES ----
let editModId=null;
function saveModule() {
  const title=(document.getElementById('mod-title').value||'').trim();
  const icon=document.getElementById('mod-icon').value.trim()||'📚';
  const domain=document.getElementById('mod-domain').value;
  const desc=(document.getElementById('mod-desc').value||'').trim();
  if(!title){showToast('Titre requis','error');return;}
  const lessons=[];
  document.querySelectorAll('.lesson-field').forEach(el=>{
    const t=(el.querySelector('.lf-title')?.value||'').trim();
    if(!t) return;
    lessons.push({
      id:el.dataset.lid||('l'+Date.now()+Math.random()),
      title:t,
      duration:el.querySelector('.lf-duration')?.value.trim()||'',
      videoUrl:el.querySelector('.lf-video')?.value.trim()||'',
      content:el.querySelector('.lf-content')?.value.trim()||'',
      quiz:{question:el.querySelector('.lf-quiz-q')?.value.trim()||'',options:[el.querySelector('.lf-opt0')?.value.trim()||'',el.querySelector('.lf-opt1')?.value.trim()||'',el.querySelector('.lf-opt2')?.value.trim()||'',el.querySelector('.lf-opt3')?.value.trim()||''].filter(Boolean),correct:parseInt(el.querySelector('.lf-correct')?.value||0)}
    });
  });
  const modules=DB.getArr('modules');
  if(editModId) { const i=modules.findIndex(m=>m.id===editModId); if(i>=0) modules[i]={...modules[i],title,icon,domain,desc,lessons}; showToast('Module mis à jour ✅','success'); }
  else { modules.push({id:Date.now(),title,icon,domain,desc,lessons}); showToast('Module créé ✅','success'); }
  DB.set('modules',modules); cancelModEdit(); renderAdminModules();
}

function addLessonField(lesson=null) {
  const c=document.getElementById('lessons-container');
  const idx=c.children.length+1;
  const id=lesson?lesson.id:('l'+Date.now()+Math.random());
  const div=document.createElement('div'); div.className='lesson-field'; div.dataset.lid=id;
  div.innerHTML=`
    <div class="lf-header"><span>Leçon ${idx}</span><button onclick="this.closest('.lesson-field').remove();renumLesson()"><i class="fa-solid fa-trash"></i></button></div>
    <input type="text" class="lf-title" placeholder="Titre de la leçon" value="${lesson?escAttr(lesson.title):''}">
    <input type="text" class="lf-duration" placeholder="Durée (ex: 5 min)" value="${lesson?escAttr(lesson.duration||''):''}">
    <input type="text" class="lf-video" placeholder="URL vidéo YouTube embed (optionnel)" value="${lesson?escAttr(lesson.videoUrl||''):''}">
    <textarea class="lf-content" placeholder="Contenu texte de la leçon...">${lesson?lesson.content||'':''}</textarea>
    <div class="quiz-builder">
      <div class="qb-label">Quiz (optionnel)</div>
      <input type="text" class="lf-quiz-q" placeholder="Question du quiz" value="${lesson&&lesson.quiz?escAttr(lesson.quiz.question||''):''}">
      ${[0,1,2,3].map(i=>`<input type="text" class="lf-opt${i}" placeholder="Option ${i+1}" value="${lesson&&lesson.quiz&&lesson.quiz.options?escAttr(lesson.quiz.options[i]||''):''}"> `).join('')}
      <select class="lf-correct">
        ${[0,1,2,3].map(i=>`<option value="${i}" ${lesson&&lesson.quiz&&lesson.quiz.correct===i?'selected':''}>Bonne réponse : option ${i+1}</option>`).join('')}
      </select>
    </div>`;
  c.appendChild(div);
}

function renumLesson(){document.querySelectorAll('.lesson-field').forEach((el,i)=>{const s=el.querySelector('.lf-header span');if(s)s.textContent='Leçon '+(i+1);});}

function cancelModEdit(){editModId=null;document.getElementById('mod-title').value='';document.getElementById('mod-icon').value='';document.getElementById('mod-desc').value='';document.getElementById('lessons-container').innerHTML='';document.getElementById('module-form-title').textContent='Nouveau module';document.getElementById('save-mod-txt').textContent='Créer';document.getElementById('cancel-mod-btn').style.display='none';}

function editModule(id){const m=DB.getArr('modules').find(x=>x.id===id);if(!m)return;editModId=id;document.getElementById('mod-title').value=m.title;document.getElementById('mod-icon').value=m.icon;document.getElementById('mod-domain').value=m.domain;document.getElementById('mod-desc').value=m.desc||'';document.getElementById('lessons-container').innerHTML='';m.lessons.forEach(l=>addLessonField(l));document.getElementById('module-form-title').textContent='Modifier le module';document.getElementById('save-mod-txt').textContent='Enregistrer';document.getElementById('cancel-mod-btn').style.display='inline-flex';window.scrollTo({top:0,behavior:'smooth'});}

function deleteModule(id){if(!confirm('Supprimer ce module ?'))return;DB.set('modules',DB.getArr('modules').filter(m=>m.id!==id));renderAdminModules();showToast('Supprimé');}

function renderAdminModules(){
  const list=document.getElementById('admin-modules-list');
  const mods=DB.getArr('modules');
  if(!mods.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-graduation-cap"></i><p>Aucun module.</p></div>';return;}
  list.innerHTML=mods.map(m=>`
    <div class="admin-list-item">
      <div class="ali-icon">${m.icon||'📚'}</div>
      <div><div class="ali-title">${escHtml(m.title)}</div><div class="ali-meta">${m.domain} · ${m.lessons.length} leçons</div></div>
      <div class="ali-actions"><button class="btn-edit-s" onclick="editModule(${m.id})"><i class="fa-solid fa-pen"></i></button><button class="btn-danger" onclick="deleteModule(${m.id})"><i class="fa-solid fa-trash"></i></button></div>
    </div>`).join('');
}

// ---- ADMIN REPAS ----
function saveRepas(){const nom=(document.getElementById('repas-nom').value||'').trim();if(!nom){showToast('Nom requis','error');return;}const list=DB.getArr('repas');list.push({id:Date.now(),nom,cat:document.getElementById('repas-cat').value,cal:document.getElementById('repas-cal').value||0,prot:document.getElementById('repas-prot').value||0,gluc:document.getElementById('repas-gluc').value||0,lip:document.getElementById('repas-lip').value||0,photo:document.getElementById('repas-photo').value.trim(),desc:(document.getElementById('repas-desc').value||'').trim()});DB.set('repas',list);['repas-nom','repas-cal','repas-prot','repas-gluc','repas-lip','repas-photo','repas-desc'].forEach(id=>{document.getElementById(id).value='';});showToast('Repas ajouté ✅','success');renderAdminRepas();}

function deleteRepas(id){DB.set('repas',DB.getArr('repas').filter(r=>r.id!==id));renderAdminRepas();showToast('Supprimé');}

function renderAdminRepas(){const list=document.getElementById('admin-repas-list');const data=DB.getArr('repas');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-utensils"></i><p>Aucun repas.</p></div>';return;}list.innerHTML=data.map(r=>`<div class="admin-list-item"><div class="ali-icon">🍽️</div><div><div class="ali-title">${escHtml(r.nom)}</div><div class="ali-meta">${r.cat} · ${r.cal} kcal · P:${r.prot}g G:${r.gluc}g L:${r.lip}g</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteRepas(${r.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- ADMIN DEFIS ----
function saveDefi(){const title=(document.getElementById('defi-title').value||'').trim();if(!title){showToast('Titre requis','error');return;}const list=DB.getArr('defis');list.push({id:Date.now(),title,type:document.getElementById('defi-type').value,xp:document.getElementById('defi-xp').value||50,icon:document.getElementById('defi-icon').value.trim()||'🏆',desc:(document.getElementById('defi-desc').value||'').trim()});DB.set('defis',list);['defi-title','defi-xp','defi-icon','defi-desc'].forEach(id=>{document.getElementById(id).value='';});showToast('Défi créé ✅','success');renderAdminDefis();}

function deleteDefi(id){DB.set('defis',DB.getArr('defis').filter(d=>d.id!==id));renderAdminDefis();showToast('Supprimé');}

function renderAdminDefis(){const list=document.getElementById('admin-defis-list');const data=DB.getArr('defis');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>Aucun défi.</p></div>';return;}list.innerHTML=data.map(d=>`<div class="admin-list-item"><div class="ali-icon">${d.icon||'🏆'}</div><div><div class="ali-title">${escHtml(d.title)}</div><div class="ali-meta">${d.type} · +${d.xp} XP</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteDefi(${d.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- ADMIN INVITES ----
function generateInvite(){const name=(document.getElementById('inv-name').value||'').trim();if(!name){showToast('Prénom requis','error');return;}const code='NC-'+rndStr(4)+'-'+rndStr(4);const list=DB.getArr('invites');list.push({code,name,note:(document.getElementById('inv-note').value||'').trim(),used:false,createdAt:new Date().toISOString()});DB.set('invites',list);document.getElementById('invite-result').innerHTML=`<div class="invite-result-box"><div style="font-size:13px;color:var(--green);margin-bottom:8px">Code pour <strong>${escHtml(name)}</strong></div><div class="irb-code">${code}</div><button class="btn-copy" onclick="copyText('${code}')"><i class="fa-solid fa-copy"></i> Copier</button></div>`;document.getElementById('inv-name').value='';document.getElementById('inv-note').value='';renderAdminInvites();}

function copyText(t){navigator.clipboard.writeText(t).then(()=>showToast('Copié ! 📋','success'));}

function deleteInvite(code){DB.set('invites',DB.getArr('invites').filter(i=>i.code!==code));renderAdminInvites();showToast('Supprimé');}

function renderAdminInvites(){const list=document.getElementById('invites-list');const data=DB.getArr('invites').slice().reverse();if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-envelope"></i><p>Aucun code.</p></div>';return;}list.innerHTML=data.map(i=>`<div class="invite-item"><div><div class="ii-code">${i.code}</div><div style="font-size:11px;color:var(--text3)">${escHtml(i.note||'')}</div></div><div style="font-size:14px;font-weight:500">${escHtml(i.name)}</div><span class="ii-status ${i.used?'ii-used':'ii-unused'}">${i.used?'✅ '+escHtml(i.usedBy||i.name):'⏳ En attente'}</span><button class="btn-danger btn-sm" onclick="deleteInvite('${i.code}')"><i class="fa-solid fa-trash"></i></button></div>`).join('');}

// ---- ADMIN MEMBERS ----
function renderAdminMembers(){const list=document.getElementById('members-list');const data=DB.getArr('members');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-users"></i><p>Aucun membre.</p></div>';return;}list.innerHTML=data.map(m=>{const lv=getLevel(m.xp||0);const temo=DB.get('temoignage_'+m.code);const bodyCount=DB.getArr('body_'+m.code).length;const transfoCount=DB.getArr('transfo_'+m.code).length;return`<div class="member-admin-card"><div class="mac-header"><div class="mac-av">${initials(m.name)}</div><div><div class="mac-name">${escHtml(m.name)}</div><div class="mac-meta">Depuis le ${fmtDate(m.joinedAt)} · Code: ${m.code}</div></div></div><div class="mac-stats"><div class="mac-stat"><strong>${m.xp||0}</strong> XP · ${lv.name}</div><div class="mac-stat"><strong>${(m.completedLessons||[]).length}</strong> leçons</div><div class="mac-stat"><strong>${(m.completedDefis||[]).length}</strong> défis</div><div class="mac-stat"><strong>${bodyCount}</strong> mesures</div><div class="mac-stat"><strong>${transfoCount}</strong> photos transfo</div></div>${temo?`<div style="margin-top:10px;font-size:13px;background:var(--gold-light);padding:8px 12px;border-radius:8px;color:var(--gold)"><strong>Témoignage :</strong> ${'⭐'.repeat(temo.note)} — ${escHtml(temo.pointsForts?.slice(0,80)||'')}</div>`:''}</div>`}).join('');}

// ---- ADMIN COMMUNITY ----
function renderAdminCommunity(){const list=document.getElementById('admin-posts-list');const data=DB.getArr('posts').slice().reverse();if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-comments"></i><p>Aucun post.</p></div>';return;}list.innerHTML=data.map(p=>`<div class="admin-list-item"><div><div class="ali-title">${escHtml(p.author)}</div><div class="ali-meta">${escHtml(p.body?.slice(0,80)||'')}... · ${timeAgo(p.createdAt)}</div></div><div class="ali-actions"><button class="btn-edit-s btn-sm" onclick="adminPinPost(${p.id})">${p.pinned?'Désépingler':'📌 Épingler'}</button><button class="btn-danger btn-sm" onclick="adminDeletePost(${p.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

function adminPinPost(id){const posts=DB.getArr('posts');const p=posts.find(x=>x.id===id);if(p){p.pinned=!p.pinned;DB.set('posts',posts);renderAdminCommunity();showToast(p.pinned?'Post épinglé 📌':'Post désépinglé');}}
function adminDeletePost(id){DB.set('posts',DB.getArr('posts').filter(p=>p.id!==id));renderAdminCommunity();showToast('Supprimé');}

// ---- ADMIN RESOURCES ----
function saveResource(){const title=(document.getElementById('res-title').value||'').trim();const url=(document.getElementById('res-url').value||'').trim();if(!title||!url){showToast('Titre et URL requis','error');return;}const list=DB.getArr('resources');list.push({id:Date.now(),title,type:document.getElementById('res-type').value,cat:document.getElementById('res-cat').value,url,desc:(document.getElementById('res-desc').value||'').trim()});DB.set('resources',list);['res-title','res-url','res-desc'].forEach(id=>{document.getElementById(id).value='';});showToast('Ressource ajoutée ✅','success');renderAdminResources();}

function deleteResource(id){DB.set('resources',DB.getArr('resources').filter(r=>r.id!==id));renderAdminResources();showToast('Supprimé');}

function renderAdminResources(){const list=document.getElementById('admin-resources-list');const data=DB.getArr('resources');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Aucune ressource.</p></div>';return;}list.innerHTML=data.map(r=>`<div class="admin-list-item"><div class="ali-icon">${{pdf:'📄',video:'🎥',excel:'📊',link:'🔗'}[r.type]||'📎'}</div><div><div class="ali-title">${escHtml(r.title)}</div><div class="ali-meta">${r.cat} · ${r.type}</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteResource(${r.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- ADMIN GLOSSAIRE ----
function saveGlossTerm(){const term=(document.getElementById('glos-term').value||'').trim();const def=(document.getElementById('glos-def').value||'').trim();if(!term||!def){showToast('Terme et définition requis','error');return;}const list=DB.getArr('glossaire');list.push({id:Date.now(),term,cat:document.getElementById('glos-cat').value,emoji:document.getElementById('glos-emoji').value.trim()||'📖',def});DB.set('glossaire',list);['glos-term','glos-emoji','glos-def'].forEach(id=>{document.getElementById(id).value='';});showToast('Terme ajouté ✅','success');renderAdminGlossaire();}

function deleteGlossTerm(id){DB.set('glossaire',DB.getArr('glossaire').filter(g=>g.id!==id));renderAdminGlossaire();showToast('Supprimé');}

function renderAdminGlossaire(){const list=document.getElementById('admin-glossaire-list');const data=DB.getArr('glossaire');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-book"></i><p>Aucun terme.</p></div>';return;}list.innerHTML=data.map(g=>`<div class="admin-list-item"><div class="ali-icon">${g.emoji||'📖'}</div><div><div class="ali-title">${escHtml(g.term)}</div><div class="ali-meta">${g.cat} · ${escHtml(g.def?.slice(0,60))}...</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteGlossTerm(${g.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- ADMIN TIPS ----
function saveTip(){const title=(document.getElementById('tip-title').value||'').trim();const content=(document.getElementById('tip-content').value||'').trim();if(!title||!content){showToast('Titre et contenu requis','error');return;}const list=DB.getArr('tips');list.push({id:Date.now(),title,theme:document.getElementById('tip-theme').value,icon:document.getElementById('tip-icon').value.trim()||'💡',priority:document.getElementById('tip-priority').value,content,besoin:(document.getElementById('tip-besoin').value||'').trim()});DB.set('tips',list);['tip-title','tip-icon','tip-content','tip-besoin'].forEach(id=>{document.getElementById(id).value='';});showToast('Tip ajouté ✅','success');renderAdminTips();}

function deleteTip(id){DB.set('tips',DB.getArr('tips').filter(t=>t.id!==id));renderAdminTips();showToast('Supprimé');}

function renderAdminTips(){const list=document.getElementById('admin-tips-list');const data=DB.getArr('tips');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-heart-pulse"></i><p>Aucun tip.</p></div>';return;}list.innerHTML=data.map(t=>`<div class="admin-list-item"><div class="ali-icon">${t.icon||'💡'}</div><div><div class="ali-title">${escHtml(t.title)}</div><div class="ali-meta">${t.theme} · Priorité ${t.priority}</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteTip(${t.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- ADMIN FAQ ----
function saveFAQ(){const q=(document.getElementById('faq-q').value||'').trim();const a=(document.getElementById('faq-a').value||'').trim();if(!q||!a){showToast('Question et réponse requises','error');return;}const list=DB.getArr('faq');list.push({id:Date.now(),q,theme:document.getElementById('faq-theme').value,a});DB.set('faq',list);['faq-q','faq-a'].forEach(id=>{document.getElementById(id).value='';});showToast('Question ajoutée ✅','success');renderAdminFAQ();}

function deleteFAQ(id){DB.set('faq',DB.getArr('faq').filter(f=>f.id!==id));renderAdminFAQ();showToast('Supprimé');}

function renderAdminFAQ(){const list=document.getElementById('admin-faq-list');const data=DB.getArr('faq');if(!data.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>Aucune question.</p></div>';return;}list.innerHTML=data.map(f=>`<div class="admin-list-item"><div class="ali-icon">❓</div><div><div class="ali-title">${escHtml(f.q)}</div><div class="ali-meta">${f.theme}</div></div><div class="ali-actions"><button class="btn-danger" onclick="deleteFAQ(${f.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');}

// ---- COACH MESSAGE ----
function saveCoachMessage(){const msg=(document.getElementById('coach-msg-input').value||'').trim();DB.set('coach_message',msg);document.getElementById('msg-saved').textContent='✅ Message envoyé à tous les membres !';setTimeout(()=>{document.getElementById('msg-saved').textContent='';},3000);showToast('Message envoyé ✅','success');}

// ============================================================
// MODAL / TOAST / UTILS
// ============================================================
function openModal(){document.getElementById('modal-overlay').classList.add('active');}
function closeModal(){document.getElementById('modal-overlay').classList.remove('active');}
function showToast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3200);}
function initials(name){return(name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){if(!s)return'';return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function timeAgo(iso){const d=Date.now()-new Date(iso).getTime();const m=Math.floor(d/60000);if(m<1)return'À l\'instant';if(m<60)return`Il y a ${m} min`;const h=Math.floor(m/60);if(h<24)return`Il y a ${h}h`;const j=Math.floor(h/24);return`Il y a ${j}j`;}
function fmtDate(iso){if(!iso)return'';try{return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return iso;}}
function rndStr(n){return Math.random().toString(36).substring(2,2+n).toUpperCase();}

// Enter key login
document.addEventListener('keypress',e=>{if(e.key==='Enter'&&document.getElementById('page-login').classList.contains('active'))handleLogin();});

// Safety: also bind button directly after DOM ready
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.querySelector('.btn-login');
  if(btn) btn.addEventListener('click', handleLogin);
  const s = DB.get('session');
  if(s && !CU) { CU = s; s.isAdmin ? showAdminPage() : showMemberPage(); }
});
