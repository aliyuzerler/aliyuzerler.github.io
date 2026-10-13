/* ============================================================
   ALIDECK — Projeler bölümü: kartlar rastgele sağdan/soldan eğimli
   açılarla gelir, ekrana doğru düzleşerek merkezde konumlanır
   - Tek kart odakta (daha büyük boyut), scroll ile yandan 3D giriş
   - Önizleme iframe'leri kart boyutuna dinamik tam oturtulur (boşluksuz)
   - Kart tasarımı KORUNUR; yalnızca yerleşim + animasyon
   - position:sticky taklidi (fixed-emulation) — ancestor overflow'a dayanıklı
   - React güvenli: düğüm taşınmaz, yalnız inline style; MO ile self-heal
   - prefers-reduced-motion: destesi hiç kurmaz (mevcut grid kalır)
   ============================================================ */
(function () {
  function init() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sec = document.getElementById('projects');
    if (!sec || sec.dataset.deckInit) return;
    sec.dataset.deckInit = '1';

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const grid = sec.querySelector('.grid');
    if (!grid || !grid.parentElement) return;
    const wrap = grid.parentElement; // başlık + filtre + grid'i içeren sarmalayıcı
    const SLOT_VH = 0.8;            // kart başına kaydırma yüksekliği
    const cardEls = () => Array.from(grid.querySelectorAll(':scope > button'));
    let N = 0, deckH = 0, cardW = 320;
    let enterAt = 0, exitAt = 0, secTopAbs = 0;
    let stageState = '', activeIdx = -1, rafId = 0, visible = false;
    let dotsWrap = null, dotEls = [], titles = [];
    let cardCache = [];
    let seeds = [];

    /* ---------- rastgele giriş tohumu: sağ/sol + eğimli açı ---------- */
    function makeSeed() {
      const side = Math.random() < 0.5 ? -1 : 1;
      return {
        x: side * (300 + Math.random() * 240),   // yandan giriş mesafesi (±300..540)
        y: (Math.random() * 2 - 1) * 60,         // hafif dikey çeşitleme (±60)
        z: -1500 * (0.9 + Math.random() * 0.25), // derinlik çeşitlemesi
        rx: (Math.random() * 2 - 1) * 7,         // öne/arkaya eğik (±7°)
        ry: side * (14 + Math.random() * 14),    // yana dönük burun (±14..28°)
        rz: side * (6 + Math.random() * 8)       // yatıklık / roll (±6..14°)
      };
    }

    /* ---------- ölçüm ---------- */
    function measure() {
      const vh = innerHeight;
      const slotH = Math.round(vh * SLOT_VH);
      // kart yüksekliği ≈ genişlik*0.625 (16/10 görsel) + metin ~205px
      const maxW = Math.min(innerWidth * 0.92, 620, Math.max(280, (vh - 215) / 0.625));
      return { slotH, cardW: Math.round(maxW), deckH: slotH * Math.max(1, N) };
    }

    /* ---------- dots (sabit konumlu gezinme) ---------- */
    function buildDots() {
      if (dotsWrap) dotsWrap.remove();
      dotsWrap = document.createElement('div');
      dotsWrap.setAttribute('aria-label', 'Proje gezinme');
      dotsWrap.style.cssText = 'position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:30;display:none;flex-direction:column;gap:10px;pointer-events:auto;';
      dotEls = titles.map((t, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', 'Projeye git: ' + t);
        d.style.cssText = 'width:10px;height:10px;border-radius:50%;border:1px solid rgba(102,236,210,.5);background:rgba(102,236,210,.15);cursor:pointer;padding:0;transition:all .25s ease;';
        d.addEventListener('click', () => {
          const target = enterAt + (i + 0.5) * (exitAt - enterAt) / Math.max(1, N);
          window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
        dotsWrap.appendChild(d);
        return d;
      });
      document.body.appendChild(dotsWrap);
    }

    /* ---------- kart taban stilleri ---------- */
    function styleCard(el, cw) {
      el.style.position = 'absolute';
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.width = cw + 'px';
      el.style.maxWidth = '92vw';
      el.style.margin = '0';
      el.style.transition = 'none';
      el.style.animation = 'none';
      el.style.willChange = 'transform,opacity,filter';
      el.style.backfaceVisibility = 'hidden';
      el.style.transform = 'translate(-50%,-50%) translateZ(-1500px)';
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    }

    /* ---------- kurulum / yeniden kurulum ---------- */
    function build() {
      // akış durumuna sıfırla (ölçüm doğruluğu için)
      grid.style.position = 'relative';
      grid.style.top = '0';
      grid.style.left = '0';
      grid.style.right = '0';
      grid.style.width = '100%';

      const els = cardEls();
      N = els.length;
      if (!N) return;
      cardCache = els;
      seeds = els.map(() => makeSeed()); // her kurulumda yeni rastgele dağılım
      titles = els.map((el, i) => (el.querySelector('h3,h2,strong') || {}).textContent || ('Proje ' + (i + 1)));

      const m = measure();
      deckH = m.deckH; cardW = m.cardW;

      // grid: akışta deck yüksekliği
      grid.style.display = 'block';
      grid.style.height = deckH + 'px';
      grid.style.perspective = '1200px';
      grid.style.zIndex = '20';
      // bölüm yüksekliğini kilitle (grid akıştan çıkınca çökmesin)
      sec.style.position = 'relative';

      els.forEach(el => styleCard(el, cardW));
      fitPreviews();
      activeIdx = -1;

      // mutlak konumlar
      secTopAbs = sec.getBoundingClientRect().top + (window.scrollY || 0);
      const gTop = grid.getBoundingClientRect().top + (window.scrollY || 0);
      enterAt = gTop;
      exitAt = gTop + deckH - innerHeight;
      if (exitAt <= enterAt) exitAt = enterAt + 1;
      // bölüm yüksekliğini kilitle: grid akıştan çıkınca (absolute/fixed) çökmesin
      sec.style.height = 'auto';
      sec.style.height = sec.offsetHeight + 'px';

      buildDots();
    }

    /* ---------- önizlemeleri kart boyutuna tam oturt (boşluksuz) ---------- */
    function fitPreviews() {
      cardCache.forEach(el => {
        try {
          const ifr = el.querySelector('iframe');
          if (!ifr) return;
          const box = ifr.parentElement; // düzen ölçüsü — transformdan etkilenmez
          const vw = box.clientWidth, vh = box.clientHeight;
          if (!vw || !vh) return;
          const wPx = parseFloat(ifr.style.width) || 0;
          if (wPx > 600) {
            // tarayıcı mockup'ı (1200px belge): genişliğe tamamla,
            // sanal sayfa yüksekliğini alana tam yay → ne boşluk ne kırpma
            const sc = vw / wPx;
            ifr.style.transform = 'scale(' + sc.toFixed(4) + ')';
            ifr.style.height = Math.round(vh / sc) + 'px';
          } else {
            // telefon mockup'ı (380x800): yüksekliğe tamamla,
            // kabuğu orantılı büyüt (max-w-120 sınırlamasını kaldır)
            const sc = vh / 800;
            ifr.style.transform = 'scale(' + sc.toFixed(4) + ')';
            const shell = ifr.parentElement && ifr.parentElement.parentElement;
            if (shell) {
              shell.style.maxWidth = 'none';
              shell.style.width = Math.round(380 * sc + 16) + 'px'; // 6+6 çerçeve + 2+2 pad
            }
          }
        } catch (e) { /* tek kart oturtulamadıysa diğerlerine devam */ }
      });
    }

    /* ---------- sahne durumu ---------- */
    function applyState(st) {
      stageState = st;
      if (st === 'pin') {
        Object.assign(grid.style, { position: 'fixed', top: '0', left: '0', right: '0', width: '100%', height: '100vh' });
        if (dotsWrap) dotsWrap.style.display = 'flex';
      } else {
        if (dotsWrap) dotsWrap.style.display = 'none';
        if (st === 'exit') {
          Object.assign(grid.style, { position: 'absolute', top: (exitAt - secTopAbs) + 'px', left: '0', right: '0', width: '100%', height: deckH + 'px' });
        } else { // flow
          Object.assign(grid.style, { position: 'relative', top: '0', left: '0', right: '0', width: '100%', height: deckH + 'px' });
        }
      }
    }

    /* ---------- kart animasyonu ---------- */
    function updateCards(p) {
      const els = cardCache.length ? cardCache : cardEls();
      const w = 1 / Math.max(1, els.length);
      const holdIdx = clamp(Math.floor(p / w), 0, els.length - 1);
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        const t = (p - i * w) / w;
        const s = seeds[i] || (seeds[i] = makeSeed());
        let x = 0, y = 0, z = 0, op, blur, rx = 0, ry = 0, rz = 0;
        if (t < 0.45) {
          // rastgele sağdan/soldan eğimli giriş → düzleşerek merkeze yaslan
          const e = easeIO(clamp(t / 0.45, 0, 1));
          const k = 1 - e;
          x = s.x * k; y = s.y * k; z = s.z * k;
          rx = s.rx * k; ry = s.ry * k; rz = s.rz * k;
          op = Math.min(1, e * 1.15); blur = 8 * k;
        } else if (t < 0.85) {
          op = 1; blur = 0;
        } else if (i < els.length - 1) {
          // kameradan geçiş: kartın kendi yönüne hafif sürüklenerek uçsun
          const e = easeIO(clamp((t - 0.85) / 0.15, 0, 1));
          z = 750 * e; op = Math.max(0, 1 - e * 1.25); blur = 5 * e;
          rx = -7 * e; ry = s.ry * 0.35 * e; rz = s.rz * 0.3 * e; x = s.x * 0.12 * e;
        } else {
          op = 1; blur = 0;
        }
        if (op < 0.02) {
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.opacity = String(op);
        el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
        el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px) brightness(${(0.75 + 0.25 * op).toFixed(2)})` : 'none';
        el.style.zIndex = String(10 + Math.round(z / 10));
        const interactive = (i === holdIdx && t >= 0.45 && t < 0.85);
        el.style.pointerEvents = interactive ? 'auto' : 'none';
      }
      if (holdIdx !== activeIdx) {
        els.forEach((el, i) => { try { el.tabIndex = i === holdIdx ? 0 : -1; } catch (e) {} });
        if (dotEls.length) dotEls.forEach((d, i) => {
          const on = i === holdIdx;
          d.style.background = on ? 'linear-gradient(135deg,#00a97c,#66ecd2)' : 'rgba(102,236,210,.15)';
          d.style.transform = on ? 'scale(1.45)' : 'scale(1)';
          d.style.borderColor = on ? 'rgba(102,236,210,.9)' : 'rgba(102,236,210,.5)';
        });
        activeIdx = holdIdx;
      }
    }

    /* ---------- ana döngü ---------- */
    function loop() {
      rafId = requestAnimationFrame(loop);
      const sy = window.scrollY || 0;
      let st = 'flow';
      if (sy >= exitAt) st = 'exit';
      else if (sy >= enterAt) st = 'pin';
      if (st !== stageState) applyState(st);
      if (st === 'pin') {
        const p = clamp((sy - enterAt) / Math.max(1, exitAt - enterAt), 0, 1);
        updateCards(p);
      } else if (st === 'exit') {
        updateCards(1);
      } else {
        updateCards(0);
      }
    }
    function startLoop() { if (!rafId && visible) rafId = requestAnimationFrame(loop); }
    function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }

    /* ---------- gözlemciler ---------- */
    const io = new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) startLoop(); else stopLoop();
    }, { rootMargin: '300px' });
    io.observe(sec);

    // React yeniden render (dil/filtre) → kartlar değişirse kendini onar
    let rebuildPending = false;
    const mo = new MutationObserver(() => {
      if (rebuildPending) return;
      rebuildPending = true;
      requestAnimationFrame(() => {
        rebuildPending = false;
        const els = cardEls();
        const cur = els.length;
        build();
        // mevcut kaydırma konumuna göre durumu tazele
        const sy = window.scrollY || 0;
        applyState(sy >= exitAt ? 'exit' : sy >= enterAt ? 'pin' : 'flow');
        activeIdx = -1;
      });
    });
    mo.observe(grid, { childList: true });

    let resizeT = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { build(); const sy = window.scrollY || 0; applyState(sy >= exitAt ? 'exit' : sy >= enterAt ? 'pin' : 'flow'); activeIdx = -1; }, 180);
    }, { passive: true });

    build();
    applyState('flow');
    startLoop();

    // SAĞLIK KONTROLÜ: React hidrasyonu init'ten sonra bölüm/kılavuz düğümünü
    // yeniden oluşturabilir (yavaş cihazlarda görüldü) — deste kopuk düğümlerde
    // kalırsa sessizce ölür. Yeni düğüme kendini yeniden kur.
    const health = setInterval(() => {
      try {
        const cur = document.getElementById('projects');
        const stale = !cur || cur !== sec || !cur.contains(grid);
        if (!stale) return;
        clearInterval(health);
        stopLoop();
        io.disconnect();
        mo.disconnect();
        if (dotsWrap) dotsWrap.remove();
        if (cur && cur.dataset) delete cur.dataset.deckInit;
        setTimeout(init, 60);
      } catch (e) { /* sağlık kontrolü hata halinde klasik grid kalır */ }
    }, 1200);

    window.__aliDeck = { get state() { return { N, enterAt, exitAt, stage: stageState, active: activeIdx, rafId: rafId, visible: visible }; }, rebuild: build };
  } catch (err) {
    console.warn('ALIDECK: proje destesi kurulamadı, klasik grid kalıyor.', err);
  }
  }
  // React hidrasyonu bölümü yeniden oluşturabildiği için init'i hidrasyon SONRASINA al
  function whenReady() {
    if (document.readyState === 'complete') {
      setTimeout(init, 150);
    } else {
      addEventListener('load', () => setTimeout(init, 150), { once: true });
    }
  }
  whenReady();
})();
