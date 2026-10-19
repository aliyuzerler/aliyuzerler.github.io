/* ============================================================
   ALIBLOG v1 — blog/app.js
   Statik blog mantığı: tema, veri yükleme, hash router,
   kategori filtresi + arama, markdown okuyucu.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Sabitler ---------- */
  var DATA_URL = "/data/posts.json";
  var CATS = [
    { id: "ekonomi",          label: "Ekonomi" },
    { id: "borsa",            label: "Borsa" },
    { id: "yapay-zeka",       label: "Yapay Zeka" },
    { id: "kisisel-gelisim",  label: "Kişisel Gelişim" },
    { id: "gundem",           label: "Gündem" }
  ];

  /* ---------- Yardımcılar ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function catLabel(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].label;
    return id || "";
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }

  function readTime(text) {
    var words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200)) + " dk okuma";
  }

  function slugifyCat(id) { return id; }

  /* ---------- Tema ---------- */
  var themeBtn = $("themeBtn");
  themeBtn.addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.classList.contains("dark");
    if (dark) root.classList.remove("dark"); else root.classList.add("dark");
    try { localStorage.setItem("theme", dark ? "light" : "dark"); } catch (e) {}
  });

  /* ---------- Durum ---------- */
  var state = { posts: [], cat: "all", q: "", loaded: false };

  /* ---------- Markdown → HTML (önce kaçır, sonra dönüştür) ---------- */
  function inlineFmt(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
        return '<img src="' + src + '" alt="' + alt + '" loading="lazy"/>';
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, href) {
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  }

  function mdToHtml(md) {
    var lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    var out = [], i = 0, inUl = false, inOl = false;

    function closeLists() {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    }

    while (i < lines.length) {
      var line = lines[i];

      // Kod bloğu
      if (/^```/.test(line)) {
        closeLists();
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // kapanış
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }
      // Başlıklar
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeLists();
        var lvl = h[1].length;
        out.push("<h" + lvl + ">" + inlineFmt(esc(h[2])) + "</h" + lvl + ">");
        i++; continue;
      }
      // Yatay çizgi
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
        closeLists(); out.push("<hr/>"); i++; continue;
      }
      // Alıntı
      if (/^>\s?/.test(line)) {
        closeLists();
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + q.map(function (l) { return "<p>" + inlineFmt(esc(l)) + "</p>"; }).join("") + "</blockquote>");
        continue;
      }
      // Listeler
      if (/^\s*[-*]\s+/.test(line)) {
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push("<ul>"); inUl = true; }
        out.push("<li>" + inlineFmt(esc(line.replace(/^\s*[-*]\s+/, ""))) + "</li>");
        i++; continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push("<ol>"); inOl = true; }
        out.push("<li>" + inlineFmt(esc(line.replace(/^\s*\d+[.)]\s+/, ""))) + "</li>");
        i++; continue;
      }
      // Boş satır
      if (/^\s*$/.test(line)) { closeLists(); i++; continue; }
      // Paragraf
      closeLists();
      var p = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) {
        p.push(lines[i]); i++;
      }
      out.push("<p>" + inlineFmt(esc(p.join(" "))) + "</p>");
    }
    closeLists();
    return out.join("\n");
  }

  /* ---------- Veri yükleme ---------- */
  function loadData() {
    var bust = "v=" + Date.now();
    return fetch(DATA_URL + "?" + bust, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        state.posts = (data && data.posts ? data.posts : [])
          .filter(function (p) { return p && p.published !== false; })
          .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        state.loaded = true;
      });
  }

  /* ---------- Filtre çipleri ---------- */
  function renderFilters() {
    var row = $("filterRow");
    var counts = { all: state.posts.length };
    state.posts.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    var html = chip("all", "Tümü", counts.all);
    CATS.forEach(function (c) {
      html += chip(c.id, c.label, counts[c.id] || 0);
    });
    row.innerHTML = html;

    row.querySelectorAll(".filter-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.cat = btn.getAttribute("data-cat");
        renderFilters();
        renderCards();
      });
    });

    function chip(id, label, n) {
      var on = state.cat === id ? " is-on" : "";
      return '<button type="button" class="filter-chip' + on + '" data-cat="' + esc(id) + '" style="--cc:var(--cc-' + id + ')">' +
        esc(label) + ' <span class="n">' + n + "</span></button>";
    }
  }

  /* ---------- Kart listesi ---------- */
  function filteredPosts() {
    var q = state.q.toLocaleLowerCase("tr-TR");
    return state.posts.filter(function (p) {
      if (state.cat !== "all" && p.category !== state.cat) return false;
      if (!q) return true;
      var hay = [p.title, p.excerpt, (p.tags || []).join(" "), p.content]
        .join(" ").toLocaleLowerCase("tr-TR");
      return hay.indexOf(q) !== -1;
    });
  }

  function cardHtml(p) {
    var href = "#/yazi/" + encodeURIComponent(p.slug || p.id);
    var cat = esc(catLabel(p.category));
    return (
      '<a class="card" href="' + href + '" style="--cc:var(--cc-' + esc(p.category) + ')">' +
        '<div class="card-top">' +
          '<span class="cat-chip">' + cat + "</span>" +
          '<span class="card-meta">' + fmtDate(p.createdAt) + "</span>" +
        "</div>" +
        "<h3 class=\"card-title\">" + esc(p.title) + "</h3>" +
        '<p class="card-excerpt">' + esc(p.excerpt || "") + "</p>" +
        '<div class="card-foot">' +
          '<span class="card-read">' + readTime(p.content) + "</span>" +
          '<span class="card-more">Oku <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>' +
        "</div>" +
      "</a>"
    );
  }

  function renderCards() {
    var list = filteredPosts();
    var cards = $("cards");
    var empty = $("emptyState");

    $("postCount").textContent = "(" + list.length + ")";
    cards.innerHTML = list.map(cardHtml).join("");

    if (!list.length) {
      empty.hidden = false;
      if (!state.posts.length) {
        empty.innerHTML =
          '<div class="empty-icon">✍️</div>' +
          "<h3>İlk yazı üzerinde çalışıyorum</h3>" +
          "<p>Bu alanda yakında ekonomi, borsa, yapay zeka, kişisel gelişim ve gündem üzerine yazılarım yer alacak.</p>";
      } else {
        empty.innerHTML =
          '<div class="empty-icon">🔍</div>' +
          "<h3>Sonuç bulunamadı</h3>" +
          "<p>Aramanla eşleşen bir yazı yok. Farklı bir kelime denemek ister misin?</p>";
      }
    } else {
      empty.hidden = true;
      empty.innerHTML = "";
    }
  }

  /* ---------- Yazı görünümü ---------- */
  function findPost(slug) {
    for (var i = 0; i < state.posts.length; i++) {
      if ((state.posts[i].slug || state.posts[i].id) === slug) return state.posts[i];
    }
    return null;
  }

  function renderPost(slug) {
    var p = findPost(slug);
    var viewPost = $("view-post");
    if (!p) {
      show("view-404");
      return;
    }
    var tagsHtml = "";
    if (p.tags && p.tags.length) {
      tagsHtml = '<div class="post-tags">' +
        p.tags.map(function (t) { return '<span class="post-tag">#' + esc(t) + "</span>"; }).join("") +
        "</div>";
    }
    var meta = fmtDate(p.createdAt) + '<span class="dot"></span>' + readTime(p.content);

    $("postArticle").innerHTML =
      '<span class="cat-chip" style="--cc:var(--cc-' + esc(p.category) + ')">' + esc(catLabel(p.category)) + "</span>" +
      '<h1 class="post-title">' + esc(p.title) + "</h1>" +
      '<div class="post-meta"><span>' + meta + "</span></div>" +
      '<div class="post-content">' + mdToHtml(p.content) + "</div>" +
      tagsHtml +
      '<div class="post-author">' +
        '<img src="/profile.jpg" alt="Ali Yüzerler"/>' +
        "<div>" +
          '<div class="pa-name">Ali Yüzerler</div>' +
          '<p class="pa-bio">Mobil &amp; web geliştirici. Ekonomi, borsa ve yapay zeka meraklısı.</p>' +
        "</div>" +
      "</div>";

    // Benzer yazılar (aynı kategori)
    var rel = state.posts.filter(function (x) {
      return x !== p && x.category === p.category;
    }).slice(0, 3);
    var relSec = $("relatedSection");
    if (rel.length) {
      relSec.hidden = false;
      $("relatedCards").innerHTML = rel.map(cardHtml).join("");
    } else {
      relSec.hidden = true;
      $("relatedCards").innerHTML = "";
    }
    show("view-post");
  }

  /* ---------- Görünüm yönetimi ---------- */
  function show(viewId) {
    ["view-home", "view-post", "view-404"].forEach(function (id) {
      $(id).hidden = (id !== viewId);
    });
    var isPost = (viewId === "view-post");
    $("progress").hidden = !isPost;
    // Ana sayfa bağlantısı aktifliği
    var homeLink = document.querySelector("[data-route-home]");
    if (homeLink) homeLink.classList.toggle("is-active", viewId === "view-home");
    window.scrollTo(0, 0);
  }

  function route() {
    var h = location.hash || "#/";
    var m = h.match(/^#\/yazi\/(.+)$/);
    if (m) {
      renderPost(decodeURIComponent(m[1]));
    } else if (h === "#/" || h === "#" || h === "") {
      renderFilters();
      renderCards();
      show("view-home");
    } else {
      show("view-404");
    }
  }

  /* ---------- İlerleme çubuğu ---------- */
  window.addEventListener("scroll", function () {
    if ($("progress").hidden) return;
    var el = document.documentElement;
    var max = el.scrollHeight - el.clientHeight;
    var pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
    $("progressBar").style.width = pct + "%";
  }, { passive: true });

  /* ---------- Arama ---------- */
  var searchTimer = null;
  $("searchInput").addEventListener("input", function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = e.target.value.trim();
      renderCards();
    }, 140);
  });

  /* ---------- Önyükleme ---------- */
  window.addEventListener("hashchange", function () {
    if (state.loaded) route();
  });

  loadData()
    .catch(function () { state.posts = []; state.loaded = true; })
    .then(function () { route(); });
})();
