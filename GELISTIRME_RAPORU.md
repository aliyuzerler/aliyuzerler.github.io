# aliyuzerler.github.io — Geliştirme Raporu
*Tarih: İnceleme tarihi • Yöntem: Repo klonlama + statik analiz + agent-browser canlı site testi (masaüstü + iPhone 14)*

---

## 1. Genel Durum Özeti

| Alan | Durum |
|---|---|
| Site erişimi | ✅ HTTP 200, hızlı (ilk yanıt ~0.5s) |
| Görsel tasarım | ✅ Çok iyi (dark/light tema, animasyonlar, glassmorphism) |
| Tema değiştirme | ✅ Çalışıyor |
| TR/EN dil değiştirme | ✅ Çalışıyor (ama içerik tutarsız — bkz. H1) |
| Proje detay modalı | ✅ Çalışıyor (canlı iframe önizleme + Tam Sayfa Aç) |
| Mobil uyum | ⚠️ Genel olarak iyi, mobil menüde şeffaflık hatası var (bkz. H2) |
| SEO | ⚠️ Kısmen iyi — og:image, canonical, JSON-LD, sitemap eksik |
| Erişilebilirlik | ✅ İyi (aria-label'lar, iframe başlıkları, semantik HTML) |
| Repo hijyeni | ❌ Ölü dosyalar + 9 build ID artığı + düzensiz geçmiş |

**Mimari not:** Bu repo Next.js sitenin **statik export çıktısı** — kaynak kodu içermez. Commit geçmişi tamamen "Add files via upload" (GitHub web arayüzünden manuel yükleme). CI/CD (.github/workflows) yok.

---

## 2. Bulunan Hatalar (Öncelik Sırasıyla)

### 🔴 H1 — "CV İndir" butonu ölü bağlantı (KRİTİK)
- `href="#"` — tıklayınca hiçbir şey olmuyor (sayfa başına dönüyor).
- Repoda hiçbir PDF dosyası yok.
- **Çözüm:** CV PDF'i üretilip repoya eklenmeli, link buna bağlanmalı.

### 🔴 H2 — Mobil menü şeffaflık hatası
- Hamburger menü açılınca arkadaki bölüm içerikleri (skill barları, kartlar) menü öğelerinin üzerinden geçiyor, okunabilirlik bozuluyor.
- Muhtemel neden: menü panelinin arka planı yeterince opak değil / backdrop-blur çalışmıyor.
- **Çözüm:** Mobil menü paneline opak arka plan (bg-background/95 + backdrop-blur) eklenmeli.

### 🟠 H3 — TR/EN içerik tutarsızlığı
- TR hero: "5+ yıldır dijital ürünler tasarlayan..." — EN hero: "8+ years of experience".
- İstatistik bölümü "5+ Years of experience" diyor; EN hero ile çelişiyor.
- **Çözüm:** Tek bir doğru rakam belirlenip tüm dillerde tutarlı hale getirilmeli.

### 🟠 H4 — Sosyal paylaşım meta'ları eksik
- `og:image` ve `twitter:image` YOK → sitenin linki WhatsApp/X/LinkedIn'de paylaşıldığında görsel önizleme çıkmıyor (`summary_large_image` kartı boş görüntülenir).
- `rel="canonical"` YOK.
- **Çözüm:** 1200x630 OG görseli üretilip eklenmeli.

### 🟡 H5 — "Figma" yeteneği "DevOps & Araçlar" kategorisinde
- Docker/Git ile aynı kartta listelenmiş. Kategorizasyon hatası.

### 🟡 H6 — 404.html'de iki adet `<title>` etiketi
- Next.js export artifact'ı. Minor ama geçersiz HTML.

### 🟡 H7 — Proje demo sayfaları harici CDN bağımlılığı
- `projects/*.html` dosyaları lucide ikonlarını `unpkg.com`'dan çekiyor. CDN erişilemezse ikonlar kaybolur (hata yakalayıcı fallback var, yine de self-host daha güvenli).

---

## 3. SEO & Görünürlük Eksikleri

1. **sitemap.xml yok** — robots.txt'e de Sitemap satırı eklenmemiş.
2. **JSON-LD yapısal veri yok** — `Person` + `WebSite` schema (name, jobTitle, knowsAbout, sameAs: Instagram/X/WhatsApp) eklenmeli. Google zengin sonuçları için önemli.
3. **og:image/twitter:image yok** (bkz. H4).
4. **hreflang yok** — TR/EN içerik client-side değişiyor; `hreflang` alternatifi olarak `/en` route'u statik export'ta üretilebilir (SEO açısından ideal olan bu; mevcut yaklaşım arama motorlarına sadece TR içerik sunuyor).
5. **Analitik yok** — en azından gizlilik dostu bir çözüm (Umami/Plausible/GoatCounter) eklenebilir; kaç kişi baktığını, hangi projeye ilgi olduğunu ölçmek portfolio için değerli.

---

## 4. Performans & Boyut

| Metrik | Değer | Not |
|---|---|---|
| HTML (index) | ~150 KB | Tüm bölümler + RSC payload inline; bölünebilir ama kabul edilebilir |
| İlk yükleme JS + kaynak | ~1.37 MB (decoded) | 18 chunk'tan ~11'i aktif |
| Fontlar | ✅ Preload'lu woff2 | Doğru yapılmış |
| Görseller | profile.jpg 34KB ✅ | hero-bg.png kullanılmıyor ❌ |
| Toplam repo | 8.5 MB | Ölü içerik temizlenince ~7 MB'a düşer |

1. **Ölü dosyalar temizlenmeli:**
   - `hero-bg.png` (104 KB) — hiçbir HTML/chunk'ta referans yok.
   - `altınokmakine.html` — Türkçe karakterli kopya; referanslı olan `altinokmakine.html`. Kodlama/URL hatası riski.
   - `projects/*.png` (7 dosya, ~573 KB) — yalnızca eski chunk'ta referanslı, mevcut tasarımda iframe önizlemeler kullanılıyor. Emin olunmakla birlikte yeni chunk'ta görünmüyorlar; temizlik öncesi tek test gerekiyor.
2. **Eski build artıkları:** `_next/static` altında 9 build ID dizini var, 8'i stale. Her yüklemede eski chunk'lar silinmiyor → repo şişiyor, hatalı cache hit riski.
3. **Proje iframeleri** lazy + sandbox'lı, iyi. Çift iframe (desktop + mobile önizleme) sayfa başına ek yük — tek önizleme + "Tam Sayfa Aç" yeterli olabilir.

---

## 5. Repo Hijyeni & Dağıtım Süreci

1. **Kaynak kod versiyonlanmıyor** — repo sadece build çıktısı. Disk arızası / bilgisayar değişimi = kaynak kaybı riski. Kaynak kod ayrı (en azından private) bir repoda tutulmalı.
2. **CI/CD yok** — her güncelleme GitHub web arayüzünden manuel yükleme. Basit bir GitHub Actions workflow'u (`next build` → `gh-pages` deploy) tüm bu süreci otomatikleştirir ve "eski build artığı birikmesi" sorununu kökten çözer.
3. **.nojekyll ✅** — doğru yapılmış.
4. **README** tek satır — repoya proje açıklaması, tech stack, yerel geliştirme talimatları eklenmeli (işverenler repoya da bakıyor).
5. **Öneri:** `CNAME` yok — `aliyuzerler.dev` gibi özel bir alan adı portfolyo için ciddi profesyonal değer katar (~$10-12/yıl).

---

## 6. Özellik & İçerik Önerileri

1. **GitHub profili linki yok!** — Yazılımcı portfolyosunda GitHub linki olmaması büyük eksik. LinkedIn de yok (Instagram + X var).
2. **Blog/haberler bölümü** — SEO ve uzmanlık gösterimi için kısa teknik yazılar (haftada 1 yazı hedefiyle başlayabilir).
3. **Proje detay sayfaları** — Her proje için gerçek vaka çalışması (problem → çözüm → sonuç + ekran görüntüleri + Google Play/App Store linkleri). Şu an iframeler demo var; 64+ proje iddiasını destekleyecek derinlik yok.
4. **CV İndir** — gerçek PDF (bkz. H1).
5. **İletişim formu** — şu an `mailto:` ile e-posta istemcisini açıyor. Formspree/Web3Forms (ücretsiz) ile gerçek form gönderimi + spam koruması sağlanabilir; WhatsApp zaten entegre, bu iyi.
6. **Bülten formu** (footer) — şu an statik; ya çalışan bir arka uca bağlanmalı ya da kaldırılmalı (ölü özellik kötü izlenim verir).
7. **Testimonials** — gerçek isim/şirket/LinkedIn linkiyle zenginleştirilebilir.
8. **İngilizce içerik SEO'su** — EN içeriğin ayrı URL'de sunulması (bkz. Bölüm 3.4).
9. **Mini easter egg / daha fazla etkileşim** — site zaten animasyonlu; komut paleti (Ctrl+K) veya terminal temalı "hakkımda" gibi imzalı bir dokunuş portfolyoyu akılda kalıcı yapar.

---

## 7. Önerilen İş Paketleri (Onay Bekliyor)

| Paket | İçerik | Etki |
|---|---|---|
| **P1 — Kritik Düzeltmeler** | H1 (CV linki+PDF), H2 (mobil menü), H3 (5+/8+ tutarlılığı), H6 (çift title), Figma kategorisi (H5) | Siteyi hatasız hale getirir |
| **P2 — SEO & Paylaşım** | og:image üretimi, canonical, JSON-LD, sitemap.xml, robots güncellemesi | Google + sosyal medya görünürlüğü |
| **P3 — Temizlik & Hijyen** | Ölü dosyaların silinmesi, stale build artıklarının temizlenmesi, README iyileştirme | ~1.5 MB küçülme, profesyonel repo |
| **P4 — Yeni Özellikler** | GitHub/LinkedIn linkleri, çalışan iletişim formu, analitik | Dönüşüm ve ölçüm |
| **P5 — CI/CD** | GitHub Actions otomatik deploy workflow'u | Sürdürülebilir geliştirme |
| **P6 — İleri** | Blog, proje vaka çalışmaları, EN alt sayfaları | Uzun vadeli büyüme |

---

## 8. Geliştirmeye Nasıl Başlanır? (Karar Bekliyor)

Repo yalnızca build çıktısı içerdiğinden geliştirme için üç yol var:

- **Yol A — Statik dosyalar üzerinde doğrudan düzeltme:** P1/P2/P3 paketleri statik dosyalar üzerinde uygulanabilir. Ben düzeltilmiş dosyaları üretirim, siz GitHub'a yüklersiniz (veya token verirseniz doğrudan push denemesi yapabilirim).
- **Yol B — Kaynak projede düzeltme:** Next.js kaynak projeniz varsa (ki tasarım buna işaret ediyor), düzeltmeleri kaynak kodda yapıp yeniden export almanız gerekir. Bu durumda ben düzeltilmiş kaynak dosyaları/patch'leri hazırlarım.
- **Yol C — Sandbox'ta yeniden inşa:** Siteyi burada modern Next.js projesi olarak yeniden inşa ederim; siz kaynağı oradan devralırsınız.

> Not: Bu sandbox'tan doğrudan GitHub'a push için erişim yetkiniz gerekir; yoksa çıktıları dosya olarak teslim ederim.
