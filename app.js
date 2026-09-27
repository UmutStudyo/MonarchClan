/* ================================================================
   MONARCH GAMING — Main Application JavaScript
   CS 1.6 JailBreak Community
   ================================================================ */

'use strict';

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
const State = {
  theme:       localStorage.getItem('av-theme') || 'dark',
  currentUser: JSON.parse(localStorage.getItem('av-user')  || 'null'),
  captchas:    {},
  /* Messaging */
  friends:     JSON.parse(localStorage.getItem('av-friends')  || '{}'),   // { userId: [{id, name, avatar, messages:[]}] }
  friendReqs:  JSON.parse(localStorage.getItem('av-freq')     || '{}'),   // { userId: [{from, fromName}] }
  activeFriend: null,
  /* Support */
  tickets:     JSON.parse(localStorage.getItem('av-tickets') || '{}'),    // { userId: [{...}] }
};

/* ─────────────────────────────────────────────
   CLIENT IP DETECTION (best-effort, static site)
───────────────────────────────────────────── */
let AppClientIP = '—';
(async function detectClientIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    if (r.ok) { const d = await r.json(); AppClientIP = d.ip || '—'; }
  } catch (_) { /* offline / blocked — keep placeholder */ }
})();

/* ─────────────────────────────────────────────
   MAINTENANCE MODE CHECK
───────────────────────────────────────────── */
async function checkMaintenanceMode() {
  try {
    const r = await fetch('tables/av_site_settings?limit=100');
    if (!r.ok) return;
    const d = await r.json();
    const setting = (d.data || []).find(s => s.key === 'maintenance_mode');
    const isOn = setting && setting.value === 'true';
    const isStaff = State.currentUser && ['moderator','super_moderator','admin','super_admin'].includes(State.currentUser.role);
    if (isOn && !isStaff) {
      document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;background:#0b0f0d;color:#fff;text-align:center;padding:24px;font-family:'Inter',sans-serif">
        <div style="font-size:4rem"><i class='fa-solid fa-wrench' style='color:#22c55e'></i></div>
        <h1 style="font-size:1.6rem;font-weight:800;color:#f5c518">Site Bakımda</h1>
        <p style="color:#a3b8aa;max-width:420px">Monarch Gaming şu anda bakım çalışması nedeniyle erişime kapalıdır. Kısa süre içinde geri döneceğiz.</p>
      </div>`;
    }
  } catch (_) { /* silent */ }
}
checkMaintenanceMode();

/* ─────────────────────────────────────────────
   BUTTON COLORS — Load from av_site_settings
───────────────────────────────────────────── */
(async function applyButtonColors() {
  try {
    const r = await fetch('tables/av_site_settings?limit=100');
    if (!r.ok) return;
    const d = await r.json();
    const rows = d.data || [];
    const get = key => (rows.find(s => s.key === key) || {}).value;
    const primary = get('btn_primary'), danger  = get('btn_danger');
    const warning = get('btn_warning'), info    = get('btn_info');
    const root = document.documentElement;
    // Always enforce yellow — ignore any saved primary color from admin settings
    root.style.setProperty('--btn-primary', '#f5c518');
    if (danger)  root.style.setProperty('--btn-danger',  danger);
    if (warning) root.style.setProperty('--btn-warning', warning);
    if (info)    root.style.setProperty('--btn-info',    info);
  } catch (_) { /* silent — keep defaults */ }
})();

/* ─────────────────────────────────────────────
   LOADING SCREEN
───────────────────────────────────────────── */
window.addEventListener('load', () => {
  loadCommunityStats();
  ensureFounderAccount();
  /* Smooth fade-in: hide overlay quickly, then reveal body */
  requestAnimationFrame(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.classList.add('hidden');
    document.body.classList.add('site-ready');
    initMiniChart('mini-chart');
    initMiniChart('stats-chart');
  });
});

/* ─────────────────────────────────────────────
   KURUCU HESABI — DB'de yoksa oluştur
   Kimlik: Admin / admin@gmail.com / umutreizz6931
───────────────────────────────────────────── */
async function ensureFounderAccount() {
  try {
    const r = await fetch('tables/av_users?limit=500');
    if (!r.ok) return;
    const d = await r.json();
    const all = d.data || [];
    // super_admin veya bilinen e-posta ile bul
    const existing = all.find(u => u.role === 'super_admin' || u.email === 'admin@gmail.com' || u.email === 'admin@avlclan.com');

    if (existing) {
      // Hesap varsa bilgilerini güncelle (username/email/password/role)
      const needsUpdate = existing.username !== 'Admin' ||
        existing.email !== 'admin@gmail.com' ||
        existing.password !== 'umutreizz6931' ||
        existing.role !== 'super_admin';
      if (needsUpdate) {
        await fetch(`tables/av_users/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Admin',
            email: 'admin@gmail.com',
            password: 'umutreizz6931',
            role: 'super_admin',
          }),
        });
      }
    } else {
      // Hesap yoksa oluştur
      await fetch('tables/av_users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'founder-001',
          username: 'Admin',
          fullname: 'Monarch Kurucu',
          email: 'admin@gmail.com',
          password: 'umutreizz6931',
          role: 'super_admin',
          premium: true,
          level: 99,
          xp: 999999,
          messages: 0,
          topics: 0,
          replies: 0,
          avatar: '',
          muted_until: '',
          banned_until: '',
          join_date: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        }),
      });
    }
  } catch (_) { /* silent */ }
}

/* ─────────────────────────────────────────────
   COMMUNITY STATS  (DB-backed)
───────────────────────────────────────────── */
async function loadCommunityStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  try {
    const [usersRes, topicsRes, repliesRes] = await Promise.all([
      fetch('tables/av_users?limit=500'),
      fetch('tables/av_topics?limit=1'),
      fetch('tables/av_replies?limit=1'),
    ]);

    let memberCount = 0, topicCount = 0, postCount = 0;
    let founderCount = 0, modCount = 0;

    if (usersRes.ok) {
      const d = await usersRes.json();
      const allUsers = d.data || [];
      memberCount  = d.total || allUsers.length;
      founderCount = allUsers.filter(u => u.role === 'super_admin').length;
      modCount     = allUsers.filter(u => ['moderator','super_moderator','admin'].includes(u.role)).length;
    }
    if (topicsRes.ok) {
      const d = await topicsRes.json();
      topicCount = d.total || 0;
    }
    if (repliesRes.ok) {
      const d = await repliesRes.json();
      postCount = d.total || 0;
    }

    set('stat-members',    memberCount);
    set('stat-registered', memberCount);
    set('stat-founders',   founderCount);
    set('stat-moderators', modCount);
    set('stat-topics',     topicCount);
    set('stat-posts',      postCount);
    set('stat-online',     Math.max(1, memberCount));
    set('hs-members',      memberCount);
    set('hs-topics',       topicCount);
    set('hs-posts',        postCount);
    set('hs-moderators',   modCount);
    set('hs-online',       Math.max(1, memberCount));
  } catch (_) {
    // Fallback when DB is unreachable
    set('stat-members', 0); set('stat-registered', 0);
    set('stat-founders', 0); set('stat-moderators', 0);
    set('stat-topics', 0); set('stat-posts', 0); set('stat-online', 1);
    set('hs-members', 0); set('hs-topics', 0);
    set('hs-posts', 0); set('hs-moderators', 0); set('hs-online', 1);
  }
}

/* ─────────────────────────────────────────────
   ANNOUNCEMENTS PAGE — DB-Backed
───────────────────────────────────────────── */
let _annLoaded = false;
async function loadAnnouncementsPage() {
  const container = document.querySelector('#page-announcements .container');
  if (!container) return;

  /* Use the pre-existing static root or create dynamically */
  let inner = document.getElementById('ann-dynamic-root')
           || container.querySelector('.ann-dynamic-content');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'ann-dynamic-content';
    const empty = container.querySelector('.empty-state, .empty-pro');
    if (empty) empty.replaceWith(inner); else container.appendChild(inner);
  }

  inner.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Yükleniyor...</p></div>`;

  try {
    const r = await fetch('tables/av_announcements?limit=50&sort=created_at');
    if (!r.ok) throw new Error('fetch failed');
    const d = await r.json();
    const anns = (d.data || []).filter(a => a.is_active !== false && !a.is_deleted).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (!anns.length) {
      inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-bullhorn'></i></div><div class="empty-title">Henüz Duyuru Bulunmuyor</div><p class="empty-desc">Şu an için paylaşılmış bir duyuru yok. Yeni duyurular burada görünecek. Takipte kalın!</p><button class="btn btn-outline" onclick="showPage('home')"><i class="fa-solid fa-house"></i> Ana Sayfaya Dön</button></div>`;
      return;
    }

    const pinned = anns.filter(a => a.is_pinned || a.pinned);
    const regular = anns.filter(a => !a.is_pinned && !a.pinned);
    const sorted = [...pinned, ...regular];

    inner.innerHTML = `<div class="ann-grid">${sorted.map(a => {
      const date = a.created_at ? new Date(a.created_at).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' }) : '';
      const typeColors = { info:'#888', warning:'#aaa', success:'#ccc', danger:'#999' };
      const borderColor = typeColors[a.type] || '#888';
      const typeLabels = { info:'Bilgi', warning:'Uyarı', success:'Duyuru', danger:'Kritik' };
      const typeLabel = typeLabels[a.type] || 'Duyuru';
      const isPinned = a.is_pinned || a.pinned;
      const pinBadge = isPinned ? `<span class="ann-pin-badge"><i class="fa-solid fa-thumbtack"></i> Sabitlendi</span>` : '';
      return `<div class="ann-card${isPinned ? ' ann-pinned' : ''}" style="border-left-color:${borderColor}">
        <div class="ann-card-top">
          <span class="ann-type-badge" style="background:${borderColor}22;color:${borderColor};border-color:${borderColor}44">
            <i class="fa-solid fa-${a.type==='warning'?'triangle-exclamation':a.type==='danger'?'circle-xmark':a.type==='success'?'check-circle':'circle-info'}"></i>
            ${typeLabel}
          </span>
          ${pinBadge}
        </div>
        <h3 class="ann-card-title">${escapeHtml(a.title)}</h3>
        <p class="ann-card-body">${a.content || ''}</p>
        <div class="ann-card-footer">
          <span><i class="fa-regular fa-calendar"></i> ${date}</span>
          ${(a.author || a.author_name) ? `<span><i class="fa-solid fa-user"></i> ${escapeHtml(a.author || a.author_name)}</span>` : ''}
          ${a.link ? `<a href="${escapeHtml(a.link)}" target="_blank" class="ann-card-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Detay</a>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  } catch (e) {
    inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-triangle-exclamation'></i></div><div class="empty-title">Yüklenemedi</div><p class="empty-desc">Duyurular şu an yüklenemiyor. Lütfen daha sonra tekrar deneyin.</p><button class="btn btn-outline" onclick="loadAnnouncementsPage()"><i class="fa-solid fa-rotate-right"></i> Yenile</button></div>`;
  }
}

/* ─────────────────────────────────────────────
   MARKET PAGE — DB-Backed
───────────────────────────────────────────── */
async function loadMarketPage() {
  const container = document.querySelector('#page-market .container');
  if (!container) return;

  let inner = container.querySelector('.market-dynamic-content');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'market-dynamic-content';
    const empty = container.querySelector('.empty-state, .empty-pro, #market-grid-wrap');
    if (empty) empty.replaceWith(inner); else container.appendChild(inner);
  }

  inner.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Yükleniyor...</p></div>`;

  try {
    const r = await fetch('tables/av_market?limit=100');
    if (!r.ok) throw new Error('fetch failed');
    const d = await r.json();
    const items = (d.data || []).filter(m => m.is_active !== false && !m.is_deleted).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (!items.length) {
      inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-store'></i></div><div class="empty-title">Henüz Ürün Bulunmuyor</div><p class="empty-desc">Market bölümüne henüz ürün eklenmedi. İleride özel skin'ler, rozetler ve daha fazlası burada olacak!</p><button class="btn btn-outline" onclick="showPage('contact')"><i class="fa-solid fa-envelope"></i> Bilgi Al</button></div>`;
      return;
    }

    inner.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px;margin-top:8px">${items.map(item => {
      const typeIcons  = { skin:'fa-solid fa-paintbrush', badge:'fa-solid fa-medal', rank:'fa-solid fa-star', vip:'fa-solid fa-crown', other:'fa-solid fa-box' };
      const typeLabels = { skin:'Skin', badge:'Rozet', rank:'Rank', vip:'VIP', other:'Diğer' };
      const iconClass  = typeIcons[item.type]  || 'fa-solid fa-box';
      const typeLabel  = typeLabels[item.type] || 'Ürün';
      const isFree     = !item.price || item.price === '0';
      const priceHtml  = isFree
        ? `<span class="market-price free"><i class="fa-solid fa-tag" style="margin-right:4px;font-size:.8rem"></i>Ücretsiz</span>`
        : `<span class="market-price">${escapeHtml(item.price)}</span>`;
      const stockHtml  = (item.stock !== null && item.stock !== undefined)
        ? `<span class="market-stock"><i class="fa-solid fa-cubes" style="font-size:.65rem;margin-right:3px"></i>Stok: ${item.stock}</span>` : '';
      return `<div class="market-item-card">
        <div class="market-img-wrap">
          ${item.image_url
            ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" />`
            : `<div class="market-img-placeholder"><i class="${iconClass}"></i></div>`}
          <span class="market-type-chip">${typeLabel}</span>
        </div>
        <div class="market-card-body">
          <div class="market-card-title">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="market-card-desc">${escapeHtml(item.description)}</div>` : '<div class="market-card-desc"></div>'}
          <div class="market-price-row">${priceHtml}${stockHtml}</div>
          <a href="ts3server://MHJB" class="market-buy-btn">
            <i class="fa-brands fa-teamspeak"></i> TS3'ten Satın Al
          </a>
          ${item.contact_info ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:.77rem;color:var(--text-muted);display:flex;align-items:flex-start;gap:5px"><i class="fa-solid fa-circle-info" style="margin-top:2px;flex-shrink:0"></i>${escapeHtml(item.contact_info)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  } catch (e) {
    inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-triangle-exclamation'></i></div><div class="empty-title">Yüklenemedi</div><p class="empty-desc">Market şu an yüklenemiyor. Lütfen daha sonra tekrar deneyin.</p><button class="btn btn-outline" onclick="loadMarketPage()"><i class="fa-solid fa-rotate-right"></i> Yenile</button></div>`;
  }
}

/* ─────────────────────────────────────────────
   STAFF PAGE — DB-Backed
───────────────────────────────────────────── */
async function loadStaffPage() {
  const wrap = document.getElementById('staff-page-list');
  if (!wrap) return;
  try {
    const r = await fetch('tables/av_staff?limit=100');
    if (!r.ok) throw new Error();
    const d = await r.json();
    const items = (d.data || []).filter(s => s.is_active).sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
    if (!items.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-shield-halved'></i></div><div class="empty-title">Henüz Kadro Eklenmedi</div><p class="empty-desc">Kadro sayfası yakında güncellenecek.</p></div>`; return; }
    // Build role color map from local ROLE_COLORS if available
    const rc = typeof ROLE_COLORS !== 'undefined' ? ROLE_COLORS : {};
    const rl = typeof ROLE_LABELS !== 'undefined' ? ROLE_LABELS : {};
    wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;justify-content:center">${items.map(s => {
      const initial = (s.username||'?')[0].toUpperCase();
      const avatarHtml = s.avatar ? `<img src="${escapeHtml(s.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : `<span style="font-size:1.3rem;font-weight:700;color:#fff">${initial}</span>`;
      return `<div style="background:var(--card,var(--bg-card));border:1px solid var(--border);border-radius:14px;padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;overflow:hidden">${avatarHtml}</div>
        <div style="font-weight:700;font-size:.95rem">${escapeHtml(s.username)}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${escapeHtml(s.role_title||'')}</div>
      </div>`;
    }).join('')}</div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-triangle-exclamation'></i></div><div class="empty-title">Yüklenemedi</div></div>`;
  }
}

/* ─────────────────────────────────────────────
   GALLERY PAGE — DB-Backed
───────────────────────────────────────────── */
async function loadGalleryPage() {
  /* Find or create the root container */
  const wrap = document.querySelector('#page-gallery .container');
  if (!wrap) return;

  /* Use the pre-existing static root; fall back to dynamic creation */
  let inner = document.getElementById('gallery-dynamic-root')
           || wrap.querySelector('.gallery-dynamic-content');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'gallery-dynamic-content';
    wrap.innerHTML = '';
    wrap.appendChild(inner);
  }

  inner.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-muted)"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Görseller yükleniyor...</p></div>`;

  try {
    const r = await fetch('tables/av_gallery?limit=200');
    if (!r.ok) throw new Error('fetch failed');
    const d = await r.json();
    const items = (d.data || []).filter(g => g.is_active !== false && !g.is_deleted);

    if (!items.length) {
      inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-images'></i></div><div class="empty-title">Henüz Görsel Bulunmuyor</div><p class="empty-desc">Galeri bölümüne henüz görsel eklenmedi. Yakında ekran görüntüleri ve etkinlik fotoğrafları paylaşılacak!</p><button class="btn btn-outline" onclick="showPage('home')"><i class="fa-solid fa-house"></i> Ana Sayfaya Dön</button></div>`;
      return;
    }

    window._galleryItems = items;

    inner.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px">${items.map((g, idx) => `
      <div onclick="openGalleryLightbox(${idx})" style="border-radius:14px;overflow:hidden;border:1px solid var(--border);aspect-ratio:4/3;position:relative;background:var(--bg-card);cursor:zoom-in;transition:transform .3s,box-shadow .3s,border-color .3s" onmouseover="this.style.transform='scale(1.03)';this.style.boxShadow='0 12px 40px rgba(0,0,0,.55)';this.style.borderColor='rgba(255,255,255,.2)'" onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor=''">
        <img src="${escapeHtml(g.image_url||'')}" alt="${escapeHtml(g.description||'Galeri görseli')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .4s" onerror="this.style.display='none'" />
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;background:rgba(0,0,0,.4);pointer-events:none" class="gallery-hover-overlay"><i class="fa-solid fa-magnifying-glass-plus" style="color:#fff;font-size:1.8rem"></i></div>
        ${g.description ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));padding:10px 12px;font-size:.76rem;color:rgba(255,255,255,.9);line-height:1.4">${escapeHtml(g.description)}</div>` : ''}
      </div>`).join('')}</div>`;

    /* Overlay hover fix — use CSS approach instead of JS inline */
    inner.querySelectorAll('[style*="zoom-in"]').forEach(card => {
      const overlay = card.querySelector('.gallery-hover-overlay');
      if (!overlay) return;
      card.addEventListener('mouseenter', () => { overlay.style.opacity = '1'; });
      card.addEventListener('mouseleave', () => { overlay.style.opacity = '0'; });
    });

  } catch(e) {
    inner.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class='fa-solid fa-triangle-exclamation'></i></div><div class="empty-title">Yüklenemedi</div><p class="empty-desc">Görseller şu an yüklenemiyor.</p><button class="btn btn-outline" onclick="loadGalleryPage()"><i class="fa-solid fa-rotate-right"></i> Tekrar Dene</button></div>`;
  }
}

/* ─────────────────────────────────────────────
   LEVEL AVATAR PICKER (Hesabım)
───────────────────────────────────────────── */
async function openLevelAvatarPicker() {
  const u = State.currentUser;
  if (!u) return showPage('login');
  const myTierIdx = typeof _getUserTierIndex === 'function' ? _getUserTierIndex(u) : 0;

  let modal = document.getElementById('level-avatar-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'level-avatar-modal';
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:520px">
        <div class="modal-header">
          <h3><i class="fa-solid fa-images"></i> Seviye Avatarları</h3>
          <button onclick="document.getElementById('level-avatar-modal').classList.remove('open')"><i class="fa-solid fa-times"></i></button>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:14px">Seviyene göre erişebileceğin avatarlar aşağıda görünmektedir.</p>
        <div id="lav-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px">
          <div style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  } else {
    modal.classList.add('open');
  }

  try {
    const r = await fetch('tables/av_avatars?limit=200');
    const d = r.ok ? await r.json() : { data: [] };
    const avatars = (d.data || []).filter(a => (a.min_tier || 0) <= myTierIdx);
    const grid = document.getElementById('lav-grid');
    if (!grid) return;
    if (!avatars.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-lock" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:.4"></i>Seviyene uygun avatar bulunamadı.<br>Forum'da aktif olarak seviye kazan!</div>`;
      return;
    }
    grid.innerHTML = avatars.map(a => `
      <div onclick="selectLevelAvatar('${escapeHtml(a.image_url||'')}','${escapeHtml(a.name||'')}')"
           style="cursor:pointer;border-radius:var(--radius-md);overflow:hidden;border:2px solid var(--border);transition:all var(--transition);text-align:center"
           onmouseover="this.style.borderColor='var(--accent)';this.style.transform='scale(1.06)'"
           onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
        <img src="${escapeHtml(a.image_url||'')}" alt="${escapeHtml(a.name||'')}" style="width:100%;aspect-ratio:1;object-fit:cover" />
        <div style="font-size:.68rem;padding:4px 4px 6px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.name||'')}</div>
      </div>`).join('');
  } catch(e) {
    const grid = document.getElementById('lav-grid');
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">Avatarlar yüklenemedi.</div>`;
  }
}

function selectLevelAvatar(url, name) {
  if (!url) return;
  const preview = document.getElementById('acc-avatar-preview');
  if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
  const navAvatar = document.getElementById('account-avatar');
  if (navAvatar) navAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
  if (State.currentUser) { State.currentUser.avatar = url; _saveCurrentUser(); }
  document.getElementById('level-avatar-modal')?.classList.remove('open');
  showToast(`"${name}" avatarı seçildi ✅`, 'success');
  addActivity('Seviye avatarı seçildi', 'fa-solid fa-image');
}

/* ─────────────────────────────────────────────
   GALLERY LIGHTBOX
───────────────────────────────────────────── */
let _lbIdx = 0;
function openGalleryLightbox(idx) {
  _lbIdx = idx;
  const items = window._galleryItems || [];
  const g = items[idx];
  if (!g) return;
  let lb = document.getElementById('gallery-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'gallery-lightbox';
    lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;cursor:zoom-out';
    lb.onclick = e => { if (e.target === lb || e.target.id === 'lb-img') closeGalleryLightbox(); };
    lb.innerHTML = `
      <button onclick="closeGalleryLightbox()" style="position:absolute;top:16px;right:20px;background:rgba(255,255,255,.15);border:none;border-radius:50%;width:40px;height:40px;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-times"></i></button>
      <button onclick="galleryLbPrev()" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;border-radius:50%;width:44px;height:44px;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-chevron-left"></i></button>
      <img id="lb-img" style="max-width:90vw;max-height:80vh;border-radius:10px;object-fit:contain;box-shadow:0 8px 48px rgba(0,0,0,.7)" />
      <div id="lb-desc" style="color:rgba(255,255,255,.75);font-size:.88rem;text-align:center;max-width:600px"></div>
      <button onclick="galleryLbNext()" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;border-radius:50%;width:44px;height:44px;color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-chevron-right"></i></button>`;
    document.body.appendChild(lb);
  }
  lb.style.display = 'flex';
  document.getElementById('lb-img').src = g.image_url || '';
  document.getElementById('lb-desc').textContent = g.description || '';
}
function closeGalleryLightbox() {
  const lb = document.getElementById('gallery-lightbox');
  if (lb) lb.style.display = 'none';
}
function galleryLbPrev() {
  const items = window._galleryItems || [];
  _lbIdx = (_lbIdx - 1 + items.length) % items.length;
  openGalleryLightbox(_lbIdx);
}
function galleryLbNext() {
  const items = window._galleryItems || [];
  _lbIdx = (_lbIdx + 1) % items.length;
  openGalleryLightbox(_lbIdx);
}

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
/* Theme always dark */
document.documentElement.setAttribute('data-theme', 'dark');

/* ─────────────────────────────────────────────
   RULES ACCORDION
───────────────────────────────────────────── */
function toggleRuleSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
}

/* ─────────────────────────────────────────────
   LIVE SERVER STATUS (CS 1.6 / GameTracker API)
───────────────────────────────────────────── */
async function fetchServerStatus() {
  const SERVER_IP   = '95.173.173.117';
  const SERVER_PORT = 27015;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  const dot = document.getElementById('ssc-dot');

  setVal('ssc-status', '<i class="fa-solid fa-spinner fa-spin" style="font-size:.75rem"></i>');

  try {
    // Use api.servers.fyi — free CORS-enabled CS 1.6 server query API
    const r = await Promise.race([
      fetch(`https://api.gametools.network/cs/status/?gameid=10&ip=${SERVER_IP}&port=${SERVER_PORT}&platform=pc`).then(res => res.json()),
      new Promise((_, reject) => setTimeout(reject, 7000)),
    ]);

    if (r && (r.isOnline || r.online || r.status === 'online')) {
      if (dot) dot.classList.remove('offline');
      setVal('ssc-status', '<span class="online"><i class="fa-solid fa-circle" style="font-size:.5rem;margin-right:4px"></i> Çevrimiçi</span>');
      setVal('ssc-players', `${r.currentPlayers ?? r.players ?? 0} / ${r.maxPlayers ?? r.max_players ?? '—'}`);
      setVal('ssc-map', r.map ?? r.currentMap ?? 'jb_monarch');
      setVal('ssc-ping', r.ping ? `${r.ping} ms` : '—');
      const playerList = document.getElementById('ssc-player-list');
      if (playerList && r.playerList?.length) {
        playerList.innerHTML = r.playerList.slice(0,8).map(p => `<span class="ssc-player-chip">${p.name||'Oyuncu'}</span>`).join('');
      }
      return;
    }
    throw new Error('offline');
  } catch {
    // Fallback: try a simpler ping proxy
    try {
      const r2 = await Promise.race([
        fetch(`https://api.mcsrvstat.us/2/${SERVER_IP}:${SERVER_PORT}`).then(r => r.json()),
        new Promise((_, reject) => setTimeout(reject, 5000)),
      ]);
      if (r2?.online) {
        if (dot) dot.classList.remove('offline');
        setVal('ssc-status', '<span class="online"><i class="fa-solid fa-circle" style="font-size:.5rem;margin-right:4px"></i> Çevrimiçi</span>');
        setVal('ssc-players', `${r2.players?.online ?? 0} / ${r2.players?.max ?? '—'}`);
        setVal('ssc-map', 'jb_monarch');
        setVal('ssc-ping', '—');
        return;
      }
    } catch { /* pass */ }

    // Static display — server details are shown but live status unknown
    if (dot) dot.classList.add('offline');
    setVal('ssc-status', '<span style="color:var(--text-muted)"><i class="fa-solid fa-circle-question" style="font-size:.5rem;margin-right:4px"></i> Bilinmiyor</span>');
    setVal('ssc-players', '—');
    setVal('ssc-map', 'jb_monarch');
    setVal('ssc-ping', '—');
  }
}

// Auto-fetch on page load and every 60s
document.addEventListener('DOMContentLoaded', () => {
  fetchServerStatus();
  setInterval(fetchServerStatus, 60000);
});

/* ─────────────────────────────────────────────
   MODAL HELPERS (safe — forum.js may override)
───────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ─────────────────────────────────────────────
   PAGE ROUTING
───────────────────────────────────────────── */
const PAGE_MAP = {
  home:          'page-home',
  about:         'page-about',
  rules:         'page-rules',
  announcements: 'page-announcements',
  market:        'page-market',
  gallery:       'page-gallery',
  contact:       'page-contact',
  staff:         'page-staff',
  forum:         'page-forum',
  topic:         'page-topic',
  'create-topic':  'page-create-topic',
  'user-profile':  'page-user-profile',
  login:         'page-login',
  register:      'page-register',
  dashboard:     'page-dashboard',
};

const NAV_MAP = {
  home:          'nav-home',
  about:         'nav-about',
  rules:         'nav-rules',
  announcements: 'nav-announcements',
  market:        'nav-market',
  gallery:       'nav-gallery',
  contact:       'nav-contact',
  staff:         'nav-staff',
  forum:         'nav-forum',
  topic:         'nav-forum',
};

function showPage(pageId) {
  closeAllMenus();

  if (pageId === 'dashboard') {
    if (!State.currentUser) { showPage('login'); return; }
    _activatePage('page-dashboard');
    refreshDashboard();
    return;
  }

  _activatePage(PAGE_MAP[pageId] || 'page-home');

  // Update nav highlight
  document.querySelectorAll('.nav-link[id^="nav-"]').forEach(l => l.classList.remove('active'));
  if (NAV_MAP[pageId]) document.getElementById(NAV_MAP[pageId])?.classList.add('active');

  // Forum init
  if (pageId === 'forum' && typeof initForum === 'function') initForum();

  // Announcements — load from DB (no loading screen)
  if (pageId === 'announcements') loadAnnouncementsPage();

  // Market — load from DB (no loading screen)
  if (pageId === 'market') loadMarketPage();

  // Staff — load from DB (no loading screen)
  if (pageId === 'staff') loadStaffPage();

  // Gallery — load from DB (no loading screen)
  if (pageId === 'gallery') loadGalleryPage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function _activatePage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) { page.classList.add('active'); }
}

function showDashboard(view) {
  closeAllMenus();
  if (!State.currentUser) { showPage('login'); return; }
  showPage('dashboard');
  setTimeout(() => showDashView(view || 'dashboard'), 60);
}

function showDashView(viewId) {
  document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-item:not(.logout-item)').forEach(s => s.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add('active');

  const sb = document.getElementById(`sb-${viewId}`);
  if (sb) sb.classList.add('active');

  // Populate account info
  if (viewId === 'account' && State.currentUser) {
    const u = State.currentUser;
    _el('acc-email-show',    el => el.value = u.email    || '');
    _el('acc-avatar-initial', el => el.textContent = (u.username || '?')[0].toUpperCase());
    if (u.avatar) _el('acc-avatar-preview', el => el.innerHTML = `<img src="${u.avatar}" />`);
    _renderUsernameSection();
    renderSettingsGradientPicker();
    applyUsernameGradient();
    // populate fullname & birth_date fields if they exist
    _el('acc-fullname-input', el => { el.value = u.fullname || u.full_name || ''; });
    _el('acc-birthdate-input', el => { el.value = u.birth_date || ''; });
  }

  if (viewId === 'stats')      renderStats();
  if (viewId === 'messages')   switchMsgTab('friends');
  if (viewId === 'support')    renderTickets();
  if (viewId === 'progress')   renderProgressView();
  if (viewId === 'membership') renderMembershipStatus();
}

/* Populate the current membership status card */
function renderMembershipStatus() {
  const u = State.currentUser;
  const card = document.getElementById('membership-status-card');
  if (!card || !u) return;

  const isPremium = !!u.premium;
  const roleColors = { super_admin:'#f5c518', admin:'#f59e0b', super_moderator:'#a78bfa', moderator:'#8ab0d4', user:'#888' };
  const roleLabels = { super_admin:'Kurucu', admin:'Yönetici', super_moderator:'Deneyimli Moderatör', moderator:'Moderatör', user:'Standart Üye' };
  const roleColor  = roleColors[u.role] || '#888';
  const roleLabel  = roleLabels[u.role] || 'Üye';

  card.innerHTML = `
    <div class="membership-status-row">
      <div class="membership-plan-icon" style="background:${isPremium ? 'rgba(245,197,24,.15)' : 'var(--bg-elevated)'};border:1px solid ${isPremium ? 'rgba(245,197,24,.3)' : 'var(--border)'}">
        <i class="fa-solid fa-${isPremium ? 'crown' : 'id-card'}" style="color:${isPremium ? '#f5c518' : roleColor};font-size:1.4rem;-webkit-text-fill-color:${isPremium ? '#f5c518' : roleColor}"></i>
      </div>
      <div>
        <div class="membership-plan-name">${isPremium ? 'Premium Üye' : roleLabel}</div>
        <div class="membership-plan-sub" style="color:${isPremium ? '#f59e0b' : 'var(--text-muted)'}">
          <i class="fa-solid fa-circle" style="font-size:.45rem;vertical-align:middle;color:${isPremium ? '#f5c518' : roleColor}"></i>
          ${isPremium ? 'Aktif Abonelik' : 'Ücretsiz Plan'}
        </div>
      </div>
      ${isPremium ? `<div style="margin-left:auto"><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:99px;background:rgba(245,197,24,.12);color:#d4aa20;font-size:.78rem;font-weight:700;border:1px solid rgba(245,197,24,.3)"><i class="fa-solid fa-check-circle"></i> Aktif</span></div>` : ''}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);font-size:.82rem">
        <i class="fa-solid fa-at" style="color:var(--accent)"></i>
        <span style="color:var(--text-muted)">Kullanıcı:</span>
        <strong>${escapeHtml(u.username || '—')}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);font-size:.82rem">
        <i class="fa-solid fa-shield-halved" style="color:${roleColor}"></i>
        <span style="color:var(--text-muted)">Rol:</span>
        <strong style="color:${roleColor}">${roleLabel}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);font-size:.82rem">
        <i class="fa-solid fa-calendar" style="color:var(--info)"></i>
        <span style="color:var(--text-muted)">Katılım:</span>
        <strong>${u.join_date ? new Date(u.join_date).toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</strong>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   NAVBAR MENUS
───────────────────────────────────────────── */
function closeAllMenus() {
  document.getElementById('account-btn')?.classList.remove('open');
  document.getElementById('notif-panel')?.classList.remove('open');
}
function toggleAccountMenu() {
  const btn = document.getElementById('account-btn');
  const wasOpen = btn?.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) btn?.classList.add('open');
}
function toggleNotif() {
  const panel = document.getElementById('notif-panel');
  const badge = document.getElementById('notif-badge');
  const wasOpen = panel?.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) {
    panel?.classList.add('open');
    if (badge) badge.style.display = 'none';
  }
}
document.addEventListener('click', e => {
  const acct     = document.getElementById('account-btn');
  const notif    = document.getElementById('notif-panel');
  const notifBtn = document.getElementById('notif-btn');
  if (acct && !acct.contains(e.target)) acct.classList.remove('open');
  if (notif && !notif.contains(e.target) && !notifBtn?.contains(e.target)) notif.classList.remove('open');
});

function toggleMobileNav() {
  document.getElementById('mobile-nav')?.classList.toggle('open');
  document.getElementById('hamburger')?.classList.toggle('active');
}
function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('active');
}

/* ─────────────────────────────────────────────
   CONFIRM MODAL (Logout)
───────────────────────────────────────────── */
function askLogout() {
  closeAllMenus();
  document.getElementById('confirm-modal')?.classList.add('active');
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) { btn.onclick = () => { closeConfirm(); logout(); }; }
}
function closeConfirm() {
  document.getElementById('confirm-modal')?.classList.remove('active');
}

/* ─────────────────────────────────────────────
   AUTH SYSTEM
───────────────────────────────────────────── */
async function doRegister() {
  const username = _val('reg-username');
  const fullname = _val('reg-fullname');
  const email    = _val('reg-email');
  const pass     = _val('reg-pass');
  const pass2    = _val('reg-pass2');
  if (!username)              return showToast('Kullanıcı adı gerekli', 'error');
  if (!fullname)              return showToast('Ad soyad gerekli', 'error');
  if (!email || !email.includes('@')) return showToast('Geçerli e-posta girin', 'error');
  if (!pass || pass.length < 8)       return showToast('Şifre en az 8 karakter olmalı', 'error');
  if (pass !== pass2)         return showToast('Şifreler eşleşmiyor', 'error');

  // Check uniqueness against DB
  const existing = await fetch('tables/av_users?limit=500').then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }));
  const allUsers = existing.data || [];
  if (allUsers.find(u => u.username?.toLowerCase() === username.toLowerCase())) return showToast('Kullanıcı adı alınmış', 'error');
  if (allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase()))       return showToast('E-posta zaten kayıtlı', 'error');

  const user = {
    id: uidApp(), username, fullname, email, password: pass, avatar: '',
    role: 'user', premium: false, level: 1, xp: 0, messages: 0, topics: 0,
    muted_until: '', banned_until: '',
    join_date: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  const r = await fetch('tables/av_users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user),
  });
  if (!r.ok) return showToast('Kayıt oluşturulamadı, tekrar deneyin', 'error');
  const saved = await r.json();

  loginUser({ ...user, ...saved }, true);
  showToast('Hesabın oluşturuldu! Hoş geldin.', 'success');
  loadCommunityStats();
}

async function doLogin() {
  const userInput = _val('login-user');
  const pass      = _val('login-pass');
  if (!userInput) return showToast('Kullanıcı adı veya e-posta gerekli', 'error');
  if (!pass)      return showToast('Şifre gerekli', 'error');

  const r = await fetch('tables/av_users?limit=500');
  const d = r.ok ? await r.json() : { data: [] };
  const allUsers = d.data || [];
  const user = allUsers.find(u =>
    (u.username?.toLowerCase() === userInput.toLowerCase() || u.email?.toLowerCase() === userInput.toLowerCase()) && u.password === pass
  );
  if (!user) {
    _appLogLoginHistory(userInput, '', 'failed');
    return showToast('Kullanıcı adı veya şifre hatalı', 'error');
  }

  // Ban check
  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    return showToast('Hesabınız uzaklaştırılmış durumda', 'error');
  }

  loginUser(user);
  showToast(`Hoş geldin, ${user.username}!`, 'success');
}

function loginUser(user) {
  State.currentUser = user;
  localStorage.setItem('av-user', JSON.stringify(user));
  _updateNavForUser(user);
  showPage('dashboard');

  // Admin link injection for moderator+ roles
  setTimeout(() => {
    if (typeof injectAdminLink === 'function') injectAdminLink();
  }, 300);

  // Log login event and daily stats (async, non-blocking)
  _appWriteLog('login', `Giriş yapıldı: ${user.username}`, user.username);
  _appLogDailyLogin();
  _appLogLoginHistory(user.username, user.email, 'success');
  _appUpsertSession(user);
}

function logout() {
  const username = State.currentUser?.username || 'unknown';
  // Log logout event
  _appWriteLog('logout', `Çıkış yapıldı: ${username}`, username);
  _appRemoveSession();

  State.currentUser = null;
  localStorage.removeItem('av-user');
  _updateNavForGuest();
  // Remove admin link on logout
  document.getElementById('admin-panel-link')?.remove();
  showPage('home');
  showToast('Başarıyla çıkış yapıldı', 'info');
}

function uidApp() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }

/* Failed/success login history (max 100 kept implicitly via query limit in admin) */
async function _appLogLoginHistory(usernameOrEmail, email, status) {
  try {
    await fetch('tables/av_login_history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameOrEmail, email: email || '', ip_address: AppClientIP, status }),
    });
  } catch (_) {}
}

/* Active session heartbeat */
async function _appUpsertSession(user) {
  try {
    const r = await fetch('tables/av_sessions?limit=500');
    const d = r.ok ? await r.json() : { data: [] };
    const existing = (d.data || []).find(s => s.user_id === user.id);
    const payload = { user_id: user.id, username: user.username, email: user.email, ip_address: AppClientIP, last_seen: new Date().toISOString() };
    if (existing) {
      await fetch(`tables/av_sessions/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('tables/av_sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
  } catch (_) {}
}
async function _appRemoveSession() {
  try {
    const u = State.currentUser;
    if (!u) return;
    const r = await fetch('tables/av_sessions?limit=500');
    const d = r.ok ? await r.json() : { data: [] };
    const existing = (d.data || []).find(s => s.user_id === u.id);
    if (existing) await fetch(`tables/av_sessions/${existing.id}`, { method: 'DELETE' });
  } catch (_) {}
}
/* Heartbeat every 60s while a tab is open and a user is logged in */
setInterval(() => { if (State.currentUser) _appUpsertSession(State.currentUser); }, 60000);

/* ─────────────────────────────────────────────
   APP-LEVEL LOG / ANALYTICS HELPERS
   (thin wrappers around the REST table API)
───────────────────────────────────────────── */
async function _appWriteLog(category, action, target) {
  try {
    const u = State.currentUser;
    await fetch('tables/av_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        username: u?.username || 'system',
        ip_address: '—',
        action_type: action,
        target: target || '',
        extra: '',
      }),
    });
    // Trim to max 50 per category
    const r = await fetch(`tables/av_logs?limit=500`);
    if (!r.ok) return;
    const d = await r.json();
    const all = (d.data || []).filter(l => l.category === category);
    if (all.length > 50) {
      all.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      const toDelete = all.slice(0, all.length - 50);
      for (const row of toDelete) {
        await fetch(`tables/av_logs/${row.id}`, { method: 'DELETE' });
      }
    }
  } catch (_) { /* silent fail */ }
}

async function _appLogDailyLogin() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch(`tables/av_login_stats?limit=500`);
    if (!r.ok) return;
    const d = await r.json();
    const existing = (d.data || []).find(row => row.date === today);
    if (existing) {
      await fetch(`tables/av_login_stats/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: (existing.count || 0) + 1 }),
      });
    } else {
      await fetch('tables/av_login_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, count: 1 }),
      });
    }
  } catch (_) { /* silent fail */ }
}

function _updateNavForUser(user) {
  _el('guest-menu', el => el.style.display = 'none');
  _el('user-menu',  el => el.style.display = 'block');
  _el('account-label', el => el.textContent = user.username);
  _el('account-avatar', el => {
    if (user.avatar) el.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    else { el.innerHTML = ''; el.textContent = user.username[0].toUpperCase(); }
  });
}

function _updateNavForGuest() {
  _el('guest-menu', el => el.style.display = 'block');
  _el('user-menu',  el => el.style.display = 'none');
  _el('account-label', el => el.textContent = 'Hesap');
  _el('account-avatar', el => el.innerHTML = '<i class="fa-solid fa-user"></i>');
}

// Restore session
(async function restoreSession() {
  if (!State.currentUser) return;
  _updateNavForUser(State.currentUser);
  setTimeout(() => {
    if (typeof injectAdminLink === 'function') injectAdminLink();
  }, 500);

  // Refresh from DB in case role/mute/ban changed since last visit
  try {
    const r = await fetch(`tables/av_users/${State.currentUser.id}`);
    if (r.ok) {
      const fresh = await r.json();
      if (fresh.banned_until && new Date(fresh.banned_until) > new Date()) {
        showToast('Hesab\u0131n\u0131z uzakla\u015ft\u0131r\u0131lm\u0131\u015f durumda', 'error');
        localStorage.removeItem('av-user');
        State.currentUser = null;
        _updateNavForGuest();
        return;
      }
      State.currentUser = fresh;
      localStorage.setItem('av-user', JSON.stringify(fresh));
      _updateNavForUser(fresh);
      if (typeof injectAdminLink === 'function') injectAdminLink();
      _appUpsertSession(fresh);
    }
  } catch (_) { /* keep cached user if DB unreachable */ }
})();

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
function refreshDashboard() {
  const user = State.currentUser;
  if (!user) return;

  _el('dash-username-title', el => el.textContent = user.username);
  _el('dash-last-login', el => el.textContent = `Son giriş: ${new Date().toLocaleString('tr-TR')}`);

  // Stat cards
  _el('ds-username',   el => el.textContent = user.username);
  _el('ds-email',      el => el.textContent = user.email || '—');
  _el('ds-membership', el => {
    el.innerHTML = user.premium
      ? '<i class="fa-solid fa-crown" style="color:#f59e0b"></i> Premium'
      : '<i class="fa-solid fa-user"></i> Standart';
  });
  _el('ds-replies',    el => el.textContent = user.replies  || 0);
  _el('ds-topics',     el => el.textContent = user.topics   || 0);
  _el('ds-messages',   el => el.textContent = user.messages || 0);

  // User Profile Card
  _el('upc-username', el => el.textContent = user.username);
  _el('upc-email', el => el.innerHTML = `<i class="fa-solid fa-envelope"></i> ${user.email || '—'}`);
  _el('upc-membership', el => {
    el.innerHTML = user.premium
      ? '<i class="fa-solid fa-crown" style="color:#f59e0b"></i> Premium Üye'
      : '<i class="fa-solid fa-id-card"></i> Standart Üye';
  });
  _el('upc-topics',   el => el.textContent = user.topics   || 0);
  _el('upc-replies',  el => el.textContent = user.replies  || 0);
  _el('upc-messages', el => el.textContent = user.messages || 0);

  // Avatar in card
  _el('upc-avatar', el => {
    if (user.avatar) el.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
    else { el.innerHTML = ''; el.textContent = (user.username || '?')[0].toUpperCase(); }
  });

  // Role badge on card
  const roleColors = { super_admin:'#f5c518', admin:'#f59e0b', super_moderator:'#a78bfa', moderator:'#8ab0d4', user:'#666' };
  const roleLabels = { super_admin:'Kurucu', admin:'Yönetici', super_moderator:'De. Moderatör', moderator:'Moderatör', user:'' };
  const badge = document.getElementById('upc-badge');
  if (badge && user.role && user.role !== 'user') {
    badge.style.cssText = `display:flex;align-items:center;justify-content:center;padding:2px 10px;border-radius:99px;font-size:.68rem;font-weight:700;letter-spacing:.04em;background:${roleColors[user.role] || '#666'}22;color:${roleColors[user.role] || '#aaa'};border:1px solid ${roleColors[user.role] || '#666'}44`;
    badge.textContent = roleLabels[user.role] || user.role;
  } else if (badge) { badge.style.display = 'none'; }

  renderActivities(user.activities || []);

  // Apply premium gradient to username displays
  setTimeout(applyUsernameGradient, 50);
}

function renderActivities(acts) {
  const list = document.getElementById('activity-list');
  if (!list) return;
  if (!acts.length) {
    list.innerHTML = `<div class="activity-empty"><i class="fa-solid fa-inbox"></i><span>Henüz işlem yok</span></div>`;
    return;
  }
  list.innerHTML = acts.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-icon"><i class="${a.icon}"></i></div>
      <div class="activity-info"><div class="activity-name">${a.text}</div><div class="activity-time">${a.time}</div></div>
    </div>`).join('');
}

function addActivity(text, icon = 'fa-solid fa-circle-check') {
  if (!State.currentUser) return;
  const acts = State.currentUser.activities || [];
  acts.unshift({ text, icon, time: new Date().toLocaleString('tr-TR') });
  State.currentUser.activities = acts.slice(0, 7);
  _saveCurrentUser();
}

function renderStats() {
  const u = State.currentUser;
  if (!u) return;
  _el('st-messages', el => el.textContent = u.messages || 0);
  _el('st-topics',   el => el.textContent = u.topics   || 0);
  _el('st-replies',  el => el.textContent = u.replies  || 0);
  _el('st-daily',    el => el.textContent = `${u.dailyMin  || 0} dk`);
  _el('st-weekly',   el => el.textContent = `${u.weeklyMin || 0} dk`);
  initMiniChart('stats-chart');
}

async function initMiniChart(id = 'mini-chart') {
  const chart = document.getElementById(id);
  if (!chart) return;

  // Build last 7 days date strings (YYYY-MM-DD)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  let vals = Array(7).fill(0);
  try {
    const r = await fetch('tables/av_login_stats?limit=200');
    if (r.ok) {
      const data = await r.json();
      const rows = data.data || [];
      const map = {};
      rows.forEach(row => { if (row.date) map[row.date] = (map[row.date] || 0) + (row.count || 1); });
      vals = days.map(d => map[d] || 0);
    }
  } catch (_) {}

  const max = Math.max(...vals, 1);
  chart.innerHTML = vals.map(v => `<div class="chart-bar" style="height:${Math.max(6, (v / max) * 100)}%" title="${v} giriş"></div>`).join('');
}

/* ─────────────────────────────────────────────
   PROGRESS / LEVEL SYSTEM
───────────────────────────────────────────── */
const PROGRESS_TIERS = [
  { name:'Yeni Üye',     faIcon:'fa-solid fa-seedling',       topics:0,  replies:0,  color:'#888',   desc:'Kayıt olanlara verilen başlangıç seviyesi.' },
  { name:'Bakır Üye',   faIcon:'fa-solid fa-circle',          topics:1,  replies:3,  color:'#b87333', desc:'1 konu aç + 3 yorum yap.' },
  { name:'Bronz Üye',   faIcon:'fa-solid fa-award',           topics:3,  replies:5,  color:'#cd7f32', desc:'3 konu + 5 yorum.' },
  { name:'Gümüş Üye',  faIcon:'fa-solid fa-medal',           topics:5,  replies:10, color:'#aaa',    desc:'5 konu + 10 yorum.' },
  { name:'Platin Üye',  faIcon:'fa-solid fa-gem',             topics:7,  replies:15, color:'#8ecae6', desc:'7 konu + 15 yorum.' },
  { name:'Altın Üye',   faIcon:'fa-solid fa-trophy',          topics:10, replies:20, color:'#ffd700', desc:'10 konu + 20 yorum.' },
  { name:'Elmas Üye',   faIcon:'fa-solid fa-diamond',         topics:15, replies:30, color:'#b9f2ff', desc:'15 konu + 30 yorum.' },
  { name:'Zümrüt Üye', faIcon:'fa-solid fa-leaf',            topics:20, replies:40, color:'#2ecc71', desc:'20 konu + 40 yorum.' },
  { name:'Obsidyen Üye',faIcon:'fa-solid fa-shield-halved',  topics:25, replies:50, color:'#a78bfa', desc:'25 konu + 50 yorum.' },
];

function _getUserTierIndex(u) {
  const topics  = u.topics  || 0;
  const replies = u.replies || 0;
  let idx = 0;
  for (let i = PROGRESS_TIERS.length - 1; i >= 0; i--) {
    const t = PROGRESS_TIERS[i];
    if (topics >= t.topics && replies >= t.replies) { idx = i; break; }
  }
  return idx;
}

function renderProgressView() {
  const u = State.currentUser;
  if (!u) return;
  const topics  = u.topics  || 0;
  const replies = u.replies || 0;
  const curIdx  = _getUserTierIndex(u);
  const cur     = PROGRESS_TIERS[curIdx];
  const next    = PROGRESS_TIERS[curIdx + 1] || null;

  // Mini stat counters
  const topicsEl  = document.getElementById('prog-topics-count');
  const repliesEl = document.getElementById('prog-replies-count');
  if (topicsEl)  topicsEl.textContent  = topics;
  if (repliesEl) repliesEl.textContent = replies;

  // Current level card
  const badgeEl  = document.getElementById('progress-badge-icon');
  const nameEl   = document.getElementById('progress-level-name');
  const subEl    = document.getElementById('progress-level-sub');
  const fillEl   = document.getElementById('progress-bar-fill');
  const labelEl  = document.getElementById('progress-bar-label');
  if (badgeEl) badgeEl.innerHTML = `<i class="${cur.faIcon}" style="color:${cur.color}"></i>`;
  if (nameEl)  nameEl.textContent  = cur.name;
  if (subEl)   subEl.textContent   = cur.desc;

  if (next) {
    const tProg = next.topics  > cur.topics  ? Math.min(1,(topics  - cur.topics)  / (next.topics  - cur.topics))  : 1;
    const rProg = next.replies > cur.replies ? Math.min(1,(replies - cur.replies) / (next.replies - cur.replies)) : 1;
    const pct   = Math.round(((tProg + rProg) / 2) * 100);
    if (fillEl) fillEl.style.width = pct + '%';
    if (labelEl) labelEl.textContent = `${next.name} için: ${topics}/${next.topics} konu · ${replies}/${next.replies} yorum`;
  } else {
    if (fillEl) fillEl.style.width = '100%';
    if (labelEl) labelEl.textContent = 'Maksimum seviyeye ulaştınız!';
  }

  // Tiers grid
  const grid = document.getElementById('progress-tiers-grid');
  if (!grid) return;
  grid.innerHTML = PROGRESS_TIERS.map((t, i) => {
    const achieved = topics >= t.topics && replies >= t.replies;
    const isCur    = i === curIdx;
    const cls      = isCur ? 'current' : achieved ? 'achieved' : 'locked';
    const check    = achieved ? `<span class="progress-tier-check">✓</span>` : '';
    return `<div class="progress-tier-card ${cls}">
      ${check}
      <div class="progress-tier-icon"><i class="${t.faIcon}" style="color:${achieved?t.color:'var(--text-muted)'}"></i></div>
      <div>
        <div class="progress-tier-name" style="color:${achieved?t.color:''}">${t.name}</div>
        <div class="progress-tier-req">${t.topics > 0 ? `${t.topics} konu` : 'Başlangıç'} ${t.replies > 0 ? `+ ${t.replies} yorum` : ''}</div>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   ACCOUNT SETTINGS
───────────────────────────────────────────── */
function previewAvatar(input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.type)) return showToast('Sadece JPG/JPEG/PNG dosyaları kabul edilir', 'error');
  if (file.size > 250 * 1024) return showToast('Dosya 250KB\'dan küçük olmalı', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    _el('acc-avatar-preview', el => el.innerHTML = `<img src="${src}" />`);
    _el('account-avatar', el => el.innerHTML = `<img src="${src}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`);
    if (State.currentUser) { State.currentUser.avatar = src; _saveCurrentUser(); }
    showToast('Profil fotoğrafı güncellendi', 'success');
    addActivity('Profil fotoğrafı güncellendi', 'fa-solid fa-image');
  };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────────
   USERNAME CHANGE (7 gün cooldown — Yönetici/Kurucu serbest)
───────────────────────────────────────────── */
function changeUsername() {
  const u = State.currentUser;
  if (!u) return;
  const newName = document.getElementById('acc-username-edit')?.value.trim();
  if (!newName) return showToast('Kullanıcı adı boş olamaz', 'error');
  if (newName.length < 3) return showToast('En az 3 karakter olmalı', 'error');
  if (newName.length > 24) return showToast('En fazla 24 karakter olabilir', 'error');
  if (!/^[a-zA-Z0-9_]+$/.test(newName)) return showToast('Sadece harf, rakam ve alt çizgi kullanabilirsiniz', 'error');

  // Yönetici ve Kurucu için cooldown yok
  const isPrivileged = ['admin', 'super_admin'].includes(u.role);
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün
  const lastChanged = u.username_changed_at ? parseInt(u.username_changed_at) : 0;
  const elapsed = Date.now() - lastChanged;
  if (!isPrivileged && lastChanged && elapsed < COOLDOWN_MS) {
    const remaining = COOLDOWN_MS - elapsed;
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    const hrs  = Math.ceil(remaining / (60 * 60 * 1000));
    const label = days > 1 ? `${days} gün` : `${hrs} saat`;
    return showToast(`Kullanıcı adını ${label} sonra değiştirebilirsiniz`, 'error');
  }

  u.username = newName;
  u.username_changed_at = Date.now().toString();
  _saveCurrentUser();
  _el('acc-username-show', el => el.value = newName);
  _renderUsernameSection();
  addActivity('Kullanıcı adı değiştirildi', 'fa-solid fa-at');
  showToast('Kullanıcı adı güncellendi', 'success');
}

function _renderUsernameSection() {
  const u = State.currentUser;
  if (!u) return;
  const isPrivileged = ['admin', 'super_admin'].includes(u.role);
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün
  const lastChanged = u.username_changed_at ? parseInt(u.username_changed_at) : 0;
  const elapsed = Date.now() - lastChanged;
  const onCooldown = !isPrivileged && lastChanged && elapsed < COOLDOWN_MS;
  const remaining = onCooldown ? COOLDOWN_MS - elapsed : 0;
  const days = onCooldown ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
  const hrs  = onCooldown ? Math.ceil(remaining / (60 * 60 * 1000)) : 0;
  const label = days > 1 ? `${days} gün` : `${hrs} saat`;

  const section = document.getElementById('username-change-section');
  if (!section) return;
  if (onCooldown) {
    section.innerHTML = `
      <div class="settings-section-header"><i class="fa-solid fa-at"></i> Kullanıcı Adı</div>
      <div class="settings-body">
        <div class="input-wrapper"><i class="fa-solid fa-at input-icon"></i><input type="text" class="form-input" id="acc-username-show" value="${escapeHtml(u.username)}" readonly /></div>
        <p style="font-size:.78rem;color:var(--warning,#f59e0b);margin-top:8px"><i class="fa-solid fa-clock"></i> Sonraki değişiklik için <strong>${label}</strong> beklemeniz gerekiyor</p>
      </div>`;
  } else {
    const cooldownNote = isPrivileged
      ? '<p style="font-size:.78rem;color:var(--accent,#d4aa20);margin-top:8px"><i class="fa-solid fa-crown"></i> Yönetici/Kurucu — sınırsız değiştirebilirsiniz</p>'
      : '<p style="font-size:.78rem;color:var(--text-muted);margin-top:8px"><i class="fa-solid fa-info-circle"></i> 7 günde bir değiştirilebilir · Sadece harf, rakam ve alt çizgi</p>';
    section.innerHTML = `
      <div class="settings-section-header"><i class="fa-solid fa-at"></i> Kullanıcı Adı</div>
      <div class="settings-body">
        <div style="display:flex;gap:8px;align-items:center">
          <div class="input-wrapper" style="flex:1"><i class="fa-solid fa-at input-icon"></i><input type="text" class="form-input" id="acc-username-edit" value="${escapeHtml(u.username)}" maxlength="24" placeholder="Yeni kullanıcı adı" /></div>
          <button class="btn btn-primary" onclick="changeUsername()" style="white-space:nowrap"><i class="fa-solid fa-check"></i> Değiştir</button>
        </div>
        ${cooldownNote}
      </div>`;
  }
}

function changePassword() {
  const oldP  = _val('old-pass');
  const newP  = _val('new-pass');
  const newP2 = _val('new-pass2');
  if (!oldP)                          return showToast('Mevcut şifrenizi girin', 'error');
  if (State.currentUser?.password !== oldP) return showToast('Mevcut şifre hatalı', 'error');
  if (!newP || newP.length < 8)       return showToast('Yeni şifre en az 8 karakter olmalı', 'error');
  if (newP !== newP2)                 return showToast('Yeni şifreler eşleşmiyor', 'error');
  State.currentUser.password = newP;
  _saveCurrentUser();
  ['old-pass','new-pass','new-pass2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  showToast('Şifre güncellendi', 'success');
  addActivity('Şifre değiştirildi', 'fa-solid fa-key');
}

/* ─────────────────────────────────────────────
   AD SOYAD & DOĞUM TARİHİ KAYDETME
───────────────────────────────────────────── */
async function saveFullname() {
  const u = State.currentUser;
  if (!u) return showToast('Giriş yapmanız gerekiyor', 'error');
  const val = (_val('acc-fullname-input') || '').trim();
  if (!val) return showToast('Ad soyad boş olamaz', 'error');
  if (val.length < 2) return showToast('Ad soyad en az 2 karakter olmalı', 'error');
  try {
    await fetch(`tables/av_users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname: val }),
    });
    u.fullname = val;
    _saveCurrentUser();
    showToast('Ad soyad güncellendi ✅', 'success');
    addActivity('Ad soyad güncellendi', 'fa-solid fa-id-card');
  } catch (_) { showToast('Güncelleme başarısız', 'error'); }
}

async function saveBirthDate() {
  const u = State.currentUser;
  if (!u) return showToast('Giriş yapmanız gerekiyor', 'error');
  const val = _val('acc-birthdate-input') || '';
  if (!val) return showToast('Doğum tarihi seçin', 'error');
  try {
    await fetch(`tables/av_users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth_date: val }),
    });
    u.birth_date = val;
    _saveCurrentUser();
    showToast('Doğum tarihi güncellendi ✅', 'success');
    addActivity('Doğum tarihi güncellendi', 'fa-solid fa-cake-candles');
  } catch (_) { showToast('Güncelleme başarısız', 'error'); }
}

/* ─────────────────────────────────────────────
   PREMIUM PROFİL — Gradient Renk Seçici
───────────────────────────────────────────── */
const PREMIUM_GRADIENTS = [
  { id:'red-blue',         label:'🔴 Kırmızı + 🔵 Mavi',           from:'#EF4444', to:'#3B82F6' },
  { id:'purple-yellow',    label:'🟣 Mor + 🟡 Sarı',                from:'#8B5CF6', to:'#FACC15' },
  { id:'orange-emerald',   label:'🟠 Turuncu + 🟢 Zümrüt',         from:'#F97316', to:'#10B981' },
  { id:'pink-lime',        label:'🩷 Pembe + 🟢 Limon',             from:'#EC4899', to:'#84CC16' },
  { id:'teal-purple',      label:'🔵 Turkuaz + 🟣 Mürdüm',         from:'#14B8A6', to:'#86198F' },
  { id:'amber-navy',       label:'🟠 Kehribar + 🔵 Lacivert',      from:'#F59E0B', to:'#1E3A8A' },
  { id:'green-magenta',    label:'🟢 Yeşil + 🩷 Magenta',          from:'#22C55E', to:'#DB2777' },
  { id:'cherry-mint',      label:'🔴 Vişne + 🟢 Nane',             from:'#9F1239', to:'#34D399' },
  { id:'mustard-violet',   label:'🟡 Hardal + 🟣 Menekşe',         from:'#CA8A04', to:'#7C3AED' },
  { id:'cyan-coral',       label:'🔵 Camgöbeği + 🟠 Mercan',       from:'#06B6D4', to:'#F43F5E' },
  { id:'fuchsia-forest',   label:'🟣 Fuşya + 🟢 Orman Yeşili',     from:'#D946EF', to:'#166534' },
  { id:'rose-gold',        label:'🔴 Nar Çiçeği + 🟡 Altın',      from:'#E11D48', to:'#EAB308' },
  { id:'copper-sky',       label:'🟠 Bakır + 🩵 Gökyüzü',          from:'#C2410C', to:'#0EA5E9' },
  { id:'lime-grape',       label:'🟢 Lime + 🟣 Mürdüm',            from:'#84CC16', to:'#86198F' },
];

function openPremiumProfileModal() {
  const u = State.currentUser;
  if (!u) return showPage('login');
  if (!u.premium) {
    showToast('Bu özellik sadece Premium üyelere özeldir! 👑', 'warning');
    return;
  }

  document.getElementById('premium-profile-modal')?.remove();
  const current = u.premiumGradient || null;

  const modal = document.createElement('div');
  modal.id = 'premium-profile-modal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = 'z-index:9998';

  const cards = PREMIUM_GRADIENTS.map(g => {
    const isSel = current === g.id;
    return `<div class="ppg-card${isSel ? ' selected' : ''}" onclick="selectPremiumGradient('${g.id}')" data-gid="${g.id}"
        style="background:linear-gradient(135deg,${g.from},${g.to})">
      <span class="ppg-label">${g.label}</span>
      ${isSel ? '<i class="fa-solid fa-check ppg-check"></i>' : ''}
    </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3 style="display:flex;align-items:center;gap:10px">
          <i class="fa-solid fa-palette" style="color:#f5c518"></i> Premium Profil Gradyanı
        </h3>
        <button onclick="document.getElementById('premium-profile-modal').remove()"><i class="fa-solid fa-times"></i></button>
      </div>
      <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:18px">Profil adın için animasyonlu gradyan rengi seç. Kullanıcı adın forum ve panelde renkli görünür.</p>
      <div class="ppg-grid">${cards}</div>
      <div class="modal-footer" style="margin-top:20px">
        <button class="btn btn-ghost" onclick="document.getElementById('premium-profile-modal').remove()">Vazgeç</button>
        <button class="btn btn-danger btn-sm" onclick="clearPremiumGradient()"><i class="fa-solid fa-xmark"></i> Kaldır</button>
        <button class="btn btn-primary" onclick="savePremiumGradient()"><i class="fa-solid fa-check"></i> Uygula</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  window._selectedPremiumGradient = current;
}

function selectPremiumGradient(gid) {
  window._selectedPremiumGradient = gid;
  document.querySelectorAll('.ppg-card').forEach(c => {
    const sel = c.dataset.gid === gid;
    c.classList.toggle('selected', sel);
    // update check icon
    const existing = c.querySelector('.ppg-check');
    if (sel && !existing) c.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-check ppg-check"></i>');
    if (!sel && existing)  existing.remove();
  });
}

function savePremiumGradient() {
  const gid = window._selectedPremiumGradient;
  if (!gid || !State.currentUser) return;
  State.currentUser.premiumGradient = gid;
  _saveCurrentUser();
  document.getElementById('premium-profile-modal')?.remove();
  showToast('Profil gradyanı güncellendi ✨', 'success');
  addActivity('Premium profil gradyanı değiştirildi', 'fa-solid fa-palette');
  applyUsernameGradient();
}

function clearPremiumGradient() {
  if (!State.currentUser) return;
  State.currentUser.premiumGradient = null;
  _saveCurrentUser();
  window._selectedPremiumGradient = null;
  document.getElementById('premium-profile-modal')?.remove();
  showToast('Profil gradyanı kaldırıldı', 'success');
  applyUsernameGradient();
}

/* Apply/remove animated gradient to all username elements */
function applyUsernameGradient() {
  const u = State.currentUser;
  if (!u) return;
  const gid = u.premiumGradient;
  const grad = gid ? PREMIUM_GRADIENTS.find(g => g.id === gid) : null;

  // All elements showing the username
  const usernameEls = [
    document.getElementById('dash-username-title'),
    document.getElementById('nav-username'),
    document.getElementById('ds-username'),
  ].filter(Boolean);

  usernameEls.forEach(el => {
    if (grad) {
      el.classList.add('username-gradient-text');
      el.style.backgroundImage = `linear-gradient(135deg,${grad.from},${grad.to},${grad.from})`;
      el.style.backgroundSize = '200% 200%';
      el.style.webkitBackgroundClip = 'text';
      el.style.webkitTextFillColor = 'transparent';
      el.style.backgroundClip = 'text';
    } else {
      el.classList.remove('username-gradient-text');
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.webkitBackgroundClip = '';
      el.style.webkitTextFillColor = '';
      el.style.backgroundClip = '';
    }
  });

  // Update preview in settings
  const preview = document.getElementById('premium-username-preview');
  if (preview) {
    if (grad) {
      preview.textContent = u.username;
      preview.classList.add('username-gradient-text');
      preview.style.backgroundImage = `linear-gradient(135deg,${grad.from},${grad.to},${grad.from})`;
      preview.style.backgroundSize = '200% 200%';
      preview.style.webkitBackgroundClip = 'text';
      preview.style.webkitTextFillColor = 'transparent';
      preview.style.backgroundClip = 'text';
    } else {
      preview.textContent = u.username;
      preview.classList.remove('username-gradient-text');
      preview.style.backgroundImage = '';
      preview.style.backgroundSize = '';
      preview.style.webkitBackgroundClip = '';
      preview.style.webkitTextFillColor = '';
      preview.style.backgroundClip = '';
    }
  }
}

/* ─────────────────────────────────────────────
   SETTINGS GRADIENT PICKER (inline, account view)
───────────────────────────────────────────── */
function renderSettingsGradientPicker() {
  const grid = document.getElementById('settings-ppg-grid');
  const actions = document.getElementById('settings-ppg-actions');
  const u = State.currentUser;
  if (!grid) return;

  if (!u) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.83rem">Giriş yapman gerekiyor.</p>';
    return;
  }

  // Update preview username
  const preview = document.getElementById('premium-username-preview');
  if (preview && !u.premiumGradient) preview.textContent = u.username || 'KullaniciAdi';

  if (!u.premium) {
    grid.innerHTML = `<div class="gradient-locked-banner">
      <div class="gradient-locked-icon"><i class="fa-solid fa-crown"></i></div>
      <div class="gradient-locked-text">
        <h4>Premium Üyelik Gerekli</h4>
        <p>Animasyonlu gradyan renkler yalnızca Premium üyelere açıktır. Standart üyeler için kullanıcı adı beyaz görünür.</p>
      </div>

    </div>`;
    if (actions) actions.style.display = 'none';
    return;
  }

  const current = u.premiumGradient || null;
  window._settingsSelectedGradient = current;

  grid.innerHTML = PREMIUM_GRADIENTS.map(g => {
    const isSel = current === g.id;
    return `<div class="settings-ppg-card${isSel ? ' selected' : ''}" data-gid="${g.id}"
        onclick="selectSettingsGradient('${g.id}')">
      <div class="settings-ppg-swatch" style="background:linear-gradient(135deg,${g.from},${g.to})"></div>
      <div class="settings-ppg-label" style="background:linear-gradient(135deg,${g.from},${g.to});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${g.label}</div>
    </div>`;
  }).join('');

  if (current) selectSettingsGradient(current);
  if (actions) actions.style.display = 'flex';
}

function selectSettingsGradient(gid) {
  window._settingsSelectedGradient = gid;
  document.querySelectorAll('.settings-ppg-card').forEach(c => {
    const sel = c.dataset.gid === gid;
    c.classList.toggle('selected', sel);
    const existing = c.querySelector('.settings-ppg-check');
    if (sel && !existing) c.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-check settings-ppg-check"></i>');
    if (!sel && existing) existing.remove();
  });
  // Live preview
  const grad = PREMIUM_GRADIENTS.find(g => g.id === gid);
  const preview = document.getElementById('premium-username-preview');
  if (preview && grad && State.currentUser) {
    preview.textContent = State.currentUser.username;
    preview.classList.add('username-gradient-text');
    preview.style.backgroundImage = `linear-gradient(135deg,${grad.from},${grad.to},${grad.from})`;
    preview.style.backgroundSize = '200% 200%';
    preview.style.webkitBackgroundClip = 'text';
    preview.style.webkitTextFillColor = 'transparent';
    preview.style.backgroundClip = 'text';
  }
}

function saveSettingsGradient() {
  const gid = window._settingsSelectedGradient;
  if (!gid || !State.currentUser) return showToast('Bir renk seçin', 'warning');
  State.currentUser.premiumGradient = gid;
  _saveCurrentUser();
  showToast('Kullanıcı adı rengi güncellendi', 'success');
  addActivity('Kullanıcı adı rengi değiştirildi', 'fa-solid fa-palette');
  applyUsernameGradient();
}

function clearSettingsGradient() {
  if (!State.currentUser) return;
  State.currentUser.premiumGradient = null;
  window._settingsSelectedGradient = null;
  _saveCurrentUser();
  // Deselect all cards
  document.querySelectorAll('.settings-ppg-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.settings-ppg-check')?.remove();
  });
  showToast('Kullanıcı adı rengi kaldırıldı', 'info');
  applyUsernameGradient();
}

/* ─────────────────────────────────────────────
   MESSAGING SYSTEM (Friends + Groups)
   - Friend DMs: 48s auto-delete
   - Group msgs: 24s auto-delete
───────────────────────────────────────────── */
const DM_TTL    = 48 * 60 * 60 * 1000; // 48 hours
const GROUP_TTL = 24 * 60 * 60 * 1000; // 24 hours

function _getGroups() {
  try { return JSON.parse(localStorage.getItem('av-groups') || '[]'); } catch { return []; }
}
function _saveGroups(groups) { localStorage.setItem('av-groups', JSON.stringify(groups)); }

// Current tab: 'friends' | 'groups'
let _msgTab = 'friends';

/* Groups removed — only friends tab */
function switchMsgTab(tab) {
  _msgTab = 'friends';
  document.getElementById('msg-tab-friends')?.classList.add('active');
  const fp = document.getElementById('msg-friends-panel');
  if (fp) fp.style.display = 'flex';
  const fa2 = document.getElementById('msg-friend-actions');
  if (fa2) fa2.style.display = 'block';
  renderFriendsList();
}

function _getFriends() {
  if (!State.currentUser) return [];
  return (State.friends[State.currentUser.id] || []);
}
function _saveFriends() { localStorage.setItem('av-friends', JSON.stringify(State.friends)); }

function _getFriendReqs() {
  if (!State.currentUser) return [];
  return (State.friendReqs[State.currentUser.id] || []);
}
function _saveFriendReqs() { localStorage.setItem('av-freq', JSON.stringify(State.friendReqs)); }

async function sendFriendRequest() {
  const input = document.getElementById('add-friend-input');
  const name  = input?.value.trim();
  if (!name) return showToast('Kullanıcı adı girin', 'error');
  if (!State.currentUser) return showPage('login');
  if (name === State.currentUser.username) return showToast('Kendinize istek gönderemezsiniz', 'error');

  const r = await fetch('tables/av_users?limit=500');
  const d = r.ok ? await r.json() : { data: [] };
  const target = (d.data || []).find(u => u.username === name);
  if (!target) return showToast('Kullanıcı bulunamadı', 'error');

  // Check already friends
  if (_getFriends().find(f => f.id === target.id)) return showToast('Zaten arkadaşsınız', 'error');

  // Add to target's requests
  if (!State.friendReqs[target.id]) State.friendReqs[target.id] = [];
  const existing = State.friendReqs[target.id].find(r => r.from === State.currentUser.id);
  if (existing) return showToast('İstek zaten gönderildi', 'error');

  State.friendReqs[target.id].push({ from: State.currentUser.id, fromName: State.currentUser.username });
  _saveFriendReqs();
  if (input) input.value = '';
  showToast(`${name} kullanıcısına arkadaşlık isteği gönderildi`, 'success');
  addActivity(`Arkadaşlık isteği gönderildi: ${name}`, 'fa-solid fa-user-plus');
  renderFriendsList();
}

function acceptRequest(fromId, fromName) {
  const uid = State.currentUser.id;
  // Add each to other's friends
  if (!State.friends[uid]) State.friends[uid] = [];
  if (!State.friends[fromId]) State.friends[fromId] = [];

  if (!State.friends[uid].find(f => f.id === fromId)) {
    State.friends[uid].push({ id: fromId, name: fromName, messages: [] });
  }
  if (!State.friends[fromId].find(f => f.id === uid)) {
    State.friends[fromId].push({ id: uid, name: State.currentUser.username, messages: [] });
  }
  _saveFriends();

  // Remove request
  State.friendReqs[uid] = (State.friendReqs[uid] || []).filter(r => r.from !== fromId);
  _saveFriendReqs();
  showToast(`${fromName} ile arkadaş oldunuz! 🎉`, 'success');
  addActivity(`Arkadaşlık kabul edildi: ${fromName}`, 'fa-solid fa-user-check');
  renderFriendsList();
}

function rejectRequest(fromId) {
  const uid = State.currentUser.id;
  State.friendReqs[uid] = (State.friendReqs[uid] || []).filter(r => r.from !== fromId);
  _saveFriendReqs();
  renderFriendsList();
}

function renderFriendsList() {
  const list    = document.getElementById('friends-list');
  const reqPanel= document.getElementById('friend-requests-panel');
  const reqList = document.getElementById('friend-requests-list');
  if (!list || !State.currentUser) return;

  const friends = _getFriends();
  const reqs    = _getFriendReqs();

  // Friends
  if (!friends.length) {
    list.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);font-size:.82rem"><i class="fa-solid fa-user-group" style="font-size:1.5rem;margin-bottom:8px;display:block;opacity:.3"></i>Henüz arkadaşın yok.</div>`;
  } else {
    list.innerHTML = friends.map(f => {
      const lastMsg = f.messages?.filter(m => m.text)?.slice(-1)[0];
      const last = lastMsg ? escapeHtml(lastMsg.text.slice(0, 28)) + (lastMsg.text.length > 28 ? '…' : '') : '📷 Fotoğraf yok / Mesaj yok';
      const isActive = State.activeFriend?.id === f.id && !State.activeFriend?.isGroup;
      return `<div class="msg-friend-item${isActive ? ' active' : ''}" data-friend-id="${f.id}" onclick="openChat('${f.id}','${escapeHtml(f.name)}')">
        <div class="msg-friend-avatar">${(f.name||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0"><div class="msg-friend-name">${escapeHtml(f.name)}</div><div class="msg-friend-last">${last}</div></div>
      </div>`;
    }).join('');
  }

  // Requests
  if (reqs.length) {
    reqPanel.style.display = 'block';
    reqList.innerHTML = reqs.map(r => `
      <div class="msg-req-item">
        <div class="msg-friend-avatar" style="width:30px;height:30px;font-size:.7rem">${r.fromName[0].toUpperCase()}</div>
        <span style="font-size:.82rem;flex:1">${r.fromName}</span>
        <div class="msg-req-btns">
          <button class="msg-req-accept" onclick="acceptRequest('${r.from}','${r.fromName}')">Kabul</button>
          <button class="msg-req-reject" onclick="rejectRequest('${r.from}')">Reddet</button>
        </div>
      </div>`).join('');
  } else {
    reqPanel.style.display = 'none';
  }

  // Badge count
  const badge = document.getElementById('msg-badge');
  if (badge) { badge.style.display = reqs.length ? 'inline' : 'none'; badge.textContent = reqs.length; }
}

const EMOJI_LIST = ['😀','😂','😍','🔥','👍','🎮','💪','😎','🤝','🏆','❤️','😭','🙏','💬','⚡','🎯','🏅','💥','🎉','👀'];

function _chatFooterHTML(sendFn, placeholder = 'Mesaj yaz...') {
  const emojis = EMOJI_LIST.map(e => `<span class="emoji-btn" onclick="insertEmoji('${e}')">${e}</span>`).join('');
  return `
    <div class="msg-chat-footer">
      <div class="emoji-picker" id="emoji-picker">${emojis}</div>
      <div class="msg-input-wrap">
        <textarea class="msg-input" id="msg-input" placeholder="${placeholder}" rows="1" onkeydown="msgKeydown(event)" oninput="this.style.height='';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
        <button class="msg-emoji-btn" onclick="toggleEmojiPicker()" type="button" title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
      </div>
      <label class="msg-image-btn" for="msg-image-input" title="Fotoğraf"><i class="fa-solid fa-image"></i></label>
      <input type="file" id="msg-image-input" accept="image/jpeg,image/png,image/gif" style="display:none" onchange="sendImage(this)" />
      <button class="msg-send-btn" onclick="${sendFn}" type="button"><i class="fa-solid fa-paper-plane"></i></button>
    </div>`;
}

function openChat(friendId, friendName) {
  State.activeFriend = { id: friendId, name: friendName };
  const chatArea = document.getElementById('msg-chat-area');
  if (!chatArea) return;

  const myFriends = _getFriends();
  const friend    = myFriends.find(f => f.id === friendId);
  if (!friend) return;

  // Prune messages older than 48 hours
  friend.messages = (friend.messages || []).filter(m => Date.now() - m.ts < DM_TTL);
  _saveFriends();

  chatArea.innerHTML = `
    <div class="msg-chat-header">
      ${_avatarEl(null, friendName[0], 38)}
      <div style="flex:1"><div class="msg-chat-name">${escapeHtml(friendName)}</div><div class="msg-chat-status">Özel Sohbet · 48s sonra otomatik sil</div></div>
    </div>
    <div class="msg-chat-body" id="chat-body">${_renderMessages(friend.messages, friendId)}</div>
    ${_chatFooterHTML('sendMessage()', 'Mesaj yaz...')}`;

  _scrollChat();
  document.querySelectorAll('.msg-friend-item').forEach(el => el.classList.remove('active'));
  chatArea.closest('.msg-layout')?.querySelectorAll('.msg-friend-item').forEach(el => {
    if (el.dataset.friendId === friendId) el.classList.add('active');
  });
}

function _avatarEl(user, initial, size = 30) {
  const s = `width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.4)}px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent2))`;
  if (user?.avatar) return `<div style="${s}"><img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover" /></div>`;
  return `<div style="${s}">${(initial || '?').toUpperCase()}</div>`;
}

function _renderMessages(messages, friendId) {
  if (!messages?.length) return `<div class="msg-empty"><i class="fa-regular fa-comment-dots"></i><p>Henüz mesaj yok.<br>İlk mesajı sen at!</p></div>`;
  return messages.map(m => {
    const isOwn = m.sender === State.currentUser?.id;
    const initial = isOwn ? (State.currentUser.username?.[0] || '?') : (m.senderName?.[0] || '?');
    const av = `<div class="msg-bubble-avatar">${initial.toUpperCase()}</div>`;
    const content = m.img
      ? `<img src="${m.img}" alt="Görsel" onerror="this.style.display='none'" />`
      : escapeHtml(m.text || '');
    const time = new Date(m.ts).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    return `<div class="msg-bubble-wrap ${isOwn ? 'own' : 'other'}">
      ${av}
      <div class="msg-bubble-col">
        <div class="msg-bubble ${isOwn ? 'own' : 'other'}">${content}</div>
        <div class="msg-time">${time}</div>
      </div>
    </div>`;
  }).join('');
}

function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input?.value.trim();
  if (!text) return showToast('Mesaj boş olamaz', 'error');
  if (!State.activeFriend) return showToast('Önce bir arkadaş seç', 'error');
  if (!State.currentUser)  return showPage('login');
  _pushMessage({ text, img: null });
  input.value = '';
  input.style.height = '';
}

function sendImage(fileInput) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const allowed = ['image/jpeg','image/jpg','image/png','image/gif'];
  if (!allowed.includes(file.type)) return showToast('Sadece JPG/PNG/GIF kabul edilir', 'error');
  if (file.size > 5 * 1024 * 1024) return showToast('Görsel 5MB\'dan küçük olmalı', 'error');
  const reader = new FileReader();
  reader.onload = e => { _pushMessage({ text: null, img: e.target.result }); };
  reader.readAsDataURL(file);
  fileInput.value = '';
}

function _pushMessage({ text, img }) {
  if (!State.activeFriend || !State.currentUser) return;
  const friendId = State.activeFriend.id;
  const msg = { sender: State.currentUser.id, senderName: State.currentUser.username, text: text || null, img: img || null, ts: Date.now() };

  // Ensure my friend list exists
  if (!State.friends[State.currentUser.id]) State.friends[State.currentUser.id] = [];
  const myFriends = State.friends[State.currentUser.id];
  const fIdx = myFriends.findIndex(f => f.id === friendId);
  if (fIdx < 0) return showToast('Arkadaş bulunamadı', 'error');
  if (!myFriends[fIdx].messages) myFriends[fIdx].messages = [];
  myFriends[fIdx].messages.push(msg);

  // Mirror to friend's side
  if (!State.friends[friendId]) State.friends[friendId] = [];
  const theirFriends = State.friends[friendId];
  const tIdx = theirFriends.findIndex(f => f.id === State.currentUser.id);
  if (tIdx >= 0) {
    if (!theirFriends[tIdx].messages) theirFriends[tIdx].messages = [];
    theirFriends[tIdx].messages.push(msg);
  }

  _saveFriends();

  // Stats + activity
  State.currentUser.messages = (State.currentUser.messages || 0) + 1;
  _saveCurrentUser();

  // Re-render
  const body = document.getElementById('chat-body');
  if (body) { body.innerHTML = _renderMessages(myFriends[fIdx].messages, friendId); _scrollChat(); }
  renderFriendsList();
}

function msgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (State.activeFriend?.isGroup) sendGroupMessage(State.activeFriend.id);
    else sendMessage();
  }
}

function toggleEmojiPicker() {
  document.getElementById('emoji-picker')?.classList.toggle('open');
}

function insertEmoji(emoji) {
  const input = document.getElementById('msg-input');
  if (input) {
    const start = input.selectionStart;
    const end   = input.selectionEnd;
    const val   = input.value;
    input.value = val.slice(0, start) + emoji + val.slice(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus();
    // Trigger height resize
    input.style.height = '';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  document.getElementById('emoji-picker')?.classList.remove('open');
}

function _scrollChat() {
  setTimeout(() => {
    const body = document.getElementById('chat-body');
    if (body) body.scrollTop = body.scrollHeight;
  }, 50);
}

/* ─────────────────────────────────────────────
   GROUP CHAT SYSTEM
───────────────────────────────────────────── */
function openCreateGroupModal() {
  if (!State.currentUser) return showPage('login');
  const friends = _getFriends();
  const picker  = document.getElementById('cg-friends-picker');
  const hint    = document.getElementById('cg-picker-hint');

  _el('cg-name', el => el.value = '');
  _el('cg-desc', el => el.value = '');
  _el('cg-max',  el => el.value = '10');
  _el('cg-notif',el => el.checked = true);

  if (picker) {
    if (!friends.length) {
      picker.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted)">Önce arkadaş ekleyin</span>`;
    } else {
      picker.innerHTML = friends.map(f => `
        <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;font-size:.82rem;border:1px solid var(--border)">
          <input type="checkbox" name="cg-member" value="${f.id}" data-name="${f.name}" />
          <span class="msg-friend-avatar" style="width:24px;height:24px;font-size:.65rem;flex-shrink:0">${f.name[0].toUpperCase()}</span>
          ${f.name}
        </label>`).join('');
    }
  }
  openModal('create-group-modal');
}

function createGroup() {
  const name    = _val('cg-name');
  const desc    = _val('cg-desc');
  const maxStr  = document.getElementById('cg-max')?.value || '10';
  const maxSize = Math.min(10, parseInt(maxStr) || 10);
  const notif   = document.getElementById('cg-notif')?.checked !== false;

  if (!name) return showToast('Grup adı gerekli', 'error');
  if (!State.currentUser) return;

  // Max 2 group limit per user
  const existingGroups = _getGroups().filter(g => g.createdBy === State.currentUser.id);
  if (existingGroups.length >= 2) return showToast('En fazla 2 grup oluşturabilirsiniz', 'error');

  // Selected friends
  const selected = [...document.querySelectorAll('input[name="cg-member"]:checked')]
    .map(el => ({ id: el.value, name: el.getAttribute('data-name') }));

  if (selected.length >= maxSize) return showToast(`Bu grup en fazla ${maxSize} kişi (sen dahil). Daha az üye seç.`, 'error');

  const group = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    name, desc, maxSize, notif,
    createdBy: State.currentUser.id,
    createdByName: State.currentUser.username,
    members: [
      { id: State.currentUser.id, name: State.currentUser.username, role: 'owner' },
      ...selected.map(m => ({ ...m, role: 'member' })),
    ],
    messages: [],
    createdAt: Date.now(),
  };

  const groups = _getGroups();
  groups.push(group);
  _saveGroups(groups);

  closeModal('create-group-modal');
  showToast(`"${name}" grubu oluşturuldu 🎉`, 'success');
  renderGroupsList();
  switchMsgTab('groups');
}

function renderGroupsList() {
  const list = document.getElementById('groups-list');
  if (!list || !State.currentUser) return;
  const uid = State.currentUser.id;
  const groups = _getGroups().filter(g => g.members.some(m => m.id === uid));
  if (!groups.length) {
    list.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);font-size:.82rem"><i class="fa-solid fa-people-group" style="font-size:1.5rem;margin-bottom:8px;display:block;opacity:.3"></i>Henüz grubun yok.</div>`;
    return;
  }
  list.innerHTML = groups.map(g => {
    const last = g.messages?.length ? g.messages[g.messages.length-1].text?.slice(0,24)+'...' : 'Mesaj yok';
    return `<div class="msg-friend-item" onclick="openGroupChat('${g.id}')">
      <div class="msg-friend-avatar" style="background:linear-gradient(135deg,var(--accent),var(--info))"><i class="fa-solid fa-people-group" style="font-size:.7rem"></i></div>
      <div style="flex:1;min-width:0"><div class="msg-friend-name">${escapeHtml(g.name)} <span style="font-size:.68rem;color:var(--text-muted)">(${g.members.length}/${g.maxSize})</span></div><div class="msg-friend-last">${last}</div></div>
    </div>`;
  }).join('');
}

function openGroupChat(groupId) {
  const groups = _getGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx < 0) return;
  const group = groups[idx];

  // Prune group messages older than 24 hours
  group.messages = (group.messages || []).filter(m => Date.now() - m.ts < GROUP_TTL);
  _saveGroups(groups);

  State.activeFriend = { id: groupId, name: group.name, isGroup: true };
  const chatArea = document.getElementById('msg-chat-area');
  if (!chatArea) return;

  const isMember  = group.members.some(m => m.id === State.currentUser?.id);
  const myRole    = group.members.find(m => m.id === State.currentUser?.id)?.role;
  const isOwner   = myRole === 'owner';
  const isManager = myRole === 'manager' || isOwner;
  const membersStr = group.members.map(m => `${m.name}${m.role==='owner'?' <i class="fa-solid fa-crown" style="color:#fbbf24;font-size:.65rem"></i>':m.role==='manager'?' <i class="fa-solid fa-shield-halved" style="color:#38bdf8;font-size:.65rem"></i>':''}`).join(', ');

  chatArea.innerHTML = `
    <div class="msg-chat-header" style="flex-direction:column;align-items:stretch;gap:0;padding-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="msg-friend-avatar" style="width:38px;height:38px;font-size:.9rem;border-radius:10px;background:rgba(255,255,255,.08);flex-shrink:0;border:1px solid var(--border)"><i class="fa-solid fa-people-group"></i></div>
        <div style="flex:1;min-width:0">
          <div class="msg-chat-name">${escapeHtml(group.name)}</div>
          <div class="msg-chat-status">${group.members.length}/${group.maxSize} üye</div>
        </div>
        ${isOwner ? `<button type="button" onclick="openGroupSettings('${groupId}')" style="padding:6px 12px;font-size:.78rem;background:#f5c518;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .2s" onmouseover="this.style.boxShadow='0 4px 16px rgba(245,197,24,.5)'" onmouseout="this.style.boxShadow='none'"><i class="fa-solid fa-sliders"></i> Ayarlar</button>` : ''}
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding-left:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">👥 ${membersStr}</div>
    </div>
    <div class="msg-chat-body" id="chat-body">${_renderGroupMessages(group.messages)}</div>
    ${isMember
      ? _chatFooterHTML(`sendGroupMessage('${groupId}')`, 'Gruba mesaj yaz...')
      : `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-lock"></i> Bu grubun üyesi değilsiniz</div>`
    }`;

  _scrollChat();
}

function _renderGroupMessages(messages) {
  if (!messages?.length) return `<div class="msg-empty"><i class="fa-regular fa-comment-dots"></i><p>Henüz mesaj yok.<br>İlk mesajı sen at!</p></div>`;
  return messages.map(m => {
    const isOwn = m.sender === State.currentUser?.id;
    const initial = (m.senderName || '?')[0].toUpperCase();
    const content = m.img
      ? `<img src="${m.img}" alt="Görsel" onerror="this.style.display='none'" />`
      : escapeHtml(m.text || '');
    const time = new Date(m.ts).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    const senderLabel = !isOwn ? `<div class="msg-sender-name">${escapeHtml(m.senderName || '')}</div>` : '';
    return `<div class="msg-bubble-wrap ${isOwn ? 'own' : 'other'}">
      <div class="msg-bubble-avatar">${initial}</div>
      <div class="msg-bubble-col">
        ${senderLabel}
        <div class="msg-bubble ${isOwn ? 'own' : 'other'}">${content}</div>
        <div class="msg-time">${time}</div>
      </div>
    </div>`;
  }).join('');
}

function sendGroupMessage(groupId) {
  const input = document.getElementById('msg-input');
  const text  = input?.value.trim();
  if (!text) return showToast('Mesaj boş olamaz', 'error');
  if (!State.currentUser) return showPage('login');

  const groups = _getGroups();
  const idx    = groups.findIndex(g => g.id === groupId);
  if (idx < 0) return;

  const msg = { sender: State.currentUser.id, senderName: State.currentUser.username, text, img: null, ts: Date.now() };
  if (!groups[idx].messages) groups[idx].messages = [];
  groups[idx].messages.push(msg);
  _saveGroups(groups);

  if (input) { input.value = ''; input.style.height = 'auto'; }

  const body = document.getElementById('chat-body');
  if (body) { body.innerHTML = _renderGroupMessages(groups[idx].messages); _scrollChat(); }
  renderGroupsList();
}

function closeGroupSettingsModal() {
  document.getElementById('group-settings-modal')?.remove();
}

function openGroupSettings(groupId) {
  const groups = _getGroups();
  const group  = groups.find(g => g.id === groupId);
  if (!group) return;
  const myRole = group.members.find(m => m.id === State.currentUser?.id)?.role;
  if (myRole !== 'owner') return showToast('Sadece grup kurucusu ayar yapabilir', 'error');

  const membersHtml = group.members.map(m => {
    const roleColor = m.role === 'owner' ? '#fbbf24' : m.role === 'manager' ? '#38bdf8' : 'var(--text-muted)';
    const roleIcon  = m.role === 'owner' ? 'fa-crown' : m.role === 'manager' ? 'fa-shield-halved' : 'fa-user';
    const roleLabel = m.role === 'owner' ? 'Kurucu' : m.role === 'manager' ? 'Yönetici' : 'Üye';
    const actions = m.role !== 'owner' ? `
      <button class="btn btn-sm" style="padding:4px 10px;font-size:.72rem;background:var(--bg-elevated);color:var(--info);border:1px solid rgba(56,189,248,.3);border-radius:6px" onclick="toggleGroupManager('${groupId}','${m.id}','${m.role}')">${m.role==='manager'?'<i class=\'fa-solid fa-user-minus\'></i> Düşür':'<i class=\'fa-solid fa-user-shield\'></i> Yönetici'}</button>
      <button class="btn btn-sm" style="padding:4px 10px;font-size:.72rem;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.25);border-radius:6px" onclick="removeGroupMember('${groupId}','${m.id}')"><i class="fa-solid fa-user-minus"></i></button>
    ` : '';
    const initials = (m.name||'?')[0].toUpperCase();
    return `<div class="gs-member-row">
      <div class="gs-member-av">${initials}</div>
      <div class="gs-member-info">
        <div class="gs-member-name">${escapeHtml(m.name)}</div>
        <div class="gs-member-role" style="color:${roleColor}"><i class="fa-solid ${roleIcon}" style="font-size:.65rem"></i> ${roleLabel}</div>
      </div>
      <div class="gs-member-actions">${actions}</div>
    </div>`;
  }).join('');

  // Remove any existing modal
  document.getElementById('group-settings-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'group-settings-modal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = 'z-index:9999';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div class="modal-header" style="flex-shrink:0">
        <h3 style="display:flex;align-items:center;gap:10px">
          <i class="fa-solid fa-sliders" style="color:#f5c518"></i> Grup Ayarları — ${escapeHtml(group.name)}
        </h3>
        <button onclick="closeGroupSettingsModal()"><i class="fa-solid fa-times"></i></button>
      </div>
      <div style="padding:24px;overflow-y:auto;flex:1;display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- LEFT COLUMN -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Group Avatar -->
          <div class="settings-section">
            <div class="settings-section-header"><i class="fa-solid fa-image"></i> Grup Avatarı</div>
            <div class="settings-body" style="display:flex;align-items:center;gap:16px">
              <div id="gs-avatar-preview" style="width:72px;height:72px;border-radius:var(--radius-md);background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">
                ${group.avatar ? `<img src="${group.avatar}" style="width:100%;height:100%;object-fit:cover" />` : group.name[0].toUpperCase()}
              </div>
              <div>
                <label class="btn btn-ghost btn-sm" for="gs-avatar-file" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Avatar Seç</label>
                <input type="file" id="gs-avatar-file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" style="display:none" onchange="previewGroupAvatar(this,'${groupId}')" />
                <p style="font-size:.74rem;color:var(--text-muted);margin-top:6px">Maks 100KB · JPG/PNG</p>
              </div>
            </div>
          </div>

          <!-- Group Name -->
          <div class="settings-section">
            <div class="settings-section-header"><i class="fa-solid fa-pen"></i> Grup Adı</div>
            <div class="settings-body">
              <input type="text" class="form-input" id="gs-name" value="${escapeHtml(group.name)}" maxlength="40" placeholder="Grup adı" />
            </div>
          </div>

          <!-- Group Description -->
          <div class="settings-section">
            <div class="settings-section-header"><i class="fa-solid fa-align-left"></i> Grup Açıklaması</div>
            <div class="settings-body">
              <input type="text" class="form-input" id="gs-desc" value="${escapeHtml(group.description||'')}" maxlength="100" placeholder="Kısa açıklama (opsiyonel)" />
            </div>
          </div>

        </div><!-- /left col -->

        <!-- RIGHT COLUMN — Members -->
        <div class="settings-section" style="min-height:0">
          <div class="settings-section-header"><i class="fa-solid fa-users-gear"></i> Üyeler & Roller</div>
          <div class="settings-body" style="overflow-y:auto;max-height:340px">${membersHtml}</div>
        </div>

      </div><!-- /grid -->

      <!-- Footer actions -->
      <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0">
        <button class="btn btn-primary" style="flex:1;justify-content:center" onclick="saveGroupSettings('${groupId}')"><i class="fa-solid fa-floppy-disk"></i> Kaydet</button>
        <button class="btn btn-danger" onclick="dissolveGroup('${groupId}')"><i class="fa-solid fa-trash"></i> Grubu Kapat</button>
        <button class="btn btn-ghost" onclick="closeGroupSettingsModal()"><i class="fa-solid fa-times"></i> İptal</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeGroupSettingsModal(); });
}

function previewGroupAvatar(input, groupId) {
  const file = input.files?.[0];
  if (!file) return;
  const allowed = ['image/jpeg','image/jpg','image/png'];
  if (!allowed.includes(file.type)) return showToast('Sadece JPG/PNG kabul edilir', 'error');
  if (file.size > 100 * 1024) return showToast('Görsel 100KB\'dan küçük olmalı', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('gs-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover" />`;
    // Temporarily store
    input._dataUrl = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveGroupSettings(groupId) {
  const groups = _getGroups();
  const gIdx   = groups.findIndex(g => g.id === groupId);
  if (gIdx < 0) return;
  const newName = document.getElementById('gs-name')?.value.trim();
  const newDesc = document.getElementById('gs-desc')?.value.trim();
  const avatarInput = document.getElementById('gs-avatar-file');
  if (newName) groups[gIdx].name = newName;
  if (newDesc !== undefined) groups[gIdx].description = newDesc;
  if (avatarInput?._dataUrl) groups[gIdx].avatar = avatarInput._dataUrl;
  _saveGroups(groups);
  showToast('Grup ayarları kaydedildi ✅', 'success');
  closeGroupSettingsModal();
  openGroupChat(groupId);
}

function toggleGroupManager(groupId, memberId, currentRole) {
  const groups = _getGroups();
  const gIdx = groups.findIndex(g => g.id === groupId);
  if (gIdx < 0) return;
  const mIdx = groups[gIdx].members.findIndex(m => m.id === memberId);
  if (mIdx < 0) return;
  groups[gIdx].members[mIdx].role = currentRole === 'manager' ? 'member' : 'manager';
  _saveGroups(groups);
  showToast(currentRole === 'manager' ? 'Yönetici rolü alındı' : 'Yönetici yapıldı', 'success');
  openGroupSettings(groupId);
}

function removeGroupMember(groupId, memberId) {
  const groups = _getGroups();
  const gIdx = groups.findIndex(g => g.id === groupId);
  if (gIdx < 0) return;
  groups[gIdx].members = groups[gIdx].members.filter(m => m.id !== memberId);
  _saveGroups(groups);
  showToast('Üye gruptan çıkarıldı', 'success');
  openGroupSettings(groupId);
}

function dissolveGroup(groupId) {
  if (!confirm('Bu grubu kapatmak istediğinizden emin misiniz?')) return;
  let groups = _getGroups();
  groups = groups.filter(g => g.id !== groupId);
  _saveGroups(groups);
  showToast('Grup kapatıldı', 'success');
  closeGroupSettingsModal();
  renderGroupsList();
  const chatArea = document.getElementById('msg-chat-area');
  if (chatArea) chatArea.innerHTML = `<div class="msg-empty"><i class="fa-solid fa-comment-dots"></i><p>Grup seç veya yeni grup oluştur</p></div>`;
}

/* ─────────────────────────────────────────────
   SUPPORT SYSTEM
───────────────────────────────────────────── */
function _getTickets() {
  try { return JSON.parse(localStorage.getItem('av-tickets') || '{}'); } catch { return {}; }
}
function _saveTickets(t) { localStorage.setItem('av-tickets', JSON.stringify(t)); State.tickets = t; }

function createSupportTicket() {
  const subject  = _val('support-subject');
  const category = document.getElementById('support-category')?.value;
  const desc     = _val('support-desc');

  if (!State.currentUser) return showPage('login');
  if (!subject)  return showToast('Konu alanı zorunludur', 'error');
  if (!category) return showToast('Kategori seçin', 'error');
  if (!desc || desc.length < 10) return showToast('Açıklama en az 10 karakter olmalı', 'error');

  const uid = State.currentUser.id;
  const all = _getTickets();
  if (!all[uid]) all[uid] = [];

  const ticket = {
    id: Date.now().toString(),
    subject, category, desc,
    status: 'Bekleniyor',
    createdAt: new Date().toLocaleString('tr-TR'),
    createdAtMs: Date.now(),
    closedAtMs: null,
    userId: uid,
    username: State.currentUser.username,
    messages: [{ from: 'user', text: desc, ts: Date.now(), sender: State.currentUser.username }],
  };
  all[uid].push(ticket);
  _saveTickets(all);

  ['support-subject','support-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cat = document.getElementById('support-category'); if (cat) cat.value = '';

  addActivity(`Destek talebi oluşturuldu: ${subject}`, 'fa-solid fa-headset');
  showToast('Destek talebin oluşturuldu ✅', 'success');
  renderTickets();
}

function openTicketDetail(uid, ticketId) {
  const all    = _getTickets();
  const ticket = (all[uid] || []).find(t => t.id === ticketId);
  if (!ticket) return;

  const statusColor = { 'Bekleniyor': '#f59e0b', 'Yanıtlandı': '#aaaaaa', 'Kapatıldı': '#6b7280' };
  const sc  = statusColor[ticket.status] || '#6b7280';
  const msgs = (ticket.messages || []).map(m => {
    const isAdmin = m.from === 'admin';
    return `<div style="display:flex;gap:10px;margin-bottom:14px${isAdmin ? ';flex-direction:row-reverse' : ''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${isAdmin ? 'rgba(245,197,24,.15)' : 'rgba(255,255,255,.08)'};border:1px solid ${isAdmin ? 'rgba(245,197,24,.3)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:${isAdmin ? '#f5c518' : 'var(--text-primary)'};flex-shrink:0">${isAdmin ? '<i class="fa-solid fa-shield-halved"></i>' : (m.sender||'?')[0].toUpperCase()}</div>
      <div style="max-width:75%">
        <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:3px${isAdmin ? ';text-align:right' : ''}">${isAdmin ? '<i class="fa-solid fa-shield-halved"></i> Yönetici' : escapeHtml(m.sender||'Kullanıcı')} · ${new Date(m.ts).toLocaleString('tr-TR')}</div>
        <div style="padding:10px 14px;border-radius:12px;font-size:.87rem;line-height:1.5;${isAdmin ? 'background:rgba(245,197,24,.07);border:1px solid rgba(245,197,24,.2);' : 'background:var(--bg-elevated);border:1px solid var(--border);'}">${escapeHtml(m.text)}</div>
      </div>
    </div>`;
  }).join('');

  const canReply = ticket.status !== 'Kapatıldı';

  document.getElementById('ticket-detail-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'ticket-detail-modal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = 'z-index:9997';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:620px;max-height:88vh;display:flex;flex-direction:column">
      <div class="modal-header" style="flex-shrink:0">
        <h3 style="font-size:.95rem"><i class="fa-solid fa-ticket" style="color:var(--accent)"></i> ${escapeHtml(ticket.subject)}</h3>
        <button onclick="document.getElementById('ticket-detail-modal').remove()"><i class="fa-solid fa-times"></i></button>
      </div>
      <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap">
        <span style="font-size:.78rem;padding:4px 10px;border-radius:100px;background:${sc}22;color:${sc};font-weight:700;border:1px solid ${sc}44">${ticket.status}</span>
        <span style="font-size:.76rem;color:var(--text-muted)">${ticket.category} · ${ticket.createdAt}</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px 20px">${msgs}</div>
      ${canReply ? `<div style="padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:8px;align-items:flex-end">
        <textarea id="ticket-reply-input" class="form-input" rows="2" placeholder="Yeni mesaj gönder..." style="flex:1;resize:none;font-family:inherit;font-size:.87rem"></textarea>
        <button class="btn btn-primary btn-sm" onclick="sendTicketMessage('${uid}','${ticketId}')"><i class="fa-solid fa-paper-plane"></i> Gönder</button>
      </div>` : `<div style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0;text-align:center;font-size:.82rem;color:var(--text-muted)"><i class="fa-solid fa-lock"></i> Bu talep kapatılmıştır</div>`}
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function sendTicketMessage(uid, ticketId) {
  const text = document.getElementById('ticket-reply-input')?.value.trim();
  if (!text) return showToast('Mesaj boş olamaz', 'error');
  if (!State.currentUser) return;

  const all    = _getTickets();
  const tIdx   = (all[uid] || []).findIndex(t => t.id === ticketId);
  if (tIdx < 0) return;
  const ticket = all[uid][tIdx];
  if (ticket.status === 'Kapatıldı') return showToast('Kapatılmış talebe mesaj gönderilemez', 'error');

  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({ from: 'user', text, ts: Date.now(), sender: State.currentUser.username });
  if (ticket.status === 'Yanıtlandı') ticket.status = 'Bekleniyor'; // re-open if user replies
  _saveTickets(all);

  document.getElementById('ticket-detail-modal')?.remove();
  openTicketDetail(uid, ticketId);
  renderTickets();
  showToast('Mesajın gönderildi', 'success');
}

function renderTickets() {
  // Auto-delete closed tickets older than 1 day
  const all = _getTickets();
  if (State.currentUser) {
    const uid = State.currentUser.id;
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (all[uid]) {
      all[uid] = all[uid].filter(t => !(t.status === 'Kapatıldı' && t.closedAtMs && Date.now() - t.closedAtMs > DAY_MS));
      _saveTickets(all);
    }
  }

  const container = document.getElementById('support-tickets-list');
  if (!container || !State.currentUser) return;

  const uid     = State.currentUser.id;
  const tickets = (all[uid] || []).slice().reverse();

  // Update stat counters
  const total  = tickets.length;
  const open   = tickets.filter(t => t.status === 'Bekleniyor').length;
  const closed = tickets.filter(t => t.status === 'Kapatıldı').length;
  const elTotal = document.getElementById('stat-total-tickets');
  const elOpen  = document.getElementById('stat-open-tickets');
  const elClosed= document.getElementById('stat-closed-tickets');
  if (elTotal)  elTotal.textContent  = total;
  if (elOpen)   elOpen.textContent   = open;
  if (elClosed) elClosed.textContent = closed;

  if (!tickets.length) {
    container.innerHTML = `<div class="empty-pro" style="padding:52px 24px"><div class="empty-pro-icon"><i class="fa-solid fa-ticket-simple"></i></div><div class="empty-pro-title">Henüz Talebiniz Yok</div><p class="empty-pro-desc">Soldaki formdan yeni bir destek talebi oluşturabilirsiniz. Ekibimiz en kısa sürede yardımcı olacaktır.</p></div>`;
    return;
  }

  const statusMeta = {
    'Bekleniyor': { cls:'badge-warning', icon:'fa-clock', color:'#f59e0b' },
    'Yanıtlandı': { cls:'badge-success', icon:'fa-check-circle', color:'#aaaaaa' },
    'Kapatıldı': { cls:'badge-muted',   icon:'fa-lock', color:'#6b7280' }
  };
  const hasNewReply = t => t.messages?.some(m => m.from === 'admin' && !m.readByUser);

  container.innerHTML = tickets.map((t, i) => {
    const sm = statusMeta[t.status] || statusMeta['Kapatıldı'];
    const newReply = hasNewReply(t);
    return `<div onclick="openTicketDetail('${uid}','${t.id}')" style="padding:14px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;border-bottom:1px solid var(--border);transition:all .18s;animation:fadeInUp .3s ease both;animation-delay:${i * 0.05}s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
      <div style="width:40px;height:40px;border-radius:12px;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(99,102,241,.18)">
        <i class="fa-solid fa-ticket" style="color:#6366f1;font-size:.9rem"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600;color:var(--text-primary);margin-bottom:3px;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(t.subject)}
          ${newReply ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:100px;background:rgba(255,255,255,.08);color:var(--text-secondary);font-size:.65rem;font-weight:700;border:1px solid rgba(255,255,255,.15);flex-shrink:0"><i class="fa-solid fa-bell"></i> Yanıt</span>' : ''}
        </div>
        <div style="font-size:.73rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="text-transform:capitalize">${escapeHtml(t.category)}</span>
          <span style="opacity:.4">•</span>
          <span><i class="fa-regular fa-calendar" style="font-size:.68rem"></i> ${t.createdAt}</span>
          <span style="opacity:.4">•</span>
          <span><i class="fa-solid fa-comments" style="font-size:.68rem"></i> ${t.messages?.length || 1} mesaj</span>
        </div>
      </div>
      <span class="badge ${sm.cls}" style="flex-shrink:0"><i class="fa-solid ${sm.icon}" style="font-size:.7rem"></i> ${t.status}</span>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   AUTH HELPERS
───────────────────────────────────────────── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

function checkPasswordStrength(val) {
  let score = 0;
  if (val.length >= 8)         score++;
  if (/[A-Z]/.test(val))       score++;
  if (/[0-9]/.test(val))       score++;
  if (/[^A-Za-z0-9]/.test(val))score++;
  const cls = ['','active-weak','active-medium','active-strong','active-strong'];
  [1,2,3,4].forEach(i => {
    const b = document.getElementById(`sb${i}`);
    if (!b) return;
    b.className = 'strength-bar';
    if (i <= score) b.classList.add(cls[score]);
  });
  const lbl = document.getElementById('strength-label');
  if (lbl) lbl.textContent = val.length ? (['','Zayıf','Orta','Güçlü','Çok Güçlü'][score] || 'Güçlü') : 'Şifre gücü';
}

function checkCaptcha(boxId) {
  const box   = document.getElementById(boxId);
  const check = document.getElementById(boxId + '-check');
  if (!box || box.classList.contains('checked')) return;
  if (check) check.innerHTML = '<div style="width:14px;height:14px;border:2px solid #ccc;border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite"></div>';
  if (!document.getElementById('spin-style')) {
    const s = document.createElement('style'); s.id='spin-style';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  setTimeout(() => {
    box.classList.add('checked');
    if (check) check.innerHTML = '<i class="fa-solid fa-check" style="color:#fff"></i>';
    State.captchas[boxId] = true;
  }, 1000 + Math.random() * 800);
}

/* ─────────────────────────────────────────────
   MISC UI
───────────────────────────────────────────── */
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

function submitContact() {
  showToast('Mesajınız gönderildi! En kısa sürede dönüş yapacağız.', 'success');
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const icons = { success:'fa-check-circle', error:'fa-circle-xmark', info:'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3500);
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function _el(id, fn) { const el = document.getElementById(id); if (el) fn(el); }
function _val(id) { return document.getElementById(id)?.value.trim() || ''; }

async function _saveCurrentUser() {
  if (!State.currentUser) return;
  localStorage.setItem('av-user', JSON.stringify(State.currentUser));
  try {
    const { id, ...fields } = State.currentUser;
    await fetch(`tables/av_users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    });
  } catch (_) { /* silent — localStorage still holds latest state */ }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Navbar scroll effect */
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  if (nb) nb.style.boxShadow = window.scrollY > 20 ? '0 4px 32px rgba(0,0,0,.45)' : 'none';
});

/* Close emoji picker on outside click */
document.addEventListener('click', e => {
  const ep = document.getElementById('emoji-picker');
  if (ep && !ep.contains(e.target) && !e.target.closest('.msg-emoji-btn')) ep.classList.remove('open');
});
