/* ============================================================
   ALI3D — Ali Yüzerler portfolyo 3D arka plan (v1)
   Kaynak: NEON//VOID konsepti (scroll'a bağlı Three.js evreni)
   Uyarlama: site markasına (zümrüt/yeşil gradyan) göre palet,
   koyu tema desteği, sekme/modal açıkken duraklatma,
   prefers-reduced-motion'da talep-bazlı render, self-hosted three.
   ============================================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = matchMedia('(max-width: 768px)').matches || (navigator.hardwareConcurrency || 8) <= 4;

/* Marka paleti (site: --grad-a #00a97c, --grad-b #00968c, --grad-c #66ecd2, --background #040b08) */
const C = {
  pri: 0x66ecd2,   // mint — ana parlak renk (grad-c)
  mid: 0x00b389,   // zümrüt-teal — ikincil (grad-a/b arası)
  acc: 0xd9f7ea,   // kırık beyaz-yeşil — çekirdek/parıltı
  deep: 0x0a3a2a,  // koyu zümrüt — emissive
  body: 0x071410,  // parça gövdesi
  bg: 0x040b08,    // sahne zemin/fog (site --background ile aynı)
};
const MOODS = [[0, 0x040b08], [0.25, 0x051209], [0.5, 0x071a12], [0.75, 0x051109], [1, 0x040b08]];

/* ---------- yardımcılar ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------- durum ---------- */
let three = null;          // { update(t, dt, prog) }
let running = false;
let rafId = 0;
let lastT = 0;
let targetP = 0, smoothP = 0;
let modalOpen = false;     // modal/mobil menü scroll kilidi aktif mi
let lightTheme = document.documentElement.classList.contains('light');
let booted = false;

/* ---------- canvas + fallback ---------- */
let canvas = null;
function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.id = 'ali3d-bg';
  canvas.setAttribute('aria-hidden', 'true');
  (document.body || document.documentElement).appendChild(canvas);
  return canvas;
}
function enableFallback() {
  if (document.getElementById('ali3d-stars')) return;
  if (canvas) canvas.remove();
  const fb = document.createElement('div');
  fb.id = 'ali3d-stars';
  fb.setAttribute('aria-hidden', 'true');
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push(`${(Math.random() * 100).toFixed(1)}vw ${(Math.random() * 100).toFixed(1)}vh 0 ${(Math.random() * 1.6).toFixed(1)}px rgba(102,236,210,${(0.15 + Math.random() * 0.5).toFixed(2)})`);
  }
  fb.style.boxShadow = stars.join(',');
  (document.body || document.documentElement).appendChild(fb);
}
function webglOK() {
  try {
    const t = document.createElement('canvas');
    return !!(t.getContext('webgl2') || t.getContext('webgl'));
  } catch { return false; }
}

/* ---------- scroll ilerlemesi ---------- */
function calcProgress() {
  const de = document.documentElement;
  const max = de.scrollHeight - innerHeight;
  targetP = max > 0 ? clamp((window.scrollY || de.scrollTop || 0) / max, 0, 1) : 0;
}
addEventListener('scroll', calcProgress, { passive: true });
addEventListener('resize', calcProgress, { passive: true });
calcProgress();

/* ---------- fare paralaksı ---------- */
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
if (!REDUCED) {
  addEventListener('mousemove', e => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

/* ══════════ 3D EVREN ══════════ */
async function init3D() {
  const [T, EC, RP, UB] = await Promise.all([
    import('three'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
  ]);
  const THREE = T.default || T;
  const cv = ensureCanvas();
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', alpha: false });
  // Yazılım tabanlı GL (SwiftShader/llvmpipe) tespiti — bloom'u hemen atla
  function isSoftwareGL(gl) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      return /swiftshader|llvmpipe|software|basic render/i.test(String(r));
    } catch { return false; }
  }
  const SOFT = isSoftwareGL(renderer.getContext());
  const DPR = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.bg, 6, 34);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 90);

  // Kamera yolu + bakış hedefi (Catmull-Rom)
  const camCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.3, 9.5), new THREE.Vector3(0, 0.4, 5),
    new THREE.Vector3(3.5, 1.2, 0.5), new THREE.Vector3(0, 0.6, -4),
    new THREE.Vector3(-4.5, 1.8, -13), new THREE.Vector3(0, 3.2, -24),
    new THREE.Vector3(0, 2.2, -30), new THREE.Vector3(0, 0.5, -33.5),
  ], false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, -0.3, 0),
    new THREE.Vector3(1, 0.3, -5), new THREE.Vector3(0, 0.5, -10),
    new THREE.Vector3(0, 0.5, -18), new THREE.Vector3(0, 1, -28),
    new THREE.Vector3(0, 0.6, -36), new THREE.Vector3(0, 0.5, -40),
  ], false, 'centripetal');
  // Mobilde hero metni parlak çekirdeğin üstüne binmesin: sahneyi ekranda aşağı kaydır
  if (LOW) { lookCurve.points[0].y += 1.15; lookCurve.points[1].y += 0.95; }

  // Işıklar
  scene.add(new THREE.AmbientLight(0x1a2e24, 1.4));
  const lightC = new THREE.PointLight(C.pri, 26, 16, 1.8); lightC.position.set(0, 1.5, 2.5); scene.add(lightC);
  const lightM = new THREE.PointLight(C.mid, 14, 20, 2);   lightM.position.set(-6, -2, -8); scene.add(lightM);

  /* SAHNE 01: Enerji çekirdeği */
  const core = new THREE.Group();
  const coreInner = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: C.acc }));
  const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: C.pri, wireframe: true, transparent: true, opacity: 0.55 }));
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gg = gc.getContext('2d');
  const grad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(217,247,234,0.9)'); grad.addColorStop(0.25, 'rgba(102,236,210,0.35)'); grad.addColorStop(1, 'rgba(102,236,210,0)');
  gg.fillStyle = grad; gg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(5.5);
  const orb1 = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color: C.pri, transparent: true, opacity: 0.6 }));
  orb1.rotation.x = 1.15;
  const orb2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.006, 8, 96), new THREE.MeshBasicMaterial({ color: C.mid, transparent: true, opacity: 0.4 }));
  orb2.rotation.x = 1.9; orb2.rotation.y = 0.4;
  core.add(coreInner, coreWire, glow, orb1, orb2);
  scene.add(core);

  /* SAHNE 02: Breach parçaları + şok dalgaları */
  const FRAG_N = 26;
  const fragDirs = [], fragAxes = [], fragScales = [];
  const fragMesh = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.22),
    new THREE.MeshStandardMaterial({ color: C.body, metalness: 0.7, roughness: 0.35, emissive: C.deep, emissiveIntensity: 0.6 }),
    FRAG_N
  );
  for (let i = 0; i < FRAG_N; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y *= 0.7; fragDirs.push(v);
    fragAxes.push(new THREE.Vector3().randomDirection());
    fragScales.push(0.5 + Math.random() * 1.1);
  }
  scene.add(fragMesh);
  fragMesh.scale.setScalar(0.0001);

  function shockwave(color, z = 0) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.05, 72),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(0, 0, z); m.rotation.x = Math.random() * 0.6 - 0.3;
    scene.add(m); return m;
  }
  const shockA = shockwave(C.pri), shockB = shockwave(C.mid);

  /* Geçiş yapıları: tel-kutu mimari */
  const structures = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const s = 0.6 + Math.random() * 1.9;
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s * (0.6 + Math.random()), s)),
      new THREE.LineBasicMaterial({ color: C.pri, transparent: true, opacity: 0.32 })
    );
    box.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 6, -10 - Math.random() * 14);
    box.userData.spin = (Math.random() - 0.5) * 0.15;
    structures.add(box);
  }
  scene.add(structures);

  /* SAHNE 03: Holografik kod panelleri + grid */
  function codePanel(title, lines) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 640;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(4,11,8,0.94)'; g.fillRect(0, 0, 512, 640);
    g.strokeStyle = 'rgba(102,236,210,0.45)'; g.lineWidth = 2; g.strokeRect(4, 4, 504, 632);
    g.fillStyle = 'rgba(102,236,210,0.09)'; g.fillRect(4, 4, 504, 52);
    g.fillStyle = '#66ECD2'; g.font = '500 22px "Geist Mono","JetBrains Mono",ui-monospace,monospace'; g.fillText(title, 24, 38);
    g.fillStyle = '#00B389'; g.beginPath(); g.arc(468, 30, 5, 0, 7); g.fill();
    g.font = '400 20px "Geist Mono","JetBrains Mono",ui-monospace,monospace';
    lines.forEach((ln, i) => {
      g.fillStyle = ln.startsWith('//') ? 'rgba(145,156,145,0.75)' : ln.startsWith('  ') ? '#c8f7e4' : '#66ECD2';
      g.fillText(ln, 24, 98 + i * 36);
    });
    const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4;
    return new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.88),
      new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  }
  const panel1 = codePanel('profile.ts', ['// developer.config', 'export const ali = {', "  role: 'MOBILE & WEB DEV',", "  mode: 'end-to-end',", '  ship: (idea) => {', '    return build(idea);', '  },', '};']);
  const panel2 = codePanel('loop.js', ['// philosophy', 'while (alive) {', '  const idea = imagine();', '  const code = craft(idea);', '  if (works(code)) {', '    ship(code);', '  }', '}']);
  const panel3 = codePanel('stack.md', ['- frontend   react / ts', '- backend    node / api', '- mobile     ios / android', '- creative   three / webgl', '', '// always learning', '// never templates']);
  panel1.position.set(2.9, 1.5, -14.5); panel1.rotation.y = -0.5;
  panel2.position.set(-3.3, 0.3, -17.5); panel2.rotation.y = 0.45;
  panel3.position.set(1.6, -1.0, -20.5); panel3.rotation.y = -0.3;
  const panels = [panel1, panel2, panel3];
  panels.forEach(p => scene.add(p));

  const grid1 = new THREE.GridHelper(90, 36, C.pri, 0x0a1f16);
  grid1.position.set(0, -3, -20);
  grid1.material.transparent = true; grid1.material.opacity = 0;
  const grid2 = grid1.clone(); grid2.position.z = -33; grid2.material = grid1.material.clone();
  scene.add(grid1, grid2);

  /* SAHNE 04: Tel-kafes manzara */
  const landGeo = new THREE.PlaneGeometry(70, 26, 60, 22);
  landGeo.rotateX(-Math.PI / 2);
  const landMat = new THREE.MeshBasicMaterial({ color: C.pri, wireframe: true, transparent: true, opacity: 0 });
  const landscape = new THREE.Mesh(landGeo, landMat);
  landscape.position.set(0, -3, -30);
  const landPts = new THREE.Points(landGeo, new THREE.PointsMaterial({ color: 0xbdf7e4, size: 0.055, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  landscape.add(landPts);
  scene.add(landscape);
  const landBase = landGeo.attributes.position.array.slice();

  /* Portallar */
  function portal(z) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.055, 12, 96), new THREE.MeshBasicMaterial({ color: C.pri, transparent: true, opacity: 0 }));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.58, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: C.mid, transparent: true, opacity: 0 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.35, 64), new THREE.MeshBasicMaterial({ color: C.pri, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const N = 260, pos = new Float32Array(N * 3), rr = [];
    for (let i = 0; i < N; i++) { const r = Math.random() * 2.25, a = Math.random() * 7; pos.set([Math.cos(a) * r, Math.sin(a) * r, 0], i * 3); rr.push(a); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: C.acc, size: 0.03, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    dust.userData.angles = rr;
    g.add(ring, ring2, disc, dust);
    g.position.set(0, 0.6, z);
    scene.add(g);
    return { g, ring, ring2, disc, dust };
  }
  const portal1 = portal(-10);
  const portal2 = portal(-40);

  /* Parçacık evreni (tek draw call, shader) */
  const PN = LOW ? 900 : 2600;
  const pPos = new Float32Array(PN * 3), pScale = new Float32Array(PN), pMix = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const tunnel = Math.random() < 0.7;
    const r = tunnel ? 1 + Math.random() * 6.5 : 4 + Math.random() * 13;
    const a = Math.random() * Math.PI * 2;
    pPos[i * 3] = Math.cos(a) * r;
    pPos[i * 3 + 1] = Math.sin(a) * r * 0.75 + (Math.random() - 0.5) * 2;
    pPos[i * 3 + 2] = 12 - Math.random() * 58;
    pScale[i] = 0.5 + Math.random() * 1.7;
    pMix[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aScale', new THREE.BufferAttribute(pScale, 1));
  pGeo.setAttribute('aMix', new THREE.BufferAttribute(pMix, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: (LOW ? 70 : 110) * DPR },
      uConv: { value: 0 }, uPortal: { value: new THREE.Vector3(0, 0.6, -40) },
    },
    vertexShader: `
      uniform float uTime, uSize, uConv;
      uniform vec3 uPortal;
      attribute float aScale, aMix;
      varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*0.3 + position.x*0.6 + position.z*0.25)*0.3;
        p.x += cos(uTime*0.22 + position.z*0.4)*0.25;
        p += (uPortal - p) * (uConv * (0.45 + fract(aScale*13.7)*0.55));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * aScale / (-mv.z);
        vec3 mint = vec3(0.400,0.925,0.824), teal = vec3(0.000,0.702,0.549), light = vec3(0.851,0.969,0.918);
        vec3 col = mix(mint, teal, smoothstep(0.78, 0.88, aMix));
        col = mix(col, light, smoothstep(0.94, 1.0, aMix));
        vC = col;
        float a = clamp(1.0 - ((-mv.z) - 6.0) / 55.0, 0.08, 1.0);
        a *= 0.55 + 0.45 * sin(uTime * (0.5 + aMix) + aMix * 40.0);
        a *= 1.0 + uConv * 1.8;
        vA = a;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float a = smoothstep(0.5, 0.02, d);
        gl_FragColor = vec4(vC, a * vA * 0.9);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);

  /* Bloom — yalnız güçlü cihazlar */
  let composer = null;
  if (!LOW && !SOFT) {
    composer = new EC.EffectComposer(renderer);
    composer.addPass(new RP.RenderPass(scene, camera));
    const bloom = new UB.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.7, 0.72);
    composer.addPass(bloom);
  }

  /* Sahne atmosferi (fog rengi lerp) */
  const fogC = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  function applyMood(p) {
    let i = 0;
    while (i < MOODS.length - 2 && p > MOODS[i + 1][0]) i++;
    const [pa, ca] = MOODS[i], [pb, cb] = MOODS[i + 1];
    cA.setHex(ca); cB.setHex(cb);
    fogC.lerpColors(cA, cB, clamp((p - pa) / (pb - pa), 0, 1));
    scene.fog.color.copy(fogC);
    renderer.setClearColor(fogC);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
  });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); enableFallback(); });

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Vp = new THREE.Vector3();

  /* Güncelleme — scroll ilerlemesine göre deterministik */
  function update(t, dt, prog) {
    const T_ = REDUCED ? 0 : t;

    camCurve.getPointAt(prog, Vp);
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;
    if (!REDUCED) { Vp.x += mouse.sx * 0.45; Vp.y += -mouse.sy * 0.28; }
    camera.position.copy(Vp);
    camera.lookAt(lookCurve.getPointAt(prog));

    // Çekirdek
    const b = easeIO(range(prog, 0.18, 0.38));
    const pulse = 1 + Math.sin(T_ * 1.4) * 0.04;
    core.scale.setScalar(Math.max(0.0001, (1 - b * 0.88) * pulse));
    core.rotation.y = T_ * 0.16;
    core.rotation.z = T_ * 0.05;
    orb1.rotation.z = T_ * 0.3; orb2.rotation.z = -T_ * 0.2;
    coreWire.material.opacity = 0.55 * (1 - b * 0.7);
    glow.material.opacity = 1 - b * 0.6;

    // Parçalar
    const fragVis = easeIO(range(prog, 0.17, 0.4));
    fragMesh.scale.setScalar(Math.max(0.0001, fragVis));
    if (fragVis > 0.001) {
      for (let i = 0; i < FRAG_N; i++) {
        const d = fragVis * (1.6 + (i % 7) * 0.55);
        Vp.copy(fragDirs[i]).multiplyScalar(d);
        Q.setFromAxisAngle(fragAxes[i], T_ * (0.2 + (i % 5) * 0.08) + i);
        S.setScalar(fragScales[i]);
        M.compose(Vp, Q, S);
        fragMesh.setMatrixAt(i, M);
      }
      fragMesh.instanceMatrix.needsUpdate = true;
    }

    // Şok dalgaları
    const s1 = range(prog, 0.19, 0.3), s2 = range(prog, 0.21, 0.34);
    shockA.scale.setScalar(1 + s1 * 20); shockA.material.opacity = (1 - s1) * 0.7 * (s1 > 0 ? 1 : 0);
    shockB.scale.setScalar(1 + s2 * 16); shockB.material.opacity = (1 - s2) * 0.5 * (s2 > 0 ? 1 : 0);

    // Portal 1
    const p1v = range(prog, 0.28, 0.42) * (1 - range(prog, 0.55, 0.62));
    portal1.ring.material.opacity = p1v * 0.9; portal1.ring2.material.opacity = p1v * 0.7;
    portal1.disc.material.opacity = p1v * 0.07; portal1.dust.material.opacity = p1v * 0.8;
    portal1.g.rotation.z = T_ * 0.1;
    portal1.dust.rotation.z = T_ * 0.25;
    portal1.g.scale.setScalar(0.7 + p1v * 0.3);

    // Yapılar + paneller + grid
    const dv = range(prog, 0.36, 0.46) * (1 - range(prog, 0.62, 0.68));
    structures.children.forEach(bx => { bx.rotation.y = bx.userData.spin * T_ + bx.position.x; });
    structures.children.forEach(bx => bx.material.opacity = 0.32 * dv);
    panels.forEach((pn, i) => {
      pn.material.opacity = dv * 0.92;
      pn.position.y += REDUCED ? 0 : Math.sin(T_ * 0.6 + i * 2.1) * 0.0018;
    });
    grid1.material.opacity = dv * 0.28;
    grid2.material.opacity = range(prog, 0.5, 0.62) * 0.2;

    // Manzara
    const lv = range(prog, 0.55, 0.66);
    landMat.opacity = lv * 0.22;
    landPts.material.opacity = lv * 0.5;
    if (lv > 0.001) {
      const arr = landGeo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = landBase[i], z = landBase[i + 2];
        if (!REDUCED && !LOW) {
          arr[i + 1] = Math.sin(x * 0.35 + T_ * 0.8) * 0.35
                     + Math.sin(z * 0.5 - T_ * 0.5) * 0.3
                     + Math.sin((x + z) * 0.18 + T_ * 0.3) * 0.5;
        } else {
          arr[i + 1] = Math.sin(x * 0.35) * 0.35 + Math.sin(z * 0.5) * 0.3 + Math.sin((x + z) * 0.18) * 0.5;
        }
      }
      landGeo.attributes.position.needsUpdate = true;
    }

    // Portal 2 + parçacık toplanması
    const p2v = range(prog, 0.8, 0.92);
    portal2.ring.material.opacity = p2v * 0.95; portal2.ring2.material.opacity = p2v * 0.7;
    portal2.disc.material.opacity = p2v * 0.08; portal2.dust.material.opacity = p2v * 0.9;
    portal2.g.rotation.z = T_ * 0.08;
    portal2.dust.rotation.z = -T_ * 0.22;
    portal2.g.scale.setScalar(0.55 + p2v * 0.45 + (REDUCED ? 0 : Math.sin(T_ * 1.2) * 0.02 * p2v));
    pMat.uniforms.uConv.value = easeIO(range(prog, 0.84, 0.99));
    pMat.uniforms.uTime.value = T_;

    lightC.intensity = 26 + Math.sin(T_ * 1.4) * 4;
    lightM.intensity = 14 + Math.sin(T_ * 0.9 + 2) * 3;

    applyMood(prog);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  three = { update };

  /* FPS bekçisi — zayıf GPU'da kademeli düşürme:
     <24 FPS → bloom kapat + DPR 1; hâlâ <18 FPS → parçacıkları kıs */
  let stage = 0;
  (function watchdog() {
    let f = 0;
    const t0 = performance.now();
    (function tick() {
      f++;
      if (!running) { setTimeout(watchdog, 1000); return; }
      if (performance.now() - t0 < 3500) { requestAnimationFrame(tick); return; }
      const fps = f / ((performance.now() - t0) / 1000);
      if (fps < 24 && stage === 0) {
        stage = 1;
        composer = null;
        renderer.setPixelRatio(1);
        if (window.__ali3d) window.__ali3d.stage = 1;
        setTimeout(watchdog, 500);
      } else if (fps < 18 && stage === 1) {
        stage = 2;
        pGeo.setDrawRange(0, Math.floor(PN * 0.35));
        if (window.__ali3d) window.__ali3d.stage = 2;
      } else if (fps >= 24) {
        setTimeout(watchdog, 1000); // sağlıklıysa arada kontrol etmeye devam
      }
    })();
  })();
}

/* ══════════ DÖNGÜ YÖNETİMİ ══════════ */
function frame(t) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((t - lastT) / 1000, 0.05); lastT = t;
  smoothP += (targetP - smoothP) * Math.min(1, dt * 5.5);
  if (Math.abs(targetP - smoothP) < 0.00004) smoothP = targetP;
  if (three) three.update(t / 1000, dt, smoothP);
}
function start() {
  if (running || !three || lightTheme || modalOpen || document.hidden) return;
  running = true; lastT = performance.now();
  if (window.__ali3d) window.__ali3d.running = true;
  rafId = requestAnimationFrame(frame);
}
function stop() {
  running = false;
  if (window.__ali3d) window.__ali3d.running = false;
  cancelAnimationFrame(rafId);
}
/* REDUCED: sürekli döngü yok — scroll/resize'da tek kare */
let reducedPending = false;
function reducedRender() {
  if (!three || lightTheme || modalOpen || document.hidden || reducedPending) return;
  reducedPending = true;
  requestAnimationFrame(() => {
    reducedPending = false;
    smoothP = targetP;
    if (three) three.update(0, 0, smoothP);
  });
}

/* ---------- duraklatma koşulları ---------- */
document.addEventListener('visibilitychange', () => {
  lastT = performance.now();
  if (document.hidden) stop(); else (REDUCED ? reducedRender() : start());
});
/* body style (scroll kilidi = modal/menü açık) ve html class (tema) izle */
const themeMo = new MutationObserver(() => {
  const nowLight = document.documentElement.classList.contains('light');
  if (nowLight !== lightTheme) {
    lightTheme = nowLight;
    if (canvas) canvas.style.display = lightTheme ? 'none' : '';
    if (lightTheme) stop(); else (REDUCED ? reducedRender() : start());
  }
});
themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
const bodyMo = new MutationObserver(() => {
  const locked = (document.body && document.body.style.overflow === 'hidden');
  if (locked !== modalOpen) {
    modalOpen = locked;
    if (modalOpen) stop(); else (REDUCED ? reducedRender() : start());
  }
});
if (document.body) bodyMo.observe(document.body, { attributes: true, attributeFilter: ['style'] });

/* ---------- başlatma ---------- */
async function boot() {
  if (booted) return; booted = true;
  window.__ali3d = { running: false, mode: 'init', prog: 0 };
  if (lightTheme) { window.__ali3d.mode = 'light-wait'; }   // açık temada three indirme
  if (!webglOK()) { enableFallback(); window.__ali3d.mode = 'fallback'; return; }
  try {
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1800))]);
    await init3D();
    applyBoot();
  } catch (err) {
    console.warn('ALI3D: WebGL sahnesi kurulamadı, statik atmosfere geçiliyor.', err);
    enableFallback();
    if (window.__ali3d) window.__ali3d.mode = 'fallback';
  }
}
function applyBoot() {
  if (canvas) {
    canvas.classList.add('ali3d-ready');   // CSS: opacity 0→1 fade-in
    canvas.style.display = lightTheme ? 'none' : '';
  }
  if (REDUCED) {
    ['scroll', 'resize'].forEach(ev => addEventListener(ev, reducedRender, { passive: true }));
    reducedRender();
  } else {
    start();
  }
  if (window.__ali3d) { window.__ali3d.mode = 'on'; window.__ali3d.prog = smoothP; }
}

if (lightTheme) {
  // Açık temada başladı: temaya göz kulak ol, koyuya geçince yükle
  const waitMo = new MutationObserver(() => {
    if (!document.documentElement.classList.contains('light')) {
      waitMo.disconnect();
      lightTheme = false;
      boot();
    }
  });
  waitMo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
} else {
  boot();
}
