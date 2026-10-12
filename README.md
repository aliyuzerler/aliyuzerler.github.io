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
├── profile.jpg           # Profil fotoğrafı
└── robots.txt            # Arama motoru kuralları
```

> ⚠️ **Bu depo yalnızca build çıktısını içerir.** Kaynak kod ayrı tutulmaktadır.

## 🚀 Yerel Geliştirme

Kaynak proje ayrı olduğundan bu depo üzerinde doğrudan geliştirme yapılmaz;
`next build` çıktısı bu depoya deploy edilir (bkz. `.github/workflows/deploy.yml`).

## 📞 İletişim

- 📧 yuzerler042@gmail.com
- 📱 +90 553 028 23 03 (WhatsApp)
- 📷 [@aliyuzerler](https://www.instagram.com/aliyuzerler) · 𝕏 [@Yzerler](https://x.com/Yzerler)

---

© Ali Yüzerler — Tüm hakları saklıdır.
