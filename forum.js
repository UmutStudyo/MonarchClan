/* ================================================================
   AVALANCHE GAMING — Forum System
   CS 1.6 JailBreak Community
   ================================================================ */
/* forum.js — strict mode omitted to allow cross-file var sharing */

/* ─────────────────────────────────────────────
   API HELPERS
───────────────────────────────────────────── */
const API = {
  async get(table, params = {}) {
    const q = new URLSearchParams({ limit: 200, ...params });
    const r = await fetch(`tables/${table}?${q}`);
    return r.ok ? (await r.json()).data || [] : [];
  },
  async getOne(table, id) {
    const r = await fetch(`tables/${table}/${id}`);
    return r.ok ? await r.json() : null;
  },
  async post(table, data) {
    const r = await fetch(`tables/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : null;
  },
  async put(table, id, data) {
    const r = await fetch(`tables/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : null;
  },
  async patch(table, id, data) {
    const r = await fetch(`tables/${table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : null;
  },
  async del(table, id) {
    const r = await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
    return r.ok;
  },
};

/* ─────────────────────────────────────────────
   FORUM STATE
───────────────────────────────────────────── */
const Forum = {
  categories:    [],
  topics:        [],
  currentTopicId: null,
  activeCategory: null,
  searchQuery:   '',
  page:          1,
  perPage:       8,          // show only 8 per page on forum home
  initialized:   false,
  roles:         [],
  siteSettings:  {},
  showAllTopics:  false,     // true when "Tüm konuları görüntüle" was clicked
};

/* ─────────────────────────────────────────────
   PERMISSION HELPERS
───────────────────────────────────────────── */
/* ROLE_LEVEL — local constant for forum.js (admin.js has its own) */
const _FORUM_ROLE_LEVEL = { user: 0, moderator: 10, super_moderator: 20, admin: 30, super_admin: 40 };

// Üye etiketleri — badge_role alanından gösterilir
const BADGE_ROLE_MAP = {
  banned:          { color:'#dc2626', label:'Yasaklı Üye' },
  guest_member:    { color:'#94a3b8', label:'Misafir Üye' },
  active_member:   { color:'#d4aa20', label:'Aktif Üye' },
  senior_member:   { color:'#3b82f6', label:'Kıdemli Üye' },
  veteran_member:  { color:'#f59e0b', label:'Emektar Üye' },
  gv_editor:       { color:'#8b5cf6', label:'G/V Editörü' },
  sharer:          { color:'#06b6d4', label:'Paylaşımcı' },
  content_creator: { color:'#f97316', label:'İçerik Üreticisi' },
  youtuber:        { color:'#ef4444', label:'Youtuber' },
};

function currentUser() { return (typeof State !== 'undefined' && State.currentUser) ? State.currentUser : null; }

function userLevel(u) {
  if (!u) return 0;
  return _FORUM_ROLE_LEVEL[u.role] || 0;
}

function hasPerm(perm) {
  const u = currentUser();
  if (!u) return false;
  const level = userLevel(u);
  if (level >= 40) return true; // Kurucu her şeye erişir
  const perms = {
    // De. Moderatör (20): sadece konu işlemleri
    lock_topic:            level >= 20,
    pin_topic:             level >= 20,
    // Moderatör (10): kullanıcı susturma, konu sil/sabitle/kilitle/öne çıkar, raporlar, geçmiş, destek
    delete_topic:          level >= 10,
    delete_reply:          level >= 10,
    mute_user:             level >= 10,
    ban_user:              level >= 10,
    manage_reports:        level >= 10,
    super_like:            level >= 10,
    // Yönetici (30): kullanıcı yönetimi, forum yönetimi, tüm site işlemleri
    manage_users:          level >= 30,
    manage_forum:          level >= 30,
    manage_announcements:  level >= 30,
    manage_market:         level >= 30,
    manage_staff:          level >= 30,
    manage_roles:          level >= 30,
    manage_site:           level >= 40, // sadece Kurucu
  };
  return !!perms[perm];
}

function isMuted() {
  const u = currentUser();
  if (!u || !u.muted_until) return false;
  return new Date(u.muted_until) > new Date();
}

function isBanned() {
  const u = currentUser();
  if (!u || !u.banned_until) return false;
  return new Date(u.banned_until) > new Date();
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
async function initForum() {
  if (Forum.initialized) {
    /* Already loaded — re-render with cached data */
    renderCategoryFilters();
    renderForumTabs();
    renderTopicsList();
    updateCategoryBoxStats();
    const btn = document.getElementById('new-topic-btn');
    if (btn) btn.style.display = (currentUser() && !isMuted()) ? 'inline-flex' : 'none';
    return;
  }
  Forum.initialized = true;

  /* Show loading indicator */
  const topicsList = document.getElementById('forum-topics-list');
  if (topicsList) topicsList.innerHTML = '<div class="forum-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Y\u00fckleniyor...</div>';

  // Load categories
  Forum.categories = await API.get('av_categories');
  Forum.categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  renderCategoryFilters();
  renderForumTabs();
  await loadTopics();

  // Show new topic button if logged in and not muted
  const btn = document.getElementById('new-topic-btn');
  if (btn) btn.style.display = (currentUser() && !isMuted()) ? 'inline-flex' : 'none';

  // Show admin link in dashboard
  injectAdminLink();

  // Update community stats on home page
  updateForumStats();
}

function applySiteSettings(s) {
  /* accent_color override disabled — theme enforced by CSS variables */
  if (s.site_name) {
    document.querySelectorAll('.nav-logo, .brand, .loader-logo').forEach(el => {
      if (el.textContent.trim() === '' || el.textContent.includes('Monarch')) {
        // only update text-only nodes, not ones with children
        if (!el.children.length) el.textContent = s.site_name;
      }
    });
    document.title = s.site_name + ' — CS 1.6 JailBreak Community';
  }
}

function injectAdminLink() {
  const u = currentUser();
  if (!u || userLevel(u) < 10) return;
  // Add admin link to user dropdown if not already present
  const userMenu = document.getElementById('user-menu');
  if (userMenu && !document.getElementById('admin-panel-link')) {
    const div = document.createElement('div');
    div.id = 'admin-panel-link';
    div.className = 'acc-menu-item';
    div.style.color = 'var(--warning)';
    div.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Yönetim Paneli';
    div.onclick = () => { window.open('admin.html', '_blank'); };
    const divider = userMenu.querySelector('.acc-divider');
    if (divider) userMenu.insertBefore(div, divider);
    else userMenu.prepend(div);
  }
}

/* ─────────────────────────────────────────────
   CATEGORY FILTERS
───────────────────────────────────────────── */
function renderCategoryFilters() {
  const list = document.getElementById('category-filter-list');
  if (!list) return;
  list.innerHTML = `<div class="category-filter-item active" onclick="filterByCategory(null,this)"><i class="fa-solid fa-list"></i> Tümü</div>`;
  Forum.categories.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'category-filter-item';
    el.innerHTML = `<i class="fa-solid ${cat.icon}" style="color:${cat.color}"></i> ${escForum(cat.name)}`;
    el.onclick = () => filterByCategory(cat.id, el);
    list.appendChild(el);
  });
}

function renderForumTabs() {
  const tabs = document.getElementById('forum-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  const allTab = document.createElement('div');
  allTab.className = 'forum-tab active';
  allTab.setAttribute('data-cat', '');
  allTab.innerHTML = '<i class="fa-solid fa-list"></i> Tümü';
  allTab.onclick = () => filterByCategory(null, null, allTab);
  tabs.appendChild(allTab);
  Forum.categories.forEach(cat => {
    const t = document.createElement('div');
    t.className = 'forum-tab';
    t.setAttribute('data-cat', cat.id);
    t.innerHTML = `<i class="fa-solid ${cat.icon}" style="color:${cat.color}"></i> ${escForum(cat.name)}`;
    t.onclick = () => filterByCategory(cat.id, null, t);
    tabs.appendChild(t);
  });
}

// Filter by category name (used by category boxes in forum page)
function filterByCategoryName(name) {
  const cat = Forum.categories.find(c => c.name && c.name.toLowerCase() === name.toLowerCase());
  const catId = cat ? cat.id : null;
  Forum.activeCategory = catId;
  Forum.page = 1;
  Forum.showAllTopics = true;
  Forum.perPage = 15;
  document.querySelectorAll('.category-filter-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.forum-tab').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-cat') === (catId || ''));
  });
  renderTopicsList();
}

// Populate category box stats after topics are loaded
function updateCategoryBoxStats() {
  const allTopics = Forum.topics;
  const catNames = {
    'fcb-stat-genel':    null,          // null = show all totals (Tümü)
    'fcb-stat-haber':    'Haber',
    'fcb-stat-paylasim': 'Paylaşım',
    'fcb-stat-banitiraz':'Ban İtiraz',
    'fcb-stat-reklam':   'Reklam',
  };
  Object.entries(catNames).forEach(([elId, catName]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    let filtered;
    if (catName === null) {
      filtered = allTopics;
    } else {
      const cat = Forum.categories.find(c => c.name && c.name.toLowerCase() === catName.toLowerCase());
      filtered = cat ? allTopics.filter(t => t.category_id === cat.id) : allTopics.filter(t => {
        return (t.category_name || '').toLowerCase() === catName.toLowerCase();
      });
    }
    const konuCount = filtered.length;
    const mesajCount = filtered.reduce((s, t) => s + (t.reply_count || 0), 0);
    const konuEl  = el.querySelector('.fcb-konu');
    const mesajEl = el.querySelector('.fcb-mesaj');
    if (konuEl)  konuEl.textContent  = konuCount;
    if (mesajEl) mesajEl.textContent = mesajCount;
  });
}

function filterByCategory(catId, sidebarEl, tabEl) {
  Forum.activeCategory = catId;
  Forum.page = 1;
  Forum.showAllTopics = false;
  Forum.perPage = 8;

  // Update sidebar items
  document.querySelectorAll('.category-filter-item').forEach(el => el.classList.remove('active'));
  if (sidebarEl) sidebarEl.classList.add('active');

  // Update tabs
  document.querySelectorAll('.forum-tab').forEach(el => el.classList.remove('active'));
  if (tabEl) { tabEl.classList.add('active'); }
  else {
    // sync tabs
    const targetAttr = catId || '';
    document.querySelectorAll('.forum-tab').forEach(el => {
      if (el.getAttribute('data-cat') === targetAttr) el.classList.add('active');
    });
  }

  renderTopicsList();
}

/* ─────────────────────────────────────────────
   LOAD TOPICS
───────────────────────────────────────────── */
async function loadTopics() {
  const raw = await API.get('av_topics');
  Forum.topics = raw.filter(t => !t.is_deleted);
  Forum.topics.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return (b.created_at || 0) - (a.created_at || 0);
  });
  renderTopicsList();
  updateForumStats();
  updateCategoryBoxStats();
}

async function updateForumStats() {
  const topics  = Forum.topics.length || (await API.get('av_topics')).filter(t => !t.is_deleted).length;
  const replies = (await API.get('av_replies')).filter(r => !r.is_deleted).length;
  const users   = (await API.get('av_users')).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('fstat-topics',  topics);
  set('fstat-replies', replies);
  set('fstat-users',   users);
  // also update home page stats
  set('stat-topics',  topics);
  set('stat-posts',   replies);
  set('stat-members', users);
  set('stat-registered', users);
  set('hs-topics',    topics);
  set('hs-posts',     replies);
  set('hs-members',   users);
}

function renderTopicsList() {
  const container = document.getElementById('forum-topics-list');
  if (!container) return;

  let list = [...Forum.topics];

  if (Forum.activeCategory) list = list.filter(t => t.category_id === Forum.activeCategory);

  if (Forum.searchQuery) {
    const q = Forum.searchQuery.toLowerCase();
    list = list.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.content?.toLowerCase().includes(q) ||
      t.category_name?.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return (b.created_at || 0) - (a.created_at || 0);
  });

  const total = list.length;

  // If no search/category filter AND not "show all" mode → cap at 8
  const isFiltered = Forum.activeCategory || Forum.searchQuery;
  const CAP = 8;
  const paged = (isFiltered || Forum.showAllTopics)
    ? list.slice((Forum.page - 1) * Forum.perPage, Forum.page * Forum.perPage)
    : list.slice(0, CAP);

  if (!paged.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-inbox'></i></div><div class="empty-title">Konu Bulunamadı</div><p class="empty-desc">Bu kategoride henüz konu açılmamış veya arama sonucu bulunamadı.</p></div>`;
    document.getElementById('forum-pagination').innerHTML = '';
    return;
  }

  // Table layout
  container.innerHTML = `
    <div class="forum-table">
      <div class="forum-table-head">
        <div class="ft-col-main">Konu</div>
        <div class="ft-col-stat"><i class="fa-solid fa-comments"></i></div>
        <div class="ft-col-stat"><i class="fa-solid fa-eye"></i></div>
        <div class="ft-col-stat"><i class="fa-solid fa-thumbs-up"></i></div>
        <div class="ft-col-date">Tarih</div>
      </div>
      ${paged.map(t => topicRow(t)).join('')}
    </div>`;

  // "Tüm konuları görüntüle" button — show only when capped and there are more
  const pg = document.getElementById('forum-pagination');
  if (!isFiltered && !Forum.showAllTopics && total > CAP) {
    if (pg) pg.innerHTML = `
      <div style="text-align:center;margin-top:18px">
        <button class="btn btn-outline" style="padding:12px 32px;font-size:.95rem;font-weight:700;border-radius:12px;gap:8px" onclick="showAllTopicsFn()">
          <i class="fa-solid fa-list"></i> Tüm konuları görüntüle
          <span style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:99px;font-size:.78rem;margin-left:4px">${total}</span>
        </button>
      </div>`;
  } else if (isFiltered || Forum.showAllTopics) {
    renderPagination(total);
  } else {
    if (pg) pg.innerHTML = '';
  }
}

function showAllTopicsFn() {
  Forum.showAllTopics = true;
  Forum.page = 1;
  Forum.perPage = 15;
  renderTopicsList();
  // Also update pagination
}

function resetTopicsView() {
  Forum.showAllTopics = false;
  Forum.page = 1;
  Forum.perPage = 8;
}

function topicRow(t) {
  const cat      = Forum.categories.find(c => c.id === t.category_id);
  const catColor = cat?.color || 'var(--accent)';
  const badges = [];
  if (t.is_pinned)   badges.push(`<span class="badge badge-accent" style="padding:2px 7px;font-size:.65rem"><i class="fa-solid fa-thumbtack"></i></span>`);
  if (t.is_locked)   badges.push(`<span class="badge badge-danger" style="padding:2px 7px;font-size:.65rem"><i class="fa-solid fa-lock"></i></span>`);
  if (t.super_liked) badges.push(`<span class="badge badge-warning" style="padding:2px 7px;font-size:.65rem"><i class="fa-solid fa-star"></i></span>`);
  const catBadge = cat ? `<span class="badge" style="background:${catColor}22;color:${catColor};padding:2px 8px;font-size:.65rem">${escForum(cat.name)}</span>` : '';
  const ts = t.created_at ? timeAgo(t.created_at) : '';
  const lastBy = t.last_reply_by ? `<div style="font-size:.68rem;color:var(--text-muted)">${escForum(t.last_reply_by)}</div>` : '';

  // Premium gradient for topic author
  const topicAuthorGrad = premiumGradientStyle(t.author_premiumGradient);
  const topicAuthorHtml = topicAuthorGrad
    ? `<span style="${topicAuthorGrad}">${escForum(t.author_name)}</span>`
    : escForum(t.author_name);

  return `<div class="forum-table-row${t.is_pinned?' ft-pinned':''}${t.is_locked?' ft-locked':''}${t.super_liked?' ft-superliked':''}" onclick="openTopic('${t.id}')">
    <div class="ft-col-main">
      <div class="ft-badges">${badges.join('')} ${catBadge}</div>
      <div class="ft-title">${escForum(t.title)}</div>
      <div class="ft-author"><i class="fa-solid fa-user" style="font-size:.65rem"></i> ${topicAuthorHtml}</div>
    </div>
    <div class="ft-col-stat">${t.reply_count || 0}</div>
    <div class="ft-col-stat">${t.view_count  || 0}</div>
    <div class="ft-col-stat">${t.like_count  || 0}</div>
    <div class="ft-col-date">${ts}${lastBy}</div>
  </div>`;
}

function renderPagination(total) {
  const pages = Math.ceil(total / Forum.perPage);
  const pg = document.getElementById('forum-pagination');
  if (!pg) return;
  if (pages <= 1) { pg.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<div class="page-btn${i === Forum.page ? ' active' : ''}" onclick="goForumPage(${i})">${i}</div>`;
  }
  pg.innerHTML = html;
}

function goForumPage(n) {
  Forum.page = n;
  renderTopicsList();
  document.querySelector('.forum-page-wrap')?.scrollIntoView({ behavior: 'smooth' });
}

/* ─────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────── */
function forumSearch(val) {
  Forum.searchQuery = val;
  Forum.page = 1;
  Forum.showAllTopics = false;
  Forum.perPage = 8;
  renderTopicsList();
}
function clearForumSearch() {
  Forum.searchQuery = '';
  const inp = document.getElementById('forum-search');
  if (inp) inp.value = '';
  renderTopicsList();
}

/* ─────────────────────────────────────────────
   TOPIC DETAIL
───────────────────────────────────────────── */
async function openTopic(topicId) {
  Forum.currentTopicId = topicId;
  showPage('topic');

  const wrap = document.getElementById('topic-detail-wrap');
  if (wrap) wrap.innerHTML = '<div class="forum-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  // Increment view count
  const topic = await API.getOne('av_topics', topicId);
  if (!topic || topic.is_deleted) {
    if (wrap) wrap.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-ban"></i></div><div class="empty-title">Konu Bulunamad\u0131</div></div>';
    return;
  }
  await API.patch('av_topics', topicId, { view_count: (topic.view_count || 0) + 1 });

  // Load replies and votes
  const allReplies = await API.get('av_replies');
  const replies = allReplies.filter(r => r.topic_id === topicId && !r.is_deleted);
  replies.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

  const u = currentUser();
  let myTopicVote = null;
  if (u) {
    const allVotes = await API.get('av_votes');
    const tv = allVotes.find(v => v.user_id === u.id && v.target_id === topicId && v.target_type === 'topic');
    if (tv) myTopicVote = { id: tv.id, vote: tv.vote };
  }

  renderTopicDetail(topic, replies, myTopicVote);
  writeLog('topic', 'Konu görüntülendi', topic.title);
}

function renderTopicDetail(topic, replies, myTopicVote) {
  const wrap = document.getElementById('topic-detail-wrap');
  if (!wrap) return;
  const u = currentUser();
  const cat = Forum.categories.find(c => c.id === topic.category_id);

  // Mod actions
  const modActions = hasPerm('delete_topic') || hasPerm('lock_topic') || hasPerm('pin_topic') || hasPerm('super_like') ? `
    <div class="mod-actions">
      ${hasPerm('pin_topic') ? `<button class="btn btn-ghost btn-sm btn-mod" onclick="togglePin('${topic.id}',${topic.is_pinned})">
        <i class="fa-solid fa-thumbtack"></i> ${topic.is_pinned ? 'Sabiti Kaldır' : 'Sabitle'}
      </button>` : ''}
      ${hasPerm('lock_topic') ? `<button class="btn btn-ghost btn-sm btn-mod" onclick="toggleLock('${topic.id}',${topic.is_locked})">
        <i class="fa-solid fa-lock${topic.is_locked ? '-open' : ''}"></i> ${topic.is_locked ? 'Kilidi Aç' : 'Kilitle'}
      </button>` : ''}
      ${hasPerm('super_like') ? `<button class="btn btn-ghost btn-sm btn-mod" onclick="toggleSuperLike('${topic.id}',${topic.super_liked})">
        <i class="fa-solid fa-star"></i> ${topic.super_liked ? 'Öne Çıkmayı Kaldır' : 'Öne Çıkar'}
      </button>` : ''}
      ${hasPerm('delete_topic') ? `<button class="btn btn-danger btn-sm btn-mod" onclick="deleteTopic('${topic.id}')">
        <i class="fa-solid fa-trash"></i> Sil
      </button>` : ''}
    </div>` : '';

  // Owner actions
  const isOwner = u && u.id === topic.author_id;
  const ownerActions = isOwner ? `
    <button class="vote-btn" onclick="showEditTopicModal('${topic.id}')"><i class="fa-solid fa-pen"></i> Düzenle</button>
    <button class="vote-btn" style="border-color:var(--danger);color:var(--danger)" onclick="deleteTopic('${topic.id}')"><i class="fa-solid fa-trash"></i> Sil</button>
  ` : '';

  // Vote buttons
  const likeActive   = myTopicVote?.vote === 'like'    ? ' active-like' : '';
  const dislikeActive= myTopicVote?.vote === 'dislike' ? ' active-dislike' : '';
  const reportBtn = u && u.id !== topic.author_id ? `<button class="vote-btn" onclick="openReportModal('${topic.id}','topic','${escAttr(topic.title)}')"><i class="fa-solid fa-flag"></i> Raporla</button>` : '';

  const catLabel = cat ? `<span class="badge" style="background:${cat.color}22;color:${cat.color}">${escForum(cat.name)}</span>` : '';
  const pinLabel = topic.is_pinned ? '<span class="badge badge-accent"><i class="fa-solid fa-thumbtack"></i> Sabitli</span>' : '';
  const lockLabel = topic.is_locked ? '<span class="badge badge-danger"><i class="fa-solid fa-lock"></i> Kilitli</span>' : '';

  // Konu yazarı premium gradient
  const tdAuthorGrad = premiumGradientStyle(topic.author_premiumGradient);
  const tdAuthorHtml = tdAuthorGrad
    ? `<span style="${tdAuthorGrad}">${escForum(topic.author_name)}</span>`
    : escForum(topic.author_name);

  // Yazar avatar
  const tdAvatarHtml = topic.author_avatar
    ? `<img src="${escAttr(topic.author_avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">`
    : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0">${(topic.author_name||'?')[0].toUpperCase()}</div>`;

  wrap.innerHTML = `
    <div class="topic-detail-header page-transition-enter">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${catLabel}${pinLabel}${lockLabel}</div>
      <div class="topic-detail-title">${escForum(topic.title)}</div>
      <div class="topic-author-row" onclick="openUserProfileCard('${topic.author_id}')" style="cursor:pointer">
        ${tdAvatarHtml}
        <div class="topic-author-info">
          <span class="topic-author-name">${tdAuthorHtml}</span>
          <span class="topic-author-date"><i class="fa-regular fa-clock"></i> ${timeAgo(topic.created_at)}</span>
        </div>
        <div class="topic-meta-right">
          <span><i class="fa-solid fa-eye"></i> ${(topic.view_count || 0) + 1}</span>
          <span><i class="fa-solid fa-comments"></i> ${replies.length}</span>
        </div>
      </div>
      <div class="topic-detail-content">${topic.content || ''}</div>
      <div class="topic-actions-bar">
        <button class="vote-btn${likeActive}" onclick="voteTopic('${topic.id}','like')">
          <i class="fa-solid fa-thumbs-up"></i> <span id="tl-count">${topic.like_count || 0}</span>
        </button>
        <button class="vote-btn${dislikeActive}" onclick="voteTopic('${topic.id}','dislike')">
          <i class="fa-solid fa-thumbs-down"></i> <span id="tdl-count">${topic.dislike_count || 0}</span>
        </button>
        ${reportBtn}
        ${ownerActions}
        ${modActions}
      </div>
    </div>

    <div class="replies-section">
      <div class="replies-header"><i class="fa-solid fa-comments" style="color:var(--accent)"></i> ${replies.length} Yanıt</div>
      <div id="replies-list">${replies.length ? replies.map(r => replyCard(r)).join('') : '<div class="empty-state" style="padding:28px 0"><div class="empty-icon"><i class="fa-solid fa-comments"></i></div><div class="empty-title">Henüz Yan\u0131t Yok</div><p class="empty-desc">\u0130lk yorumu sen yaz!</p></div>'}</div>
    </div>

    ${replyBoxHtml(topic)}
  `;
}

function replyBoxHtml(topic) {
  const u = currentUser();
  if (!u) {
    return `<div class="reply-box"><p style="font-size:.88rem;color:var(--text-muted);text-align:center">
      Yorum yazmak için <a onclick="showPage('login')" style="color:var(--accent);cursor:pointer">giriş yap</a> veya <a onclick="showPage('register')" style="color:var(--accent);cursor:pointer">kayıt ol</a>.
    </p></div>`;
  }
  if (topic.is_locked && !hasPerm('lock_topic')) {
    return `<div class="locked-notice"><i class="fa-solid fa-lock"></i> Bu konu kilitlenmiş. Yeni yanıt gönderilemiyor.</div>`;
  }
  if (isMuted()) {
    return `<div class="locked-notice"><i class="fa-solid fa-microphone-slash"></i> Susturulduğunuz için yorum yazamazsınız.</div>`;
  }
  const EMOJIS = ['😀','😂','😍','🔥','👍','🎮','💪','😎','🤝','🏆','❤️','😭','🙏','💬','⚡','😅','🤣','😊','🥳','🎉'];
  const emojiGrid = EMOJIS.map(e => `<span class="emoji-btn" onclick="insertEmojiReply('${e}')">${e}</span>`).join('');
  return `<div class="reply-box">
    <h4><i class="fa-solid fa-reply" style="color:var(--accent);margin-right:6px"></i> Yanıtla</h4>
    <div class="reply-toolbar">
      <button type="button" onclick="rtReplyCmd('bold')" title="Kalın"><i class="fa-solid fa-bold"></i></button>
      <button type="button" onclick="rtReplyCmd('italic')" title="İtalik"><i class="fa-solid fa-italic"></i></button>
      <button type="button" onclick="rtReplyInsertLink()" title="Link"><i class="fa-solid fa-link"></i></button>
      <button type="button" onclick="toggleReplyEmoji()" title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
      <div class="reply-toolbar-sep"></div>
      <select class="reply-font-select" onchange="rtReplyFont(this.value)" title="Yazı Tipi">
        <option value="inherit">Normal</option>
        <option value="cursive">El Yazısı</option>
        <option value="'UnifrakturMaguntia',cursive">Fraktur</option>
        <option value="'Courier New',monospace">Kara Tahta</option>
      </select>
      <label class="reply-color-wrap" title="Renk Seçici">
        <i class="fa-solid fa-palette"></i>
        <input type="color" class="reply-color-input" id="reply-color-input" value="#ef4444" onchange="rtReplyColor(this.value)">
      </label>
      <button type="button" onclick="rtReplyInsertTag()" title="Etiket Ekle"><i class="fa-solid fa-hashtag"></i></button>
      <button type="button" onclick="rtReplyInsertYoutube()" title="YouTube Link"><i class="fa-brands fa-youtube"></i></button>
      <button type="button" onclick="rtReplyInsertTiktok()" title="TikTok Link"><i class="fa-brands fa-tiktok"></i></button>
    </div>
    <div class="reply-editor" id="reply-editor" contenteditable="true" data-placeholder="Yanıtınızı yazın..."></div>
    <div class="emoji-picker" id="reply-emoji-picker">${emojiGrid}</div>
    <div class="reply-actions">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('reply-editor').innerHTML=''">Temizle</button>
      <button class="btn btn-primary btn-sm" onclick="submitReply('${topic.id}')"><i class="fa-solid fa-paper-plane"></i> Gönder</button>
    </div>
  </div>`;
}

function replyCard(r) {
  const u = currentUser();
  const isOwner = u && u.id === r.author_id;
  const roleBadge = roleBadgeHtml(r.author_role, r.author_badge_role);
  const avatarSrc = r.author_avatar
    ? `<img src="${escAttr(r.author_avatar)}" />`
    : r.author_name?.[0]?.toUpperCase() || '?';
  const editedNote = r.edited_at ? `<span class="reply-edited">• Düzenlendi</span>` : '';

  // Kendi yorumu: Düzenle (mor) + Kaldır (kırmızı) — sağ altta
  const ownerBtns = isOwner ? `
    <button class="btn-reply-edit" onclick="openEditReplyModal('${r.id}')"><i class="fa-solid fa-pen"></i> Düzenle</button>
    <button class="btn-reply-delete" onclick="deleteReply('${r.id}','${Forum.currentTopicId}')"><i class="fa-solid fa-trash"></i> Kaldır</button>
  ` : '';

  // Mod: sadece sil, susturma forumdan değil panelden yapılır
  const modBtns = !isOwner && hasPerm('delete_reply') ? `
    <button class="vote-btn" style="padding:4px 10px;font-size:.75rem;border-color:var(--danger);color:var(--danger)" onclick="deleteReply('${r.id}','${Forum.currentTopicId}')"><i class="fa-solid fa-trash"></i></button>
  ` : '';

  // Cevapla (reply-quote) butonu — başkasının yorumunda
  const replyQuoteBtn = u && !isOwner
    ? `<button class="btn-reply-quote" onclick="quoteReply('${escAttr(r.author_name)}','${r.id}')"><i class="fa-solid fa-reply"></i> Cevapla</button>`
    : '';

  // Raporla butonu — kırmızı, glow, kendi yorumunda yok
  const replyReportBtn = u && !isOwner
    ? `<button class="btn-reply-report" onclick="openReportModal('${r.id}','reply','Yorum')"><i class="fa-solid fa-flag"></i> Raporla</button>`
    : '';

  // Premium gradient for author name
  const authorGradStyle = premiumGradientStyle(r.author_premiumGradient);
  const authorNameHtml = authorGradStyle
    ? `<span style="${authorGradStyle}">${escForum(r.author_name)}</span>`
    : escForum(r.author_name);

  return `<div class="reply-item" id="reply-${r.id}">
    <div class="reply-author-col">
      <div class="reply-author-avatar" onclick="openUserProfileCard('${r.author_id}')" style="cursor:pointer">${avatarSrc}</div>
      <div class="reply-author-name" onclick="openUserProfileCard('${r.author_id}')" style="cursor:pointer">${authorNameHtml}</div>
      ${roleBadge}
    </div>
    <div class="reply-body">
      <div class="reply-content">${r.content || ''}</div>
      <div class="reply-footer">
        <div class="reply-footer-top">
          <span class="reply-date-tag"><i class="fa-regular fa-calendar"></i> ${timeAgo(r.created_at)}</span>
          ${editedNote}
        </div>
        <div class="reply-footer-bottom">
          <div class="reply-footer-votes">
            <button class="vote-btn" style="padding:4px 12px;font-size:.78rem" id="rv-like-${r.id}" onclick="voteReply('${r.id}','like')">
              <i class="fa-solid fa-thumbs-up"></i> <span id="rl-count-${r.id}">${r.like_count || 0}</span>
            </button>
            <button class="vote-btn" style="padding:4px 12px;font-size:.78rem" id="rv-dislike-${r.id}" onclick="voteReply('${r.id}','dislike')">
              <i class="fa-solid fa-thumbs-down"></i> <span id="rdl-count-${r.id}">${r.dislike_count || 0}</span>
            </button>
            ${modBtns}
          </div>
          <div class="reply-footer-actions">
            ${isOwner ? ownerBtns : `${replyQuoteBtn}${replyReportBtn}`}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* Returns inline style string for animated premium gradient text */
function premiumGradientStyle(gradientId) {
  if (!gradientId) return '';
  // PREMIUM_GRADIENTS is defined in app.js — access via global
  const list = (typeof PREMIUM_GRADIENTS !== 'undefined') ? PREMIUM_GRADIENTS : [];
  const g = list.find(x => x.id === gradientId);
  if (!g) return '';
  return `background:linear-gradient(135deg,${g.from},${g.to},${g.from});background-size:200% 200%;` +
    `-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;` +
    `animation:gradAnim 3s ease infinite;`;
}

/* roleBadgeHtml(role, badgeRole)
   role      = temel sistem rolü (super_admin / admin / super_moderator / moderator)
   badgeRole = üye etiketi (active_member / veteran_member / youtuber vb.) */
function roleBadgeHtml(role, badgeRole) {
  const roleMap = {
    super_admin:      { color:'#f5c518', label:'Kurucu' },
    admin:            { color:'#f59e0b', label:'Yönetici' },
    super_moderator:  { color:'#a78bfa', label:'De. Moderatör' },
    moderator:        { color:'#38bdf8', label:'Moderatör' },
  };

  let html = '';

  // Temel rol rozeti
  if (role && role !== 'user') {
    const entry = roleMap[role];
    if (entry) {
      html += `<span class="role-badge" style="background:${entry.color}22;color:${entry.color};border:1px solid ${entry.color}44">${entry.label}</span>`;
    }
  }

  // Üye etiketi rozeti (badge_role)
  if (badgeRole) {
    const b = BADGE_ROLE_MAP[badgeRole];
    if (b) {
      html += `<span class="role-badge" style="background:${b.color}22;color:${b.color};border:1px solid ${b.color}44;margin-top:2px">${b.label}</span>`;
    }
  }

  return html;
}

/* Quote/fill reply editor with @mention */
function quoteReply(authorName, replyId) {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  editor.focus();
  const mention = `<span style="color:var(--accent);font-weight:700">@${authorName}</span>&nbsp;`;
  editor.innerHTML = mention + editor.innerHTML;
  // Move cursor to end
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  editor.scrollIntoView({ behavior:'smooth', block:'center' });
}

/* ─── Reply Editor Toolbar Helpers ─── */
function rtReplyCmd(cmd) {
  document.getElementById('reply-editor')?.focus();
  document.execCommand(cmd, false, null);
}

function rtReplyInsertLink() {
  const url = prompt('Link URL girin:');
  if (!url) return;
  document.getElementById('reply-editor')?.focus();
  document.execCommand('createLink', false, url);
}

function rtReplyFont(font) {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  editor.focus();
  // Wrap selection in span with font-family
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontFamily = font;
    try { range.surroundContents(span); } catch(_) {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
  } else {
    // No selection: set data attribute for next typed text
    editor.dataset.pendingFont = font;
    editor.addEventListener('keydown', function applyPendingFont(e) {
      if (e.key.length === 1) {
        e.preventDefault();
        const s = document.createElement('span');
        s.style.fontFamily = editor.dataset.pendingFont || 'inherit';
        s.textContent = e.key;
        const r = window.getSelection()?.getRangeAt(0);
        if (r) { r.insertNode(s); r.setStartAfter(s); r.collapse(true); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
        delete editor.dataset.pendingFont;
        editor.removeEventListener('keydown', applyPendingFont);
      }
    });
  }
}

function rtReplyColor(color) {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    document.execCommand('foreColor', false, color);
  } else {
    showToast('Renklendirmek için önce metin seçin', 'warning');
  }
}

function toggleReplyEmoji() {
  const picker = document.getElementById('reply-emoji-picker');
  if (picker) picker.classList.toggle('open');
}

function insertEmojiReply(emoji) {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  editor.focus();
  document.execCommand('insertText', false, emoji);
}

function rtReplyInsertTag() {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  const tag = prompt('Etiket adı girin (# olmadan):');
  if (!tag || !tag.trim()) return;
  editor.focus();
  const span = document.createElement('span');
  span.style.cssText = 'color:var(--accent);font-weight:700';
  span.textContent = '#' + tag.trim().replace(/\s+/g, '_');
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(span);
  }
}

function rtReplyInsertYoutube() {
  const url = prompt('YouTube video URL girin:');
  if (!url || !url.trim()) return;
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  // Extract video ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  const vidId = match ? match[1] : null;
  let html;
  if (vidId) {
    html = `<div class="reply-embed reply-embed-yt" style="margin:8px 0;border-radius:8px;overflow:hidden;max-width:480px">` +
      `<iframe width="100%" height="270" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen style="display:block;border-radius:8px"></iframe></div>`;
  } else {
    html = `<a href="${escAttr(url)}" target="_blank" rel="noopener" style="color:var(--accent)">${url}</a>`;
  }
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

function rtReplyInsertTiktok() {
  const url = prompt('TikTok video URL girin:');
  if (!url || !url.trim()) return;
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  // TikTok embed via oEmbed-style blockquote
  const html = `<div class="reply-embed reply-embed-tt" style="margin:8px 0;padding:10px 14px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;max-width:360px">` +
    `<i class="fa-brands fa-tiktok" style="color:#69c9d0;margin-right:6px"></i>` +
    `<a href="${escAttr(url)}" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all">${url}</a></div>`;
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

/* ─────────────────────────────────────────────
   REPLY SUBMIT
───────────────────────────────────────────── */
async function submitReply(topicId) {
  const u = currentUser();
  if (!u) return showToast('Giriş yapmanız gerekiyor', 'error');
  if (isMuted()) return showToast('Susturulduğunuz için yorum yapamazsınız', 'error');
  if (isBanned()) return showToast('Hesabınız askıya alınmış', 'error');

  const editor = document.getElementById('reply-editor');
  const content = editor?.innerHTML?.trim();
  if (!content || content === '<br>') return showToast('Yanıt içeriği boş olamaz', 'error');

  const reply = {
    id: uid(), topic_id: topicId,
    content,
    author_id: u.id, author_name: u.username,
    author_role: u.role || 'user', author_avatar: u.avatar || null,
    author_badge_role: u.badge_role || null,
    author_premiumGradient: u.premiumGradient || null,
    is_deleted: false, edited_at: null,
    like_count: 0, dislike_count: 0,
  };

  const saved = await API.post('av_replies', reply);
  if (!saved) return showToast('Yanıt gönderilemedi', 'error');

  // Update topic reply count + last reply
  const topic = await API.getOne('av_topics', topicId);
  if (topic) {
    await API.patch('av_topics', topicId, {
      reply_count: (topic.reply_count || 0) + 1,
      last_reply_at: new Date().toISOString(),
      last_reply_by: u.username,
    });
    // Update local cache
    const idx = Forum.topics.findIndex(t => t.id === topicId);
    if (idx >= 0) Forum.topics[idx].reply_count = (Forum.topics[idx].reply_count || 0) + 1;
  }

  // Update user reply count (ilerleme seviyesi için 'replies' alanı, mesajlaşma için 'messages')
  if (typeof State !== 'undefined') {
    State.currentUser.replies  = (State.currentUser.replies  || 0) + 1; // progress tier
    State.currentUser.messages = (State.currentUser.messages || 0) + 1; // activity counter
    if (typeof _saveCurrentUser === 'function') _saveCurrentUser();
    if (typeof addXP === 'function') addXP(3);
    if (typeof addActivity === 'function') addActivity('Forum yanıtı gönderildi', 'fa-solid fa-comment');
    // Refresh progress view if visible
    if (typeof renderProgressView === 'function') {
      const pv = document.getElementById('view-progress');
      if (pv && pv.classList.contains('active')) renderProgressView();
    }
  }

  if (editor) editor.innerHTML = '';
  showToast('Yanıtınız gönderildi ✅', 'success');
  writeLog('reply', 'Yorum eklendi', topicId);

  // Refresh replies section only
  const allReplies = await API.get('av_replies');
  const replies = allReplies.filter(r => r.topic_id === topicId && !r.is_deleted);
  replies.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  const rList = document.getElementById('replies-list');
  if (rList) { rList.innerHTML = replies.map(r => replyCard(r)).join(''); }
  const rHeader = document.querySelector('.replies-header');
  if (rHeader) rHeader.innerHTML = `<i class="fa-solid fa-comments" style="color:var(--accent)"></i> ${replies.length} Yanıt`;
}

/* ─────────────────────────────────────────────
   NEW TOPIC
───────────────────────────────────────────── */
function showNewTopicModal() {
  const u = currentUser();
  if (!u) return showPage('login');
  if (isMuted()) return showToast('Susturulduğunuz için konu açamazsınız', 'error');
  if (isBanned()) return showToast('Hesabınız askıya alınmış', 'error');

  // Render full-page topic creation
  renderCreateTopicPage();
  showPage('create-topic');
}

function renderCreateTopicPage() {
  const wrap = document.getElementById('create-topic-wrap');
  if (!wrap) return;

  const catOptions = '<option value="">Kategori seçin...</option>' +
    Forum.categories.map(c => `<option value="${c.id}">${escForum(c.name)}</option>`).join('');

  wrap.innerHTML = `
    <div class="ct-page">
      <div class="ct-header">
        <button class="ct-back-btn" onclick="backToForum()"><i class="fa-solid fa-arrow-left"></i></button>
        <div>
          <h1 class="ct-title"><i class="fa-solid fa-pen-to-square" style="color:var(--accent)"></i> Yeni Konu Aç</h1>
          <p class="ct-subtitle">Toplulukla paylaşmak istediğin konuyu oluştur</p>
        </div>
      </div>

      <div class="ct-form-card">
        <!-- BAŞLIK -->
        <div class="ct-field">
          <label class="ct-label"><i class="fa-solid fa-heading"></i> Başlık <span class="ct-req">*</span></label>
          <input id="ct-title" class="ct-input" type="text" placeholder="Konu başlığını girin..." maxlength="120" />
          <span class="ct-char-count" id="ct-title-count">0 / 120</span>
        </div>

        <!-- KATEGORİ -->
        <div class="ct-field">
          <label class="ct-label"><i class="fa-solid fa-tag"></i> Kategori <span class="ct-req">*</span></label>
          <select id="ct-category" class="ct-input ct-select">${catOptions}</select>
        </div>

        <!-- GÖRSEL -->
        <div class="ct-field">
          <label class="ct-label"><i class="fa-solid fa-image"></i> Kapak Görseli <span class="ct-opt">(isteğe bağlı, maks 2MB)</span></label>
          <div class="ct-image-zone" id="ct-image-zone" onclick="document.getElementById('ct-image-file').click()">
            <div class="ct-image-zone-inner" id="ct-image-zone-inner">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <span>Görsel seçmek için tıkla</span>
              <small>JPG, PNG, GIF — maks 2MB</small>
            </div>
          </div>
          <input type="file" id="ct-image-file" accept="image/jpeg,image/png,image/gif" style="display:none" onchange="ctImagePreview(this)" />
        </div>

        <!-- AÇIKLAMA / İÇERİK -->
        <div class="ct-field">
          <label class="ct-label"><i class="fa-solid fa-align-left"></i> İçerik <span class="ct-req">*</span></label>
          <div class="ct-toolbar">
            <button type="button" onclick="document.execCommand('bold')" title="Kalın"><i class="fa-solid fa-bold"></i></button>
            <button type="button" onclick="document.execCommand('italic')" title="İtalik"><i class="fa-solid fa-italic"></i></button>
            <button type="button" onclick="document.execCommand('underline')" title="Altı Çizili"><i class="fa-solid fa-underline"></i></button>
            <button type="button" onclick="ctInsertLink()" title="Link Ekle"><i class="fa-solid fa-link"></i></button>
            <button type="button" onclick="document.execCommand('insertOrderedList')" title="Numaralı Liste"><i class="fa-solid fa-list-ol"></i></button>
            <button type="button" onclick="document.execCommand('insertUnorderedList')" title="Madde İşaretli"><i class="fa-solid fa-list-ul"></i></button>
            <div class="reply-toolbar-sep"></div>
            <select class="reply-font-select" onchange="ctApplyFont(this.value)" title="Yazı Tipi">
              <option value="inherit">Normal</option>
              <option value="cursive">El Yazısı</option>
              <option value="'UnifrakturMaguntia',cursive">Fraktur</option>
              <option value="'Courier New',monospace">Kara Tahta</option>
            </select>
            <button type="button" onclick="ctInsertYoutube()" title="YouTube Ekle"><i class="fa-brands fa-youtube"></i></button>
            <button type="button" onclick="ctInsertTiktok()" title="TikTok Ekle"><i class="fa-brands fa-tiktok"></i></button>
          </div>
          <div id="ct-content" class="ct-editor" contenteditable="true" data-placeholder="Konu içeriğini buraya yaz..."></div>
        </div>

        <!-- ETİKETLER -->
        <div class="ct-field">
          <label class="ct-label"><i class="fa-solid fa-hashtag"></i> Etiketler <span class="ct-opt">(isteğe bağlı, maks 5)</span></label>
          <div class="ct-tags-wrap">
            <div class="ct-tags-list" id="ct-tags-list"></div>
            <div class="ct-tag-input-row">
              <input id="ct-tag-input" class="ct-input" type="text" placeholder="#oyun #cs gibi etiket yaz..." maxlength="30"
                onkeydown="ctTagKeydown(event)" oninput="ctTagAutoHash(this)" />
              <button type="button" class="ct-tag-add-btn" onclick="ctAddTag()"><i class="fa-solid fa-plus"></i></button>
            </div>
            <p class="ct-tag-hint">Enter veya virgülle ekle. Maks 5 etiket.</p>
          </div>
        </div>

        <!-- GÖNDER -->
        <div class="ct-actions">
          <button class="btn btn-ghost" onclick="backToForum()"><i class="fa-solid fa-xmark"></i> İptal</button>
          <button class="btn btn-primary ct-submit-btn" onclick="submitNewTopic()"><i class="fa-solid fa-paper-plane"></i> Konuyu Yayınla</button>
        </div>
      </div>
    </div>
  `;

  // Title char counter
  const titleInp = document.getElementById('ct-title');
  const titleCount = document.getElementById('ct-title-count');
  if (titleInp && titleCount) {
    titleInp.addEventListener('input', () => {
      titleCount.textContent = `${titleInp.value.length} / 120`;
    });
  }

  // Reset state
  window._ctTags = [];
  window._ctImageBase64 = null;
}

async function submitNewTopic() {
  const u = currentUser();
  if (!u) return;

  const title   = (document.getElementById('ct-title') || document.getElementById('nt-title'))?.value.trim();
  const catId   = (document.getElementById('ct-category') || document.getElementById('nt-category'))?.value;
  const content = (document.getElementById('ct-content') || document.getElementById('nt-content'))?.innerHTML?.trim();
  const tags    = window._ctTags || [];
  const image   = window._ctImageBase64 || null;

  if (!title)   return showToast('Başlık gerekli', 'error');
  if (!catId)   return showToast('Kategori seçin', 'error');
  if (!content || content === '<br>') return showToast('İçerik gerekli', 'error');

  // Disable submit btn
  const submitBtn = document.querySelector('.ct-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...'; }

  const cat = Forum.categories.find(c => c.id === catId);
  const topic = {
    id: uid(), title,
    content,
    cover_image: image,
    tags: tags,
    category_id: catId, category_name: cat?.name || '',
    author_id: u.id, author_name: u.username,
    author_role: u.role || 'user', author_badge_role: u.badge_role || null,
    author_premiumGradient: u.premiumGradient || null,
    author_avatar: u.avatar || null,
    is_pinned: false, is_locked: false, is_deleted: false,
    reply_count: 0, view_count: 0, like_count: 0, dislike_count: 0,
    super_liked: false, last_reply_at: null, last_reply_by: null,
  };

  const saved = await API.post('av_topics', topic);
  if (!saved) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Konuyu Yayınla'; }
    return showToast('Konu oluşturulamadı', 'error');
  }

  Forum.topics.unshift({ ...topic, created_at: Date.now() });
  showToast('Konu oluşturuldu! ✅', 'success');

  // Update user
  if (typeof State !== 'undefined') {
    State.currentUser.topics = (State.currentUser.topics || 0) + 1;
    if (typeof _saveCurrentUser === 'function') _saveCurrentUser();
    if (typeof addXP === 'function') addXP(5);
    if (typeof addActivity === 'function') addActivity(`Yeni konu: ${title}`, 'fa-solid fa-pen-to-square');
  }

  writeLog('topic', 'Konu oluşturuldu', title);
  renderTopicsList();
  updateForumStats();
  openTopic(saved.id);
}

/* ── Create Topic Page Helpers ── */
function ctImagePreview(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png','image/gif'].includes(file.type))
    return showToast('Sadece JPG/PNG/GIF kabul edilir', 'error');
  if (file.size > 2 * 1024 * 1024)
    return showToast('Görsel 2MB\'dan küçük olmalı', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    window._ctImageBase64 = e.target.result;
    const zone = document.getElementById('ct-image-zone-inner');
    if (zone) zone.innerHTML = `<img src="${e.target.result}" style="max-height:140px;max-width:100%;border-radius:8px;object-fit:cover" /><button type="button" onclick="ctClearImage(event)" style="margin-top:8px;background:rgba(239,68,68,.12);border:none;color:var(--danger);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:.8rem"><i class='fa-solid fa-trash'></i> Kaldır</button>`;
  };
  reader.readAsDataURL(file);
}

function ctClearImage(e) {
  e.stopPropagation();
  window._ctImageBase64 = null;
  const zone = document.getElementById('ct-image-zone-inner');
  if (zone) zone.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>Görsel seçmek için tıkla</span><small>JPG, PNG, GIF — maks 2MB</small>`;
  const fi = document.getElementById('ct-image-file');
  if (fi) fi.value = '';
}

function ctInsertLink() {
  const url = prompt('Link URL girin:');
  if (url) {
    document.getElementById('ct-content')?.focus();
    document.execCommand('createLink', false, url);
  }
}

function ctApplyFont(font) {
  const editor = document.getElementById('ct-content');
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontFamily = font;
    try { range.surroundContents(span); } catch(_) {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
  } else {
    showToast('Yazı tipini uygulamak için önce metin seçin', 'warning');
  }
}

function ctInsertYoutube() {
  const url = prompt('YouTube video URL girin:');
  if (!url || !url.trim()) return;
  const editor = document.getElementById('ct-content');
  if (!editor) return;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  const vidId = match ? match[1] : null;
  let html;
  if (vidId) {
    html = `<div style="margin:10px 0;border-radius:8px;overflow:hidden;max-width:560px">` +
      `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen style="display:block;border-radius:8px"></iframe></div>`;
  } else {
    html = `<a href="${escAttr(url)}" target="_blank" rel="noopener" style="color:var(--accent)">${url}</a>`;
  }
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

function ctInsertTiktok() {
  const url = prompt('TikTok video URL girin:');
  if (!url || !url.trim()) return;
  const editor = document.getElementById('ct-content');
  if (!editor) return;
  const html = `<div style="margin:10px 0;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:8px;max-width:360px">` +
    `<i class="fa-brands fa-tiktok" style="color:#69c9d0;margin-right:6px"></i>` +
    `<a href="${escAttr(url)}" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all">${url}</a></div>`;
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

function ctTagAutoHash(input) {
  let v = input.value;
  if (v && !v.startsWith('#')) { input.value = '#' + v; }
}

function ctTagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); ctAddTag(); }
}

function ctAddTag() {
  if (!window._ctTags) window._ctTags = [];
  const input = document.getElementById('ct-tag-input');
  if (!input) return;
  let val = input.value.trim().replace(/,/g, '');
  if (!val) return;
  if (!val.startsWith('#')) val = '#' + val;
  val = val.toLowerCase().replace(/[^#a-z0-9_ğüşıöç]/g, '');
  if (val.length < 2) return;
  if (window._ctTags.includes(val)) { showToast('Bu etiket zaten var', 'error'); input.value = ''; return; }
  if (window._ctTags.length >= 5) { showToast('En fazla 5 etiket ekleyebilirsin', 'error'); return; }
  window._ctTags.push(val);
  input.value = '';
  ctRenderTags();
}

function ctRenderTags() {
  const list = document.getElementById('ct-tags-list');
  if (!list) return;
  list.innerHTML = (window._ctTags || []).map((t, i) =>
    `<span class="ct-tag-chip">${escForum(t)}<button type="button" onclick="ctRemoveTag(${i})"><i class="fa-solid fa-xmark"></i></button></span>`
  ).join('');
}

function ctRemoveTag(idx) {
  if (!window._ctTags) return;
  window._ctTags.splice(idx, 1);
  ctRenderTags();
}

/* ─────────────────────────────────────────────
   EDIT TOPIC
───────────────────────────────────────────── */
async function showEditTopicModal(topicId) {
  const topic = await API.getOne('av_topics', topicId);
  if (!topic) return;
  const u = currentUser();
  if (!u || (u.id !== topic.author_id && !hasPerm('manage_forum'))) return showToast('Yetkiniz yok', 'error');

  document.getElementById('et-title').value = topic.title;
  document.getElementById('et-content').innerHTML = topic.content || '';
  document.getElementById('et-topic-id').value = topicId;

  const sel = document.getElementById('et-category');
  if (sel) {
    sel.innerHTML = Forum.categories.map(c =>
      `<option value="${c.id}"${c.id === topic.category_id ? ' selected' : ''}>${escForum(c.name)}</option>`).join('');
  }
  openModal('edit-topic-modal');
}

async function submitEditTopic() {
  const topicId = document.getElementById('et-topic-id')?.value;
  const title   = document.getElementById('et-title')?.value.trim();
  const catId   = document.getElementById('et-category')?.value;
  const content = document.getElementById('et-content')?.innerHTML?.trim();

  if (!title) return showToast('Başlık gerekli', 'error');
  const cat = Forum.categories.find(c => c.id === catId);
  const ok = await API.patch('av_topics', topicId, {
    title, category_id: catId, category_name: cat?.name || '', content,
  });
  if (!ok) return showToast('Güncelleme başarısız', 'error');

  closeModal('edit-topic-modal');
  showToast('Konu güncellendi', 'success');
  writeLog('topic', 'Konu düzenlendi', title);
  openTopic(topicId);
}

/* ─────────────────────────────────────────────
   DELETE TOPIC / REPLY
───────────────────────────────────────────── */
async function deleteTopic(topicId) {
  const u = currentUser();
  if (!u) return;
  const topic = Forum.topics.find(t => t.id === topicId) || await API.getOne('av_topics', topicId);
  if (!topic) return;
  if (u.id !== topic.author_id && !hasPerm('delete_topic')) return showToast('Yetkiniz yok', 'error');

  if (!confirm('Bu konuyu silmek istediğinizden emin misiniz?')) return;
  await API.patch('av_topics', topicId, { is_deleted: true });
  Forum.topics = Forum.topics.filter(t => t.id !== topicId);
  showToast('Konu silindi', 'success');
  writeLog('topic', 'Konu silindi', topic.title);
  backToForum();
}

async function deleteReply(replyId, topicId) {
  const u = currentUser();
  if (!u) return;
  const reply = await API.getOne('av_replies', replyId);
  if (!reply) return;
  if (u.id !== reply.author_id && !hasPerm('delete_reply')) return showToast('Yetkiniz yok', 'error');

  if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;
  await API.patch('av_replies', replyId, { is_deleted: true });

  // Update reply count
  const topic = await API.getOne('av_topics', topicId);
  if (topic) await API.patch('av_topics', topicId, { reply_count: Math.max(0, (topic.reply_count || 1) - 1) });

  const el = document.getElementById(`reply-${replyId}`);
  if (el) el.remove();
  showToast('Yorum silindi', 'success');
  writeLog('reply', 'Yorum silindi', replyId);
}

/* ─────────────────────────────────────────────
   EDIT REPLY
───────────────────────────────────────────── */
async function openEditReplyModal(replyId) {
  const reply = await API.getOne('av_replies', replyId);
  if (!reply) return;
  const u = currentUser();
  if (!u || u.id !== reply.author_id) return showToast('Yetkiniz yok', 'error');
  document.getElementById('er-content').innerHTML = reply.content || '';
  document.getElementById('er-reply-id').value = replyId;
  openModal('edit-reply-modal');
}

async function submitEditReply() {
  const replyId = document.getElementById('er-reply-id')?.value;
  const content = document.getElementById('er-content')?.innerHTML?.trim();
  if (!content) return showToast('İçerik boş olamaz', 'error');
  const ok = await API.patch('av_replies', replyId, { content, edited_at: new Date().toISOString() });
  if (!ok) return showToast('Güncelleme başarısız', 'error');
  closeModal('edit-reply-modal');
  showToast('Yorum güncellendi', 'success');
  openTopic(Forum.currentTopicId);
}

/* ─────────────────────────────────────────────
   VOTING
───────────────────────────────────────────── */
/* In-memory vote cache to avoid repeated API round-trips */
const _voteCache = {}; // key: `${type}_${targetId}_${userId}` → { id, vote }

async function _ensureVoteCache(u) {
  if (_voteCache.__loaded) return;
  const all = await API.get('av_votes');
  all.forEach(v => { _voteCache[`${v.target_type}_${v.target_id}_${v.user_id}`] = { id: v.id, vote: v.vote }; });
  _voteCache.__loaded = true;
}

async function voteTopic(topicId, vote) {
  const u = currentUser();
  if (!u) return showToast('Oy vermek için giriş yapın', 'error');

  // Optimistic: read current UI counts immediately
  const lcEl = document.getElementById('tl-count');
  const dcEl = document.getElementById('tdl-count');
  let curLike    = parseInt(lcEl?.textContent || '0', 10);
  let curDislike = parseInt(dcEl?.textContent || '0', 10);

  await _ensureVoteCache(u);
  const cacheKey = `topic_${topicId}_${u.id}`;
  const existing = _voteCache[cacheKey];

  let likeDelta = 0, dislikeDelta = 0;
  if (existing) {
    if (existing.vote === vote) {
      likeDelta = vote === 'like' ? -1 : 0;
      dislikeDelta = vote === 'dislike' ? -1 : 0;
      delete _voteCache[cacheKey];
      API.del('av_votes', existing.id);
    } else {
      likeDelta    = vote === 'like'    ?  1 : -1;
      dislikeDelta = vote === 'dislike' ?  1 : -1;
      _voteCache[cacheKey].vote = vote;
      API.patch('av_votes', existing.id, { vote });
    }
  } else {
    const newId = uid();
    likeDelta    = vote === 'like'    ? 1 : 0;
    dislikeDelta = vote === 'dislike' ? 1 : 0;
    _voteCache[cacheKey] = { id: newId, vote };
    API.post('av_votes', { id: newId, user_id: u.id, target_id: topicId, target_type: 'topic', vote });
  }

  const newLike    = Math.max(0, curLike    + likeDelta);
  const newDislike = Math.max(0, curDislike + dislikeDelta);
  if (lcEl) lcEl.textContent = newLike;
  if (dcEl) dcEl.textContent = newDislike;
  // Fire-and-forget DB update
  API.patch('av_topics', topicId, { like_count: newLike, dislike_count: newDislike });
}

async function voteReply(replyId, vote) {
  const u = currentUser();
  if (!u) return showToast('Oy vermek için giriş yapın', 'error');

  const lEl = document.getElementById(`rl-count-${replyId}`);
  const dEl = document.getElementById(`rdl-count-${replyId}`);
  let curLike    = parseInt(lEl?.textContent || '0', 10);
  let curDislike = parseInt(dEl?.textContent || '0', 10);

  await _ensureVoteCache(u);
  const cacheKey = `reply_${replyId}_${u.id}`;
  const existing = _voteCache[cacheKey];

  let likeDelta = 0, dislikeDelta = 0;
  if (existing) {
    if (existing.vote === vote) {
      likeDelta    = vote === 'like'    ? -1 : 0;
      dislikeDelta = vote === 'dislike' ? -1 : 0;
      delete _voteCache[cacheKey];
      API.del('av_votes', existing.id);
    } else {
      likeDelta    = vote === 'like'    ?  1 : -1;
      dislikeDelta = vote === 'dislike' ?  1 : -1;
      _voteCache[cacheKey].vote = vote;
      API.patch('av_votes', existing.id, { vote });
    }
  } else {
    const newId = uid();
    likeDelta    = vote === 'like'    ? 1 : 0;
    dislikeDelta = vote === 'dislike' ? 1 : 0;
    _voteCache[cacheKey] = { id: newId, vote };
    API.post('av_votes', { id: newId, user_id: u.id, target_id: replyId, target_type: 'reply', vote });
  }

  const nl = Math.max(0, curLike    + likeDelta);
  const nd = Math.max(0, curDislike + dislikeDelta);
  if (lEl) lEl.textContent = nl;
  if (dEl) dEl.textContent = nd;
  API.patch('av_replies', replyId, { like_count: nl, dislike_count: nd });

}

/* ─────────────────────────────────────────────
   MOD ACTIONS
───────────────────────────────────────────── */
async function togglePin(topicId, current) {
  if (!hasPerm('pin_topic')) return showToast('Yetkiniz yok', 'error');
  await API.patch('av_topics', topicId, { is_pinned: !current });
  showToast(current ? 'Sabit kaldırıldı' : 'Konu sabitlendi', 'success');
  writeLog('moderator', current ? 'Sabit kaldırıldı' : 'Konu sabitlendi', topicId);
  openTopic(topicId);
}

async function toggleLock(topicId, current) {
  if (!hasPerm('lock_topic')) return showToast('Yetkiniz yok', 'error');
  await API.patch('av_topics', topicId, { is_locked: !current });
  showToast(current ? 'Kilit açıldı' : 'Konu kilitlendi', 'success');
  writeLog('moderator', current ? 'Kilit açıldı' : 'Konu kilitlendi', topicId);
  openTopic(topicId);
}

async function toggleSuperLike(topicId, current) {
  if (!hasPerm('super_like')) return showToast('Yetkiniz yok', 'error');
  await API.patch('av_topics', topicId, { super_liked: !current });
  showToast(current ? 'Öne çıkma kaldırıldı' : 'Konu öne çıkarıldı ⭐', 'success');
  writeLog('moderator', current ? 'Süper beğeni kaldırıldı' : 'Süper beğeni verildi', topicId);
  const idx = Forum.topics.findIndex(t => t.id === topicId);
  if (idx >= 0) Forum.topics[idx].super_liked = !current;
  openTopic(topicId);
}

/* ─────────────────────────────────────────────
   REPORT
───────────────────────────────────────────── */
function openReportModal(targetId, targetType, targetTitle) {
  const u = currentUser();
  if (!u) return showToast('Raporlamak için giriş yapın', 'error');
  document.getElementById('report-target-id').value    = targetId;
  document.getElementById('report-target-type').value  = targetType;
  document.getElementById('report-target-title').value = targetTitle;
  openModal('report-modal');
}

async function submitReport() {
  const u = currentUser();
  if (!u) return;
  const targetId    = document.getElementById('report-target-id')?.value;
  const targetType  = document.getElementById('report-target-type')?.value;
  const targetTitle = document.getElementById('report-target-title')?.value;
  const reason      = document.getElementById('report-reason')?.value;

  const report = {
    id: uid(), reporter_id: u.id, reporter_name: u.username,
    target_id: targetId, target_type: targetType, target_title: targetTitle,
    reason, status: 'open', resolved_by: null, resolved_at: null, resolver_note: null,
  };
  await API.post('av_reports', report);
  closeModal('report-modal');
  showToast('Rapor gönderildi. Teşekkürler!', 'success');
}

/* ─────────────────────────────────────────────
   MUTE / BAN
───────────────────────────────────────────── */
function openMuteModal(userId, userName) {
  if (!hasPerm('mute_user')) return showToast('Yetkiniz yok', 'error');
  document.getElementById('mute-target-id').value   = userId;
  document.getElementById('mute-target-name').value = userName;
  document.getElementById('mute-hours').value = '24';
  openModal('mute-modal');
}

async function submitMute() {
  const targetId = document.getElementById('mute-target-id')?.value;
  const name     = document.getElementById('mute-target-name')?.value;
  const hours    = parseInt(document.getElementById('mute-hours')?.value) || 24;
  if (hours > 72) return showToast('Maksimum 72 saat', 'error');

  const until = new Date(Date.now() + hours * 3600000).toISOString();
  // Find user record and update
  const users = await API.get('av_users');
  const target = users.find(u => u.id === targetId);
  if (target) await API.patch('av_users', target.id, { muted_until: until });

  closeModal('mute-modal');
  showToast(`${name} ${hours} saat susturuldu`, 'success');
  writeLog('moderator', `Kullanıcı susturuldu (${hours}s)`, name);
}

function openBanModal(userId, userName) {
  if (!hasPerm('ban_user')) return showToast('Yetkiniz yok', 'error');
  document.getElementById('ban-target-id').value   = userId;
  document.getElementById('ban-target-name').value = userName;
  document.getElementById('ban-hours').value = '24';
  openModal('ban-modal');
}

async function submitBan() {
  const targetId = document.getElementById('ban-target-id')?.value;
  const name     = document.getElementById('ban-target-name')?.value;
  const hours    = parseInt(document.getElementById('ban-hours')?.value) || 24;
  if (hours > 72) return showToast('Maksimum 72 saat', 'error');

  const until = new Date(Date.now() + hours * 3600000).toISOString();
  const users = await API.get('av_users');
  const target = users.find(u => u.id === targetId);
  if (target) await API.patch('av_users', target.id, { banned_until: until });

  closeModal('ban-modal');
  showToast(`${name} ${hours} saat uzaklaştırıldı`, 'success');
  writeLog('moderator', `Kullanıcı uzaklaştırıldı (${hours}s)`, name);
}

/* ─────────────────────────────────────────────
   RICH EDITOR HELPERS
───────────────────────────────────────────── */
function rtCmd(cmd) { document.execCommand(cmd, false); }
function rtReplyCmd(cmd) { document.execCommand(cmd, false); }

function rtInsertLink() {
  const url = prompt('Link URL:', 'https://');
  if (url) document.execCommand('createLink', false, url);
}
function rtReplyInsertLink() {
  const url = prompt('Link URL:', 'https://');
  if (url) document.execCommand('createLink', false, url);
}

const FORUM_EMOJIS = ['😀','😂','😍','🔥','👍','🎮','💪','😎','🤝','🏆','❤️','😭','🙏','💬','⚡','😅','🤣','😊','🥳','🎉','🎯','🛡️','⚔️','🎖️','🌟'];

function toggleEmojiPickerRT(editorId) {
  const pickerId = editorId + '-emoji';
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  if (!picker.innerHTML) {
    picker.innerHTML = FORUM_EMOJIS.map(e =>
      `<span class="emoji-btn" onclick="insertEmojiRT('${editorId}','${e}')">${e}</span>`).join('');
  }
  picker.classList.toggle('open');
}

function insertEmojiRT(editorId, emoji) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  editor.focus();
  document.execCommand('insertText', false, emoji);
  const picker = document.getElementById(editorId + '-emoji');
  if (picker) picker.classList.remove('open');
}

function toggleReplyEmoji() {
  const picker = document.getElementById('reply-emoji-picker');
  if (!picker) return;
  picker.classList.toggle('open');
}
function insertEmojiReply(emoji) {
  const editor = document.getElementById('reply-editor');
  if (!editor) return;
  editor.focus();
  document.execCommand('insertText', false, emoji);
  const picker = document.getElementById('reply-emoji-picker');
  if (picker) picker.classList.remove('open');
}

/* ─────────────────────────────────────────────
   KULLANICI PROFİL SAYFASI (Tam Sayfa)
───────────────────────────────────────────── */

// Geri dönmek için önceki sayfayı saklıyoruz
let _profileReturnPage = 'forum';

async function openUserProfileCard(userId) {
  if (!userId) return;

  // Şu anki sayfayı hatırla (forum veya topic)
  const activePageEl = document.querySelector('.page.active');
  _profileReturnPage = activePageEl?.id?.replace('page-', '') || 'forum';

  // Yükleniyor ekranı
  const wrap = document.getElementById('user-profile-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="upf-loading"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><span>Profil yükleniyor...</span></div>`;
  showPage('user-profile');

  // DB'den kullanıcı çek
  let user = null;
  try {
    const all = await API.get('av_users');
    user = all.find(u => u.id === userId) || null;
  } catch (_) { /* ignore */ }

  if (!user) {
    wrap.innerHTML = `<div class="upf-loading" style="color:var(--danger)"><i class="fa-solid fa-circle-exclamation fa-2x"></i><span>Kullanıcı bulunamadı</span></div>`;
    return;
  }

  renderUserProfilePage(user);
}

async function renderUserProfilePage(user) {
  const wrap = document.getElementById('user-profile-wrap');
  if (!wrap) return;

  const roleMap = {
    super_admin:     { color: '#f5c518', label: 'Kurucu',          icon: 'fa-crown' },
    admin:           { color: '#f59e0b', label: 'Yönetici',        icon: 'fa-shield-halved' },
    super_moderator: { color: '#a78bfa', label: 'De. Moderatör',   icon: 'fa-user-shield' },
    moderator:       { color: '#38bdf8', label: 'Moderatör',       icon: 'fa-user-check' },
    user:            { color: '#6b7280', label: 'Üye',             icon: 'fa-user' },
    '':              { color: '#6b7280', label: 'Üye',             icon: 'fa-user' },
  };
  const userRole = (user.role && user.role !== '') ? user.role : 'user';
  const roleEntry = roleMap[userRole] || roleMap.user;

  // Gizlenmiş ad-soyad: "A*** B***"
  const rawFull = (user.fullname || user.full_name || '').trim();
  function maskName(n) {
    if (!n) return '—';
    return n.split(' ').map(w => w.length <= 1 ? w : w[0] + '*'.repeat(w.length - 1)).join(' ');
  }
  const maskedFull = maskName(rawFull);

  // Avatar
  const avatarHtml = user.avatar
    ? `<img src="${escAttr(user.avatar)}" class="upf-avatar-img" />`
    : `<div class="upf-avatar-initial">${(user.username || '?')[0].toUpperCase()}</div>`;

  const me = currentUser();
  const isSelf = me && me.id === user.id;

  // Premium gradient username
  const upfGradStyle = premiumGradientStyle(user.premiumGradient);
  const upfUsernameHtml = upfGradStyle
    ? `<span style="${upfGradStyle}">${escForum(user.username)}</span>`
    : escForum(user.username);

  // Üye etiketi badge
  const badgeHtml = user.badge_role && BADGE_ROLE_MAP[user.badge_role]
    ? `<span class="upf-role-badge" style="background:${BADGE_ROLE_MAP[user.badge_role].color}22;color:${BADGE_ROLE_MAP[user.badge_role].color};border:1px solid ${BADGE_ROLE_MAP[user.badge_role].color}55">
        <i class="fa-solid fa-tag"></i> ${BADGE_ROLE_MAP[user.badge_role].label}
       </span>`
    : '';

  // ─── Kayıt yaşı
  function joinAge(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    const now = new Date();
    const yr = d.getFullYear();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1)   return `${yr}'de kayıt oldu, bugün`;
    if (diffDays < 30)  return `${yr}'de kayıt oldu, ${diffDays} gün`;
    if (diffDays < 365) return `${yr}'de kayıt oldu, ${Math.floor(diffDays/30)} ay`;
    const yrs = Math.floor(diffDays/365);
    return `${yr}'de kayıt oldu, ${yrs} yıl`;
  }
  const joinAgeStr = joinAge(user.join_date || user.created_at);

  // ─── Son ziyaret
  function lastSeenStr(iso) {
    if (!iso) return '—';
    return timeAgo(typeof iso === 'string' ? new Date(iso).getTime() : iso);
  }
  const lastSeen = lastSeenStr(user.last_seen);

  // ─── Doğum tarihi
  const birthDate = user.birth_date ? user.birth_date : '—';

  // ─── Aktiflik süresi (xp proxy)
  const totalXp = user.xp || 0;

  // ─── Alınan toplam görüntülenme (topics aggregate — best effort from loaded topics)
  let totalViews = user.total_views || 0;
  let totalLikes = user.total_likes || 0;
  let solvedTopics = user.solved_topics || 0;
  try {
    const allTopics = Forum.topics.filter(t => t.author_id === user.id && !t.is_deleted);
    if (allTopics.length > 0) {
      totalViews = allTopics.reduce((s, t) => s + (t.view_count || 0), 0);
      totalLikes = allTopics.reduce((s, t) => s + (t.like_count || 0), 0);
      solvedTopics = allTopics.filter(t => t.is_solved).length;
    }
  } catch(_) {}

  const topics  = user.topics  || 0;
  const replies = user.replies || 0;
  const repPts  = user.rep_points || 0;
  const refs    = user.referrals  || 0;

  // Referans ve rep puan gönderme yetkileri
  const alreadyGaveRef = me ? !!localStorage.getItem(`upf-ref-given-${me.id}-${user.id}`) : false;
  const canGiveRef = me && !isSelf && !alreadyGaveRef;
  const canGiveRep = me && !isSelf && (userLevel(me) >= 30); // Yönetici+

  // Referans butonu HTML (tek bir buton satırı — sadece info-row içinde gösterilir)
  const refBtns = me && !isSelf ? (alreadyGaveRef
    ? `<div class="upf-ref-row"><span style="font-size:.8rem;color:var(--text-muted);font-style:italic"><i class="fa-solid fa-check" style="color:#d4aa20"></i> Referans verildi</span></div>`
    : `<div class="upf-ref-row">
        <span style="font-size:.82rem;color:var(--text-muted)">Referans ver:</span>
        <button class="upf-ref-btn upf-ref-pos" onclick="upfGiveRef('${user.id}',1)" title="+1 Referans"><i class="fa-solid fa-thumbs-up"></i></button>
        <button class="upf-ref-btn upf-ref-neg" onclick="upfGiveRef('${user.id}',-1)" title="-1 Referans"><i class="fa-solid fa-thumbs-down"></i></button>
      </div>`
  ) : '';

  // Rep puan butonu
  const repBtn = canGiveRep ? `
    <button class="upf-rep-btn" onclick="upfGiveRep('${user.id}','${escAttr(user.username)}')">
      <i class="fa-solid fa-star"></i> Rep Puan Ver
    </button>` : '';

  const actionBtns = !isSelf && me ? `
    <div class="upf-actions">
      <button class="upf-btn-friend" id="upf-friend-btn" onclick="upfSendFriendRequest('${user.id}','${escAttr(user.username)}')">
        <i class="fa-solid fa-user-plus"></i> Arkadaş İsteği
      </button>
      ${repBtn}
      <button class="upf-btn-report" onclick="upfReport('${user.id}','${escAttr(user.username)}')">
        <i class="fa-solid fa-flag"></i> Rapor Et
      </button>
    </div>
  ` : '';

  wrap.innerHTML = `
    <div class="upf-page">
      <button class="upf-back-btn" onclick="showPage('${_profileReturnPage}')">
        <i class="fa-solid fa-arrow-left"></i> Geri Dön
      </button>

      <div class="upf-card">
        <!-- Banner -->
        <div class="upf-banner" style="background:linear-gradient(135deg,${roleEntry.color}33,transparent)">
          <div class="upf-banner-overlay"></div>
        </div>

        <!-- Avatar & İsim -->
        <div class="upf-hero">
          <div class="upf-avatar" style="border-color:${roleEntry.color}">
            ${avatarHtml}
          </div>
          <div class="upf-hero-info">
            <h1 class="upf-username">${upfUsernameHtml}</h1>
            <div class="upf-fullname"><i class="fa-solid fa-id-card"></i> ${escForum(maskedFull)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
              <span class="upf-role-badge" style="background:${roleEntry.color}22;color:${roleEntry.color};border:1px solid ${roleEntry.color}55;padding:4px 10px;border-radius:6px;font-size:.8rem;font-weight:700;display:inline-flex;align-items:center;gap:5px">
                <i class="fa-solid ${roleEntry.icon}"></i> ${roleEntry.label}
              </span>
              ${badgeHtml}
            </div>
          </div>
        </div>

        <!-- İçerik: 3 bölüm -->
        <div class="upf-sections">

          <!-- GENEL BİLGİLER -->
          <div class="upf-section-card">
            <div class="upf-section-title"><i class="fa-solid fa-circle-info"></i> Genel Bilgiler</div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-at"></i> Kullanıcı Adı</span><span class="upf-info-val">${escForum(user.username)}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-id-card"></i> Ad-Soyad</span><span class="upf-info-val">${escForum(maskedFull)}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-shield-halved"></i> Yetki</span>
              <span class="upf-info-val">
                <span style="color:${roleEntry.color};font-weight:700"><i class="fa-solid ${roleEntry.icon}"></i> ${roleEntry.label}</span>
                ${user.badge_role && BADGE_ROLE_MAP[user.badge_role] ? `&nbsp;<span style="color:${BADGE_ROLE_MAP[user.badge_role].color};font-size:.8rem">${BADGE_ROLE_MAP[user.badge_role].label}</span>` : ''}
              </span>
            </div>
          </div>

          <!-- KULLANICI BİLGİLERİ -->
          <div class="upf-section-card">
            <div class="upf-section-title"><i class="fa-solid fa-user-clock"></i> Kullanıcı Bilgileri</div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-calendar-plus"></i> Kayıt Yaşı</span><span class="upf-info-val">${joinAgeStr}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-cake-candles"></i> Doğum Tarihi</span><span class="upf-info-val">${birthDate !== '—' ? escForum(birthDate) : '<span style="color:var(--text-muted)">Belirtilmemiş</span>'}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-clock"></i> Son Ziyaret</span><span class="upf-info-val">${lastSeen}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-eye"></i> Alınan Görüntülenme</span><span class="upf-info-val" style="font-weight:700;color:var(--accent)">${totalViews.toLocaleString()}</span></div>
            <div class="upf-info-row"><span class="upf-info-lbl"><i class="fa-solid fa-stopwatch"></i> Aktiflik Süresi</span><span class="upf-info-val">${totalXp.toLocaleString()} XP</span></div>
            <div class="upf-info-row">
              <span class="upf-info-lbl"><i class="fa-solid fa-people-arrows"></i> Referanslar</span>
              <span class="upf-info-val upf-refs-val" id="upf-refs-val-${user.id}">
                <span style="color:#d4aa20;font-weight:700">+${Math.max(0,refs)}</span>
                &nbsp;/&nbsp;
                <span style="color:#ef4444;font-weight:700">${Math.min(0,refs)}</span>
                &nbsp;<span style="color:var(--text-muted);font-size:.8rem">(net: ${refs})</span>
              </span>
              ${refBtns}
            </div>
          </div>

          <!-- FORUM BİLGİLERİ -->
          <div class="upf-section-card">
            <div class="upf-section-title"><i class="fa-solid fa-comments"></i> Forum Bilgileri</div>
            <div class="upf-forum-stats">
              <div class="upf-fstat"><div class="upf-fstat-val">${topics}</div><div class="upf-fstat-lbl"><i class="fa-solid fa-pen-to-square"></i> Konu</div></div>
              <div class="upf-fstat"><div class="upf-fstat-val">${replies}</div><div class="upf-fstat-lbl"><i class="fa-solid fa-comment"></i> Yorum</div></div>
              <div class="upf-fstat"><div class="upf-fstat-val" style="color:#f59e0b">${totalLikes}</div><div class="upf-fstat-lbl"><i class="fa-solid fa-thumbs-up"></i> Beğeni</div></div>
              <div class="upf-fstat"><div class="upf-fstat-val" style="color:#d4aa20">${solvedTopics}</div><div class="upf-fstat-lbl"><i class="fa-solid fa-circle-check"></i> Çözüm</div></div>
              <div class="upf-fstat"><div class="upf-fstat-val" style="color:#a78bfa">${repPts}</div><div class="upf-fstat-lbl"><i class="fa-solid fa-star"></i> Rep</div></div>
            </div>
            ${actionBtns}
          </div>

        </div>
      </div>
    </div>
  `;
}

function upfSendFriendRequest(userId, username) {
  if (typeof sendFriendRequest === 'function') {
    sendFriendRequest(userId, username);
  } else {
    showToast(`@${username} kişisine arkadaş isteği gönderildi 🤝`, 'success');
  }
  const btn = document.getElementById('upf-friend-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-check"></i> İstek Gönderildi'; }
}

function upfReport(userId, username) {
  if (typeof openReportModal === 'function') {
    openReportModal(userId, 'user', username);
  } else {
    showToast(`@${username} raporlandı`, 'success');
  }
}

async function upfGiveRef(userId, delta) {
  const me = currentUser();
  if (!me) return showToast('Giriş yapmanız gerekiyor', 'error');

  // Kalıcı: aynı hesaba bir kez referans verilebilir (24h kısıtı yok)
  const key = `upf-ref-given-${me.id}-${userId}`;
  if (localStorage.getItem(key)) {
    return showToast('Bu kullanıcıya daha önce referans verdiniz. Her hesaba yalnızca 1 kez referans verilebilir.', 'warning');
  }

  try {
    const target = await API.getOne('av_users', userId);
    if (!target) return showToast('Kullanıcı bulunamadı', 'error');
    const newRefs = (target.referrals || 0) + delta;
    await API.patch('av_users', userId, { referrals: newRefs });

    // Kalıcı işaretleme (asla sıfırlanmaz)
    localStorage.setItem(key, '1');

    // Update UI
    const el = document.getElementById(`upf-refs-val-${userId}`);
    if (el) {
      const net = newRefs;
      const pos = Math.max(0, net);
      const neg = Math.min(0, net);
      el.innerHTML = `<span style="color:#d4aa20;font-weight:700">+${pos}</span>&nbsp;/&nbsp;<span style="color:#ef4444;font-weight:700">${neg}</span>&nbsp;<span style="color:var(--text-muted);font-size:.8rem">(net: ${net})</span>`;
    }

    // Referans butonlarını gizle (artık verilemez)
    const refRow = document.querySelector('.upf-ref-row');
    if (refRow) {
      refRow.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted);font-style:italic"><i class="fa-solid fa-check" style="color:#d4aa20"></i> Referans verildi</span>`;
    }

    showToast(delta > 0 ? 'Pozitif referans verildi 👍' : 'Negatif referans verildi 👎', 'success');
  } catch(_) { showToast('Referans verilemedi', 'error'); }
}

async function upfGiveRep(userId, username) {
  const me = currentUser();
  if (!me) return showToast('Giriş yapmanız gerekiyor', 'error');
  if (userLevel(me) < 30) return showToast('Rep puan vermek için Yönetici yetkisi gereklidir', 'error');
  const pts = parseInt(prompt(`@${username} için kaç rep puan vermek istiyorsunuz? (negatif de olabilir)`) || '0');
  if (isNaN(pts) || pts === 0) return;
  try {
    const target = await API.getOne('av_users', userId);
    if (!target) return showToast('Kullanıcı bulunamadı', 'error');
    const newRep = (target.rep_points || 0) + pts;
    await API.patch('av_users', userId, { rep_points: newRep });
    showToast(`@${username} kullanıcısına ${pts > 0 ? '+' : ''}${pts} rep puan verildi`, 'success');
  } catch(_) { showToast('Rep puan verilemedi', 'error'); }
}

/* ─────────────────────────────────────────────
   MODAL HELPERS (defined in app.js — kept here for reference)
───────────────────────────────────────────── */
// openModal / closeModal are defined in app.js and shared globally

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
});

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function backToForum() {
  Forum.currentTopicId = null;
  showPage('forum');
  loadTopics();
}

/* ─────────────────────────────────────────────
   LOG SYSTEM (max 50 per category)
───────────────────────────────────────────── */
async function writeLog(category, action, target = '') {
  const u = currentUser();
  const log = {
    id: uid(),
    category,
    username: u?.username || 'misafir',
    ip: '—', // client-side can't get real IP
    action,
    target: String(target).slice(0, 120),
    ts: new Date().toISOString(),
  };
  await API.post('av_logs', log);

  // Enforce max 50 per category
  const all = await API.get('av_logs');
  const catLogs = all.filter(l => l.category === category);
  if (catLogs.length > 50) {
    catLogs.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const toDelete = catLogs.slice(0, catLogs.length - 50);
    for (const l of toDelete) await API.del('av_logs', l.id);
  }
}

// Also log login/logout
const _origLoginUser = typeof loginUser !== 'undefined' ? loginUser : null;
if (typeof loginUser !== 'undefined') {
  const _origLogin = loginUser;
  window.loginUser = function(user) {
    _origLogin(user);
    writeLog('login', 'Giriş yapıldı', user.username);
  };
}
if (typeof logout !== 'undefined') {
  const _origLogout = logout;
  window.logout = function() {
    const u = currentUser();
    if (u) writeLog('logout', 'Çıkış yapıldı', u.username);
    _origLogout();
  };
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60)    return 'Az önce';
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `${d}g önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

function escForum(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// Override showToast if not available
if (typeof showToast === 'undefined') {
  window.showToast = function(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  };
}
