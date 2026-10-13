/* ============================================================
   ALICARDS — Yetenekler (#skills) & Hizmetler (#services) kartları
   için birbirinden FARKLI iki 3D animasyon:
   - #skills   : dönüşümlü 3D çevirme girişi (flip, sol/sağ) + fare
                 eğimi (tilt) — "keskin/etkileşimli" karakter
   - #services : dalga hâlinde panel açılışı (rotateX unfold) +
                 yumuşak süzülme (float) — "canlı/yüzen" karakter
   Framer Motion kartı görünür yapınca (opacity=1) o kartın 3D
   girişi oynar; scroll'u takip eden doğal bir dalga oluşur.
   Yalnızca inline style + WAAPI (React güvenli, self-heal'li).
   prefers-reduced-motion: hiç kurulmaz (klasik görünüm).
   ============================================================ */
(function () {
  function initFx() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

    setupSection('skills', {
      mode: 'flip', perspective: 1100, dur: 720, stagger: 95,
      tilt: 7, hoverScale: 1.015, hoverLift: 0, lerp: 0.14, float: 0
    });
    setupSection('services', {
      mode: 'unfold', perspective: 1000, dur: 800, stagger: 115,
      tilt: 5, hoverScale: 1.02, hoverLift: -6, lerp: 0.1,
      float: 4.5, floatSpeed: 0.85, floatPhase: 1.35
    });
  } catch (e) { console.warn('ALICARDS kurulamadı:', e); }
  }

  function setupSection(secId, o) {
    var sec = document.getElementById(secId);
    if (!sec || sec.dataset.cardsFx) return;
    var grid = sec.querySelector('.mt-16.grid');
    if (!grid) return;
    if (grid.__cfxOwned) return; // başka örnek sahibi — çift kurulumu önle
    grid.__cfxOwned = true;
    sec.dataset.cardsFx = '1';

    var cards = function () {
      return Array.prototype.filter.call(grid.children, function (el) { return el.tagName === 'DIV'; });
    };
    var visible = false, rafId = 0, phase = Math.random() * 6.283, armedCount = 0, lastArm = 0, watches = 0;
    var instId = secId + '-' + Math.random().toString(36).slice(2, 6);
    var st = new WeakMap(), batch = { n: 0, t: 0 };

    grid.style.perspective = o.perspective + 'px';

    function S(el) {
      var s = st.get(el);
      if (!s) { s = { rx: 0, ry: 0, y: 0, sc: 1, hx: 0, hy: 0, hover: false, ok: false }; st.set(el, s); }
      return s;
    }

    /* ---------- kart başına 3D giriş (kendi reveal'ı bitince) ---------- */
    function fromFor(i) {
      if (o.mode === 'flip') {
        var d = i % 2 === 0 ? -1 : 1; // çift kart soldan, tek kart sağdan çevrilir
        return { transform: 'translate3d(' + (d * 46) + 'px,14px,0) rotateY(' + (d * 58) + 'deg) scale(0.94)', transformOrigin: '50% 50%' };
      }
      return { transform: 'translate3d(0,' + (i % 2 ? 50 : 42) + 'px,0) rotateX(52deg) scale(0.96)', transformOrigin: '50% 0%' };
    }
    function watch(el, idx) {
      watches++;
      var t0 = performance.now();
      (function check() {
        if (S(el).ok) return;
        if (parseFloat(getComputedStyle(el).opacity) > 0.95) {
          // aynı anda hazır olan kartlara sıralı gecikme (dalga), sonrakiler kendi turunda
          var d = batch.n * o.stagger;
          batch.n++;
          clearTimeout(batch.t);
          batch.t = setTimeout(function () { batch.n = 0; }, 450);
          el.animate([fromFor(idx),
            { transform: 'translate3d(0,0,0) rotateX(0deg) rotateY(0deg) scale(1)', transformOrigin: '50% 50%' }],
            { duration: o.dur, delay: d, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
          setTimeout(function () { armOne(el); }, d + o.dur + 80);
          return;
        }
        if (performance.now() - t0 > 6000) return armOne(el); // güvenlik: reveal gelmediyse bırak
        setTimeout(check, 80);
      })();
    }
    function armOne(el) {
      if (S(el).ok) return;
      var s = S(el); s.ok = true; armedCount++; lastArm = Date.now();
      el.style.willChange = 'transform';
      el.style.transformOrigin = '50% 50%';
      if (canHover && !el.dataset.cfxHover) {
        el.dataset.cfxHover = '1';
        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
      }
    }

    /* ---------- yazıcı: hover eğimi + süzülme (lerp) ---------- */
    function onMove(e) {
      var el = e.currentTarget, s = S(el), r = el.getBoundingClientRect();
      if (r.width < 2) return;
      s.hover = true;
      s.hy = ((e.clientX - r.left) / r.width * 2 - 1) * o.tilt;
      s.hx = -((e.clientY - r.top) / r.height * 2 - 1) * o.tilt;
    }
    function onLeave(e) { var s = S(e.currentTarget); s.hover = false; s.hx = 0; s.hy = 0; }

    function write() {
      rafId = requestAnimationFrame(write);
      phase += 0.016 * (o.floatSpeed || 1);
      var els = cards();
      for (var i = 0; i < els.length; i++) {
        var el = els[i], s = S(el);
        if (!s.ok) continue; // girişi oynatılmamış kartlara dokunma (Framer reveal koruması)
        var ty = (o.float ? Math.sin(phase + i * (o.floatPhase || 1)) * o.float : 0) + (s.hover ? o.hoverLift : 0);
        var trx = s.hover ? s.hx : 0, trY = s.hover ? s.hy : 0;
        var tsc = s.hover ? o.hoverScale : 1, k = o.lerp;
        s.rx += (trx - s.rx) * k; s.ry += (trY - s.ry) * k;
        s.y += (ty - s.y) * k; s.sc += (tsc - s.sc) * k;
        el.style.transform = 'translate3d(0,' + s.y.toFixed(2) + 'px,0) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) scale(' + s.sc.toFixed(3) + ')';
      }
    }

    /* ---------- görünürlük kapısı: bölüm ekrandakiyken döngü ---------- */
    var vio = new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !rafId) rafId = requestAnimationFrame(write);
      if (!visible && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }, { rootMargin: '160px' });
    vio.observe(grid);

    /* ---------- tetikleyici: bölüm yaklaşınca kartları izlemeye al ---------- */
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      cards().forEach(watch);
    }, { rootMargin: '260px' });
    io.observe(grid);

    /* ---------- self-heal: React kartları yeniden oluşturursa ---------- */
    var healT = 0;
    var mo = new MutationObserver(function () {
      if (healT) return;
      healT = setTimeout(function () {
        healT = 0;
        st = new WeakMap(); armedCount = 0;
        var els = cards();
        els.forEach(function (el) { el.style.transform = ''; el.style.willChange = ''; });
        els.forEach(watch);
      }, 220);
    });
    mo.observe(grid, { childList: true });

    /* ---------- bölüm düğümü değişirse (hidrasyon yarışı) yeniden kur ---------- */
    var health = setInterval(function () {
      try {
        var cur = document.getElementById(secId);
        if (cur === sec && sec.contains(grid)) return;
        clearInterval(health);
        grid.__cfxOwned = false;
        if (rafId) cancelAnimationFrame(rafId);
        io.disconnect(); mo.disconnect(); vio.disconnect();
        delete sec.dataset.cardsFx;
        var cur2 = document.getElementById(secId);
        if (cur2 && cur2.dataset) delete cur2.dataset.cardsFx;
        setTimeout(initFx, 60);
      } catch (e) { /* sağlık kontrolü sessiz */ }
    }, 1300);

    window.__aliCards = window.__aliCards || {};
    Object.defineProperty(window.__aliCards, secId, {
      get: function () { return { armed: armedCount, total: cards().length, visible: visible, rafId: rafId, watches: watches, lastArm: lastArm, inst: instId }; }
    });
  }

  function whenReady() {
    if (document.readyState === 'complete') setTimeout(initFx, 150);
    else addEventListener('load', function () { setTimeout(initFx, 150); }, { once: true });
  }
  whenReady();
})();
