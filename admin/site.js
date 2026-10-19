/* ============================================================
   ALIBLOG v2 — admin/site.js
   "Site İçeriği" sekmesi: portföy sitesinin tüm içeriğini
   Supabase REST API üzerinden yönetir (Profil, Nav Menü,
   İstatistikler, Sosyal Medya, Hizmetler, Yetenekler, Projeler,
   Deneyim, Yorumlar, Mesajlar).
   Eski yönetim panelinin (chunk içindeki) tam karşılığıdır —
   tek panelde blog + site yönetimi.
   Supabase publishable key GİZLİ DEĞİLDİR; sitenin kendi JS'inde
   zaten herkes tarafından görülebilir durumdadır (RLS ile korunur).
   ============================================================ */
(function () {
  "use strict";

  var SB_URL = "https://bauqwxehyfleigdjtlgk.supabase.co/rest/v1";
  var SB_KEY = "sb_publishable_W5mPgBmV5oNzG_94aKVWlQ_XzmC43pJ";

  var ICON_OPTS = ["smartphone", "globe", "palette", "lightbulb", "database", "wrench",
    "code", "briefcase", "github", "linkedin", "twitter", "instagram", "whatsapp", "mail", "quote", "star"];

  /* ---- Şema: her varlık = bir Supabase tablosu ---- */
  var ENT = [
    {
      id: "profile", table: "profile", label: "Profil", single: true,
      desc: "Sitenin her yerinde görünen profil bilgileri: isim, ünvan, iletişim, bio.",
      fields: [
        { k: "name", l: "Ad Soyad" },
        { k: "initials", l: "Baş Harfler", ph: "AY" },
        { k: "first_name", l: "Ad" },
        { k: "last_name", l: "Soyad" },
        { k: "role", l: "Ünvan (TR)" },
        { k: "role_en", l: "Ünvan (EN)" },
        { k: "tagline", l: "Slogan (TR)", wide: 1 },
        { k: "tagline_en", l: "Slogan (EN)", wide: 1 },
        { k: "location", l: "Konum (TR)" },
        { k: "location_en", l: "Konum (EN)" },
        { k: "email", l: "E-posta" },
        { k: "phone", l: "Telefon" },
        { k: "avatar", l: "Avatar Yolu", ph: "/profile.jpg" },
        { k: "resume_url", l: "CV Yolu", ph: "/Ali-Yuzerler-CV.pdf" },
        { k: "available", l: "Yeni projelere açık", t: "bool", wide: 1 },
        { k: "bio", l: "Bio (TR)", t: "ta", wide: 1, rows: 4 },
        { k: "bio_en", l: "Bio (EN)", t: "ta", wide: 1, rows: 4 },
        { k: "bio_extended", l: "Detaylı Bio (TR)", t: "ta", wide: 1, rows: 6 },
        { k: "bio_extended_en", l: "Detaylı Bio (EN)", t: "ta", wide: 1, rows: 6 }
      ]
    },
    {
      id: "nav", table: "nav_links", label: "Nav Menü",
      desc: "Üst menü ve footer bağlantıları. Bölüm bağlantıları # ile başlar (örn. #about); ayrı sayfalar / ile başlar (örn. /blog/).",
      titleKey: "name", subKey: "href",
      fields: [
        { k: "name", l: "Görünen Ad (TR)" },
        { k: "name_en", l: "Görünen Ad (EN)" },
        { k: "href", l: "Hedef", ph: "#about veya /blog/" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 }
      ]
    },
    {
      id: "stats", table: "stats", label: "İstatistikler",
      desc: "Hero bölümündeki sayaçlar (örn. 40+ Mutlu Müşteri).",
      titleKey: "label", subFn: function (r) { return (r.value == null ? "—" : r.value) + (r.suffix || ""); },
      fields: [
        { k: "label", l: "Etiket (TR)" },
        { k: "label_en", l: "Etiket (EN)" },
        { k: "value", l: "Değer", t: "num", def: 0 },
        { k: "suffix", l: "Son Ek", ph: "+" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 }
      ]
    },
    {
      id: "socials", table: "socials", label: "Sosyal Medya",
      desc: "Footer ve iletişim bölümündeki sosyal medya bağlantıları.",
      titleKey: "name", subKey: "url",
      fields: [
        { k: "name", l: "Platform" },
        { k: "url", l: "URL", ph: "https://..." },
        { k: "icon", l: "İkon", t: "icon" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 }
      ]
    },
    {
      id: "services", table: "services", label: "Hizmetler",
      desc: "Hizmetler bölümündeki kartlar.",
      titleKey: "title", subKey: "description",
      fields: [
        { k: "title", l: "Başlık (TR)" },
        { k: "title_en", l: "Başlık (EN)" },
        { k: "icon", l: "İkon", t: "icon" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 },
        { k: "description", l: "Açıklama (TR)", t: "ta", wide: 1, rows: 3 },
        { k: "description_en", l: "Açıklama (EN)", t: "ta", wide: 1, rows: 3 },
        { k: "features", l: "Özellikler (TR) — her satıra bir madde", t: "lines", wide: 1 },
        { k: "features_en", l: "Özellikler (EN) — her satıra bir madde", t: "lines", wide: 1 }
      ]
    },
    {
      id: "skills", table: "skill_categories", label: "Yetenekler",
      desc: "Yetenek kategorileri ve seviyeleri (0-100).",
      titleKey: "title", subFn: function (r) { var a = parseArr(r.skills); return a.length + " yetenek"; },
      fields: [
        { k: "title", l: "Kategori (TR)" },
        { k: "title_en", l: "Kategori (EN)" },
        { k: "icon", l: "İkon", t: "icon" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 },
        { k: "skills", l: "Yetenekler", t: "skills", wide: 1 }
      ]
    },
    {
      id: "projects", table: "projects", label: "Projeler",
      desc: "Portföy projeleri. 'Öne Çıkan' işaretlenenler hero bölümünde gösterilir.",
      titleKey: "title", subFn: function (r) { return [r.category, r.year, r.client].filter(Boolean).join(" · "); },
      fields: [
        { k: "title", l: "Başlık (TR)" },
        { k: "title_en", l: "Başlık (EN)" },
        { k: "slug", l: "Kısa Ad", ph: "proje-adi" },
        { k: "category", l: "Kategori", t: "sel", opts: [["web", "Web"], ["mobile", "Mobil"]] },
        { k: "year", l: "Yıl", ph: "2024" },
        { k: "client", l: "Müşteri" },
        { k: "image", l: "Görsel Yolu", ph: "/projects/proje.png" },
        { k: "link", l: "Bağlantı", ph: "#" },
        { k: "preview_html", l: "Önizleme Sayfası", ph: "/projects/proje.html", wide: 1 },
        { k: "featured", l: "Öne Çıkan (hero'da gösterilir)", t: "bool" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 },
        { k: "description", l: "Kısa Açıklama (TR)", t: "ta", wide: 1, rows: 3 },
        { k: "description_en", l: "Kısa Açıklama (EN)", t: "ta", wide: 1, rows: 3 },
        { k: "long_description", l: "Detaylı Açıklama (TR)", t: "ta", wide: 1, rows: 5 },
        { k: "long_description_en", l: "Detaylı Açıklama (EN)", t: "ta", wide: 1, rows: 5 },
        { k: "tags", l: "Etiketler (virgülle ayır)", t: "csv", wide: 1 }
      ]
    },
    {
      id: "experience", table: "experiences", label: "Deneyim",
      desc: "İş deneyimi zaman çizelgesi.",
      titleKey: "role", subFn: function (r) { return [r.company, r.period].filter(Boolean).join(" · "); },
      fields: [
        { k: "role", l: "Pozisyon (TR)" },
        { k: "role_en", l: "Pozisyon (EN)" },
        { k: "company", l: "Şirket" },
        { k: "period", l: "Dönem", ph: "2021 — Günümüz" },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 },
        { k: "description", l: "Açıklama (TR)", t: "ta", wide: 1, rows: 3 },
        { k: "description_en", l: "Açıklama (EN)", t: "ta", wide: 1, rows: 3 },
        { k: "highlights", l: "Öne Çıkanlar (TR) — her satıra bir madde", t: "lines", wide: 1 },
        { k: "highlights_en", l: "Öne Çıkanlar (EN) — her satıra bir madde", t: "lines", wide: 1 }
      ]
    },
    {
      id: "testimonials", table: "testimonials", label: "Yorumlar",
      desc: "Müşteri yorumları.",
      titleKey: "name", subFn: function (r) { return [r.company, r.rating ? "★ " + r.rating : ""].filter(Boolean).join(" · "); },
      fields: [
        { k: "name", l: "Kişi" },
        { k: "company", l: "Şirket" },
        { k: "role", l: "Ünvan (TR)" },
        { k: "role_en", l: "Ünvan (EN)" },
        { k: "avatar", l: "Baş Harfler", ph: "ED" },
        { k: "rating", l: "Puan (1-5)", t: "num", def: 5 },
        { k: "sort_order", l: "Sıra", t: "num", def: 0 },
        { k: "content", l: "Yorum (TR)", t: "ta", wide: 1, rows: 4 },
        { k: "content_en", l: "Yorum (EN)", t: "ta", wide: 1, rows: 4 }
      ]
    },
    {
      id: "messages", table: "contact_messages", label: "Mesajlar", readOnly: true,
      order: "created_at.desc",
      desc: "İletişim formundan gelen mesajlar."
    }
  ];

  /* ---- Durum ---- */
  var S = { loaded: false, loading: false, entity: "profile", rows: {}, inForm: false, formId: null, formIsNew: false, draft: null, saving: false };

  /* ---- Yardımcılar ---- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function BR() { return window.AliblogBridge || { toast: function () {}, status: function () {} }; }
  function parseArr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string" || !v.trim()) return [];
    try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function fmtDT(iso) {
    try { return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return "—"; }
  }

  function sb(method, path, body) {
    return fetch(SB_URL + path, {
      method: method,
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var msg = (data && (data.message || data.error)) || ("HTTP " + r.status);
          var err = new Error(msg);
          err.apiMessage = msg;
          throw err;
        }
        return data;
      });
    });
  }

  function entById(id) {
    for (var i = 0; i < ENT.length; i++) if (ENT[i].id === id) return ENT[i];
    return null;
  }
  function rowsOf(ent) { return S.rows[ent.table] || []; }

  /* ---- Veri yükleme ---- */
  function loadAll() {
    S.loading = true;
    renderBody();
    BR().status("Site içeriği yükleniyor...", "busy");
    var jobs = ENT.map(function (ent) {
      var order = ent.order || (hasSort(ent) ? "sort_order.asc" : null);
      var path = "/" + ent.table + "?select=*" + (order ? "&order=" + order : "");
      return sb("GET", path).then(function (rows) {
        S.rows[ent.table] = rows || [];
      });
    });
    return Promise.all(jobs).then(function () {
      S.loaded = true; S.loading = false;
      BR().status("Site içeriği hazır (canlı — kaydedince anında yayına girer).", "ok");
      renderRail();
      renderBody();
    }).catch(function (err) {
      S.loading = false;
      BR().status("Site içeriği alınamadı: " + err.apiMessage, "err");
      BR().toast("Veri alınamadı: " + err.apiMessage, "err");
      renderBody();
    });
  }
  function hasSort(ent) {
    return ent.fields && ent.fields.some(function (f) { return f.k === "sort_order"; });
  }
  function reloadEnt(ent) {
    var order = ent.order || (hasSort(ent) ? "sort_order.asc" : null);
    return sb("GET", "/" + ent.table + "?select=*" + (order ? "&order=" + order : "")).then(function (rows) {
      S.rows[ent.table] = rows || [];
      renderRail();
    });
  }

  /* ---- Şerit (varlık sekmeleri) ---- */
  function renderRail() {
    var rail = $("siteRail");
    if (!rail) return;
    rail.innerHTML = ENT.map(function (ent) {
      var n = ent.single ? "" : '<span class="sr-count">' + (ent.readOnly ? "" : rowsOf(ent).length) + "</span>";
      var act = S.entity === ent.id ? " is-active" : "";
      return '<button type="button" class="sr-btn' + act + '" data-ent="' + ent.id + '">' +
        esc(ent.label) + (ent.readOnly ? "" : n) + "</button>";
    }).join("");
    rail.querySelectorAll("[data-ent]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.entity = b.getAttribute("data-ent");
        S.formId = null; S.formIsNew = false; S.inForm = false;
        renderRail(); renderBody();
      });
    });
  }

  /* ---- Gövde render ---- */
  function renderBody() {
    var body = $("siteBody");
    if (!body) return;
    var ent = entById(S.entity);
    if (!ent) return;

    if (S.loading) {
      body.innerHTML = '<div class="site-empty"><p>Yükleniyor...</p></div>';
      return;
    }
    if (!S.loaded) {
      body.innerHTML = '<div class="site-empty"><p>Veri yüklenemedi. Tekrar denemek için sayfayı yenile.</p></div>';
      return;
    }

    var title = $("siteTitle");
    if (title) title.textContent = ent.label;
    var hint = $("siteHint");
    if (hint) hint.textContent = ent.desc || "";

    if (S.inForm) { renderForm(ent); return; }
    if (ent.single) { openForm(ent, "profile", false); return; }
    if (ent.readOnly) { renderMessages(ent); return; }
    renderList(ent);
  }

  function renderList(ent) {
    var body = $("siteBody");
    var rows = rowsOf(ent);
    var html =
      '<div class="list-bar">' +
        '<h3 class="sec-sub">' + esc(ent.label) + ' <small>(' + rows.length + ' kayıt)</small></h3>' +
        '<button type="button" class="btn-primary" id="siteNewBtn">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>' +
          "Yeni Ekle</button>" +
      "</div>";

    if (!rows.length) {
      html += '<div class="site-empty"><p>Kayıt yok. "Yeni Ekle" ile ilk kaydı oluştur.</p></div>';
      body.innerHTML = html;
      $("siteNewBtn").addEventListener("click", function () { openForm(ent, null, true); });
      return;
    }

    html += '<div class="post-list">' + rows.map(function (r) {
      var t = r[ent.titleKey] || "(başlıksız)";
      var sub = ent.subFn ? ent.subFn(r) : (ent.subKey ? (r[ent.subKey] || "") : "");
      if (typeof sub !== "string") sub = String(sub == null ? "" : sub);
      return '<div class="pl-item">' +
        '<div class="pl-main">' +
          '<div class="pl-title">' + esc(t) + "</div>" +
          (sub ? '<div class="pl-meta"><span>' + esc(sub.slice(0, 120)) + "</span></div>" : "") +
        "</div>" +
        '<div class="pl-actions">' +
          '<button type="button" class="btn-icon" data-sedit="' + esc(r.id) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>Düzenle</button>' +
          '<button type="button" class="btn-icon danger" data-sdel="' + esc(r.id) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>Sil</button>' +
        "</div>" +
      "</div>";
    }).join("") + "</div>";

    body.innerHTML = html;
    $("siteNewBtn").addEventListener("click", function () { openForm(ent, null, true); });
    body.querySelectorAll("[data-sedit]").forEach(function (b) {
      b.addEventListener("click", function () { openForm(ent, b.getAttribute("data-sedit"), false); });
    });
    body.querySelectorAll("[data-sdel]").forEach(function (b) {
      b.addEventListener("click", function () { askDelete(ent, b.getAttribute("data-sdel")); });
    });
  }

  function renderMessages(ent) {
    var body = $("siteBody");
    var rows = rowsOf(ent);
    var html = '<div class="list-bar"><h3 class="sec-sub">Mesajlar <small>(' + rows.length + ')</small></h3></div>';
    if (!rows.length) {
      html += '<div class="site-empty"><p>Henüz mesaj yok. İletişim formundan mesaj geldiğinde burada görünecek.</p></div>';
      body.innerHTML = html;
      return;
    }
    html += '<div class="msg-list">' + rows.map(function (r) {
      return '<div class="msg-card">' +
        '<div class="msg-head">' +
          '<div><div class="msg-name">' + esc(r.name || "—") + "</div>" +
          '<div class="msg-mail">' + esc(r.email || "") + "</div></div>" +
          '<div class="msg-right"><span class="msg-date">' + esc(fmtDT(r.created_at)) + "</span>" +
          '<button type="button" class="btn-icon danger" data-mdel="' + esc(r.id) + '">Sil</button></div>' +
        "</div>" +
        (r.subject ? '<div class="msg-subject">' + esc(r.subject) + "</div>" : "") +
        '<div class="msg-body">' + esc(r.message || "").replace(/\n/g, "<br/>") + "</div>" +
        (r.budget ? '<div class="msg-budget">Bütçe: ' + esc(r.budget) + "</div>" : "") +
      "</div>";
    }).join("") + "</div>";
    body.innerHTML = html;
    body.querySelectorAll("[data-mdel]").forEach(function (b) {
      b.addEventListener("click", function () { askDelete(ent, b.getAttribute("data-mdel")); });
    });
  }

  /* ---- Silme ---- */
  function askDelete(ent, id) {
    var rows = rowsOf(ent);
    var row = null;
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) { row = rows[i]; break; }
    if (!row) return;
    var label = row[ent.titleKey] || row.name || row.label || row.role || "kayıt";
    var mask = document.createElement("div");
    mask.className = "confirm-mask";
    mask.innerHTML =
      '<div class="confirm-box">' +
        "<h3>Silinsin mi?</h3>" +
        '<p>"' + esc(label) + '" kalıcı olarak silinecek. Bu işlem canlı siteye anında yansır.</p>' +
        '<div class="confirm-actions">' +
          '<button type="button" class="btn-ghost" data-no>Vazgeç</button>' +
          '<button type="button" class="btn-primary" data-yes>Evet, Sil</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(mask);
    mask.querySelector("[data-no]").addEventListener("click", function () { mask.remove(); });
    mask.querySelector("[data-yes]").addEventListener("click", function () {
      mask.remove();
      BR().status("Siliniyor...", "busy");
      sb("DELETE", "/" + ent.table + "?id=eq." + encodeURIComponent(id)).then(function () {
        return reloadEnt(ent);
      }).then(function () {
        BR().status("Silindi.", "ok");
        BR().toast("Silindi ✓ (canlı site anında güncellendi)", "ok");
        renderBody();
      }).catch(function (err) {
        BR().status("Silinemedi: " + err.apiMessage, "err");
        BR().toast("Silinemedi: " + err.apiMessage, "err");
      });
    });
  }

  /* ---- Form ---- */
  function openForm(ent, id, isNew) {
    S.inForm = true; S.formId = id; S.formIsNew = !!isNew;
    var row = null;
    if (id) {
      var rows = rowsOf(ent);
      for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) { row = rows[i]; break; }
      if (!row && ent.single) row = null; // profil satırı yoksa yeni oluştur gibi davran
    }
    S.draft = row ? JSON.parse(JSON.stringify(row)) : newRow(ent);
    renderBody();
  }

  function newRow(ent) {
    var row = {};
    var maxSort = 0;
    rowsOf(ent).forEach(function (r) { if ((r.sort_order || 0) > maxSort) maxSort = r.sort_order || 0; });
    ent.fields.forEach(function (f) {
      if (f.t === "bool") row[f.k] = false;
      else if (f.k === "sort_order") row[f.k] = maxSort + 1;
      else if (f.def !== undefined) row[f.k] = f.def;
      else row[f.k] = "";
    });
    if (ent.table === "projects" && !row.slug) row.slug = "proje-" + Date.now();
    if (ent.id === "testimonials") row.rating = 5;
    return row;
  }

  function fieldToInput(f, val) {
    var t = f.t || "text";
    var idAttr = ' id="sf_' + f.k + '"';
    if (t === "bool") {
      return '<label class="chk chk-wide"><input type="checkbox"' + idAttr + (val ? " checked" : "") + "/><span>" + esc(f.l) + "</span></label>";
    }
    var label = '<span>' + esc(f.l) + (f.hint ? " <small>" + esc(f.hint) + "</small>" : "") + "</span>";
    if (t === "ta") {
      return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
        '<textarea class="inp" rows="' + (f.rows || 3) + '"' + idAttr + ">" + esc(val) + "</textarea></label>";
    }
    if (t === "sel") {
      var opts = f.opts.slice();
      if (val && !opts.some(function (o) { return o[0] === val; })) opts.push([val, val]);
      return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
        '<select class="inp"' + idAttr + ">" + opts.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select></label>";
    }
    if (t === "icon") {
      return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
        '<input class="inp" list="aliIconList" spellcheck="false"' + idAttr + ' value="' + esc(val) + '"/></label>';
    }
    if (t === "num") {
      return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
        '<input type="number" class="inp"' + idAttr + ' value="' + esc(val == null ? "" : val) + '"/></label>';
    }
    if (t === "lines" || t === "csv") {
      var txt = t === "lines" ? parseArr(val).join("\n") : parseArr(val).join(", ");
      var ph = t === "lines" ? "Her satıra bir madde yaz" : "virgülle ayır";
      return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
        '<textarea class="inp" rows="' + (t === "lines" ? 4 : 2) + '" placeholder="' + ph + '"' + idAttr + ">" + esc(txt) + "</textarea></label>";
    }
    if (t === "skills") return ""; // özel render
    return '<label class="fld' + (f.wide ? " fld-wide" : "") + '">' + label +
      '<input type="text" class="inp" spellcheck="false" placeholder="' + esc(f.ph || "") + '"' + idAttr + ' value="' + esc(val) + '"/></label>';
  }

  function skillsEditorHtml(val) {
    var list = parseArr(val).map(function (s) {
      if (typeof s === "string") s = { name: s, level: 80 };
      return { name: s.name || "", level: s.level == null ? 80 : s.level };
    });
    if (!list.length) list = [{ name: "", level: 80 }];
    var rows = list.map(function (s, i) {
      return '<div class="sk-row" data-ski="' + i + '">' +
        '<input type="text" class="inp sk-name" placeholder="Yetenek adı (örn. React Native)" value="' + esc(s.name) + '"/>' +
        '<input type="number" class="inp sk-level" min="0" max="100" title="Seviye (0-100)" value="' + esc(s.level) + '"/>' +
        '<button type="button" class="btn-icon danger sk-del" title="Kaldır">×</button>' +
      "</div>";
    }).join("");
    return '<div class="fld fld-wide"><span>Yetenekler <small>(seviye 0-100)</small></span>' +
      '<div class="sk-wrap" id="skWrap">' + rows + "</div>" +
      '<div><button type="button" class="btn-ghost btn-sm" id="skAdd">+ Yetenek Ekle</button></div></div>';
  }

  function renderForm(ent) {
    var body = $("siteBody");
    var d = S.draft;
    var isNew = S.formIsNew;
    var title = isNew ? ent.label + " — Yeni Kayıt" : ent.label + " — Düzenle";
    if (ent.single) title = "Profil — Düzenle";

    var fieldsHtml = "";
    var skillsDone = false;
    ent.fields.forEach(function (f) {
      if (f.t === "skills") { fieldsHtml += skillsEditorHtml(d[f.k]); skillsDone = true; return; }
      fieldsHtml += fieldToInput(f, d[f.k]);
    });

    body.innerHTML =
      '<div class="ed-head">' +
        '<h3 class="sec-sub">' + esc(title) + "</h3>" +
        '<div class="ed-actions">' +
          '<button type="button" class="btn-ghost" id="siteBackBtn">' + (ent.single ? "" : "Vazgeç") + "</button>" +
          '<button type="button" class="btn-primary" id="siteSaveBtn">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
            "Kaydet" +
          "</button>" +
        "</div>" +
      "</div>" +
      (isNew ? "" : '<p class="site-note">Bu kayıt canlı sitede şu an yayında. Kaydet tuşuna basınca değişiklik anında uygulanır.</p>') +
      '<form id="siteForm" class="ed-grid" onsubmit="return false">' + fieldsHtml + "</form>";

    // skills editor events
    var skWrap = $("skWrap");
    if (skWrap) {
      skWrap.addEventListener("click", function (e) {
        var del = e.target.closest(".sk-del");
        if (del) {
          var rowEl = del.closest(".sk-row");
          if (skWrap.querySelectorAll(".sk-row").length > 1) rowEl.remove();
          else { rowEl.querySelector(".sk-name").value = ""; rowEl.querySelector(".sk-level").value = 80; }
        }
      });
      var addBtn = $("skAdd");
      if (addBtn) addBtn.addEventListener("click", function () {
        var div = document.createElement("div");
        div.className = "sk-row";
        div.innerHTML = '<input type="text" class="inp sk-name" placeholder="Yetenek adı"/>' +
          '<input type="number" class="inp sk-level" min="0" max="100" value="80"/>' +
          '<button type="button" class="btn-icon danger sk-del" title="Kaldır">×</button>';
        skWrap.appendChild(div);
        div.querySelector(".sk-name").focus();
      });
    }

    $("siteSaveBtn").addEventListener("click", function () { saveForm(ent); });
    var back = $("siteBackBtn");
    if (back) back.addEventListener("click", function () {
      S.inForm = false; S.formId = null; S.formIsNew = false; S.draft = null;
      renderBody();
    });
    window.scrollTo(0, 0);
  }

  function collectForm(ent) {
    var out = {};
    ent.fields.forEach(function (f) {
      var el = $("sf_" + f.k);
      var t = f.t || "text";
      if (t === "skills") {
        var list = [];
        document.querySelectorAll("#skWrap .sk-row").forEach(function (r) {
          var name = r.querySelector(".sk-name").value.trim();
          var level = parseInt(r.querySelector(".sk-level").value, 10);
          if (name) list.push({ name: name, level: isNaN(level) ? 80 : Math.max(0, Math.min(100, level)) });
        });
        out[f.k] = JSON.stringify(list);
        return;
      }
      if (t === "bool") { out[f.k] = el.checked; return; }
      var v = el.value;
      if (t === "num") {
        if (v === "") out[f.k] = f.def !== undefined ? f.def : null;
        else out[f.k] = parseInt(v, 10);
        return;
      }
      if (t === "lines") { out[f.k] = JSON.stringify(v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean)); return; }
      if (t === "csv") { out[f.k] = JSON.stringify(v.split(",").map(function (x) { return x.trim(); }).filter(Boolean)); return; }
      out[f.k] = v;
    });
    return out;
  }

  function saveForm(ent) {
    var payload = collectForm(ent);
    // temel doğrulama: tek zorlu alan — ilk metin alanı boş olmasın
    var firstText = ent.fields.filter(function (f) { return !f.t || f.t === "text"; })[0];
    if (firstText && !String(payload[firstText.k] || "").trim()) {
      BR().toast(firstText.l + " boş olamaz.", "err");
      var el = $("sf_" + firstText.k); if (el) el.focus();
      return;
    }
    var btn = $("siteSaveBtn");
    btn.disabled = true;
    BR().status("Kaydediliyor...", "busy");
    var isNew = S.formIsNew;
    var p;
    if (isNew) {
      p = sb("POST", "/" + ent.table, payload);
    } else if (ent.single) {
      p = sb("PATCH", "/" + ent.table + "?id=eq." + encodeURIComponent(S.formId), payload);
    } else {
      p = sb("PATCH", "/" + ent.table + "?id=eq." + encodeURIComponent(S.formId), payload);
    }
    p.then(function () {
      return reloadEnt(ent);
    }).then(function () {
      btn.disabled = false;
      S.inForm = false; S.formId = null; S.formIsNew = false; S.draft = null;
      BR().status("Kaydedildi — canlı sitede anında yayında.", "ok");
      BR().toast(isNew ? "Eklendi ✓" : "Kaydedildi ✓ (canlı site anında güncellendi)", "ok");
      renderBody();
    }).catch(function (err) {
      btn.disabled = false;
      BR().status("Kaydedilemedi: " + err.apiMessage, "err");
      BR().toast("Kaydedilemedi: " + err.apiMessage, "err");
    });
  }

  /* ---- Dış arayüz ---- */
  window.SiteAdmin = {
    show: function () {
      if (!S.loaded && !S.loading) loadAll();
      else { renderRail(); renderBody(); }
    },
    reset: function () {
      S.loaded = false; S.loading = false; S.entity = "profile";
      S.rows = {}; S.inForm = false; S.formId = null; S.formIsNew = false; S.draft = null;
    }
  };
})();
