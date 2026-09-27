# Avalanche Gaming — CS 1.6 JailBreak Community

Tam özellikli CS 1.6 JailBreak topluluk sitesi. Forum sistemi, admin yönetim paneli, kullanıcı mesajlaşma, destek sistemi ve üyelik sayfaları içerir.

---

## 🟢 Tamamlanan Özellikler

### 🌐 Ana Site (index.html — SPA)
- **Yeşil Tema** — CSS değişkenleri ile dinamik renk sistemi (#22c55e)
- **7 Sayfa + Forum**: Ana Sayfa, Hakkımızda, Kurallar, Duyurular, Market, Galeri, İletişim + Forum
- **Gerçek Zamanlı İstatistikler** — DB'den üye/konu/yorum sayısı
- **Forum Butonu** — Navbar'da yeşil gradient buton, 🟢 Aktif status badge

### 📋 Forum Sistemi (`js/forum.js`, `css/forum.css`)
- **Konu Listesi** — Sayfalama, kategori filtresi, arama (başlık/içerik/kategori)
- **5 Kategori** — Genel, Haber, Paylaşım, Ban İtiraz, Reklam
- **Konu Detayı** — Görüntüleme sayacı, yanıt listesi, oy butonları
- **Konu Oluşturma Tam Sayfa** — `page-create-topic` tam sayfa (Başlık/Kategori/Görsel[maks 2MB]/İçerik/Etiket[maks 5])
- **Rich Text Editor** — Kalın/italik/underline/link/liste + emoji picker (contenteditable)
- **Oylama** — Like/dislike toggle, değiştirme, geri çekme (DB tabanlı)
- **Konu/Yorum CRUD** — Kullanıcı kendi konusunu/yorumunu düzenler/siler
- **Sabitleme / Kilitleme** — Moderatör+ yetkisi gerekir
- **Süper Beğeni** — Admin+ yetkisi gerekir
- **Raporlama** — Konu ve yorumları raporlama modali
- **Mute/Ban Modal** — Geçici susturma/uzaklaştırma (maks 72 saat)
- **Rol Rozetleri** — Kurucu / Yönetici / De.Moderatör / Moderatör — overflow yok
- **Üye Etiketleri (badge_role)** — Yasaklı/Misafir/Aktif/Kıdemli/Emektar Üye + G/V Editörü/Paylaşımcı/İçerik Üreticisi/Youtuber; yetki seviyesine göre atanabilir
- **Kendi yorumunda Düzenle (mor) + Kaldır (kırmızı)**, başkasında Cevapla (mavi) + Raporla (kırmızı) — sağ altta hover glow
- **Tarih Sol Üstte** — Yanıt footer'ında tarih sol üstte `📅 X dk önce` formatında
- **Reply Toolbar Genişletildi** — Yazı Tipi + Renk Seçici + Etiket(#) + YouTube embed + TikTok link
- **Premium Gradient Yazar Adı** — Konu listesi ve yanıt kartlarında `author_premiumGradient` varsa animasyonlu
- **Profil Kartı → Tam Sayfa** — `page-user-profile`, banner + avatar + maskelenmiş ad + stat kartları + glow butonlar
- **Yetki Hiyerarşisi** — user(0) < moderator(10/Moderatör) < super_moderator(20/De.Moderatör) < admin(30/Yönetici) < super_admin(40/Kurucu)

### 🛡️ Admin Paneli (`admin.html`, `js/admin.js`, `css/admin.css`)
Ayrı sayfa — `admin.html` — moderatör ve üstü roller için erişilebilir.

| Bölüm | İçerik |
|-------|--------|
| **Genel Bakış** | Kullanıcı/konu/yorum/rapor istatistikleri, 7 günlük giriş grafiği |
| **Kullanıcı Yönetimi** | Arama, rol değiştirme, bilgi düzenleme, mute/ban |
| **Forum Yönetimi** | Konu ve yorum arama/düzenleme/silme/kilitleme/sabitleme |
| **Duyuru Yönetimi** | CRUD + son 20 kayıt görünümü |
| **Market Yönetimi** | CRUD + son 20 kayıt görünümü |
| **Kadro Yönetimi** | CRUD + sıralama + son 20 kayıt |
| **Rapor Yönetimi** | Bekleyen/geçmiş sekmeler, çözüm notu, çözümleyen bilgisi |
| **Rol Yönetimi** | CRUD + 16 izin anahtarlı permission grid + renk picker |
| **Log/Kayıt** | 6 kategori (login/logout/topic/reply/user/moderator), maks 50 kayıt |
| **Site Ayarları** | Site adı, accent renkleri, TeamSpeak, WhatsApp — sadece super_admin |

### 📢 Duyurular Sayfası
- **DB-Backed** — `av_announcements` tablosundan gerçek veri yükleme
- Sabitlenmiş duyurular üstte gösterilir
- Tip rengi (bilgi/uyarı/başarı/kritik) desteklenir
- Veri yoksa empty state, hata durumunda yenile butonu

### 🛒 Market Sayfası
- **DB-Backed** — `av_market` tablosundan gerçek ürün yükleme
- Kart grid layout, ürün görseli veya emoji fallback
- Stok, fiyat, iletişim bilgisi gösterimi

### 👤 Kullanıcı Sistemi
- Kayıt / Giriş (localStorage tabanlı, CAPTCHA simülasyonu)
- Dashboard: Hesabım, İstatistiklerim, Mesajlaşma, Üyelik, Destek, Çıkış
- Şifre değiştirme, avatar yükleme
- Mesajlaşma: Arkadaşlık istekleri, iki yönlü DM + Grup chat (maks 2 grup/kullanıcı), 48s DM / 24s Grup TTL
- **Mesaj balonları sıfırdan yeniden yazıldı** — `.msg-bubble-wrap.own/other`, `.msg-bubble-col`, avatar + gönderen adı düzgün hizalama
- **Premium Kullanıcı Adı Rengi** — 14 animasyonlu gradient çifti (sadece Premium üyelere özel), dashboard+forum+sidebar+konu listesi+yanıt kartlarında uygulanır
- **Kullanıcı Adı 72h Cooldown** — `username_changed_at` timestamp ile değiştirme sınırı
- Destek Talepleri: Form oluşturma, durum takibi, konuşma iş parçacığı modeli

### 📊 Log & Analitik
- **Login Log** — Her giriş `av_logs` tablosuna yazılır
- **Logout Log** — Çıkış işlemi loglanır
- **Günlük Giriş** — `av_login_stats` tablosuna upsert (admin grafik için)
- **Maks 50 Log/Kategori** — Otomatik eski silme

### 🔑 Admin Panel Linki
- Giriş sonrası otomatik inject edilir (forum sayfasına gerek yok)
- Kullanıcı dropdown menüsünde "Yönetim Paneli" butonu görünür (moderatör+)

---

## 📁 Dosya Yapısı

```
index.html              ← Ana SPA
admin.html              ← Ayrı admin paneli

css/
  style.css             ← Ana stiller + CSS değişkenleri (yeşil tema)
  pages.css             ← Tüm sayfa stilleri
  forum.css             ← Forum + modal + rich editor stilleri (~18KB)
  admin.css             ← Admin paneli stilleri (~16KB)

js/
  app.js                ← SPA routing, auth, mesajlaşma, log hooks, announcements/market yükleme
  forum.js              ← Forum CRUD, oylama, moderasyon, log yazıcı (~51KB)
  admin.js              ← Admin panel: tüm yönetim işlemleri (~50KB)
```

---

## 🗄️ Veritabanı Tabloları (RESTful Table API)

| Tablo | Amaç |
|-------|------|
| `av_users` | Kullanıcılar (role, muted_until, banned_until) |
| `av_categories` | Forum kategorileri (5 kayıt) |
| `av_topics` | Konular (is_pinned, is_locked, super_liked, sayaçlar) |
| `av_replies` | Yanıtlar (topic_id, author_id, like/dislike sayaçları) |
| `av_votes` | Oylar (user_id, target_id, target_type, vote) |
| `av_reports` | Raporlar (status, resolved_by, resolver_note) |
| `av_announcements` | Duyurular (is_active, is_pinned, type) |
| `av_market` | Market ürünleri (price, stock, is_active) |
| `av_staff` | Kadro (sort_order, role_title, is_active) |
| `av_roles` | Roller (level, color, perms JSON) |
| `av_site_settings` | Site ayarları (key-value) |
| `av_logs` | Loglar (category, username, action_type, target) |
| `av_login_stats` | Günlük giriş sayısı (date, count) |

---

## 🔗 Sayfa URI'leri

| Sayfa | Açma Yöntemi |
|-------|-------------|
| Ana Sayfa | `showPage('home')` |
| Forum | `showPage('forum')` |
| Konu Detayı | `openTopic(topicId)` |
| Duyurular | `showPage('announcements')` — DB'den yükler |
| Market | `showPage('market')` — DB'den yükler |
| Hakkımızda | `showPage('about')` |
| Kurallar | `showPage('rules')` |
| Galeri | `showPage('gallery')` |
| İletişim | `showPage('contact')` |
| Giriş/Kayıt | `showPage('login')` / `showPage('register')` |
| Dashboard | `showPage('dashboard')` |
| Admin Panel | `admin.html` (ayrı sayfa) |

---

## 🔐 Rol Hiyerarşisi

| Rol | Seviye | Erişim |
|-----|--------|--------|
| user | 0 | Forum okuma, konu/yorum oluşturma, oylama |
| moderator | 10 | + Kilitleme, sabitleme, mute, ban, rapor yönetimi, admin panel |
| super_moderator | 20 | + Kullanıcı yönetimi, forum yönetimi |
| admin | 30 | + Duyuru, market, kadro yönetimi |
| super_admin | 40 | + Rol yönetimi, site ayarları |

---

## ⚙️ 16 İzin Anahtarı

`delete_topic`, `delete_reply`, `lock_topic`, `pin_topic`, `mute_user`, `ban_user`, `manage_reports`, `manage_users`, `manage_forum`, `manage_announcements`, `manage_market`, `manage_staff`, `super_like`, `manage_roles`, `manage_site`, `manage_logs`

---

## 🚀 Test Durumu

| Dosya | Console Test | Görsel Test |
|-------|-------------|-------------|
| index.html | ✅ Hata yok (1 erişilebilirlik uyarısı — önemsiz) | ✅ Yeşil tema, navbar, hero doğru |
| admin.html | ✅ Hata yok | ✅ Access denied ekranı (beklenen — giriş yapılmadan) |

---

## ⏳ Eksik / Geliştirilebilecek

- **Staff Sayfası** (`#page-about`) → `av_staff` tablosundan dinamik kadro gösterimi
- **Galeri** → `av_gallery` tablosu (henüz oluşturulmadı)
- **IP Adresi Tespiti** — Log kayıtlarında `—` yerine gerçek IP (statik sitede sınırlı)
- **DB → localStorage Sync** — Admin panelinden düzenlenen kullanıcı bilgileri localStorage'a otomatik yansıtılmıyor (Hosted Deploy sonrasında tek kaynak DB olmalı)
- **Mute/Ban Otomatik Güncelleme** — Forum açılışında DB'den fresh mute/ban durumu çekilmeli
- **Hosted Deploy** → Publish sekmesinden yayınlandıktan sonra Cloudflare D1 canlı DB aktif hale gelir

---

## 📌 Önemli Notlar

1. **Güvenlik:** Statik site olduğu için tüm yetki kontrolleri JavaScript katmanında. Gerçek backend olmadan sunucu taraflı doğrulama yapılamaz — bu bilinen bir kısıtlamadır.
2. **iki Veri Deposu:** Preview (editor) verisi ve Hosted Deploy (Cloudflare D1) verisi ayrıdır. HostedDbExecute ile production DB'ye seed veri eklenebilir.
3. **loadCommunityStats** → Artık gerçek DB'den toplam kullanıcı/konu/yorum sayısı çekiyor.
4. **Admin Panel Linki** → Login sonrası otomatik enjekte edilir; forum sayfasına gitmek gerekmiyor.
