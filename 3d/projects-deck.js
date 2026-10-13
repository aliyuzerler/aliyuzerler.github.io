/* ============================================================
   ALIDECK — Projeler bölümü: kartlar sırayla uzaktan yakına uçar
   - Tek kart odakta (daha büyük boyut), scroll ile 3D derinlikten gelir
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
        let z, op, blur, rx, y;
        if (t < 0.45) {
          const e = easeIO(clamp(t / 0.45, 0, 1));
          z = -1500 * (1 - e); op = Math.min(1, e * 1.15); blur = 8 * (1 - e); rx = 9 * (1 - e); y = 70 * (1 - e);
        } else if (t < 0.85) {
          z = 0; op = 1; blur = 0; rx = 0; y = 0;
        } else if (i < els.length - 1) {
          const e = easeIO(clamp((t - 0.85) / 0.15, 0, 1));
          z = 750 * e; op = Math.max(0, 1 - e * 1.25); blur = 5 * e; rx = -7 * e; y = 0;
        } else {
          z = 0; op = 1; blur = 0; rx = 0; y = 0;
        }
        if (op < 0.02) {
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.opacity = String(op);
        el.style.transform = `translate(-50%,-50%) translateY(${y.toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg)`;
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
