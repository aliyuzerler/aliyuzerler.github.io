/* ============================================================
   ALIBLOG v1 — admin/admin.js
   GitHub Contents API ile data/posts.json CRUD.
   Kimlik doğrulama: kullanıcının kendi GitHub PAT'i
   (localStorage/sessionStorage'da saklanır; hiçbir yerde gösterilmez).
   Hazır şifre/örnek kimlik bilgisi YOKTUR.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Sabitler ---------- */
  var REPO = "aliyuzerler/aliyuzerler.github.io";
  var BRANCH = "main";
  var FILE_PATH = "data/posts.json";
  var API = "https://api.github.com/repos/" + REPO + "/contents/" + FILE_PATH;
  var LS_KEY = "ali_admin_gh_token";
  var SS_KEY = "ali_admin_gh_token_s";

  var CATS = [
    { id: "ekonomi", label: "Ekonomi" },
    { id: "borsa", label: "Borsa" },
    { id: "yapay-zeka", label: "Yapay Zeka" },
    { id: "kisisel-gelisim", label: "Kişisel Gelişim" },
    { id: "gundem", label: "Gündem" }
  ];

  /* ---------- Durum ---------- */
  var token = null;
  var fileSha = null;
  var data = null;        // {version, updatedAt, posts:[]}
  var editingId = null;   // null => yeni yazı
  var slugTouched = false;

  /* ---------- Yardımcılar ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function catLabel(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].label;
    return id;
  }
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return "—"; }
  }
  function fmtDateTime(iso) {
    try {
      return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return "—"; }
  }

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- GitHub API ---------- */
  function ghHeaders() {
    return {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }

  function ghGet() {
    return fetch(API + "?ref=" + BRANCH + "&t=" + Date.now(), {
      headers: ghHeaders(), cache: "no-store"
    }).then(function (r) {
      if (r.status === 404) return { notFound: true };
      if (r.status === 401) throw new Error("AUTH");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function ghPut(jsonText, message) {
    var body = {
      message: message,
      content: b64encode(jsonText),
      branch: BRANCH
    };
    if (fileSha) body.sha = fileSha;
    return fetch(API, {
      method: "PUT", headers: ghHeaders(), body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 409) throw new Error("CONFLICT");
      if (r.status === 401) throw new Error("AUTH");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------- Bildirimler ---------- */
  var toastTimer = null;
  function toast(msg, kind) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast " + (kind || "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function status(msg, kind) {
    var el = $("statusMsg");
    el.textContent = msg || "";
    el.className = "status-msg " + (kind || "");
  }

  /* site.js'in kullanacağı köprü */
  window.AliblogBridge = { toast: toast, status: status };

  /* ---------- Tema ---------- */
  $("themeBtn").addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.classList.contains("dark");
    if (dark) root.classList.remove("dark"); else root.classList.add("dark");
    try { localStorage.setItem("theme", dark ? "light" : "dark"); } catch (e) {}
  });

  /* ---------- Oturum ---------- */
  function saveToken(remember) {
    try {
      if (remember) { localStorage.setItem(LS_KEY, token); sessionStorage.removeItem(SS_KEY); }
      else { sessionStorage.setItem(SS_KEY, token); localStorage.removeItem(LS_KEY); }
    } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(LS_KEY); sessionStorage.removeItem(SS_KEY); } catch (e) {}
    token = null;
  }
  function loadStoredToken() {
    try {
      return localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY) || null;
    } catch (e) { return null; }
  }

  function logout() {
    clearToken();
    data = null; fileSha = null; editingId = null;
    if (window.SiteAdmin) window.SiteAdmin.reset();
    $("panel").hidden = true;
    $("gate").hidden = false;
    $("tokenInput").value = "";
    $("gateErr").hidden = true;
  }

  /* ---------- Veri akışı ---------- */
  function parseData(jsonText) {
    var obj;
    try { obj = JSON.parse(jsonText); } catch (e) { throw new Error("BADJSON"); }
    if (!obj || !Array.isArray(obj.posts)) throw new Error("BADJSON");
    return obj;
  }

  function initData() {
    status("Veriler yükleniyor...", "busy");
    return ghGet().then(function (res) {
      if (res.notFound) {
        // dosya yok — boş veri seti oluştur (ilk kayıtta oluşur)
        data = { version: 1, updatedAt: new Date().toISOString(), posts: [] };
        fileSha = null;
      } else {
        data = parseData(b64decode(res.content));
        fileSha = res.sha;
      }
      $("fileMeta").textContent =
        "data/posts.json · son güncelleme: " + fmtDateTime(data.updatedAt) +
        (fileSha ? " · " + String(fileSha).slice(0, 7) : " · henüz GitHub'da yok");
      renderList();
      status("Veriler hazır.", "ok");
    }).catch(function (err) {
      if (err.message === "AUTH") { gateError("Anahtar geçersiz veya süresi dolmuş görünüyor. Kontrol edip tekrar dene."); throw err; }
      if (err.message === "BADJSON") { gateError("posts.json biçimi bozuk görünüyor. Depoda dosyayı kontrol et."); throw err; }
      gateError("Veri alınamadı (" + err.message + "). İnternet bağlantını ve anahtar yetkilerini kontrol et.");
      throw err;
    });
  }

  function commitData(message) {
    data.updatedAt = new Date().toISOString();
    var jsonText = JSON.stringify(data, null, 2) + "\n";
    status("GitHub'a gönderiliyor...", "busy");
    setBusy(true);
    return ghPut(jsonText, message).then(function (res) {
      if (res && res.content && res.content.sha) fileSha = res.content.sha;
      $("fileMeta").textContent =
        "data/posts.json · son güncelleme: " + fmtDateTime(data.updatedAt) +
        (fileSha ? " · " + String(fileSha).slice(0, 7) : "");
      status("Kaydedildi — canlı site 1-2 dakika içinde güncellenir.", "ok");
      toast("GitHub'a kaydedildi ✓", "ok");
      renderList();
    }).catch(function (err) {
      if (err.message === "AUTH") { toast("Yetki hatası — anahtar geçersiz olabilir.", "err"); status("Yetki hatası.", "err"); }
      else if (err.message === "CONFLICT") {
        status("Sürüm çakışması — veriler yeniden yükleniyor...", "err");
        toast("Çakışma: dosya başka bir yerden değişmiş. Değişikliklerini tekrar uygula.", "err");
        return initData();
      }
      else { status("Kaydedilemedi (" + err.message + ")", "err"); toast("Kaydedilemedi: " + err.message, "err"); }
      throw err;
    }).finally(function () { setBusy(false); });
  }

  function setBusy(b) {
    $("saveBtn").disabled = b;
    $("gateBtn").disabled = b;
  }

  /* ---------- Sekmeler ---------- */
  /* Üst sekmeler: Site İçeriği (Supabase) | Blog (GitHub) */
  function switchTop(top) {
    var isSite = top === "site";
    $("viewSite").hidden = !isSite;
    $("blogWrap").hidden = isSite;
    $("tabSite").classList.toggle("is-active", isSite);
    $("tabBlog").classList.toggle("is-active", !isSite);
    $("tabSite").setAttribute("aria-selected", isSite ? "true" : "false");
    $("tabBlog").setAttribute("aria-selected", isSite ? "false" : "true");
    if (isSite && window.SiteAdmin) window.SiteAdmin.show();
    window.scrollTo(0, 0);
  }
  $("tabSite").addEventListener("click", function () { switchTop("site"); });
  $("tabBlog").addEventListener("click", function () { switchTop("blog"); });

  /* Blog alt sekmeleri: Yazılar | Düzenleyici */
  function switchTab(tab) {
    var isList = tab === "list";
    $("viewList").hidden = !isList;
    $("viewEditor").hidden = isList;
    $("tabList").classList.toggle("is-active", isList);
    $("tabEditor").classList.toggle("is-active", !isList);
    $("tabList").setAttribute("aria-selected", isList ? "true" : "false");
    $("tabEditor").setAttribute("aria-selected", isList ? "false" : "true");
    if (!isList) {
      $("edTitle").textContent = editingId ? "Yazıyı Düzenle" : "Yeni Yazı";
      if (!$("previewWrap").hidden) renderPreview();
    }
    window.scrollTo(0, 0);
  }
  $("tabList").addEventListener("click", function () { switchTab("list"); });
  $("tabEditor").addEventListener("click", function () { switchTab("editor"); });

  /* ---------- Liste ---------- */
  function renderList() {
    var posts = (data.posts || []).slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    var pub = posts.filter(function (p) { return p.published !== false; }).length;

    $("statsRow").innerHTML =
      stat(posts.length, "Toplam Yazı") +
      stat(pub, "Yayında") +
      stat(posts.length - pub, "Taslak") +
      stat(CATS.length, "Kategori");

    if (!posts.length) {
      $("postList").innerHTML =
        '<div class="pl-item" style="justify-content:center;text-align:center">' +
        '<div><p style="margin:0 0 .3rem;font-weight:700">Henüz yazı yok</p>' +
        '<p style="margin:0;font-size:.85rem;color:var(--muted-foreground)">"Yeni Yazı" ile ilk blog yazını ekle.</p></div></div>';
      return;
    }

    $("postList").innerHTML = posts.map(function (p) {
      var cc = "--cc:var(--cc-" + esc(p.category) + ")";
      return '<div class="pl-item" style="' + cc + '">' +
        '<div class="pl-main">' +
          '<div class="pl-title">' + esc(p.title) + "</div>" +
          '<div class="pl-meta">' +
            '<span class="cat-chip">' + esc(catLabel(p.category)) + "</span>" +
            '<span class="badge-pub ' + (p.published !== false ? "on" : "off") + '">' + (p.published !== false ? "Yayında" : "Taslak") + "</span>" +
            "<span>" + fmtDate(p.createdAt) + "</span>" +
            "<span>/" + esc(p.slug || "") + "</span>" +
          "</div>" +
        "</div>" +
        '<div class="pl-actions">' +
          '<button type="button" class="btn-icon" data-edit="' + esc(p.id) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>Düzenle</button>' +
          '<button type="button" class="btn-icon danger" data-del="' + esc(p.id) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>Sil</button>' +
        "</div>" +
      "</div>";
    }).join("");

    $("postList").querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { openEditor(b.getAttribute("data-edit")); });
    });
    $("postList").querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () { askDelete(b.getAttribute("data-del")); });
    });
  }

  function stat(n, label) {
    return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + esc(label) + "</div></div>";
  }

  /* ---------- Silme ---------- */
  function askDelete(id) {
    var p = data.posts.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var mask = document.createElement("div");
    mask.className = "confirm-mask";
    mask.innerHTML =
      '<div class="confirm-box">' +
        "<h3>Yazıyı sil?</h3>" +
        '<p>"' + esc(p.title) + '" kalıcı olarak silinecek ve değişiklik GitHub\'a kaydedilecek.</p>' +
        '<div class="confirm-actions">' +
          '<button type="button" class="btn-ghost" data-no>Vazgeç</button>' +
          '<button type="button" class="btn-primary" data-yes>Evet, Sil</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(mask);
    mask.querySelector("[data-no]").addEventListener("click", function () { mask.remove(); });
    mask.querySelector("[data-yes]").addEventListener("click", function () {
      mask.remove();
      data.posts = data.posts.filter(function (x) { return x.id !== id; });
      commitData("blog: yazı silindi — " + p.title).catch(function () {});
    });
  }

  /* ---------- Düzenleyici ---------- */
  function slugify(text) {
    return String(text || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g").replace(/Ç/g, "c").replace(/ç/g, "c")
      .replace(/ş/g, "s").replace(/ı/g, "i").replace(/İ/g, "i")
      .replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90);
  }

  function openEditor(id) {
    editingId = id || null;
    slugTouched = !!id;
    var p = null;
    if (id) {
      p = data.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) { editingId = null; }
    }
    $("fTitle").value = p ? p.title : "";
    $("fSlug").value = p ? (p.slug || "") : "";
    $("fCat").value = p ? (p.category || "ekonomi") : "ekonomi";
    $("fTags").value = p && p.tags ? p.tags.join(", ") : "";
    $("fExcerpt").value = p ? (p.excerpt || "") : "";
    $("fContent").value = p ? (p.content || "") : "";
    $("fPublished").checked = p ? p.published !== false : true;
    hidePreview();
    switchTab("editor");
    $("fTitle").focus();
  }

  $("newBtn").addEventListener("click", function () { openEditor(null); });
  $("cancelBtn").addEventListener("click", function () {
    editingId = null;
    switchTab("list");
  });
  $("logoutBtn").addEventListener("click", logout);

  // Slug üretimi
  $("slugBtn").addEventListener("click", function () {
    $("fSlug").value = slugify($("fTitle").value);
    slugTouched = true;
  });
  $("fTitle").addEventListener("input", function () {
    if (!slugTouched) $("fSlug").value = slugify($("fTitle").value);
  });
  $("fSlug").addEventListener("input", function () { slugTouched = true; });

  // Markdown araç çubuğu
  document.querySelectorAll(".md-tool").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ta = $("fContent");
      var s = ta.selectionStart, e = ta.selectionEnd;
      var sel = ta.value.slice(s, e);
      var kind = btn.getAttribute("data-md");
      var ins = sel, wrapBefore = "", wrapAfter = "", linePrefix = "";
      if (kind === "h2") { linePrefix = "## "; }
      else if (kind === "h3") { linePrefix = "### "; }
      else if (kind === "b") { wrapBefore = "**"; wrapAfter = "**"; }
      else if (kind === "i") { wrapBefore = "*"; wrapAfter = "*"; }
      else if (kind === "link") { wrapBefore = "["; wrapAfter = "](https://)"; }
      else if (kind === "quote") { linePrefix = "> "; }
      else if (kind === "code") { wrapBefore = "```\n"; wrapAfter = "\n```"; }
      else if (kind === "list") { linePrefix = "- "; }
      if (linePrefix) {
        var lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
        ta.value = ta.value.slice(0, lineStart) + linePrefix + ta.value.slice(lineStart);
        ta.selectionStart = ta.selectionEnd = e + linePrefix.length;
      } else {
        ins = wrapBefore + (sel || "metin") + wrapAfter;
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
        ta.selectionStart = s + wrapBefore.length;
        ta.selectionEnd = s + wrapBefore.length + (sel || "metin").length;
      }
      ta.focus();
      renderPreview();
    });
  });

  // Önizleme
  function renderPreview() {
    $("previewBox").innerHTML = mdToHtml($("fContent").value);
  }
  function showPreview() {
    renderPreview();
    $("previewWrap").hidden = false;
    $("previewBtn").textContent = "Önizlemeyi Kapat";
  }
  function hidePreview() {
    $("previewWrap").hidden = true;
    $("previewBtn").textContent = "Önizleme";
  }
  $("previewBtn").addEventListener("click", function () {
    if ($("previewWrap").hidden) showPreview(); else hidePreview();
  });
  $("fContent").addEventListener("input", function () {
    if (!$("previewWrap").hidden) renderPreview();
  });

  // Kaydet
  $("saveBtn").addEventListener("click", function () {
    var title = $("fTitle").value.trim();
    var slug = slugify($("fSlug").value.trim() || $("fTitle").value);
    var content = $("fContent").value;
    if (!title) { toast("Başlık gerekli.", "err"); $("fTitle").focus(); return; }
    if (!slug) { toast("Kısa ad (slug) gerekli.", "err"); $("fSlug").focus(); return; }
    if (!content.trim()) { toast("İçerik gerekli.", "err"); $("fContent").focus(); return; }

    // slug benzersizliği
    var clash = data.posts.filter(function (x) {
      return x.slug === slug && x.id !== editingId;
    })[0];
    if (clash) { toast("Bu kısa ad başka bir yazıda kullanılıyor: " + clash.title, "err"); $("fSlug").focus(); return; }

    var tags = $("fTags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var excerpt = $("fExcerpt").value.trim() || autoExcerpt(content);

    var now = new Date().toISOString();
    var post = null;
    if (editingId) {
      post = data.posts.filter(function (x) { return x.id === editingId; })[0];
    }
    var isNew = !post;
    if (isNew) {
      post = { id: "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: now };
      data.posts.push(post);
    }
    post.title = title;
    post.slug = slug;
    post.category = $("fCat").value;
    post.tags = tags;
    post.excerpt = excerpt;
    post.content = content;
    post.published = $("fPublished").checked;
    post.updatedAt = now;

    editingId = null;
    commitData((isNew ? "blog: yeni yazı — " : "blog: yazı güncellendi — ") + title)
      .then(function () { switchTab("list"); })
      .catch(function () { switchTab("list"); renderList(); });
  });

  function autoExcerpt(md) {
    var t = String(md || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`~\[\]()!-]/g, " ")
      .replace(/\s+/g, " ").trim();
    return t.length > 180 ? t.slice(0, 177) + "..." : t;
  }

  /* ---------- Markdown (önizleme için) ---------- */
  function inlineFmt(s) {
    return s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, href) {
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  }
  function mdToHtml(md) {
    var lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    var out = [], i = 0, inUl = false;
    function closeLists() { if (inUl) { out.push("</ul>"); inUl = false; } }
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) {
        closeLists();
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeLists(); out.push("<h" + h[1].length + ">" + inlineFmt(esc(h[2])) + "</h" + h[1].length + ">"); i++; continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { closeLists(); out.push("<hr/>"); i++; continue; }
      if (/^>\s?/.test(line)) {
        closeLists();
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote><p>" + inlineFmt(esc(q.join(" "))) + "</p></blockquote>");
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        if (!inUl) { out.push("<ul>"); inUl = true; }
        out.push("<li>" + inlineFmt(esc(line.replace(/^\s*[-*]\s+/, ""))) + "</li>");
        i++; continue;
      }
      if (/^\s*$/.test(line)) { closeLists(); i++; continue; }
      closeLists();
      var p = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|```|>|\s*[-*]\s)/.test(lines[i])) { p.push(lines[i]); i++; }
      out.push("<p>" + inlineFmt(esc(p.join(" "))) + "</p>");
    }
    closeLists();
    return out.join("\n");
  }

  /* ---------- Giriş kapısı ---------- */
  function gateError(msg) {
    var el = $("gateErr");
    el.textContent = msg;
    el.hidden = false;
    if (msg.indexOf("Anahtar geçersiz") !== -1 || msg.indexOf("posts.json") !== -1) {
      // veri akışı başarısız — paneli açma
      $("panel").hidden = true;
      $("gate").hidden = false;
      if (msg.indexOf("Anahtar geçersiz") !== -1) clearToken();
    }
  }

  function tryEnter(tok, remember) {
    token = tok;
    setBusy(true);
    status("");
    initData()
      .then(function () {
        saveToken(remember);
        $("gate").hidden = true;
        $("panel").hidden = false;
        switchTab("list");
        switchTop("site");
        setBusy(false);
      })
      .catch(function () { setBusy(false); });
  }

  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var tok = $("tokenInput").value.trim();
    if (!tok) { gateError("Lütfen GitHub anahtarını (token) gir."); return; }
    $("gateErr").hidden = true;
    tryEnter(tok, $("rememberChk").checked);
  });

  /* ---------- Önyükleme ---------- */
  var stored = loadStoredToken();
  if (stored) {
    tryEnter(stored, true);
  } else {
    $("gate").hidden = false;
  }
})();
