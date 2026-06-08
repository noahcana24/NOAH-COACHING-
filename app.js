// ===================== STATE =====================
const ADMIN_CODE = 'NOAHCANA-ADMIN';
let currentUser = null;
let selectedColor = 'blue';
let pendingPostImage = null;
let editingModuleId = null;

const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem('nc_' + key)) || null; } catch { return null; } },
  set: (key, val) => localStorage.setItem('nc_' + key, JSON.stringify(val)),
  getArr: (key) => { try { return JSON.parse(localStorage.getItem('nc_' + key)) || []; } catch { return []; } },
};

// ===================== INIT =====================
window.onload = () => {
  const saved = DB.get('session');
  if (saved) {
    currentUser = saved;
    if (currentUser.isAdmin) showAdminPage();
    else showMemberPage();
  }
};

// ===================== AUTH =====================
function handleLogin() {
  const code = document.getElementById('invite-code').value.trim().toUpperCase();
  const name = document.getElementById('member-name').value.trim();
  const err = document.getElementById('login-error');

  if (!name) { err.textContent = 'Entre ton prénom'; return; }
  if (!code) { err.textContent = 'Entre ton code d\'invitation'; return; }

  // Admin
  if (code === ADMIN_CODE) {
    currentUser = { name: 'Noah Cana', isAdmin: true };
    DB.set('session', currentUser);
    err.textContent = '';
    showAdminPage();
    return;
  }

  // Check invite codes
  const invites = DB.getArr('invites');
  const invite = invites.find(i => i.code === code);
  if (!invite) { err.textContent = 'Code invalide. Vérifie le code reçu.'; return; }

  // Mark as used & register member
  invite.used = true;
  invite.usedBy = name;
  invite.usedAt = new Date().toISOString();
  DB.set('invites', invites);

  // Register member
  const members = DB.getArr('members');
  let member = members.find(m => m.code === code);
  if (!member) {
    member = { id: Date.now(), name, code, joinedAt: new Date().toISOString(), completedLessons: [], posts: 0, lastSeen: new Date().toISOString() };
    members.push(member);
    DB.set('members', members);
  }

  currentUser = { ...member, isAdmin: false };
  DB.set('session', currentUser);
  err.textContent = '';
  showMemberPage();
}

function logout() {
  DB.set('session', null);
  currentUser = null;
  showPage('login');
  document.getElementById('invite-code').value = '';
  document.getElementById('member-name').value = '';
  document.getElementById('login-error').textContent = '';
}

// ===================== PAGES =====================
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
}

function showMemberPage() {
  showPage('member');
  updateMemberNav();
  showSection('home');
}

function showAdminPage() {
  showPage('admin');
  showAdminSection('dashboard');
}

// ===================== SIDEBAR =====================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===================== MEMBER SECTIONS =====================
function showSection(name) {
  document.querySelectorAll('#page-member .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#page-member .nav-link').forEach(l => l.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  const links = { home: 0, modules: 1, community: 2, resources: 3, progress: 4 };
  const navLinks = document.querySelectorAll('#page-member .nav-link');
  if (links[name] !== undefined && navLinks[links[name]]) navLinks[links[name]].classList.add('active');

  if (name === 'modules') renderModules();
  if (name === 'community') renderCommunity();
  if (name === 'resources') renderResources();
  if (name === 'progress') renderProgress();
  if (name === 'home') renderHome();

  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
}

function updateMemberNav() {
  const name = currentUser?.name || 'Membre';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('nav-av').textContent = initials;
  document.getElementById('nav-name').textContent = name;
  document.getElementById('topbar-name').textContent = 'Bonjour ' + name.split(' ')[0] + ' 👋';
  document.getElementById('composer-av').textContent = initials;
  const modules = DB.getArr('modules');
  document.getElementById('nav-module-count').textContent = modules.length;
  const posts = DB.getArr('posts');
  document.getElementById('nav-post-count').textContent = posts.length;
}

// ===================== HOME =====================
function renderHome() {
  const modules = DB.getArr('modules');
  const posts = DB.getArr('posts');
  const completed = currentUser?.completedLessons?.length || 0;

  document.getElementById('welcome-title').textContent = 'Prêt à transformer ton physique, ' + (currentUser?.name?.split(' ')[0] || '') + ' ?';
  document.getElementById('hs-modules').textContent = modules.length;
  document.getElementById('hs-completed').textContent = completed;
  document.getElementById('hs-posts').textContent = posts.length;

  // Continue card
  const cont = document.getElementById('continue-section');
  const inProgress = modules.find(m => {
    const done = m.lessons.filter(l => currentUser?.completedLessons?.includes(m.id + '-' + l.id)).length;
    return done > 0 && done < m.lessons.length;
  });
  if (inProgress) {
    const done = inProgress.lessons.filter(l => currentUser?.completedLessons?.includes(inProgress.id + '-' + l.id)).length;
    cont.innerHTML = `
      <div class="home-card" onclick="viewModule(${inProgress.id})" style="margin-bottom:0; background: var(--dark); border-color: transparent;">
        <div class="hcard-icon ${inProgress.color}" style="background:rgba(255,255,255,0.1); color:#fff; font-size:22px;">${inProgress.icon}</div>
        <div>
          <div class="hcard-title" style="color:#fff">Continuer : ${inProgress.title}</div>
          <div class="hcard-sub" style="color:rgba(255,255,255,0.5)">${done} / ${inProgress.lessons.length} leçons complétées</div>
        </div>
        <i class="fa-solid fa-chevron-right hcard-arrow" style="color:rgba(255,255,255,0.4)"></i>
      </div>
    `;
  } else cont.innerHTML = '';
}

// ===================== MODULES =====================
function renderModules() {
  const modules = DB.getArr('modules');
  const grid = document.getElementById('modules-grid');
  if (!modules.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>Aucun module disponible pour l\'instant.<br>Reviens bientôt !</p></div>';
    return;
  }
  grid.innerHTML = modules.map(m => {
    const completed = m.lessons.filter(l => currentUser?.completedLessons?.includes(m.id + '-' + l.id)).length;
    const total = m.lessons.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return `
      <div class="module-card" onclick="viewModule(${m.id})">
        <div class="module-card-top ${m.color}">${m.icon}</div>
        <div class="module-card-body">
          <div class="module-card-title">${m.title}</div>
          <div class="module-card-desc">${m.desc}</div>
          <div class="module-progress">
            <div class="module-progress-bar"><div class="module-progress-fill fill-${m.color}" style="width:${pct}%"></div></div>
            <div class="module-progress-text">${completed} / ${total} leçons — ${pct}%</div>
          </div>
        </div>
        <div class="module-card-footer">
          <span><i class="fa-solid fa-book-open"></i> ${total} leçon${total > 1 ? 's' : ''}</span>
          <span class="module-start-btn">${pct === 0 ? 'Commencer' : pct === 100 ? '✅ Terminé' : 'Continuer'} <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </div>
    `;
  }).join('');
}

function viewModule(id) {
  const modules = DB.getArr('modules');
  const m = modules.find(x => x.id === id);
  if (!m) return;
  showSection('module-detail');
  const completed = m.lessons.filter(l => currentUser?.completedLessons?.includes(m.id + '-' + l.id)).length;
  document.getElementById('module-detail-content').innerHTML = `
    <div class="mod-detail-header">
      <div class="mod-detail-icon">${m.icon}</div>
      <div>
        <div class="mod-detail-title">${m.title}</div>
        <div class="mod-detail-desc">${m.desc} — ${completed}/${m.lessons.length} leçons complétées</div>
      </div>
    </div>
    <div class="lessons-list">
      ${m.lessons.map((l, i) => {
        const isDone = currentUser?.completedLessons?.includes(m.id + '-' + l.id);
        return `
          <div class="lesson-item" onclick="openLesson(${m.id}, '${l.id}')">
            <div class="lesson-num ${isDone ? 'done' : ''}">${isDone ? '<i class="fa-solid fa-check"></i>' : i + 1}</div>
            <div>
              <div class="lesson-title">${l.title}</div>
              ${l.duration ? `<div class="lesson-content-preview"><i class="fa-regular fa-clock"></i> ${l.duration}</div>` : ''}
            </div>
            <span class="lesson-duration">${isDone ? '✅' : '<i class="fa-solid fa-play"></i>'}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
  // Update nav highlight
  document.querySelectorAll('#page-member .nav-link').forEach((l, i) => {
    l.classList.toggle('active', i === 1);
  });
}

function openLesson(moduleId, lessonId) {
  const modules = DB.getArr('modules');
  const m = modules.find(x => x.id === moduleId);
  if (!m) return;
  const l = m.lessons.find(x => x.id === lessonId);
  if (!l) return;
  const isDone = currentUser?.completedLessons?.includes(m.id + '-' + l.id);
  const videoHtml = l.videoUrl ? `<iframe class="lesson-video" style="height:240px; border:0;" src="${l.videoUrl}" allowfullscreen></iframe>` : '';
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="lesson-modal">
      <h3>${l.title}</h3>
      ${videoHtml}
      <div class="lesson-modal-content">${l.content || 'Contenu de la leçon à venir.'}</div>
      <button class="lesson-btn-done ${isDone ? 'already' : ''}" onclick="toggleLessonDone(${moduleId}, '${lessonId}')">
        ${isDone ? '<i class="fa-solid fa-rotate-left"></i> Marquer comme non complété' : '<i class="fa-solid fa-check"></i> Marquer comme complété'}
      </button>
    </div>
  `;
  openModal();
}

function toggleLessonDone(moduleId, lessonId) {
  const key = moduleId + '-' + lessonId;
  if (!currentUser.completedLessons) currentUser.completedLessons = [];
  const idx = currentUser.completedLessons.indexOf(key);
  if (idx >= 0) currentUser.completedLessons.splice(idx, 1);
  else currentUser.completedLessons.push(key);

  // Update in members list
  const members = DB.getArr('members');
  const mi = members.findIndex(m => m.code === currentUser.code);
  if (mi >= 0) { members[mi].completedLessons = currentUser.completedLessons; DB.set('members', members); }
  DB.set('session', currentUser);

  showToast(idx >= 0 ? 'Leçon marquée comme non complétée' : '✅ Leçon complétée !', 'success');
  closeModal();
  viewModule(moduleId);
}

// ===================== COMMUNITY =====================
function renderCommunity() {
  const posts = DB.getArr('posts');
  const feed = document.getElementById('posts-feed');
  if (!posts.length) {
    feed.innerHTML = '<div class="empty-state"><i class="fa-solid fa-comments"></i><p>Sois le premier à poster !</p></div>';
    return;
  }
  feed.innerHTML = posts.slice().reverse().map(p => {
    const initials = p.author.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#185FA5', '#3B6D11', '#854F0B', '#993C1D', '#534AB7'];
    const col = colors[p.authorId % colors.length];
    const liked = p.likedBy && p.likedBy.includes(currentUser?.code);
    const isOwn = p.authorCode === currentUser?.code || currentUser?.isAdmin;
    return `
      <div class="post-card" id="post-${p.id}">
        <div class="post-header">
          <div class="post-av" style="background:${col}20; color:${col}">${initials}</div>
          <div>
            <div class="post-author">${p.author}</div>
            <div class="post-time">${timeAgo(p.createdAt)}</div>
          </div>
        </div>
        <div class="post-body">${escapeHtml(p.body)}</div>
        ${p.image ? `<img src="${p.image}" class="post-image" alt="photo">` : ''}
        <div class="post-actions">
          <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="likePost(${p.id})">
            <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i> ${p.likes || 0}
          </button>
          ${isOwn ? `<button class="post-action-btn post-delete-btn" onclick="deletePost(${p.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function submitPost() {
  const text = document.getElementById('post-input').value.trim();
  if (!text && !pendingPostImage) return;
  const posts = DB.getArr('posts');
  const post = {
    id: Date.now(),
    author: currentUser.name,
    authorCode: currentUser.code,
    authorId: currentUser.id || 0,
    body: text,
    image: pendingPostImage || null,
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: []
  };
  posts.push(post);
  DB.set('posts', posts);
  document.getElementById('post-input').value = '';
  pendingPostImage = null;
  document.getElementById('post-image-preview').innerHTML = '';

  // Update member post count
  const members = DB.getArr('members');
  const mi = members.findIndex(m => m.code === currentUser.code);
  if (mi >= 0) { members[mi].posts = (members[mi].posts || 0) + 1; DB.set('members', members); }

  showToast('Post publié ! 🔥', 'success');
  renderCommunity();
  document.getElementById('nav-post-count').textContent = posts.length;
}

function handlePostImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingPostImage = e.target.result;
    document.getElementById('post-image-preview').innerHTML = `<img src="${e.target.result}" style="max-height:60px; border-radius:6px;">`;
  };
  reader.readAsDataURL(file);
}

function likePost(id) {
  const posts = DB.getArr('posts');
  const p = posts.find(x => x.id === id);
  if (!p) return;
  if (!p.likedBy) p.likedBy = [];
  const idx = p.likedBy.indexOf(currentUser?.code);
  if (idx >= 0) { p.likedBy.splice(idx, 1); p.likes = Math.max(0, (p.likes || 1) - 1); }
  else { p.likedBy.push(currentUser?.code); p.likes = (p.likes || 0) + 1; }
  DB.set('posts', posts);
  renderCommunity();
}

function deletePost(id) {
  let posts = DB.getArr('posts');
  posts = posts.filter(p => p.id !== id);
  DB.set('posts', posts);
  renderCommunity();
  showToast('Post supprimé');
}

// ===================== RESOURCES =====================
function renderResources() {
  const resources = DB.getArr('resources');
  const grid = document.getElementById('resources-grid');
  if (!resources.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Aucune ressource disponible.<br>Bientôt disponible !</p></div>';
    return;
  }
  const icons = { pdf: '📄', excel: '📊', video: '🎥', link: '🔗' };
  grid.innerHTML = resources.map(r => `
    <div class="resource-card">
      <div class="res-icon ${r.type}">${icons[r.type] || '📎'}</div>
      <div>
        <div class="res-title">${r.title}</div>
        <div class="res-desc">${r.desc || ''}</div>
        <a href="${r.url}" target="_blank" class="res-download"><i class="fa-solid fa-arrow-down"></i> Télécharger / Ouvrir</a>
      </div>
    </div>
  `).join('');
}

// ===================== PROGRESS =====================
function renderProgress() {
  const modules = DB.getArr('modules');
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = currentUser?.completedLessons?.length || 0;
  const pct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const posts = DB.getArr('posts').filter(p => p.authorCode === currentUser?.code).length;

  document.getElementById('pg-modules').textContent = `${completedLessons} / ${totalLessons}`;
  document.getElementById('pg-bar').style.width = pct + '%';
  document.getElementById('pg-posts').textContent = posts;

  renderWeightEntries();
}

function addWeightEntry() {
  const form = document.getElementById('wt-form');
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('wt-date').value = today;
}

function saveWeight() {
  const val = parseFloat(document.getElementById('wt-input').value);
  const date = document.getElementById('wt-date').value;
  if (!val || !date) return;
  const entries = DB.getArr('weight_' + (currentUser?.code || 'guest'));
  entries.push({ val, date, id: Date.now() });
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  DB.set('weight_' + (currentUser?.code || 'guest'), entries);
  document.getElementById('wt-form').style.display = 'none';
  document.getElementById('wt-input').value = '';
  renderWeightEntries();
  showToast('Poids enregistré ✅', 'success');
}

function renderWeightEntries() {
  const entries = DB.getArr('weight_' + (currentUser?.code || 'guest'));
  const container = document.getElementById('wt-entries');
  if (!entries.length) {
    container.innerHTML = '<p class="wt-empty">Aucune donnée. Commence à tracker ton poids !</p>';
    return;
  }
  container.innerHTML = entries.map(e => `
    <div class="wt-entry">
      <span class="wt-val">${e.val} kg</span>
      <span class="wt-date">${formatDate(e.date)}</span>
      <button class="wt-del" onclick="deleteWeight(${e.id})"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');
}

function deleteWeight(id) {
  let entries = DB.getArr('weight_' + (currentUser?.code || 'guest'));
  entries = entries.filter(e => e.id !== id);
  DB.set('weight_' + (currentUser?.code || 'guest'), entries);
  renderWeightEntries();
}

// ===================== ADMIN SECTIONS =====================
function showAdminSection(name) {
  document.querySelectorAll('#page-admin .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#page-admin .nav-link').forEach(l => l.classList.remove('active'));
  const sec = document.getElementById('admin-section-' + name);
  if (sec) sec.classList.add('active');
  const links = { dashboard: 0, modules: 1, invites: 2, members: 3, resources: 4, community: 5 };
  const navLinks = document.querySelectorAll('#page-admin .nav-link');
  if (links[name] !== undefined && navLinks[links[name]]) navLinks[links[name]].classList.add('active');

  if (name === 'dashboard') renderAdminDashboard();
  if (name === 'modules') renderAdminModules();
  if (name === 'invites') renderAdminInvites();
  if (name === 'members') renderAdminMembers();
  if (name === 'resources') renderAdminResources();
  if (name === 'community') renderAdminCommunity();
}

function renderAdminDashboard() {
  const modules = DB.getArr('modules');
  const invites = DB.getArr('invites');
  const members = DB.getArr('members');
  const posts = DB.getArr('posts');
  const resources = DB.getArr('resources');
  document.getElementById('admin-stats').innerHTML = [
    { n: members.length, l: 'Membres actifs', i: '👥' },
    { n: modules.length, l: 'Modules', i: '📚' },
    { n: invites.filter(i => !i.used).length, l: 'Invitations en attente', i: '✉️' },
    { n: posts.length, l: 'Posts communauté', i: '💬' },
    { n: resources.length, l: 'Ressources', i: '📁' },
  ].map(s => `
    <div class="astat">
      <div class="astat-icon">${s.i}</div>
      <div class="astat-n">${s.n}</div>
      <div class="astat-l">${s.l}</div>
    </div>
  `).join('');
}

// ===================== ADMIN MODULES =====================
function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.cp-opt').forEach(el => el.classList.toggle('selected', el.dataset.color === c));
}

function addLessonField(lesson = null) {
  const container = document.getElementById('lessons-container');
  const idx = container.children.length + 1;
  const id = lesson ? lesson.id : 'l' + Date.now();
  const div = document.createElement('div');
  div.className = 'lesson-field';
  div.dataset.lessonId = id;
  div.innerHTML = `
    <div class="lesson-field-header">
      <span class="lesson-field-num">Leçon ${idx}</span>
      <button class="lesson-field-del" onclick="this.closest('.lesson-field').remove(); renumberLessons()"><i class="fa-solid fa-trash"></i></button>
    </div>
    <input type="text" class="lf-title" placeholder="Titre de la leçon" value="${lesson ? escapeAttr(lesson.title) : ''}">
    <input type="text" class="lf-duration" placeholder="Durée (ex: 5 min)" value="${lesson ? escapeAttr(lesson.duration || '') : ''}">
    <input type="text" class="lf-video" placeholder="Lien vidéo YouTube embed (optionnel)" value="${lesson ? escapeAttr(lesson.videoUrl || '') : ''}">
    <textarea class="lf-content" placeholder="Contenu de la leçon (texte, conseils...)">${lesson ? lesson.content || '' : ''}</textarea>
  `;
  container.appendChild(div);
}

function renumberLessons() {
  document.querySelectorAll('.lesson-field').forEach((el, i) => {
    el.querySelector('.lesson-field-num').textContent = 'Leçon ' + (i + 1);
  });
}

function saveModule() {
  const title = document.getElementById('mod-title').value.trim();
  const icon = document.getElementById('mod-icon').value.trim() || '📚';
  const desc = document.getElementById('mod-desc').value.trim();
  if (!title) { showToast('Entre un titre pour le module', 'error'); return; }

  const lessonFields = document.querySelectorAll('.lesson-field');
  const lessons = [];
  lessonFields.forEach(el => {
    const t = el.querySelector('.lf-title').value.trim();
    if (!t) return;
    lessons.push({
      id: el.dataset.lessonId || ('l' + Date.now() + Math.random()),
      title: t,
      duration: el.querySelector('.lf-duration').value.trim(),
      videoUrl: el.querySelector('.lf-video').value.trim(),
      content: el.querySelector('.lf-content').value.trim(),
    });
  });

  const modules = DB.getArr('modules');
  if (editingModuleId) {
    const idx = modules.findIndex(m => m.id === editingModuleId);
    if (idx >= 0) {
      modules[idx] = { ...modules[idx], title, icon, desc, color: selectedColor, lessons };
      showToast('Module mis à jour ✅', 'success');
    }
  } else {
    modules.push({ id: Date.now(), title, icon, desc, color: selectedColor, lessons });
    showToast('Module créé ✅', 'success');
  }
  DB.set('modules', modules);
  cancelModuleEdit();
  renderAdminModules();
}

function cancelModuleEdit() {
  editingModuleId = null;
  document.getElementById('edit-module-id').value = '';
  document.getElementById('mod-title').value = '';
  document.getElementById('mod-icon').value = '';
  document.getElementById('mod-desc').value = '';
  document.getElementById('lessons-container').innerHTML = '';
  document.getElementById('module-form-title').textContent = 'Créer un nouveau module';
  document.getElementById('save-module-btn-text').textContent = 'Créer le module';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  selectColor('blue');
}

function editModule(id) {
  const modules = DB.getArr('modules');
  const m = modules.find(x => x.id === id);
  if (!m) return;
  editingModuleId = id;
  document.getElementById('mod-title').value = m.title;
  document.getElementById('mod-icon').value = m.icon;
  document.getElementById('mod-desc').value = m.desc;
  document.getElementById('lessons-container').innerHTML = '';
  m.lessons.forEach(l => addLessonField(l));
  selectColor(m.color);
  document.getElementById('module-form-title').textContent = 'Modifier le module';
  document.getElementById('save-module-btn-text').textContent = 'Enregistrer les modifications';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteModule(id) {
  if (!confirm('Supprimer ce module ? Cette action est irréversible.')) return;
  let modules = DB.getArr('modules');
  modules = modules.filter(m => m.id !== id);
  DB.set('modules', modules);
  renderAdminModules();
  showToast('Module supprimé');
}

function renderAdminModules() {
  const modules = DB.getArr('modules');
  const list = document.getElementById('admin-modules-list');
  if (!modules.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>Aucun module. Crée le premier !</p></div>';
    return;
  }
  list.innerHTML = modules.map(m => `
    <div class="admin-module-item">
      <div class="ami-icon module-card-top ${m.color}" style="height:42px; font-size:20px;">${m.icon}</div>
      <div>
        <div class="ami-title">${m.title}</div>
        <div class="ami-meta">${m.lessons.length} leçon${m.lessons.length > 1 ? 's' : ''} · ${m.desc}</div>
      </div>
      <div class="ami-actions">
        <button class="btn-edit" onclick="editModule(${m.id})"><i class="fa-solid fa-pen"></i> Modifier</button>
        <button class="btn-delete" onclick="deleteModule(${m.id})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ===================== ADMIN INVITATIONS =====================
function generateInvite() {
  const name = document.getElementById('inv-name').value.trim();
  const note = document.getElementById('inv-note').value.trim();
  if (!name) { showToast('Entre le prénom du membre', 'error'); return; }

  const code = 'NC-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const invites = DB.getArr('invites');
  invites.push({ code, name, note, used: false, createdAt: new Date().toISOString() });
  DB.set('invites', invites);

  document.getElementById('invite-result').innerHTML = `
    <div class="invite-result-box">
      <div style="font-size:13px; color:var(--green); margin-bottom:8px;">Code généré pour <strong>${name}</strong> :</div>
      <div class="invite-code-display">${code}</div>
      <div style="font-size:12px; color:var(--text2); margin-bottom:10px;">Envoie ce code à ${name} pour qu'il puisse accéder à la plateforme.</div>
      <button class="btn-copy" onclick="copyCode('${code}')"><i class="fa-solid fa-copy"></i> Copier le code</button>
    </div>
  `;
  document.getElementById('inv-name').value = '';
  document.getElementById('inv-note').value = '';
  renderAdminInvites();
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => showToast('Code copié ! 📋', 'success'));
}

function deleteInvite(code) {
  let invites = DB.getArr('invites');
  invites = invites.filter(i => i.code !== code);
  DB.set('invites', invites);
  renderAdminInvites();
  showToast('Invitation supprimée');
}

function renderAdminInvites() {
  const invites = DB.getArr('invites');
  const list = document.getElementById('invites-list');
  if (!invites.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-envelope-open"></i><p>Aucun code généré.</p></div>';
    return;
  }
  list.innerHTML = invites.slice().reverse().map(i => `
    <div class="invite-list-item">
      <div>
        <div class="inv-code">${i.code}</div>
        <div style="font-size:11px; color:var(--text3)">${i.note || ''}</div>
      </div>
      <div class="inv-name">${i.name}</div>
      <span class="inv-status ${i.used ? 'used' : 'unused'}">${i.used ? '✅ Utilisé par ' + (i.usedBy || i.name) : '⏳ En attente'}</span>
      <button class="inv-del" onclick="deleteInvite('${i.code}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

// ===================== ADMIN MEMBERS =====================
function renderAdminMembers() {
  const members = DB.getArr('members');
  const list = document.getElementById('members-list');
  if (!members.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users"></i><p>Aucun membre inscrit.</p></div>';
    return;
  }
  list.innerHTML = members.map(m => {
    const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `
      <div class="member-admin-card">
        <div class="mac-av">${initials}</div>
        <div>
          <div class="mac-name">${m.name}</div>
          <div class="mac-meta">Inscrit le ${formatDate(m.joinedAt)} · Code: ${m.code}</div>
        </div>
        <div class="mac-stats">
          <div>${m.completedLessons?.length || 0} leçons</div>
          <div>${m.posts || 0} posts</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===================== ADMIN RESOURCES =====================
function saveResource() {
  const title = document.getElementById('res-title').value.trim();
  const type = document.getElementById('res-type').value;
  const url = document.getElementById('res-url').value.trim();
  const desc = document.getElementById('res-desc').value.trim();
  if (!title || !url) { showToast('Titre et URL requis', 'error'); return; }
  const resources = DB.getArr('resources');
  resources.push({ id: Date.now(), title, type, url, desc });
  DB.set('resources', resources);
  document.getElementById('res-title').value = '';
  document.getElementById('res-url').value = '';
  document.getElementById('res-desc').value = '';
  showToast('Ressource ajoutée ✅', 'success');
  renderAdminResources();
}

function deleteResource(id) {
  let resources = DB.getArr('resources');
  resources = resources.filter(r => r.id !== id);
  DB.set('resources', resources);
  renderAdminResources();
  showToast('Ressource supprimée');
}

function renderAdminResources() {
  const resources = DB.getArr('resources');
  const list = document.getElementById('admin-resources-list');
  if (!resources.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Aucune ressource.</p></div>';
    return;
  }
  const icons = { pdf: '📄', excel: '📊', video: '🎥', link: '🔗' };
  list.innerHTML = resources.map(r => `
    <div class="admin-module-item">
      <div style="font-size:22px">${icons[r.type] || '📎'}</div>
      <div>
        <div class="ami-title">${r.title}</div>
        <div class="ami-meta">${r.type.toUpperCase()} · ${r.desc || r.url}</div>
      </div>
      <div class="ami-actions">
        <button class="btn-delete" onclick="deleteResource(${r.id})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ===================== ADMIN COMMUNITY =====================
function renderAdminCommunity() {
  const posts = DB.getArr('posts');
  const list = document.getElementById('admin-posts-list');
  if (!posts.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-comments"></i><p>Aucun post.</p></div>';
    return;
  }
  list.innerHTML = posts.slice().reverse().map(p => `
    <div class="admin-post-item">
      <div class="api-header">
        <strong>${p.author}</strong>
        <span style="font-size:12px; color:var(--text3); margin-left:8px">${timeAgo(p.createdAt)}</span>
        <button class="api-del" onclick="adminDeletePost(${p.id})"><i class="fa-solid fa-trash"></i> Supprimer</button>
      </div>
      <div class="api-body">${escapeHtml(p.body)}</div>
    </div>
  `).join('');
}

function adminDeletePost(id) {
  let posts = DB.getArr('posts');
  posts = posts.filter(p => p.id !== id);
  DB.set('posts', posts);
  renderAdminCommunity();
  showToast('Post supprimé');
}

// ===================== MODAL =====================
function openModal() { document.getElementById('modal-overlay').classList.add('active'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

// ===================== TOAST =====================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===================== UTILS =====================
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} jour${d > 1 ? 's' : ''}`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
      sidebar.classList.remove('open');
    }
  }
});

// Enter key on login
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active')) {
    handleLogin();
  }
});
