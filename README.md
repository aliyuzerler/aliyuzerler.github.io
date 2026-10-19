# Ali Yüzerler — Portfolyo Web Sitesi

> [!NOTE]
> Bu README, P4 paketi kapsamında önerilen taslaktır.

Kişisel portfolyo sitesi: mobil & web geliştirme hizmetleri, canlı proje önizlemeleri ve iletişim kanalları.

🔗 **Canlı:** https://aliyuzerler.github.io

## 🧱 Teknoloji

| Katman | Teknoloji |
|---|---|
| Framework | Next.js (App Router, statik export) |
| Stil | Tailwind CSS + shadcn/ui bileşen yaklaşımı |
| Tipografi | Inter, Space Grotesk, Geist Mono (woff2, preload'lu) |
| Barındırma | GitHub Pages (`aliyuzerler.github.io`) |
| Proje demoları | Bağımsız HTML/CSS/JS (`/projects/*.html`, iframe ile önizleme) |

## 📁 Depo Yapısı

```
├── index.html            # Ana sayfa (statik export çıktısı)
├── 404.html              # 404 sayfası
├── _next/                # Next.js statik varlıkları (JS/CSS/font)
├── projects/             # Proje demo sayfaları ve varlıkları
├── blog/                 # Blog sayfası (statik, posts.json'dan beslenir)
├── admin/                # Blog yönetim paneli (özel, noindex)
├── data/posts.json       # Blog yazıları veri kaynağı
├── profile.jpg           # Profil fotoğrafı
└── robots.txt            # Arama motoru kuralları
```

> ⚠️ **Bu depo yalnızca build çıktısını içerir.** Kaynak kod ayrı tutulmaktadır.

## ✍️ Blog

- **Blog sayfası:** [/blog/](https://aliyuzerler.github.io/blog/) — ekonomi, borsa, yapay zeka,
  kişisel gelişim ve gündem başlıklı yazılar. Ana sitedeki "Blog" sekmesinden erişilir.
- **Yönetim paneli:** [/admin/](https://aliyuzerler.github.io/admin/) — yalnızca yazarın
  erişimine açık, sitede hiçbir yerden bağlantı verilmez.
  Yazı eklemek/düzenlemek için GitHub Personal Access Token (repo yetkili) gerekir;
  token yalnızca tarayıcıda saklanır ve kayıtlar doğrudan `data/posts.json` dosyasına
  commit edilir. Site, commit sonrası otomatik olarak yeniden yayınlanır (1-2 dk).

## 🚀 Yerel Geliştirme

Kaynak proje ayrı olduğundan bu depo üzerinde doğrudan geliştirme yapılmaz;
`next build` çıktısı bu depoya deploy edilir (bkz. `.github/workflows/deploy.yml`).

Blog verisi üzerinde çalışırken basit bir statik sunucu yeterlidir:
`python3 -m http.server 3030` → `http://localhost:3030/blog/`

## 📞 İletişim

- 📧 yuzerler042@gmail.com
- 📱 +90 553 028 23 03 (WhatsApp)
- 📷 [@aliyuzerler](https://www.instagram.com/aliyuzerler) · 𝕏 [@Yzerler](https://x.com/Yzerler)

---

© Ali Yüzerler — Tüm hakları saklıdır.
