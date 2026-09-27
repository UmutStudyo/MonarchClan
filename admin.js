/* ================================================================
   MONARCH GAMING — Admin Panel JavaScript
   ================================================================ */
'use strict';

/* ─────────────────────────────────────────────
   API
───────────────────────────────────────────── */
const AdminAPI = {
  async get(table, params = {}) {
    const q = new URLSearchParams({ limit: 500, ...params });
    const r = await fetch(`tables/${table}?${q}`);
    return r.ok ? (await r.json()).data || [] : [];
  },
  async getOne(table, id) {
    const r = await fetch(`tables/${table}/${id}`);
    return r.ok ? await r.json() : null;
  },
  async post(table, data) {
    const r = await fetch(`tables/${table}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : null;
  },
  async patch(table, id, data) {
    const r = await fetch(`tables/${table}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return r.ok ? await r.json() : null;
  },
  async del(table, id) {
    const r = await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
    return r.ok;
  },
};

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
const Admin = {
  currentUser: null,
  roles: [],
  users: [],
  topics: [],
  replies: [],
  reports: [],
  announcements: [],
  market: [],
  staff: [],
  logs: {},
  settings: {},
  gallery: [],
  staffReports: [],
  sessions: [],
  loginHistory: [],
  roleHistory: [],
  notifications: [],
  analyticsMode: 'daily',
};

const ICON_LIST = [
  'fa-solid fa-user','fa-solid fa-user-tie','fa-solid fa-user-gear','fa-solid fa-shield-halved',
  'fa-solid fa-shield-cat','fa-solid fa-crown','fa-solid fa-star','fa-solid fa-gem',
  'fa-solid fa-fire','fa-solid fa-bolt','fa-solid fa-skull','fa-solid fa-ghost',
  'fa-solid fa-dragon','fa-solid fa-gavel','fa-solid fa-hand-fist','fa-solid fa-eye',
  'fa-solid fa-key','fa-solid fa-lock','fa-solid fa-medal','fa-solid fa-trophy',
  'fa-solid fa-code','fa-solid fa-headset','fa-solid fa-wrench','fa-solid fa-bug',
  'fa-solid fa-heart','fa-solid fa-paw','fa-solid fa-rocket','fa-solid fa-chess-knight',
  'fa-solid fa-flag','fa-solid fa-anchor','fa-solid fa-bomb','fa-solid fa-atom',
];

const ROLE_LEVEL = { user: 0, moderator: 10, super_moderator: 20, admin: 30, super_admin: 40 };
const ROLE_LABELS = { user: 'Kullanıcı', moderator: 'Moderatör', super_moderator: 'De. Moderatör', admin: 'Yönetici', super_admin: 'Kurucu' };
const ROLE_COLORS = { user: '#a3b8aa', moderator: '#38bdf8', super_moderator: '#a78bfa', admin: '#f59e0b', super_admin: '#22c55e' };

// Üye etiketleri (badge_role) — temel rolden bağımsız
const BADGE_ROLE_LABELS = {
  banned:          { label: 'Yasaklı Üye',      color: '#dc2626', minLevel: 30 },  // admin+
  guest_member:    { label: 'Misafir Üye',       color: '#94a3b8', minLevel: 20 },  // de.mod+
  active_member:   { label: 'Aktif Üye',         color: '#22c55e', minLevel: 10 },  // mod+
  senior_member:   { label: 'Kıdemli Üye',       color: '#3b82f6', minLevel: 10 },  // mod+
  veteran_member:  { label: 'Emektar Üye',       color: '#f59e0b', minLevel: 30 },  // admin+
  gv_editor:       { label: 'G/V Editörü',       color: '#8b5cf6', minLevel: 10 },  // mod+
  sharer:          { label: 'Paylaşımcı',        color: '#06b6d4', minLevel: 10 },  // mod+
  content_creator: { label: 'İçerik Üreticisi',  color: '#f97316', minLevel: 10 },  // mod+
  youtuber:        { label: 'Youtuber',          color: '#ef4444', minLevel: 10 },  // mod+
};

const ALL_PERMS = [
  { key: 'delete_topic',          label: 'Konu Sil' },
  { key: 'delete_reply',          label: 'Yorum Sil' },
  { key: 'lock_topic',            label: 'Konu Kilitle' },
  { key: 'pin_topic',             label: 'Konu Sabitle' },
  { key: 'mute_user',             label: 'Kullanıcı Sustur' },
  { key: 'ban_user',              label: 'Kullanıcı Uzaklaştır' },
  { key: 'manage_reports',        label: 'Rapor Yönetimi' },
  { key: 'manage_users',          label: 'Kullanıcı Yönetimi' },
  { key: 'manage_forum',          label: 'Forum Yönetimi' },
  { key: 'manage_announcements',  label: 'Duyuru Yönetimi' },
  { key: 'manage_market',         label: 'Market Yönetimi' },
  { key: 'manage_staff',          label: 'Kadro Yönetimi' },
  { key: 'super_like',            label: 'Süper Beğeni' },
  { key: 'manage_roles',          label: 'Rol Yönetimi' },
  { key: 'manage_site',           label: 'Site Yönetimi' },
  { key: 'manage_logs',           label: 'Log Görüntüleme' },
];

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
async function adminInit() {
  try { Admin.currentUser = JSON.parse(localStorage.getItem('av-user') || 'null'); } catch(e) {}
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  // De. Moderatör (level 20) ve üstü panel erişimi alır
  if (!Admin.currentUser || myLevel < 20) {
    const deniedEl = document.getElementById('access-denied');
    const layoutEl = document.getElementById('admin-layout');
    if (deniedEl) deniedEl.style.display = 'flex';
    if (layoutEl) layoutEl.style.display = 'none';
    return;
  }
  const deniedEl = document.getElementById('access-denied');
  const layoutEl = document.getElementById('admin-layout');
  if (deniedEl) deniedEl.style.display = 'none';
  if (layoutEl) layoutEl.style.display = '';

  const u = Admin.currentUser;
  const avatarEl = document.getElementById('sb-user-avatar');
  if (avatarEl) {
    if (u.avatar) avatarEl.innerHTML = `<img src="${u.avatar}" />`;
    else avatarEl.textContent = (u.username || '?')[0].toUpperCase();
  }
  _el('sb-user-name', el => el.textContent = u.username);
  _el('sb-user-role', el => el.textContent = ROLE_LABELS[u.role] || u.role);

  await loadAllData();
  renderAdminSidebar();
  showAdminSection('web-stats');
  applyTheme(localStorage.getItem('av-theme') || 'dark');
}

async function loadAllData() {
  [
    Admin.users, Admin.roles, Admin.topics, Admin.replies,
    Admin.reports, Admin.announcements, Admin.market, Admin.staff,
    Admin.gallery, Admin.staffReports, Admin.sessions, Admin.loginHistory,
    Admin.roleHistory, Admin.notifications,
  ] = await Promise.all([
    AdminAPI.get('av_users'), AdminAPI.get('av_roles'),
    AdminAPI.get('av_topics'), AdminAPI.get('av_replies'),
    AdminAPI.get('av_reports'), AdminAPI.get('av_announcements'),
    AdminAPI.get('av_market'), AdminAPI.get('av_staff'),
    AdminAPI.get('av_gallery'), AdminAPI.get('av_staff_reports'),
    AdminAPI.get('av_sessions'), AdminAPI.get('av_login_history'),
    AdminAPI.get('av_role_history'), AdminAPI.get('av_notifications'),
  ]);

  const settingsArr = await AdminAPI.get('av_site_settings');
  Admin.settings = {};
  settingsArr.forEach(s => { Admin.settings[s.key] = { id: s.id, value: s.value }; });
}

/* ─────────────────────────────────────────────
   NAVIGATION — DYNAMIC SIDEBAR
───────────────────────────────────────────── */
/*
  Rol Seviyeleri:
    user=0 | moderator=10 (Moderatör) | super_moderator=20 (De.Moderatör) |
    admin=30 (Yönetici) | super_admin=40 (Kurucu)

  Panele giriş: De.Mod (20) ve üstü
  Yönetici (30): Web/Kullanıcı/Forum/Rol/Duyuru/Market/Kadro/Galeri/Avatar/Rapor/Güvenlik/Destek — TAM
  Kurucu (40): Her şey + Bakım modu + Web editörü
  Kurucu hesabına dokunulamaz (admin editleyemez)
*/
const SIDEBAR_GROUPS = [
  {
    label: 'WEB YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'web-stats',       icon: 'fa-solid fa-chart-bar',           label: 'Web İstatistikleri', minLevel: 30 },
      { id: 'web-analytics',   icon: 'fa-solid fa-users-viewfinder',    label: 'Web Analizi',        minLevel: 30 },
      { id: 'web-maintenance', icon: 'fa-solid fa-triangle-exclamation',label: 'Bakım Modu',         minLevel: 40 },
      { id: 'web-editor',      icon: 'fa-solid fa-palette',             label: 'Web Editörü',        minLevel: 40 },
      { id: 'web-history',     icon: 'fa-solid fa-clock-rotate-left',   label: 'Web Geçmişi',        minLevel: 30 },
    ],
  },
  {
    label: 'KULLANICI YÖNETİMİ', minLevel: 20,
    links: [
      { id: 'users-users',   icon: 'fa-solid fa-users',         label: 'Kullanıcı İşlemleri', minLevel: 20 },
      { id: 'users-mods',    icon: 'fa-solid fa-shield-halved', label: 'Moderatör İşlemleri', minLevel: 30 },
      { id: 'users-history', icon: 'fa-solid fa-user-pen',      label: 'Değişiklik Geçmişi',  minLevel: 20 },
    ],
  },
  {
    label: 'FORUM YÖNETİMİ', minLevel: 20,
    links: [
      { id: 'forum-topics',          icon: 'fa-solid fa-book',              label: 'Konu İşlemleri',   minLevel: 20 },
      { id: 'forum-replies',         icon: 'fa-solid fa-comments',          label: 'Yorum İşlemleri',  minLevel: 20 },
      { id: 'forum-content-reports', icon: 'fa-solid fa-flag',              label: 'İçerik Raporları', badge: 'openReports', minLevel: 10 },
      { id: 'forum-history',         icon: 'fa-solid fa-clock-rotate-left', label: 'Forum Geçmişi',    minLevel: 20 },
    ],
  },
  {
    label: 'ROL YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'roles-list',    icon: 'fa-solid fa-user-tag',          label: 'Rol İşlemleri', minLevel: 30 },
      { id: 'roles-history', icon: 'fa-solid fa-clock-rotate-left', label: 'Rol Geçmişi',   minLevel: 30 },
    ],
  },
  {
    label: 'DUYURU YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'ann-history', icon: 'fa-solid fa-bullhorn', label: 'Duyuru Geçmişi', minLevel: 30 },
    ],
  },
  {
    label: 'MARKET YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'market-history', icon: 'fa-solid fa-store', label: 'Ürün Geçmişi', minLevel: 30 },
    ],
  },
  {
    label: 'KADRO YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'staff-history', icon: 'fa-solid fa-shield-halved', label: 'Kişi Geçmişi', minLevel: 30 },
    ],
  },
  {
    label: 'GALERİ YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'gallery-ops', icon: 'fa-solid fa-images', label: 'Görsel İşlemleri', minLevel: 30 },
    ],
  },
  {
    label: 'AVATAR YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'avatar-management', icon: 'fa-solid fa-image-portrait', label: 'Seviye Avatarları', minLevel: 30 },
    ],
  },
  {
    label: 'RAPOR YÖNETİMİ', minLevel: 20,
    links: [
      { id: 'reports-incoming', icon: 'fa-solid fa-inbox',       label: 'Gelen Raporlar', badge: 'pendingReports', minLevel: 20 },
      { id: 'reports-outgoing', icon: 'fa-solid fa-paper-plane', label: 'Giden Raporlar',                         minLevel: 20 },
    ],
  },
  {
    label: 'GÜVENLİK YÖNETİMİ', minLevel: 30,
    links: [
      { id: 'security-sessions', icon: 'fa-solid fa-user-clock',           label: 'Aktif Oturumlar',    minLevel: 30 },
      { id: 'security-logins',   icon: 'fa-solid fa-right-to-bracket',     label: 'Son Girişler',       minLevel: 20 },
      { id: 'security-failed',   icon: 'fa-solid fa-triangle-exclamation', label: 'Başarısız Girişler', minLevel: 20 },
    ],
  },
  {
    label: 'DESTEK YÖNETİMİ', minLevel: 20,
    links: [
      { id: 'support-tickets', icon: 'fa-solid fa-headset', label: 'Destek Talepleri', badge: 'pendingTickets', minLevel: 20 },
    ],
  },
];

const SECTION_TITLES = {
  'web-stats':            'Web İstatistikleri',
  'web-analytics':        'Web Analizi',
  'web-maintenance':      'Bakım Modu',
  'web-editor':           'Web Editörü',
  'web-history':          'Web Geçmişi',
  'users-users':          'Kullanıcı İşlemleri',
  'users-mods':           'Moderatör İşlemleri',
  'users-history':        'Değişiklik Geçmişi',
  'forum-topics':         'Konu İşlemleri',
  'forum-replies':        'Yorum İşlemleri',
  'forum-content-reports':'İçerik Raporları',
  'forum-history':        'Forum Geçmişi',
  'roles-list':           'Rol İşlemleri',
  'roles-history':        'Rol Geçmişi',
  'ann-history':          'Duyuru Yönetimi',
  'market-history':       'Market Yönetimi',
  'staff-history':        'Kadro Yönetimi',
  'gallery-ops':          'Galeri Yönetimi',
  'reports-incoming':     'Gelen Raporlar',
  'reports-outgoing':     'Giden Raporlar',
  'security-sessions':    'Aktif Oturumlar',
  'security-logins':      'Son Girişler',
  'security-failed':      'Başarısız Girişler',
  'avatar-management':    'Seviye Avatarları',
  'support-tickets':      'Destek Talepleri',
};

function _countPendingTickets() {
  try {
    const all = JSON.parse(localStorage.getItem('av-tickets') || '{}');
    let count = 0;
    for (const uid in all) { count += (all[uid] || []).filter(t => t.status === 'Bekleniyor').length; }
    return count;
  } catch { return 0; }
}

function renderAdminSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  const openReports    = Admin.reports.filter(r => r.status === 'open').length;
  const pendingReports = Admin.staffReports.filter(r => r.status === 'pending').length;
  const pendingTickets = _countPendingTickets();

  let html = '';
  for (const group of SIDEBAR_GROUPS) {
    if (myLevel < (group.minLevel || 0)) continue;
    const visibleLinks = group.links.filter(l => myLevel >= (l.minLevel || 0));
    if (!visibleLinks.length) continue;
    html += `<div class="sidebar-section">${group.label}</div>`;
    for (const l of visibleLinks) {
      let badge = '';
      if (l.badge === 'openReports'    && openReports    > 0) badge = `<span class="sidebar-badge">${openReports}</span>`;
      if (l.badge === 'pendingReports' && pendingReports > 0) badge = `<span class="sidebar-badge">${pendingReports}</span>`;
      if (l.badge === 'pendingTickets' && pendingTickets > 0) badge = `<span class="sidebar-badge">${pendingTickets}</span>`;
      html += `<div class="sidebar-link" id="nav-${l.id}" onclick="showAdminSection('${l.id}')">
        <i class="${l.icon}"></i><span>${l.label}</span>${badge}
      </div>`;
    }
  }
  nav.innerHTML = html;
}

function showAdminSection(section) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById(`page-${section}`);
  if (page) page.classList.add('active');
  const link = document.getElementById(`nav-${section}`);
  if (link) link.classList.add('active');

  _el('admin-topbar-title', el => el.textContent = SECTION_TITLES[section] || section);

  switch(section) {
    case 'web-stats':            renderWebStats(); break;
    case 'web-analytics':        renderAnalytics(); break;
    case 'web-maintenance':      renderMaintenance(); break;
    case 'web-editor':           renderSettings(); break;
    case 'web-history':          renderWebHistory(); break;
    case 'users-users':          renderUsers(); break;
    case 'users-mods':           renderMods(); break;
    case 'users-history':        renderUsersHistory(); break;
    case 'forum-topics':         renderTopicsAdmin(); break;
    case 'forum-replies':        renderRepliesAdmin(); break;
    case 'forum-content-reports':renderContentReports('open'); break;
    case 'forum-history':        renderForumHistory(); break;
    case 'roles-list':           renderRoles(); break;
    case 'roles-history':        renderRolesHistory(); break;
    case 'ann-history':          renderAnnouncements(); break;
    case 'market-history':       renderMarket(); break;
    case 'staff-history':        renderStaff(); break;
    case 'gallery-ops':          renderGallery(); break;
    case 'reports-incoming':     renderIncomingStaffReports(); break;
    case 'reports-outgoing':     renderOutgoingStaffReports(); break;
    case 'security-sessions':    renderSessions(); break;
    case 'security-logins':      renderRecentLogins(); break;
    case 'security-failed':      renderFailedLogins(); break;
    case 'avatar-management':    renderAvatarManagement(); break;
    case 'support-tickets':      renderAdminSupportTickets(); break;
  }

  closeSidebar();
}

/* ─────────────────────────────────────────────
   WEB STATİSTİKLERİ
───────────────────────────────────────────── */
function renderWebStats() {
  const users   = Admin.users;
  const topics  = Admin.topics.filter(t => !t.is_deleted);
  const replies = Admin.replies.filter(r => !r.is_deleted);
  const founders = users.filter(u => u.role === 'super_admin').length;
  const otherRoles = users.filter(u => ['moderator','super_moderator','admin'].includes(u.role)).length;
  const openRep = Admin.reports.filter(r => r.status === 'open').length;
  const closedRep = Admin.reports.filter(r => r.status !== 'open').length;

  _el('ws-total-users',   el => el.textContent = users.length);
  _el('ws-founders',      el => el.textContent = founders);
  _el('ws-other-roles',   el => el.textContent = otherRoles);
  _el('ws-topics',        el => el.textContent = topics.length);
  _el('ws-replies',       el => el.textContent = replies.length);
  _el('ws-open-reports',  el => el.textContent = openRep);
  _el('ws-closed-reports',el => el.textContent = closedRep);

  renderLoginChart();
}

/* ─────────────────────────────────────────────
   WEB ANALİZİ
───────────────────────────────────────────── */
function switchAnalyticsMode(mode) {
  Admin.analyticsMode = mode;
  document.querySelectorAll('.sub-tab').forEach(t =>
    t.classList.toggle('active', t.getAttribute('data-mode') === mode)
  );
  renderAnalytics();
}

function renderAnalytics() {
  const mode = Admin.analyticsMode || 'daily';
  const now = new Date();
  let cutoff;
  if (mode === 'daily')   cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'weekly')  cutoff = new Date(now - 7 * 86400000);
  if (mode === 'monthly') cutoff = new Date(now.getFullYear(), now.getMonth(), 1);

  // Registered users in period
  const regUsers = Admin.users.filter(u => {
    if (!u.join_date) return false;
    return new Date(u.join_date) >= cutoff;
  });
  _el('analytics-reg-count', el => el.textContent = regUsers.length);
  const regTbody = document.getElementById('analytics-reg-tbody');
  if (regTbody) {
    regTbody.innerHTML = regUsers.length
      ? regUsers.slice(0,100).map(u => `<tr>
          <td>${escH(u.username)}</td>
          <td style="font-size:.78rem;color:var(--text-muted)">${escH(u.email||'')}</td>
          <td style="font-size:.78rem">${escH(u.join_date||'')}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-muted)">Bu dönemde kayıt yok</td></tr>`;
  }

  // Logged-in users (from login_history, success, in period)
  const loggedIn = Admin.loginHistory.filter(l => {
    if (l.status !== 'success') return false;
    if (!l.created_at) return false;
    return new Date(l.created_at) >= cutoff;
  });
  _el('analytics-login-count', el => el.textContent = loggedIn.length);
  const loginTbody = document.getElementById('analytics-login-tbody');
  if (loginTbody) {
    loginTbody.innerHTML = loggedIn.length
      ? loggedIn.slice(0,100).map(l => `<tr>
          <td>${escH(l.username||'')}</td>
          <td style="font-family:var(--font-mono);font-size:.78rem">${escH(l.ip_address||'—')}</td>
          <td style="font-size:.78rem;color:var(--text-muted)">${l.created_at ? new Date(l.created_at).toLocaleString('tr-TR') : '—'}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-muted)">Bu dönemde giriş yok</td></tr>`;
  }
}

/* ─────────────────────────────────────────────
   BAKIM MODU
───────────────────────────────────────────── */
function renderMaintenance() {
  const isOn = Admin.settings['maintenance_mode']?.value === 'true';
  const toggle = document.getElementById('maintenance-toggle');
  if (toggle) toggle.checked = isOn;
  _el('maintenance-status-label', el => {
    el.textContent = isOn ? '🔴 Açık — Site bakımda' : '🟢 Kapalı — Site erişilebilir';
    el.style.color = isOn ? 'var(--danger)' : 'var(--success)';
  });
}

async function toggleMaintenanceMode(checked) {
  const value = checked ? 'true' : 'false';
  const entry = Admin.settings['maintenance_mode'];
  if (entry?.id) {
    await AdminAPI.patch('av_site_settings', entry.id, { value });
    Admin.settings['maintenance_mode'].value = value;
  } else {
    const saved = await AdminAPI.post('av_site_settings', { id: adminUid(), key: 'maintenance_mode', value, updated_by: Admin.currentUser?.username });
    if (saved) Admin.settings['maintenance_mode'] = { id: saved.id, value };
  }
  _el('maintenance-status-label', el => {
    el.textContent = checked ? '🔴 Açık — Site bakımda' : '🟢 Kapalı — Site erişilebilir';
    el.style.color = checked ? 'var(--danger)' : 'var(--success)';
  });
  adminToast(checked ? 'Bakım modu açıldı!' : 'Bakım modu kapatıldı', checked ? 'warning' : 'success');
  writeAdminLog('admin', checked ? 'Bakım modu açıldı' : 'Bakım modu kapatıldı', 'maintenance_mode');
}

/* ─────────────────────────────────────────────
   WEB GEÇMİŞİ
───────────────────────────────────────────── */
async function renderWebHistory() {
  const tbody = document.getElementById('web-history-tbody');
  if (!tbody) return;
  const all = await AdminAPI.get('av_logs');
  all.sort((a,b) => new Date(b.ts||b.created_at||0) - new Date(a.ts||a.created_at||0));
  const catColors = { login:'badge-green', logout:'badge-muted', topic:'badge-blue', reply:'badge-blue', user:'badge-yellow', moderator:'badge-red', admin:'badge-purple', forum:'badge-blue' };
  tbody.innerHTML = all.slice(0,100).map(l => `<tr>
    <td><span class="badge ${catColors[l.category]||'badge-muted'} log-category-badge">${escH(l.category||'')}</span></td>
    <td style="font-size:.82rem">${escH(l.username||'')}</td>
    <td style="font-family:var(--font-mono);font-size:.78rem">${escH(l.ip_address||l.ip||'—')}</td>
    <td style="font-size:.82rem">${escH(l.action_type||l.action||'')}</td>
    <td style="font-size:.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(l.target||'')}</td>
    <td style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">${l.ts||l.created_at ? new Date(l.ts||l.created_at).toLocaleString('tr-TR') : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted)">Log kaydı yok</td></tr>`;
}

/* ─────────────────────────────────────────────
   KULLANICI MODERATÖRLERİ
───────────────────────────────────────────── */
function renderMods(search = '') {
  const tbody = document.getElementById('mods-tbody');
  if (!tbody) return;
  let list = Admin.users.filter(u => ['moderator','super_moderator'].includes(u.role));
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Moderatör bulunamadı</td></tr>`; return; }
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  tbody.innerHTML = list.map(u => {
    const muted  = u.muted_until  && new Date(u.muted_until) > new Date();
    const banned = u.banned_until && new Date(u.banned_until) > new Date();
    const roleBadge = `<span class="badge" style="background:${ROLE_COLORS[u.role]}22;color:${ROLE_COLORS[u.role]}">${ROLE_LABELS[u.role]||u.role}</span>`;
    const statusBadge = banned ? '<span class="badge badge-red">Uzaklaştırıldı</span>' : muted ? '<span class="badge badge-yellow">Susturuldu</span>' : '<span class="badge badge-green">Aktif</span>';
    const canEdit = myLevel > (ROLE_LEVEL[u.role]||0);
    const actions = canEdit ? `
      <button class="btn btn-info btn-xs" onclick="openUserModal('${u.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-warning btn-xs" onclick="openMuteModal('${u.id}','${escA(u.username)}')"><i class="fa-solid fa-microphone-slash"></i></button>
      <button class="btn btn-danger btn-xs" onclick="openBanModal('${u.id}','${escA(u.username)}')"><i class="fa-solid fa-ban"></i></button>` : '—';
    return `<tr>
      <td><strong style="font-size:.88rem">${escH(u.username)}</strong></td>
      <td style="font-size:.8rem;color:var(--text-muted)">${escH(u.email||'')}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td style="font-size:.8rem">${escH(u.join_date||'')}</td>
      <td><div class="action-cell">${actions}</div></td>
    </tr>`;
  }).join('');
}

function renderUsersHistory() {
  const tbody = document.getElementById('users-history-tbody');
  if (!tbody) return;
  const list = Admin.roleHistory.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  tbody.innerHTML = list.slice(0,100).map(h => `<tr>
    <td style="font-size:.85rem"><strong>${escH(h.target_username||'')}</strong></td>
    <td><span class="badge badge-muted">${escH(h.old_role||'—')}</span></td>
    <td><span class="badge badge-green">${escH(h.new_role||'—')}</span></td>
    <td style="font-size:.8rem">${escH(h.changed_by||'')}</td>
    <td><span class="badge badge-blue">${escH(h.action||'')}</span></td>
    <td style="font-size:.75rem;color:var(--text-muted)">${h.created_at ? new Date(h.created_at).toLocaleString('tr-TR') : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted)">Kayıt yok</td></tr>`;
}

/* ─────────────────────────────────────────────
   FORUM GEÇMİŞİ + İÇERİK RAPORLARI
───────────────────────────────────────────── */
function renderForumHistory() {
  const tbody = document.getElementById('forum-history-tbody');
  if (!tbody) return;
  const all = (Admin.logs && Admin.logs['forum'] ? Admin.logs['forum'] : []);
  // Re-fetch from AdminAPI
  AdminAPI.get('av_logs').then(allLogs => {
    const list = allLogs.filter(l => ['forum','reply','topic'].includes(l.category))
      .sort((a,b) => new Date(b.ts||b.created_at||0) - new Date(a.ts||a.created_at||0));
    tbody.innerHTML = list.slice(0,100).map(l => `<tr>
      <td style="font-size:.82rem">${escH(l.username||'')}</td>
      <td style="font-size:.82rem">${escH(l.action_type||l.action||'')}</td>
      <td style="font-size:.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(l.target||'')}</td>
      <td style="font-size:.75rem;color:var(--text-muted)">${l.ts||l.created_at ? new Date(l.ts||l.created_at).toLocaleString('tr-TR') : '—'}</td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted)">Kayıt yok</td></tr>`;
  });
}

function switchContentReportTab(tab) {
  document.querySelectorAll('.content-report-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
  renderContentReports(tab);
}

function renderContentReports(tab = 'open') {
  const list = document.getElementById('content-reports-list');
  if (!list) return;
  let reports = Admin.reports.filter(r => tab === 'open' ? r.status === 'open' : r.status !== 'open');
  reports.sort((a,b) => (b.created_at||0) - (a.created_at||0));
  if (!reports.length) { list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-flag"></i>${tab==='open'?'Bekleyen rapor yok 🎉':'Geçmiş kayıt yok'}</div>`; return; }
  list.innerHTML = reports.map(r => `<div class="report-card${r.status!=='open'?' resolved':''}">
    <div class="report-icon${r.status!=='open'?' resolved-icon':''}"><i class="fa-solid fa-flag"></i></div>
    <div class="report-body">
      <div class="report-title">${escH(r.target_title||'İçerik')}</div>
      <div class="report-meta">
        <span class="badge badge-${r.target_type==='topic'?'blue':'green'}">${r.target_type==='topic'?'Konu':'Yorum'}</span>
        Rapor eden: <strong>${escH(r.reporter_name||'?')}</strong> · Sebep: ${escH(r.reason||'')} · ${timeAgoAdmin(r.created_at)}
        ${r.status!=='open'?`<br>Çözüldü: ${escH(r.resolved_by||'')} · ${escH(r.resolver_note||'')}` : ''}
      </div>
      ${r.status==='open' ? `<div class="report-actions">
        <button class="btn btn-info btn-xs" onclick="openResolveModal('${r.id}','resolved')"><i class="fa-solid fa-check"></i> Çözüldü</button>
        <button class="btn btn-ghost btn-xs" onclick="openResolveModal('${r.id}','dismissed')"><i class="fa-solid fa-times"></i> Reddet</button>
      </div>` : `<span class="badge badge-${r.status==='resolved'?'green':'muted'}">${r.status==='resolved'?'Çözüldü':'Reddedildi'}</span>`}
    </div>
  </div>`).join('');
}

/* ─────────────────────────────────────────────
   ROL GEÇMİŞİ
───────────────────────────────────────────── */
function renderRolesHistory() {
  const tbody = document.getElementById('roles-history-tbody');
  if (!tbody) return;
  const list = Admin.roleHistory.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  tbody.innerHTML = list.slice(0,100).map(h => `<tr>
    <td style="font-size:.85rem"><strong>${escH(h.target_username||'')}</strong></td>
    <td><span class="badge badge-muted">${escH(h.old_role||'—')}</span></td>
    <td><span class="badge badge-green">${escH(h.new_role||'—')}</span></td>
    <td style="font-size:.8rem">${escH(h.changed_by||'')}</td>
    <td><span class="badge badge-blue">${escH(h.action||'')}</span></td>
    <td style="font-size:.75rem;color:var(--text-muted)">${h.created_at ? new Date(h.created_at).toLocaleString('tr-TR') : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted)">Kayıt yok</td></tr>`;
}

/* ─────────────────────────────────────────────
   GALERİ YÖNETİMİ
───────────────────────────────────────────── */
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  if (!Admin.gallery.length) {
    grid.innerHTML = `<div class="admin-empty" style="grid-column:1/-1"><i class="fa-solid fa-images"></i>Henüz görsel eklenmedi</div>`;
    return;
  }
  grid.innerHTML = Admin.gallery.map(g => `<div class="gallery-item">
    <img src="${escA(g.image_url||'')}" alt="${escA(g.description||'')}" loading="lazy"
         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%23111%22 width=%22200%22 height=%22150%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23444%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>No Image</text></svg>'" />
    <div class="gallery-item-overlay">
      <div class="gallery-item-desc">${escH(g.description||'')}</div>
      <div class="gallery-item-actions">
        <button class="btn btn-ghost btn-xs" onclick="openEditGallery('${g.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-xs" onclick="deleteGallery('${g.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`).join('');
}

function openNewGallery() {
  _el('gallery-id',   el => el.value = '');
  _el('gallery-url',  el => el.value = '');
  _el('gallery-desc', el => el.value = '');
  openAdminModal('gallery-modal');
}
function openEditGallery(id) {
  const g = Admin.gallery.find(x => x.id === id);
  if (!g) return;
  _el('gallery-id',   el => el.value = id);
  _el('gallery-url',  el => el.value = g.image_url   || '');
  _el('gallery-desc', el => el.value = g.description || '');
  openAdminModal('gallery-modal');
}
async function saveGallery() {
  const id   = _val2('gallery-id');
  const url  = _val2('gallery-url');
  const desc = _val2('gallery-desc');
  if (!url) return adminToast('Görsel URL gerekli', 'error');
  const u = Admin.currentUser;
  if (id) {
    await AdminAPI.patch('av_gallery', id, { image_url: url, description: desc });
    const g = Admin.gallery.find(x => x.id === id);
    if (g) Object.assign(g, { image_url: url, description: desc });
    writeAdminLog('admin', 'Galeri görseli düzenlendi', url);
  } else {
    const item = { id: adminUid(), image_url: url, description: desc, added_by: u?.username, added_by_id: u?.id };
    const saved = await AdminAPI.post('av_gallery', item);
    if (saved) Admin.gallery.push({ ...item, created_at: Date.now() });
    writeAdminLog('admin', 'Galeri görseli eklendi', url);
  }
  closeAdminModal('gallery-modal');
  adminToast('Görsel kaydedildi', 'success');
  renderGallery();
}
async function deleteGallery(id) {
  if (!confirm('Bu görseli silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.del('av_gallery', id);
  Admin.gallery = Admin.gallery.filter(g => g.id !== id);
  adminToast('Görsel silindi', 'success');
  writeAdminLog('admin', 'Galeri görseli silindi', id);
  renderGallery();
}

/* ─────────────────────────────────────────────
   RAPOR YÖNETİMİ (STAFF-TO-STAFF)
───────────────────────────────────────────── */
function renderIncomingStaffReports() {
  const wrap = document.getElementById('incoming-staff-reports');
  if (!wrap) return;
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  // Incoming = reports sent TO someone at current user's level or below, that the current user can respond to
  const list = Admin.staffReports.filter(r => r.status === 'pending' && r.sender_id !== Admin.currentUser?.id);
  list.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  if (!list.length) { wrap.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-inbox"></i>Gelen rapor yok</div>`; return; }
  wrap.innerHTML = list.map(r => `<div class="report-card">
    <div class="report-icon"><i class="fa-solid fa-file-lines"></i></div>
    <div class="report-body">
      <div class="report-title">${escH(r.title||'Başlıksız')}</div>
      <div class="report-meta">
        Gönderen: <strong>${escH(r.sender_name||'?')}</strong>
        ${r.target_username ? ` · İlgili: <strong>${escH(r.target_username)}</strong>` : ''}
        · ${timeAgoAdmin(r.created_at)}
      </div>
      <div style="font-size:.82rem;color:var(--text-secondary);margin:6px 0">${escH((r.description||'').slice(0,200))}</div>
      <div class="report-actions">
        <button class="btn btn-info btn-xs" onclick="openStaffReportRespond('${r.id}','approved')"><i class="fa-solid fa-check"></i> Onayla</button>
        <button class="btn btn-danger btn-xs" onclick="openStaffReportRespond('${r.id}','rejected')"><i class="fa-solid fa-times"></i> Reddet</button>
      </div>
    </div>
  </div>`).join('');
}

function renderOutgoingStaffReports() {
  const wrap = document.getElementById('outgoing-staff-reports');
  if (!wrap) return;
  const list = Admin.staffReports.filter(r => r.sender_id === Admin.currentUser?.id)
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  if (!list.length) { wrap.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-paper-plane"></i>Gönderilmiş rapor yok</div>`; return; }
  const statusColors = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };
  const statusLabels = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
  wrap.innerHTML = list.slice(0,100).map(r => `<div class="history-item">
    <div class="history-icon"><i class="fa-solid fa-paper-plane"></i></div>
    <div style="flex:1">
      <div class="history-text"><strong>${escH(r.title||'Başlıksız')}</strong></div>
      <div style="font-size:.78rem;color:var(--text-muted);margin:4px 0">${escH((r.description||'').slice(0,120))}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="badge ${statusColors[r.status]||'badge-muted'}">${statusLabels[r.status]||r.status}</span>
        ${r.response_note ? `<span style="font-size:.78rem;color:var(--text-secondary)">Not: ${escH(r.response_note)}</span>` : ''}
      </div>
      <div class="history-time">${timeAgoAdmin(r.created_at)}</div>
    </div>
  </div>`).join('');
}

function openStaffReportModal() {
  _el('sr-target-username', el => el.value = '');
  _el('sr-title',           el => el.value = '');
  _el('sr-desc',            el => el.value = '');
  openAdminModal('staff-report-modal');
}

async function sendStaffReport() {
  const target = _val2('sr-target-username');
  const title  = _val2('sr-title');
  const desc   = _val2('sr-desc');
  if (!title || !desc) return adminToast('Başlık ve açıklama gerekli', 'error');
  const u = Admin.currentUser;
  const report = {
    id: adminUid(), sender_id: u.id, sender_name: u.username,
    target_user_id: '', target_username: target,
    title, description: desc, status: 'pending',
    response_note: '', responded_by: '', responded_at: '',
  };
  const saved = await AdminAPI.post('av_staff_reports', report);
  if (saved) Admin.staffReports.unshift({ ...report, created_at: Date.now() });
  closeAdminModal('staff-report-modal');
  adminToast('Rapor gönderildi', 'success');
  renderOutgoingStaffReports();
}

function openStaffReportRespond(id, status) {
  _el('srr-id',     el => el.value = id);
  _el('srr-status', el => el.value = status);
  _el('srr-note',   el => el.value = '');
  openAdminModal('staff-report-respond-modal');
}

async function saveStaffReportResponse() {
  const id     = _val2('srr-id');
  const status = _val2('srr-status');
  const note   = _val2('srr-note');
  if (!note.trim()) return adminToast('Açıklama notu zorunludur', 'error');
  const u = Admin.currentUser;
  await AdminAPI.patch('av_staff_reports', id, {
    status, response_note: note,
    responded_by: u.username, responded_at: new Date().toISOString(),
  });
  const r = Admin.staffReports.find(x => x.id === id);
  if (r) Object.assign(r, { status, response_note: note, responded_by: u.username });

  // Send notification to sender
  if (r) {
    await AdminAPI.post('av_notifications', {
      id: adminUid(), user_id: r.sender_id,
      type: 'staff_report', is_read: false,
      title: status === 'approved' ? 'Raporunuz Onaylandı ✅' : 'Raporunuz Reddedildi ❌',
      message: `"${r.title}" — Not: ${note}`,
      link: '',
    });
  }
  closeAdminModal('staff-report-respond-modal');
  adminToast('Yanıt gönderildi', 'success');
  renderIncomingStaffReports();
  renderAdminSidebar();
}

/* ─────────────────────────────────────────────
   GÜVENLİK YÖNETİMİ
───────────────────────────────────────────── */
function renderSessions() {
  const tbody = document.getElementById('sessions-tbody');
  if (!tbody) return;
  const list = Admin.sessions.slice().sort((a,b) => new Date(b.last_seen||0) - new Date(a.last_seen||0));
  tbody.innerHTML = list.slice(0,100).map(s => {
    const fiveMinAgo = Date.now() - 5*60*1000;
    const isOnline = s.last_seen && new Date(s.last_seen).getTime() > fiveMinAgo;
    return `<tr>
      <td><span class="session-live-dot" style="${isOnline ? '' : 'background:var(--text-muted);animation:none;box-shadow:none'}"></span></td>
      <td style="font-size:.85rem"><strong>${escH(s.username||'')}</strong></td>
      <td style="font-size:.8rem;color:var(--text-muted)">${escH(s.email||'')}</td>
      <td style="font-family:var(--font-mono);font-size:.78rem">${escH(s.ip_address||'—')}</td>
      <td style="font-size:.75rem;color:var(--text-muted)">${s.last_seen ? new Date(s.last_seen).toLocaleString('tr-TR') : '—'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Aktif oturum yok</td></tr>`;
}

function renderRecentLogins() {
  const tbody = document.getElementById('recent-logins-tbody');
  if (!tbody) return;
  const list = Admin.loginHistory.filter(l => l.status === 'success')
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  tbody.innerHTML = list.slice(0,100).map(l => `<tr>
    <td style="font-size:.85rem">${escH(l.username||'')}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${escH(l.email||'')}</td>
    <td style="font-family:var(--font-mono);font-size:.78rem">${escH(l.ip_address||'—')}</td>
    <td style="font-size:.75rem;color:var(--text-muted)">${l.created_at ? new Date(l.created_at).toLocaleString('tr-TR') : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted)">Giriş kaydı yok</td></tr>`;
}

function renderFailedLogins() {
  const tbody = document.getElementById('failed-logins-tbody');
  if (!tbody) return;
  const list = Admin.loginHistory.filter(l => l.status === 'failed')
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  tbody.innerHTML = list.slice(0,100).map(l => `<tr>
    <td style="font-size:.85rem">${escH(l.username||'')}</td>
    <td style="font-family:var(--font-mono);font-size:.78rem">${escH(l.ip_address||'—')}</td>
    <td style="font-size:.75rem;color:var(--text-muted)">${l.created_at ? new Date(l.created_at).toLocaleString('tr-TR') : '—'}</td>
  </tr>`).join('') || `<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-muted)">Başarısız giriş kaydı yok</td></tr>`;
}

async function renderLoginChart() {
  const stats = await AdminAPI.get('av_login_stats');
  const days = 7;
  const labels = [];
  const vals = [];
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    labels.push(dayNames[d.getDay()]);
    const found = stats.find(s => s.date === dateStr);
    vals.push(found ? found.count : 0);
  }

  const max = Math.max(...vals, 1);
  const wrap = document.getElementById('login-chart');
  if (!wrap) return;
  wrap.innerHTML = vals.map((v, i) => `
    <div class="chart-col">
      <div class="chart-bar-item" style="height:${Math.max(4, Math.round((v/max)*70))}px"></div>
      <div class="chart-label">${labels[i]}<br>${v}</div>
    </div>`).join('');
}

/* ─────────────────────────────────────────────
   USERS
───────────────────────────────────────────── */
function renderUsers(search = '') {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  let list = Admin.users;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">Kullanıcı bulunamadı</td></tr>`; return; }

  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;

  tbody.innerHTML = list.map(u => {
    const muted  = u.muted_until  && new Date(u.muted_until) > new Date();
    const banned = u.banned_until && new Date(u.banned_until) > new Date();
    const roleBadge = `<span class="badge" style="background:${ROLE_COLORS[u.role]}22;color:${ROLE_COLORS[u.role]}">${ROLE_LABELS[u.role] || u.role}</span>`;
    const statusBadge = banned ? '<span class="badge badge-red">Uzaklaştırıldı</span>' : muted ? '<span class="badge badge-yellow">Susturuldu</span>' : '<span class="badge badge-green">Aktif</span>';
    const targetLevel = ROLE_LEVEL[u.role] || 0;
    const canEdit = myLevel > targetLevel;
    const actionsHtml = canEdit ? `
      <button class="btn btn-info btn-xs" onclick="openUserModal('${u.id}')"><i class="fa-solid fa-pen"></i></button>
      ${ROLE_LEVEL[Admin.currentUser?.role] >= 10 ? `<button class="btn btn-warning btn-xs" onclick="openMuteModal('${u.id}','${escA(u.username)}')"><i class="fa-solid fa-microphone-slash"></i></button>
      <button class="btn btn-danger btn-xs" onclick="openBanModal('${u.id}','${escA(u.username)}')"><i class="fa-solid fa-ban"></i></button>` : ''}
    ` : '—';
    return `<tr>
      <td><strong style="font-size:.88rem">${escH(u.username)}</strong></td>
      <td style="font-size:.8rem;color:var(--text-muted)">${escH(u.email||'')}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td style="font-size:.8rem">${escH(u.join_date||'')}</td>
      <td style="font-size:.8rem">${u.messages||0}</td>
      <td><div class="action-cell">${actionsHtml}</div></td>
    </tr>`;
  }).join('');
}

function openUserModal(userId) {
  const u = Admin.users.find(x => x.id === userId);
  if (!u) return;

  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  const targetLevel = ROLE_LEVEL[u.role] || 0;

  // Kurucu hesabına kimse dokunamaz (super_admin seviyesine ulaşmak gerekir ama hiç atanmaz)
  if (u.role === 'super_admin' && myLevel < 40) return adminToast('Kurucu hesabı düzenlenemez', 'error');
  if (myLevel <= targetLevel) return adminToast('Bu kullanıcıyı düzenleyemezsiniz', 'error');

  _el('um-username',   el => el.value = u.username    || '');
  _el('um-email',      el => el.value = u.email       || '');
  _el('um-birth-date', el => el.value = u.birth_date  || '');
  _el('um-rep-points', el => el.value = u.rep_points  || 0);
  _el('um-user-id',    el => el.value = userId);

  // Temel rol seçimi — sadece kendi seviyesinin altındakileri atayabilir
  const sel = document.getElementById('um-role');
  if (sel) {
    const roleKeys = Object.keys(ROLE_LEVEL).filter(k => ROLE_LEVEL[k] < myLevel);
    sel.innerHTML = roleKeys.map(k => `<option value="${k}"${u.role===k?' selected':''}>${ROLE_LABELS[k]||k}</option>`).join('');
  }

  // Üye etiketi seçimi (badge_role)
  const badgeSel = document.getElementById('um-badge-role');
  if (badgeSel) {
    const assignableBadges = Object.entries(BADGE_ROLE_LABELS)
      .filter(([, v]) => myLevel >= v.minLevel);
    badgeSel.innerHTML = `<option value="">-- Etiket Yok --</option>` +
      assignableBadges.map(([k, v]) => `<option value="${k}"${u.badge_role===k?' selected':''}>${v.label}</option>`).join('');
  }

  openAdminModal('user-modal');
}

async function saveUser() {
  const userId    = _val2('um-user-id');
  const username  = _val2('um-username');
  const email     = _val2('um-email');
  const birthDate = _val2('um-birth-date') || null;
  const role      = document.getElementById('um-role')?.value;
  const badgeRole = document.getElementById('um-badge-role')?.value || null;
  const repRaw    = _val2('um-rep-points');
  const repPoints = repRaw !== '' && !isNaN(parseInt(repRaw)) ? parseInt(repRaw) : undefined;
  if (!username) return adminToast('Kullanıcı adı gerekli', 'error');

  const existingUser = Admin.users.find(u => u.id === userId);
  const oldRole = existingUser?.role;
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;

  // Kurucu koruması: super_admin rolünü kimse veremez
  if (role === 'super_admin') return adminToast('Kurucu rolü atanamaz', 'error');
  // Rep puan sadece Yönetici+
  if (repPoints !== undefined && repPoints !== (existingUser?.rep_points || 0) && myLevel < 30) {
    return adminToast('Rep puan değiştirmek için Yönetici yetkisi gereklidir', 'error');
  }

  const patchData = { username, email, role, badge_role: badgeRole };
  if (birthDate !== null) patchData.birth_date = birthDate;
  if (repPoints !== undefined) patchData.rep_points = repPoints;

  await AdminAPI.patch('av_users', userId, patchData);
  const idx = Admin.users.findIndex(u => u.id === userId);
  if (idx >= 0) Object.assign(Admin.users[idx], patchData);

  // Log role change if changed
  if (oldRole && role && oldRole !== role) {
    const histEntry = {
      id: adminUid(), target_username: username, old_role: oldRole, new_role: role,
      changed_by: Admin.currentUser?.username, action: 'assigned',
    };
    await AdminAPI.post('av_role_history', histEntry);
    Admin.roleHistory.unshift({ ...histEntry, created_at: Date.now() });
  }

  closeAdminModal('user-modal');
  adminToast('Kullanıcı güncellendi', 'success');
  writeAdminLog('user', 'Kullanıcı düzenlendi', username);
  renderUsers();
}

function openMuteModal(userId, userName) {
  _el('mu-user-id',   el => el.value = userId);
  _el('mu-user-name', el => el.value = userName);
  _el('mu-hours',     el => el.value = '24');
  openAdminModal('mute-user-modal');
}
async function saveMute() {
  const userId = _val2('mu-user-id');
  const name   = _val2('mu-user-name');
  const hours  = Math.min(72, parseInt(_val2('mu-hours')) || 24);
  const until  = new Date(Date.now() + hours * 3600000).toISOString();
  await AdminAPI.patch('av_users', userId, { muted_until: until });
  const u = Admin.users.find(x => x.id === userId);
  if (u) u.muted_until = until;
  closeAdminModal('mute-user-modal');
  adminToast(`${name} ${hours} saat susturuldu`, 'success');
  writeAdminLog('moderator', `Susturuldu (${hours}s)`, name);
  renderUsers();
}

function openBanModal(userId, userName) {
  _el('ba-user-id',   el => el.value = userId);
  _el('ba-user-name', el => el.value = userName);
  _el('ba-hours',     el => el.value = '24');
  openAdminModal('ban-user-modal');
}
async function saveBan() {
  const userId = _val2('ba-user-id');
  const name   = _val2('ba-user-name');
  const hours  = Math.min(72, parseInt(_val2('ba-hours')) || 24);
  const until  = new Date(Date.now() + hours * 3600000).toISOString();
  await AdminAPI.patch('av_users', userId, { banned_until: until });
  const u = Admin.users.find(x => x.id === userId);
  if (u) u.banned_until = until;
  closeAdminModal('ban-user-modal');
  adminToast(`${name} ${hours} saat uzaklaştırıldı`, 'success');
  writeAdminLog('moderator', `Uzaklaştırıldı (${hours}s)`, name);
  renderUsers();
}

/* ─────────────────────────────────────────────
   FORUM ADMIN
───────────────────────────────────────────── */
function renderForumAdmin(search = '', tab = 'topics') {
  const activeTab = document.querySelector('.forum-admin-tab.active')?.getAttribute('data-tab') || tab;
  if (activeTab === 'topics') renderTopicsAdmin(search);
  else renderRepliesAdmin(search);
}

function switchForumTab(tab) {
  document.querySelectorAll('.forum-admin-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
  document.getElementById('topics-admin-section').style.display  = tab === 'topics'  ? 'block' : 'none';
  document.getElementById('replies-admin-section').style.display = tab === 'replies' ? 'block' : 'none';
}

function renderTopicsAdmin(search = '') {
  const tbody = document.getElementById('topics-tbody');
  if (!tbody) return;
  let list = Admin.topics.filter(t => !t.is_deleted);
  if (search) { const q = search.toLowerCase(); list = list.filter(t => t.title?.toLowerCase().includes(q) || t.author_name?.toLowerCase().includes(q)); }
  list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Konu bulunamadı</td></tr>`; return; }
  tbody.innerHTML = list.map(t => `<tr>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a onclick="viewTopicAdmin('${t.id}')" style="color:var(--accent);cursor:pointer">${escH(t.title)}</a></td>
    <td style="font-size:.8rem">${escH(t.author_name||'')}</td>
    <td>${t.is_pinned?'<span class="badge badge-green">Sabitli</span>':''}${t.is_locked?'<span class="badge badge-red">Kilitli</span>':''}${t.super_liked?'<span class="badge badge-yellow">Öne Çıkan</span>':''}</td>
    <td style="font-size:.8rem">${t.reply_count||0} yorum / ${t.view_count||0} görüntüleme</td>
    <td style="font-size:.78rem;color:var(--text-muted)">${timeAgoAdmin(t.created_at)}</td>
    <td><div class="action-cell">
      <button class="btn btn-warning btn-xs" onclick="toggleTopicPinAdmin('${t.id}',${t.is_pinned})">${t.is_pinned?'Sabiti Kaldır':'Sabitle'}</button>
      <button class="btn btn-info btn-xs"    onclick="toggleTopicLockAdmin('${t.id}',${t.is_locked})">${t.is_locked?'Kilidi Aç':'Kilitle'}</button>
      <button class="btn btn-warning btn-xs" onclick="toggleSuperLikeAdmin('${t.id}',${t.super_liked})">${t.super_liked?'Öne Çıkmayı Kaldır':'Öne Çıkar'}</button>
      <button class="btn btn-ghost btn-xs"   onclick="openEditTopicAdmin('${t.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-xs"  onclick="deleteTopicAdmin('${t.id}')"><i class="fa-solid fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

async function toggleTopicPinAdmin(id, cur) {
  await AdminAPI.patch('av_topics', id, { is_pinned: !cur });
  const t = Admin.topics.find(x => x.id === id); if (t) t.is_pinned = !cur;
  adminToast(cur ? 'Sabit kaldırıldı' : 'Konu sabitlendi', 'success');
  writeAdminLog('moderator', cur ? 'Sabit kaldırıldı' : 'Konu sabitlendi', id);
  renderTopicsAdmin();
}
async function toggleTopicLockAdmin(id, cur) {
  await AdminAPI.patch('av_topics', id, { is_locked: !cur });
  const t = Admin.topics.find(x => x.id === id); if (t) t.is_locked = !cur;
  adminToast(cur ? 'Kilit açıldı' : 'Konu kilitlendi', 'success');
  writeAdminLog('moderator', cur ? 'Kilit açıldı' : 'Konu kilitlendi', id);
  renderTopicsAdmin();
}
async function toggleSuperLikeAdmin(id, cur) {
  await AdminAPI.patch('av_topics', id, { super_liked: !cur });
  const t = Admin.topics.find(x => x.id === id); if (t) t.super_liked = !cur;
  adminToast(cur ? 'Öne çıkma kaldırıldı' : 'Öne çıkarıldı ⭐', 'success');
  writeAdminLog('moderator', cur ? 'Süper beğeni kaldırıldı' : 'Süper beğeni verildi', id);
  renderTopicsAdmin();
}

function openEditTopicAdmin(topicId) {
  const t = Admin.topics.find(x => x.id === topicId);
  if (!t) return;
  _el('etat-id',      el => el.value = topicId);
  _el('etat-title',   el => el.value = t.title || '');
  _el('etat-content', el => el.value = t.content || '');
  openAdminModal('edit-topic-admin-modal');
}
async function saveTopicAdmin() {
  const id      = _val2('etat-id');
  const title   = _val2('etat-title');
  const content = _val2('etat-content');
  await AdminAPI.patch('av_topics', id, { title, content });
  const t = Admin.topics.find(x => x.id === id);
  if (t) { t.title = title; t.content = content; }
  closeAdminModal('edit-topic-admin-modal');
  adminToast('Konu güncellendi', 'success');
  writeAdminLog('forum', 'Konu düzenlendi', title);
  renderTopicsAdmin();
}
async function deleteTopicAdmin(id) {
  if (!confirm('Bu konuyu silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.patch('av_topics', id, { is_deleted: true });
  Admin.topics = Admin.topics.filter(t => t.id !== id);
  adminToast('Konu silindi', 'success');
  writeAdminLog('forum', 'Konu silindi', id);
  renderTopicsAdmin();
}

function renderRepliesAdmin(search = '') {
  const tbody = document.getElementById('replies-tbody');
  if (!tbody) return;
  let list = Admin.replies.filter(r => !r.is_deleted);
  if (search) { const q = search.toLowerCase(); list = list.filter(r => r.author_name?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q)); }
  list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Yorum bulunamadı</td></tr>`; return; }
  tbody.innerHTML = list.slice(0, 100).map(r => `<tr>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">${r.content?.replace(/<[^>]*>/g,'')?.slice(0,80)||''}</td>
    <td style="font-size:.8rem">${escH(r.author_name||'')}</td>
    <td>
      ${r.is_pinned ? '<span class="badge badge-green">Sabitli</span>' : ''}
      ${r.super_liked ? '<span class="badge badge-yellow">⭐ Öne Çıkan</span>' : ''}
      ${!r.is_pinned && !r.super_liked ? '<span class="badge badge-muted">Normal</span>' : ''}
    </td>
    <td style="font-size:.78rem;color:var(--text-muted)">${timeAgoAdmin(r.created_at)}</td>
    <td><span class="badge badge-green">${r.like_count||0} 👍</span></td>
    <td><div class="action-cell">
      <button class="btn btn-warning btn-xs" onclick="toggleReplyPinAdmin('${r.id}',${!!r.is_pinned})" title="${r.is_pinned?'Sabiti Kaldır':'Sabitle'}">${r.is_pinned?'📌 Kaldır':'📌'}</button>
      <button class="btn btn-warning btn-xs" onclick="toggleReplySuperLike('${r.id}',${!!r.super_liked})" title="${r.super_liked?'Öne Çıkmayı Kaldır':'Öne Çıkar'}">${r.super_liked?'⭐ Kaldır':'⭐'}</button>
      <button class="btn btn-ghost btn-xs" onclick="openEditReplyAdmin('${r.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-xs" onclick="deleteReplyAdmin('${r.id}')"><i class="fa-solid fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

async function toggleReplyPinAdmin(id, cur) {
  await AdminAPI.patch('av_replies', id, { is_pinned: !cur });
  const r = Admin.replies.find(x => x.id === id); if (r) r.is_pinned = !cur;
  adminToast(cur ? 'Sabit kaldırıldı' : 'Yorum sabitlendi', 'success');
  writeAdminLog('reply', cur ? 'Yorum sabiti kaldırıldı' : 'Yorum sabitlendi', id);
  renderRepliesAdmin();
}
async function toggleReplySuperLike(id, cur) {
  await AdminAPI.patch('av_replies', id, { super_liked: !cur });
  const r = Admin.replies.find(x => x.id === id); if (r) r.super_liked = !cur;
  adminToast(cur ? 'Öne çıkma kaldırıldı' : 'Yorum öne çıkarıldı ⭐', 'success');
  writeAdminLog('reply', cur ? 'Yorum öne çıkması kaldırıldı' : 'Yorum öne çıkarıldı', id);
  renderRepliesAdmin();
}

function openEditReplyAdmin(replyId) {
  const r = Admin.replies.find(x => x.id === replyId);
  if (!r) return;
  _el('erar-id',      el => el.value = replyId);
  _el('erar-content', el => el.value = r.content?.replace(/<[^>]*>/g,'') || '');
  openAdminModal('edit-reply-admin-modal');
}
async function saveReplyAdmin() {
  const id      = _val2('erar-id');
  const content = _val2('erar-content');
  await AdminAPI.patch('av_replies', id, { content, edited_at: new Date().toISOString() });
  const r = Admin.replies.find(x => x.id === id); if (r) r.content = content;
  closeAdminModal('edit-reply-admin-modal');
  adminToast('Yorum güncellendi', 'success');
  writeAdminLog('reply', 'Yorum düzenlendi', id);
  renderRepliesAdmin();
}
async function deleteReplyAdmin(id) {
  if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.patch('av_replies', id, { is_deleted: true });
  Admin.replies = Admin.replies.filter(r => r.id !== id);
  adminToast('Yorum silindi', 'success');
  writeAdminLog('reply', 'Yorum silindi', id);
  renderRepliesAdmin();
}

/* ─────────────────────────────────────────────
   ANNOUNCEMENTS
───────────────────────────────────────────── */
function renderAnnouncements() {
  const list = document.getElementById('ann-list');
  if (!list) return;
  const anns = Admin.announcements.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  if (!anns.length) { list.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted)">Henüz duyuru eklenmedi</div>`; return; }
  list.innerHTML = anns.slice(0, 20).map(a => `<div class="history-item">
    <div class="history-icon"><i class="fa-solid fa-bullhorn"></i></div>
    <div style="flex:1">
      <div class="history-text"><strong>${escH(a.title)}</strong> — ${escH(a.author_name||'')}</div>
      <div style="display:flex;gap:8px;margin-top:6px">
        ${a.is_active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-muted">Gizli</span>'}
        ${a.pinned ? '<span class="badge badge-yellow">Sabitli</span>' : ''}
      </div>
      <div class="history-time">${timeAgoAdmin(a.created_at)}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-ghost btn-xs" onclick="openEditAnn('${a.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-xs" onclick="deleteAnn('${a.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`).join('');
}

function openNewAnn() {
  _el('ann-id',      el => el.value = '');
  _el('ann-title',   el => el.value = '');
  _el('ann-content', el => el.value = '');
  _el('ann-link',    el => el.value = '');
  _el('ann-active',  el => el.checked = true);
  _el('ann-pinned',  el => el.checked = false);
  openAdminModal('ann-modal');
}
function openEditAnn(id) {
  const a = Admin.announcements.find(x => x.id === id);
  if (!a) return;
  _el('ann-id',      el => el.value = id);
  _el('ann-title',   el => el.value = a.title   || '');
  _el('ann-content', el => el.value = a.content || '');
  _el('ann-link',    el => el.value = a.link    || '');
  _el('ann-active',  el => el.checked = !!a.is_active);
  _el('ann-pinned',  el => el.checked = !!a.pinned);
  openAdminModal('ann-modal');
}
async function saveAnn() {
  const id      = _val2('ann-id');
  const title   = _val2('ann-title');
  const content = _val2('ann-content');
  const link    = _val2('ann-link');
  const active  = document.getElementById('ann-active')?.checked ?? true;
  const pinned  = document.getElementById('ann-pinned')?.checked ?? false;
  if (!title) return adminToast('Başlık gerekli', 'error');
  const u = Admin.currentUser;

  if (id) {
    await AdminAPI.patch('av_announcements', id, { title, content, link, is_active: active, pinned });
    const a = Admin.announcements.find(x => x.id === id);
    if (a) Object.assign(a, { title, content, link, is_active: active, pinned });
    writeAdminLog('moderator', 'Duyuru düzenlendi', title);
  } else {
    const newAnn = { id: adminUid(), title, content, link, author_id: u.id, author_name: u.username, is_active: active, pinned };
    const saved = await AdminAPI.post('av_announcements', newAnn);
    if (saved) Admin.announcements.unshift({ ...newAnn, created_at: Date.now() });
    writeAdminLog('moderator', 'Duyuru eklendi', title);
  }
  closeAdminModal('ann-modal');
  adminToast('Duyuru kaydedildi', 'success');
  renderAnnouncements();
}
async function deleteAnn(id) {
  if (!confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.del('av_announcements', id);
  Admin.announcements = Admin.announcements.filter(a => a.id !== id);
  adminToast('Duyuru silindi', 'success');
  writeAdminLog('moderator', 'Duyuru silindi', id);
  renderAnnouncements();
}

/* ─────────────────────────────────────────────
   MARKET
───────────────────────────────────────────── */
function renderMarket() {
  const list = document.getElementById('market-list');
  if (!list) return;
  const items = Admin.market.slice().sort((a, b) => (b.created_at||0) - (a.created_at||0));
  if (!items.length) { list.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted)">Henüz ürün eklenmedi</div>`; return; }
  list.innerHTML = items.slice(0, 20).map(m => `<div class="history-item">
    <div class="history-icon" style="background:rgba(56,189,248,.1);color:var(--info)"><i class="fa-solid fa-store"></i></div>
    <div style="flex:1">
      <div class="history-text"><strong>${escH(m.name)}</strong> — ${escH(m.price||'Ücretsiz')} ${m.category ? `<span class="badge badge-blue">${escH(m.category)}</span>` : ''}</div>
      <div class="history-time">Stok: ${m.stock||0} · ${m.is_active ? '<span style="color:var(--success)">Aktif</span>' : '<span style="color:var(--text-muted)">Gizli</span>'}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-ghost btn-xs" onclick="openEditMarket('${m.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-xs" onclick="deleteMarket('${m.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`).join('');
}

function openNewMarket() {
  ['market-id','market-name','market-price','market-category','market-stock','market-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _el('market-active', el => el.checked = true);
  openAdminModal('market-modal');
}
function openEditMarket(id) {
  const m = Admin.market.find(x => x.id === id);
  if (!m) return;
  _el('market-id',       el => el.value = id);
  _el('market-name',     el => el.value = m.name     || '');
  _el('market-price',    el => el.value = m.price    || '');
  _el('market-category', el => el.value = m.category || '');
  _el('market-stock',    el => el.value = m.stock    ?? '');
  _el('market-desc',     el => el.value = (m.description||'').replace(/<[^>]*>/g,''));
  _el('market-active',   el => el.checked = !!m.is_active);
  openAdminModal('market-modal');
}
async function saveMarket() {
  const id       = _val2('market-id');
  const name     = _val2('market-name');
  const price    = _val2('market-price');
  const category = _val2('market-category');
  const stock    = parseInt(_val2('market-stock')) || 0;
  const desc     = _val2('market-desc');
  const active   = document.getElementById('market-active')?.checked ?? true;
  if (!name) return adminToast('Ürün adı gerekli', 'error');

  if (id) {
    await AdminAPI.patch('av_market', id, { name, price, category, stock, description: desc, is_active: active });
    const m = Admin.market.find(x => x.id === id);
    if (m) Object.assign(m, { name, price, category, stock, description: desc, is_active: active });
    writeAdminLog('moderator', 'Ürün düzenlendi', name);
  } else {
    const item = { id: adminUid(), name, price, category, stock, description: desc, is_active: active, added_by: Admin.currentUser?.username };
    const saved = await AdminAPI.post('av_market', item);
    if (saved) Admin.market.unshift({ ...item, created_at: Date.now() });
    writeAdminLog('moderator', 'Ürün eklendi', name);
  }
  closeAdminModal('market-modal');
  adminToast('Ürün kaydedildi', 'success');
  renderMarket();
}
async function deleteMarket(id) {
  if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.del('av_market', id);
  Admin.market = Admin.market.filter(m => m.id !== id);
  adminToast('Ürün silindi', 'success');
  writeAdminLog('moderator', 'Ürün silindi', id);
  renderMarket();
}

/* ─────────────────────────────────────────────
   STAFF
───────────────────────────────────────────── */
function renderStaff(search = '') {
  const list = document.getElementById('staff-list');
  if (!list) return;
  let items = Admin.staff.filter(s => s.is_active).sort((a, b) => (a.sort_order||0) - (b.sort_order||0));
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(s => s.username?.toLowerCase().includes(q) || s.role_title?.toLowerCase().includes(q));
  }
  if (!items.length) { list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-shield-halved"></i>Henüz kadro eklenmedi</div>`; return; }
  list.innerHTML = items.map(s => {
    const user = Admin.users.find(u => u.username === s.username);
    const avatarHtml = user?.avatar
      ? `<img src="${escA(user.avatar)}" />`
      : `<span>${(s.username||'?')[0].toUpperCase()}</span>`;
    const roleColor = user ? (ROLE_COLORS[user.role] || '#888') : '#888';
    const roleLabel = user ? (ROLE_LABELS[user.role] || user.role) : '';
    return `<div class="staff-profile-card">
      <div class="staff-profile-avatar">${avatarHtml}</div>
      <div class="staff-profile-info">
        <div class="staff-profile-name">${escH(s.username)}</div>
        <div class="staff-profile-title">${escH(s.role_title||'')}</div>
        ${roleLabel ? `<span class="badge" style="background:${roleColor}22;color:${roleColor};margin-top:4px">${roleLabel}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-left:auto">
        <button class="btn btn-ghost btn-xs" onclick="openEditStaff('${s.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-xs" onclick="deleteStaff('${s.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openNewStaff() {
  ['staff-id','staff-username','staff-role-title','staff-sort'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openAdminModal('staff-modal');
}
function openEditStaff(id) {
  const s = Admin.staff.find(x => x.id === id);
  if (!s) return;
  _el('staff-id',         el => el.value = id);
  _el('staff-username',   el => el.value = s.username   || '');
  _el('staff-role-title', el => el.value = s.role_title || '');
  _el('staff-sort',       el => el.value = s.sort_order || 0);
  openAdminModal('staff-modal');
}
async function saveStaff() {
  const id        = _val2('staff-id');
  const username  = _val2('staff-username');
  const roleTitle = _val2('staff-role-title');
  const sort      = parseInt(_val2('staff-sort')) || 0;
  if (!username) return adminToast('Kullanıcı adı gerekli', 'error');

  const u = Admin.users.find(x => x.username === username);

  if (id) {
    await AdminAPI.patch('av_staff', id, { username, role_title: roleTitle, sort_order: sort });
    const s = Admin.staff.find(x => x.id === id);
    if (s) Object.assign(s, { username, role_title: roleTitle, sort_order: sort });
    writeAdminLog('moderator', 'Kadro düzenlendi', username);
  } else {
    const item = { id: adminUid(), user_id: u?.id || '', username, role_title: roleTitle, sort_order: sort, is_active: true, added_by: Admin.currentUser?.username };
    const saved = await AdminAPI.post('av_staff', item);
    if (saved) Admin.staff.unshift({ ...item, created_at: Date.now() });
    writeAdminLog('moderator', 'Kadroya eklendi', username);
  }
  closeAdminModal('staff-modal');
  adminToast('Kadro kaydedildi', 'success');
  renderStaff();
}
async function deleteStaff(id) {
  if (!confirm('Bu kişiyi kadrodan çıkarmak istediğinizden emin misiniz?')) return;
  await AdminAPI.patch('av_staff', id, { is_active: false });
  Admin.staff = Admin.staff.filter(s => s.id !== id);
  adminToast('Kadrodan çıkarıldı', 'success');
  writeAdminLog('moderator', 'Kadrodan çıkarıldı', id);
  renderStaff();
}

/* ─────────────────────────────────────────────
   REPORTS
───────────────────────────────────────────── */
function renderReports(tab = 'open') {
  const activeTab = document.querySelector('.report-tab.active')?.getAttribute('data-tab') || tab;
  const list = document.getElementById('reports-list');
  if (!list) return;
  let reports = Admin.reports.filter(r => activeTab === 'open' ? r.status === 'open' : r.status !== 'open');
  reports.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  if (!reports.length) { list.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted)">${activeTab==='open'?'Bekleyen rapor yok 🎉':'Geçmiş kayıt yok'}</div>`; return; }

  list.innerHTML = reports.map(r => `<div class="report-card${r.status!=='open'?' resolved':''}">
    <div class="report-icon${r.status!=='open'?' resolved-icon':''}"><i class="fa-solid fa-flag"></i></div>
    <div class="report-body">
      <div class="report-title">${escH(r.target_title||'İçerik')}</div>
      <div class="report-meta">
        <span class="badge badge-${r.target_type==='topic'?'blue':'green'}">${r.target_type==='topic'?'Konu':'Yorum'}</span>
        Rapor eden: <strong>${escH(r.reporter_name||'?')}</strong> · Sebep: ${escH(r.reason||'')} · ${timeAgoAdmin(r.created_at)}
        ${r.status==='resolved'?`<br>Çözüldü: ${escH(r.resolved_by||'')} · ${escH(r.resolver_note||'')}` : ''}
      </div>
      ${r.status==='open' ? `<div class="report-actions">
        <button class="btn btn-info btn-xs" onclick="openResolveModal('${r.id}','resolved')"><i class="fa-solid fa-check"></i> Çözüldü</button>
        <button class="btn btn-ghost btn-xs" onclick="openResolveModal('${r.id}','dismissed')"><i class="fa-solid fa-times"></i> Reddedildi</button>
      </div>` : `<span class="badge badge-${r.status==='resolved'?'green':'muted'}">${r.status==='resolved'?'Çözüldü':'Reddedildi'}</span>`}
    </div>
  </div>`).join('');
}

function switchReportTab(tab) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
  renderReports(tab);
}

function openResolveModal(reportId, status) {
  _el('resolve-report-id',     el => el.value = reportId);
  _el('resolve-report-status', el => el.value = status);
  _el('resolve-note',          el => el.value = '');
  openAdminModal('resolve-modal');
}
async function saveResolve() {
  const id     = _val2('resolve-report-id');
  const status = _val2('resolve-report-status');
  const note   = _val2('resolve-note');
  await AdminAPI.patch('av_reports', id, {
    status, resolved_by: Admin.currentUser?.username,
    resolved_at: new Date().toISOString(), resolver_note: note,
  });
  const r = Admin.reports.find(x => x.id === id);
  if (r) Object.assign(r, { status, resolved_by: Admin.currentUser?.username, resolver_note: note });
  closeAdminModal('resolve-modal');
  adminToast('Rapor güncellendi', 'success');
  writeAdminLog('moderator', `Rapor ${status==='resolved'?'çözüldü':'reddedildi'}`, id);

  // Update badge
  const openReports = Admin.reports.filter(r => r.status === 'open').length;
  _el('reports-badge', el => { el.textContent = openReports; el.style.display = openReports ? 'inline-block' : 'none'; });
  renderReports();
}

/* ─────────────────────────────────────────────
   ROLES
───────────────────────────────────────────── */
function renderRoles() {
  const list = document.getElementById('roles-list');
  if (!list) return;
  const myLevel = ROLE_LEVEL[Admin.currentUser?.role] || 0;
  const sorted = Admin.roles.slice().sort((a,b) => (a.sort_order||a.level||0) - (b.sort_order||b.level||0));
  list.innerHTML = sorted.map(r => `<div class="admin-card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="color-swatch" style="background:${r.color||'#888'}"></div>
      ${r.icon ? `<i class="${escH(r.icon)}" style="color:${r.color||'#888'};font-size:1.1rem"></i>` : ''}
      <strong>${escH(r.name)}</strong>
      <span class="badge badge-muted">Seviye ${r.level||0}</span>
      ${r.description ? `<span style="font-size:.78rem;color:var(--text-muted)">${escH(r.description)}</span>` : ''}
      <div style="margin-left:auto;display:flex;gap:6px">
        ${myLevel >= 40 ? `<button class="btn btn-ghost btn-xs" onclick="openEditRole('${r.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-xs" onclick="deleteRole('${r.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    </div>
    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
      ${JSON.parse(r.perms||'[]').map(p => {
        const pd = ALL_PERMS.find(x => x.key === p);
        return `<span class="badge badge-green">${pd?.label||p}</span>`;
      }).join('')}
    </div>
  </div>`).join('');
}

function renderIconPicker(selectedIcon) {
  const grid = document.getElementById('icon-picker-grid');
  if (!grid) return;
  grid.innerHTML = ICON_LIST.map(ic => `<div class="icon-picker-item${ic===selectedIcon?' active':''}" onclick="selectRoleIcon('${ic}')" title="${ic}"><i class="${ic}"></i></div>`).join('');
}
function selectRoleIcon(icon) {
  _el('role-icon', el => el.value = icon);
  document.querySelectorAll('.icon-picker-item').forEach(el => el.classList.toggle('active', el.title === icon));
}

function openNewRole() {
  _el('role-id',          el => el.value = '');
  _el('role-name',        el => el.value = '');
  _el('role-color',       el => el.value = '#22c55e');
  _el('role-level',       el => el.value = '0');
  _el('role-sort',        el => el.value = '0');
  _el('role-description', el => el.value = '');
  _el('role-icon',        el => el.value = 'fa-solid fa-user');
  renderPermGrid([]);
  renderIconPicker('fa-solid fa-user');
  openAdminModal('role-modal');
}
function openEditRole(id) {
  if (ROLE_LEVEL[Admin.currentUser?.role] < 40) return adminToast('Sadece Süper Admin rol düzenleyebilir', 'error');
  const r = Admin.roles.find(x => x.id === id);
  if (!r) return;
  _el('role-id',          el => el.value = id);
  _el('role-name',        el => el.value = r.name        || '');
  _el('role-color',       el => el.value = r.color       || '#22c55e');
  _el('role-level',       el => el.value = r.level       || 0);
  _el('role-sort',        el => el.value = r.sort_order  || 0);
  _el('role-description', el => el.value = r.description || '');
  _el('role-icon',        el => el.value = r.icon        || 'fa-solid fa-user');
  renderPermGrid(JSON.parse(r.perms || '[]'));
  renderIconPicker(r.icon || 'fa-solid fa-user');
  openAdminModal('role-modal');
}
function renderPermGrid(activePerm = []) {
  const grid = document.getElementById('perm-grid');
  if (!grid) return;
  grid.innerHTML = ALL_PERMS.map(p => {
    const active = activePerm.includes(p.key);
    return `<div class="perm-item${active?' active':''}" onclick="togglePerm(this,'${p.key}')">
      <div class="perm-check"><i class="fa-solid fa-check"></i></div>
      <div class="perm-label">${p.label}</div>
    </div>`;
  }).join('');
}
function togglePerm(el, key) { el.classList.toggle('active'); }

async function saveRole() {
  const id          = _val2('role-id');
  const name        = _val2('role-name');
  const color       = _val2('role-color') || '#888';
  const level       = parseInt(_val2('role-level')) || 0;
  const sort_order  = parseInt(_val2('role-sort')) || 0;
  const description = _val2('role-description');
  const icon        = _val2('role-icon') || 'fa-solid fa-user';
  const permKeys    = [...document.querySelectorAll('.perm-item.active')].map(el => {
    const m = el.getAttribute('onclick')?.match(/'([^']+)'/);
    return m?.[1];
  }).filter(Boolean);
  if (!name) return adminToast('Rol adı gerekli', 'error');
  const permsJson = JSON.stringify(permKeys);
  const u = Admin.currentUser;

  if (id) {
    await AdminAPI.patch('av_roles', id, { name, color, level, perms: permsJson, icon, description, sort_order });
    const r = Admin.roles.find(x => x.id === id);
    if (r) Object.assign(r, { name, color, level, perms: permsJson, icon, description, sort_order });
    const hist = { id: adminUid(), target_username: name, old_role: r?.name||name, new_role: name, changed_by: u?.username, action: 'edited' };
    await AdminAPI.post('av_role_history', hist);
    Admin.roleHistory.unshift({ ...hist, created_at: Date.now() });
    writeAdminLog('admin', 'Rol düzenlendi', name);
  } else {
    const newRole = { id: adminUid(), name, color, level, perms: permsJson, icon, description, sort_order };
    const saved = await AdminAPI.post('av_roles', newRole);
    if (saved) Admin.roles.push({ ...newRole, created_at: Date.now() });
    const hist = { id: adminUid(), target_username: name, old_role: '—', new_role: name, changed_by: u?.username, action: 'created' };
    await AdminAPI.post('av_role_history', hist);
    Admin.roleHistory.unshift({ ...hist, created_at: Date.now() });
    writeAdminLog('admin', 'Rol eklendi', name);
  }
  closeAdminModal('role-modal');
  adminToast('Rol kaydedildi', 'success');
  renderRoles();
}
async function deleteRole(id) {
  if (ROLE_LEVEL[Admin.currentUser?.role] < 40) return adminToast('Sadece Süper Admin rol silebilir', 'error');
  if (!confirm('Bu rolü silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.del('av_roles', id);
  Admin.roles = Admin.roles.filter(r => r.id !== id);
  adminToast('Rol silindi', 'success');
  writeAdminLog('moderator', 'Rol silindi', id);
  renderRoles();
}

/* ─────────────────────────────────────────────
   LOGS
───────────────────────────────────────────── */
async function renderLogs(category = 'login') {
  const activeTab = document.querySelector('.log-tab.active')?.getAttribute('data-cat') || category;
  const all = await AdminAPI.get('av_logs');
  const filtered = all.filter(l => l.category === activeTab).sort((a, b) => new Date(b.ts||0) - new Date(a.ts||0));
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Log kaydı yok</td></tr>`; return; }
  const catColors = { login:'badge-green', logout:'badge-muted', topic:'badge-blue', reply:'badge-blue', user:'badge-yellow', moderator:'badge-red' };
  tbody.innerHTML = filtered.slice(0, 50).map(l => `<tr>
    <td style="font-size:.8rem">${escH(l.username||'')}</td>
    <td style="font-size:.8rem;font-family:var(--font-mono)">${escH(l.ip_address||l.ip||'—')}</td>
    <td style="font-size:.8rem">${escH(l.action_type||l.action||'')}</td>
    <td style="font-size:.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(l.target||'')}</td>
    <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">${l.created_at ? new Date(l.created_at).toLocaleString('tr-TR') : (l.ts ? new Date(l.ts).toLocaleString('tr-TR') : '')}</td>
  </tr>`).join('');
}
function switchLogTab(tab) {
  document.querySelectorAll('.log-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-cat') === tab));
  renderLogs(tab);
}

/* ─────────────────────────────────────────────
   SETTINGS
───────────────────────────────────────────── */
function renderSettings() {
  if (ROLE_LEVEL[Admin.currentUser?.role] < 40) {
    const container = document.getElementById('settings-container');
    if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)"><i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:12px;display:block;opacity:.4"></i>Bu bölüm sadece Süper Admin tarafından görüntülenebilir.</div>';
    return;
  }
  const s = Admin.settings;
  _el('set-site-name', el => el.value = s.site_name?.value || 'Monarch Gaming');
  _el('set-accent',    el => el.value = s.accent_color?.value || '#22c55e');
  _el('set-accent2',   el => el.value = s.accent_color2?.value || '#15803d');
  _el('set-btn-primary',  el => el.value = s.btn_primary?.value || '#22c55e');
  _el('set-btn-danger',   el => el.value = s.btn_danger?.value  || '#ef4444');
  _el('set-btn-warning',  el => el.value = s.btn_warning?.value || '#f59e0b');
  _el('set-btn-info',     el => el.value = s.btn_info?.value    || '#38bdf8');
  _el('set-desc',      el => el.value = s.site_description?.value || '');
  _el('set-ts3',       el => el.value = s.ts3_address?.value || '');
  _el('set-phone',     el => el.value = s.phone_number?.value || '');
}

async function saveSettings() {
  if (ROLE_LEVEL[Admin.currentUser?.role] < 40) return adminToast('Yetkiniz yok', 'error');
  const updates = {
    site_name:        _val2('set-site-name'),
    accent_color:     _val2('set-accent'),
    accent_color2:    _val2('set-accent2'),
    btn_primary:      _val2('set-btn-primary'),
    btn_danger:       _val2('set-btn-danger'),
    btn_warning:      _val2('set-btn-warning'),
    btn_info:         _val2('set-btn-info'),
    site_description: _val2('set-desc'),
    ts3_address:      _val2('set-ts3'),
    phone_number:     _val2('set-phone'),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (Admin.settings[key]?.id) {
      await AdminAPI.patch('av_site_settings', Admin.settings[key].id, { value });
      Admin.settings[key].value = value;
    } else {
      const saved = await AdminAPI.post('av_site_settings', { id: adminUid(), key, value, updated_by: Admin.currentUser?.username });
      if (saved) Admin.settings[key] = { id: saved.id, value };
    }
  }
  adminToast('Ayarlar kaydedildi ✅', 'success');
  writeAdminLog('admin', 'Site ayarları güncellendi', 'settings');
  // Apply colors in real time
  if (updates.accent_color) document.documentElement.style.setProperty('--accent', updates.accent_color);
  if (updates.accent_color2) document.documentElement.style.setProperty('--accent2', updates.accent_color2);
  if (updates.btn_primary) document.documentElement.style.setProperty('--btn-primary-color', updates.btn_primary);
  if (updates.btn_danger) document.documentElement.style.setProperty('--btn-danger-color', updates.btn_danger);
  if (updates.btn_warning) document.documentElement.style.setProperty('--btn-warning-color', updates.btn_warning);
  if (updates.btn_info) document.documentElement.style.setProperty('--btn-info-color', updates.btn_info);
}

/* ─────────────────────────────────────────────
   LOG HELPER (max 50/category)
───────────────────────────────────────────── */
async function writeAdminLog(category, action, target = '') {
  const u = Admin.currentUser;
  const log = {
    id: adminUid(), category,
    username: u?.username || '—',
    ip: '—', action,
    target: String(target).slice(0, 120),
    ts: new Date().toISOString(),
  };
  await AdminAPI.post('av_logs', log);
  // Trim to 50
  const all = await AdminAPI.get('av_logs');
  const catLogs = all.filter(l => l.category === category);
  if (catLogs.length > 50) {
    catLogs.sort((a, b) => (a.created_at||0) - (b.created_at||0));
    for (const l of catLogs.slice(0, catLogs.length - 50)) await AdminAPI.del('av_logs', l.id);
  }
}

/* Also log to daily login stats */
async function logDailyLogin() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const all = await AdminAPI.get('av_login_stats');
  const existing = all.find(s => s.date === dateStr);
  if (existing) {
    await AdminAPI.patch('av_login_stats', existing.id, { count: (existing.count || 0) + 1 });
  } else {
    await AdminAPI.post('av_login_stats', { id: adminUid(), date: dateStr, count: 1 });
  }
}

/* ─────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────── */
function openAdminModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeAdminModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('admin-modal-backdrop')) e.target.classList.remove('open');
});

/* ─────────────────────────────────────────────
   AVATAR YÖNETİMİ
───────────────────────────────────────────── */
const TIER_LABELS = ['Yeni Üye','Bakır Üye','Bronz Üye','Gümüş Üye','Platin Üye','Altın Üye','Elmas Üye','Zümrüt Üye','Obsidyen Üye'];

async function renderAvatarManagement() {
  const grid = document.getElementById('avatar-mgmt-grid');
  if (!grid) return;
  const items = await AdminAPI.get('av_avatars');
  if (!items.length) {
    grid.innerHTML = '<div class="admin-empty">Henüz avatar eklenmedi. "Yeni Avatar Ekle" butonuna tıklayın.</div>'; return;
  }
  grid.innerHTML = items.map(a => `
    <div class="gallery-item">
      <img src="${escH(a.image_url||'')}" alt="${escH(a.name||'')}" />
      <div class="gallery-item-overlay">
        <div class="gallery-item-desc">
          <strong>${escH(a.name||'')}</strong><br>
          <span style="color:#fbbf24">${TIER_LABELS[a.min_tier||0] || 'Yeni Üye'}+</span>
        </div>
        <div class="gallery-item-actions">
          <button class="btn btn-sm btn-info" onclick="openEditAvatar('${a.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteAvatar('${a.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`).join('');
}

function openNewAvatar() {
  document.getElementById('av-id').value = '';
  document.getElementById('av-name').value = '';
  document.getElementById('av-tier').value = '0';
  document.getElementById('av-preview').innerHTML = '🖼️';
  document.getElementById('av-file-input').value = '';
  document.getElementById('avatar-modal-title').textContent = 'Yeni Avatar Ekle';
  openAdminModal('avatar-modal');
}

async function openEditAvatar(id) {
  const a = await AdminAPI.getOne('av_avatars', id);
  if (!a) return;
  document.getElementById('av-id').value   = id;
  document.getElementById('av-name').value = a.name || '';
  document.getElementById('av-tier').value = a.min_tier || '0';
  document.getElementById('av-preview').innerHTML = a.image_url ? `<img src="${escH(a.image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : '🖼️';
  document.getElementById('av-file-input')._dataUrl = null;
  document.getElementById('avatar-modal-title').textContent = 'Avatar Düzenle';
  openAdminModal('avatar-modal');
}

function previewAvatarAdmin(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) return adminToast('Sadece JPG/PNG', 'error');
  if (file.size > 100*1024) return adminToast('Maks 100KB', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('av-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    input._dataUrl = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveAvatar() {
  const id       = document.getElementById('av-id')?.value;
  const name     = document.getElementById('av-name')?.value.trim();
  const minTier  = parseInt(document.getElementById('av-tier')?.value || '0');
  const fileInput= document.getElementById('av-file-input');
  const dataUrl  = fileInput._dataUrl;
  if (!name) return adminToast('Avatar adı giriniz', 'error');

  if (id) {
    const patch = { name, min_tier: minTier };
    if (dataUrl) patch.image_url = dataUrl;
    await AdminAPI.patch('av_avatars', id, patch);
    adminToast('Avatar güncellendi ✅', 'success');
  } else {
    if (!dataUrl) return adminToast('Lütfen görsel seçin', 'error');
    await AdminAPI.post('av_avatars', { id: adminUid(), name, image_url: dataUrl, min_tier: minTier });
    adminToast('Avatar eklendi ✅', 'success');
  }
  closeAdminModal('avatar-modal');
  renderAvatarManagement();
}

async function deleteAvatar(id) {
  if (!confirm('Bu avatarı silmek istediğinizden emin misiniz?')) return;
  await AdminAPI.del('av_avatars', id);
  adminToast('Avatar silindi', 'success');
  renderAvatarManagement();
}

/* ─────────────────────────────────────────────
   DESTEK YÖNETİMİ (Admin)
───────────────────────────────────────────── */
function _adminGetTickets() {
  try { return JSON.parse(localStorage.getItem('av-tickets') || '{}'); } catch { return {}; }
}
function _adminSaveTickets(all) { localStorage.setItem('av-tickets', JSON.stringify(all)); }

function renderAdminSupportTickets(filter = 'all') {
  const page = document.getElementById('page-support-tickets');
  if (!page) return;

  const all = _adminGetTickets();
  // Flatten all tickets
  let tickets = [];
  for (const uid in all) {
    (all[uid] || []).forEach(t => { tickets.push({ ...t, _uid: uid }); });
  }

  // Auto-delete closed tickets older than 1 day
  const DAY_MS = 24 * 60 * 60 * 1000;
  let changed = false;
  for (const uid in all) {
    const before = (all[uid] || []).length;
    all[uid] = (all[uid] || []).filter(t => !(t.status === 'Kapalı' && t.closedAtMs && Date.now() - t.closedAtMs > DAY_MS));
    if (all[uid].length !== before) changed = true;
  }
  if (changed) _adminSaveTickets(all);

  // Re-flatten after cleanup
  tickets = [];
  for (const uid in all) {
    (all[uid] || []).forEach(t => { tickets.push({ ...t, _uid: uid }); });
  }

  if (filter === 'waiting')  tickets = tickets.filter(t => t.status === 'Bekleniyor');
  if (filter === 'answered') tickets = tickets.filter(t => t.status === 'Yanıtlandı');
  if (filter === 'closed')   tickets = tickets.filter(t => t.status === 'Kapalı');

  tickets.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  const scMap = { 'Bekleniyor':'#f59e0b', 'Yanıtlandı':'#22c55e', 'Kapalı':'#6b7280' };
  const waiting  = tickets.filter(t => t.status === 'Bekleniyor').length;
  const answered = tickets.filter(t => t.status === 'Yanıtlandı').length;
  const closed   = tickets.filter(t => t.status === 'Kapalı').length;

  page.innerHTML = `
    <div class="admin-card" style="margin-bottom:20px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-sm${filter==='all'?' btn-primary':' btn-ghost'}" onclick="renderAdminSupportTickets('all')">Tümü (${tickets.length})</button>
          <button class="btn btn-sm${filter==='waiting'?' btn-primary':' btn-ghost'}" onclick="renderAdminSupportTickets('waiting')">Bekleyen (${waiting})</button>
          <button class="btn btn-sm${filter==='answered'?' btn-primary':' btn-ghost'}" onclick="renderAdminSupportTickets('answered')">Yanıtlandı (${answered})</button>
          <button class="btn btn-sm${filter==='closed'?' btn-primary':' btn-ghost'}" onclick="renderAdminSupportTickets('closed')">Kapalı (${closed})</button>
        </div>
      </div>
    </div>

    ${!tickets.length ? `<div class="admin-card" style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-inbox" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:12px"></i>Bu filtrede talep yok</div>` : `
    <div class="admin-card" style="padding:0;overflow:hidden">
      <table class="admin-table">
        <thead><tr>
          <th>Konu</th><th>Kullanıcı</th><th>Kategori</th><th>Tarih</th><th>Durum</th><th>İşlem</th>
        </tr></thead>
        <tbody>
          ${tickets.map(t => {
            const sc = scMap[t.status] || '#6b7280';
            const msgCount = t.messages?.length || 1;
            return `<tr>
              <td><strong>${escH(t.subject)}</strong><br><span style="font-size:.74rem;color:var(--text-muted)">${msgCount} mesaj</span></td>
              <td><span style="font-weight:600">${escH(t.username||t._uid)}</span></td>
              <td>${escH(t.category)}</td>
              <td style="font-size:.78rem">${t.createdAt||'—'}</td>
              <td><span style="padding:3px 10px;border-radius:100px;background:${sc}22;color:${sc};font-weight:700;font-size:.78rem;border:1px solid ${sc}44">${t.status}</span></td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="adminOpenTicketDetail('${t._uid}','${t.id}')" style="margin-right:4px"><i class="fa-solid fa-eye"></i> Görüntüle</button>
                ${t.status !== 'Kapalı' ? `<button class="btn btn-sm btn-danger" onclick="adminCloseTicket('${t._uid}','${t.id}')"><i class="fa-solid fa-lock"></i> Kapat</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}`;
}

function adminOpenTicketDetail(uid, ticketId) {
  const all    = _adminGetTickets();
  const ticket = (all[uid] || []).find(t => t.id === ticketId);
  if (!ticket) return adminToast('Talep bulunamadı', 'error');

  const scMap  = { 'Bekleniyor':'#f59e0b', 'Yanıtlandı':'#22c55e', 'Kapalı':'#6b7280' };
  const sc     = scMap[ticket.status] || '#6b7280';
  const msgs   = (ticket.messages || []).map(m => {
    const isAdmin = m.from === 'admin';
    return `<div style="display:flex;gap:10px;margin-bottom:14px${isAdmin ? ';flex-direction:row-reverse' : ''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${isAdmin ? 'linear-gradient(135deg,#ec4899,#f472b6)' : 'var(--bg-elevated)'};display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:${isAdmin ? '#fff' : 'var(--text-primary)'};flex-shrink:0;border:${isAdmin ? 'none' : '1px solid var(--border)'}">${isAdmin ? '<i class="fa-solid fa-shield-halved"></i>' : escH((m.sender||'?')[0]).toUpperCase()}</div>
      <div style="max-width:75%">
        <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:3px${isAdmin ? ';text-align:right' : ''}">${isAdmin ? '<i class="fa-solid fa-shield-halved"></i> Yönetici' : escH(m.sender||'Kullanıcı')} · ${new Date(m.ts).toLocaleString('tr-TR')}</div>
        <div style="padding:10px 14px;border-radius:12px;font-size:.87rem;line-height:1.5;${isAdmin ? 'background:linear-gradient(135deg,rgba(236,72,153,.15),rgba(244,114,182,.1));border:1px solid rgba(236,72,153,.25);' : 'background:var(--bg-elevated);border:1px solid var(--border);'}">${escH(m.text)}</div>
      </div>
    </div>`;
  }).join('');

  const canReply = ticket.status !== 'Kapalı';

  const existing = document.getElementById('admin-ticket-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-ticket-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0">
        <h3 style="flex:1;font-size:.95rem;margin:0"><i class="fa-solid fa-ticket" style="color:#ec4899"></i> ${escH(ticket.subject)}</h3>
        <button onclick="document.getElementById('admin-ticket-modal').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem"><i class="fa-solid fa-times"></i></button>
      </div>
      <div style="padding:12px 22px;border-bottom:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;align-items:center;flex-shrink:0">
        <span style="padding:3px 10px;border-radius:100px;background:${sc}22;color:${sc};font-weight:700;font-size:.78rem;border:1px solid ${sc}44">${ticket.status}</span>
        <span style="font-size:.76rem;color:var(--text-muted)">${escH(ticket.username||uid)} · ${ticket.category} · ${ticket.createdAt}</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px 22px">${msgs}</div>
      ${canReply ? `<div style="padding:14px 22px;border-top:1px solid var(--border);flex-shrink:0">
        <textarea id="admin-reply-input" rows="3" placeholder="Kullanıcıya yanıt yaz..." style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-family:inherit;font-size:.87rem;resize:none;box-sizing:border-box;margin-bottom:10px"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-danger btn-sm" onclick="adminCloseTicket('${uid}','${ticketId}')"><i class="fa-solid fa-lock"></i> Kapat</button>
          <button class="btn btn-primary btn-sm" onclick="adminReplyTicket('${uid}','${ticketId}')"><i class="fa-solid fa-paper-plane"></i> Yanıtla & Kapat</button>
          <button class="btn btn-ghost btn-sm" onclick="adminReplyTicketOnly('${uid}','${ticketId}')"><i class="fa-solid fa-comment"></i> Sadece Yanıtla</button>
        </div>
      </div>` : `<div style="padding:12px 22px;border-top:1px solid var(--border);text-align:center;font-size:.82rem;color:var(--text-muted)"><i class="fa-solid fa-lock"></i> Bu talep kapatılmıştır</div>`}
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function adminReplyTicket(uid, ticketId) {
  const text = document.getElementById('admin-reply-input')?.value.trim();
  if (!text) return adminToast('Yanıt boş olamaz', 'error');
  const all   = _adminGetTickets();
  const tIdx  = (all[uid] || []).findIndex(t => t.id === ticketId);
  if (tIdx < 0) return;
  const ticket = all[uid][tIdx];
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({ from: 'admin', text, ts: Date.now(), sender: Admin.currentUser?.username || 'Yönetici' });
  ticket.status    = 'Kapalı';
  ticket.closedAtMs = Date.now();
  _adminSaveTickets(all);
  document.getElementById('admin-ticket-modal')?.remove();
  adminToast('Yanıtlandı ve kapatıldı ✅', 'success');
  renderAdminSupportTickets();
  renderAdminSidebar();
}

function adminReplyTicketOnly(uid, ticketId) {
  const text = document.getElementById('admin-reply-input')?.value.trim();
  if (!text) return adminToast('Yanıt boş olamaz', 'error');
  const all   = _adminGetTickets();
  const tIdx  = (all[uid] || []).findIndex(t => t.id === ticketId);
  if (tIdx < 0) return;
  const ticket = all[uid][tIdx];
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({ from: 'admin', text, ts: Date.now(), sender: Admin.currentUser?.username || 'Yönetici', readByUser: false });
  ticket.status = 'Yanıtlandı';
  _adminSaveTickets(all);
  document.getElementById('admin-ticket-modal')?.remove();
  adminToast('Yanıt gönderildi ✅', 'success');
  renderAdminSupportTickets();
  renderAdminSidebar();
}

function adminCloseTicket(uid, ticketId) {
  if (!confirm('Bu talebi kapatmak istediğinizden emin misiniz?')) return;
  const all   = _adminGetTickets();
  const tIdx  = (all[uid] || []).findIndex(t => t.id === ticketId);
  if (tIdx < 0) return;
  all[uid][tIdx].status     = 'Kapalı';
  all[uid][tIdx].closedAtMs = Date.now();
  _adminSaveTickets(all);
  document.getElementById('admin-ticket-modal')?.remove();
  adminToast('Talep kapatıldı', 'success');
  renderAdminSupportTickets();
  renderAdminSidebar();
}

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('av-theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
function toggleAdminTheme() {
  const cur = localStorage.getItem('av-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

/* Mobile sidebar */
function toggleAdminSidebar() { document.getElementById('admin-sidebar')?.classList.toggle('mobile-open'); }
function closeSidebar() { document.getElementById('admin-sidebar')?.classList.remove('mobile-open'); }

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function adminUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function timeAgoAdmin(ts) {
  if (!ts) return '—';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Az önce';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}sa önce`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}g önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

function escH(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(str) {
  if (!str) return '';
  return String(str).replace(/'/g,"&#39;").replace(/"/g,'&quot;');
}

function _el(id, fn) { const el = document.getElementById(id); if (el) fn(el); }
function _val2(id)   { return document.getElementById(id)?.value?.trim() || ''; }

function adminToast(msg, type = 'info') {
  const c = document.getElementById('admin-toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3500);
}

/* Init on load */
window.addEventListener('DOMContentLoaded', adminInit);
