// Weather hero as a real 3D scene: a matte sun or moon, lumpy clouds and tall
// chamfered numerals, lit like a studio shot against a white wall that catches
// soft shadows. Drag to spin it all the way around.
import * as THREE from '../vendor/three.module.min.js';

let fontPromise;
function loadFont() {
  fontPromise ||= fetch(new URL('../vendor/digits.typeface.json', import.meta.url)).then((r) => r.json());
  return fontPromise;
}

// Typeface glyph outlines → THREE.Shapes (same format FontLoader reads).
function textShapes(font, text, size) {
  const scale = size / font.resolution;
  const shapes = [];
  let x = 0;
  for (const ch of text) {
    const g = font.glyphs[ch];
    if (!g) continue;
    const path = new THREE.ShapePath();
    const o = g._cachedOutline || (g._cachedOutline = g.o.split(' '));
    for (let i = 0; i < o.length;) {
      const a = o[i++];
      if (a === 'm') path.moveTo(o[i++] * scale + x, o[i++] * scale);
      else if (a === 'l') path.lineTo(o[i++] * scale + x, o[i++] * scale);
      else if (a === 'q') {
        const px = o[i++] * scale + x, py = o[i++] * scale;
        path.quadraticCurveTo(o[i++] * scale + x, o[i++] * scale, px, py);
      } else if (a === 'b') {
        const px = o[i++] * scale + x, py = o[i++] * scale;
        path.bezierCurveTo(o[i++] * scale + x, o[i++] * scale, o[i++] * scale + x, o[i++] * scale, px, py);
      }
    }
    shapes.push(...path.toShapes());
    x += g.ha * scale * 0.94;
  }
  return shapes;
}

// fine noise used as a bump map so surfaces look sandblasted
function grainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 146;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

// deterministic random so a given forecast always draws the same clouds
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const SKY_Y = 7.4;      // centre of the sun / moon
const DIGIT_TOP = 4.4;  // numerals run from -4.2 up to here

export function createWeather3D(container, { onTap } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // soft, blurry shadows on the wall
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const grain = grainTexture();

  const hemi = new THREE.HemisphereLight(0xffffff, 0xdedede, 1.6);
  // key light from high on the right: lights the chamfers, keeps the faces dark
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(7, 9, 12);
  // a nearly invisible light in front casts the shadows, so they stay short and
  // fall just down-left of each object on the wall
  const caster = new THREE.DirectionalLight(0xffffff, 0.001);
  caster.position.set(5, 3.5, 14);
  caster.castShadow = true;
  caster.shadow.mapSize.set(1024, 1024);
  caster.shadow.camera.left = -12; caster.shadow.camera.right = 12;
  caster.shadow.camera.top = 14; caster.shadow.camera.bottom = -10;
  caster.shadow.camera.near = 1; caster.shadow.camera.far = 50;
  caster.shadow.radius = 14;
  caster.shadow.blurSamples = 16;
  caster.shadow.bias = -0.0005;
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-8, 2, 10);
  // red bounce from the sun onto the tops of the numerals
  const glow = new THREE.PointLight(0xff1a24, 0, 6, 1.4);
  glow.position.set(0, DIGIT_TOP + 1.2, 1.4);
  scene.add(hemi, key, caster, fill, glow);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.11 }));
  wall.position.z = -3.2;
  wall.receiveShadow = true;
  scene.add(wall);

  const spin = new THREE.Group();     // rotated by the user
  const art = new THREE.Group();
  const digits = new THREE.Group();
  spin.add(art, digits);
  scene.add(spin);

  const mat = {
    sun: new THREE.MeshStandardMaterial({ color: 0xff1f2c, roughness: 0.75, bumpMap: grain, bumpScale: 0.5, emissive: 0x8a0410 }),
    // the moon is lit by its own "sun" so it can show the real phase
    moonPhase: new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: new THREE.Vector3(0, 0, 1) }, grain: { value: grain } },
      vertexShader: `
        varying vec3 vN; varying vec2 vUv;
        void main() {
          vN = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 sunDir; uniform sampler2D grain;
        varying vec3 vN; varying vec2 vUv;
        void main() {
          float d = dot(normalize(vN), sunDir);
          float lit = smoothstep(-0.06, 0.14, d);            // soft terminator
          float g = texture2D(grain, vUv * vec2(6.0, 3.0)).r;
          vec3 day = vec3(0.97, 0.97, 0.95) * (0.62 + 0.38 * clamp(d, 0.0, 1.0));
          vec3 night = vec3(0.035, 0.035, 0.04);              // faint earthshine
          vec3 col = mix(night, day, lit) * (0.9 + 0.16 * g);
          col *= 0.82 + 0.18 * normalize(vN).z;               // gentle limb darkening
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
    cloud: new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.8, bumpMap: grain, bumpScale: 0.45 }),
    cloudLight: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8, bumpMap: grain, bumpScale: 0.45 }),
    drop: new THREE.MeshStandardMaterial({ color: 0x3b8cff, roughness: 0.3, emissive: 0x0a2a66 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x333333 }),
    star: new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xfff0a0, emissiveIntensity: 0.9 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.5, emissive: 0x8a6400 }),
    digit: new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.55, bumpMap: grain, bumpScale: 0.3 }),
  };
  const sphereGeo = new THREE.SphereGeometry(1, 64, 48);
  // teardrop raindrop: round at the bottom, pointed on top
  const dropGeo = new THREE.LatheGeometry(
    Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      return new THREE.Vector2(Math.sin(Math.PI * t) * (1 - t * 0.85) * 0.16, -0.16 + t * 0.5);
    }), 20);
  const shared = [sphereGeo, dropGeo];

  function add(group, geo, material, pos, scale = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  const floaters = [];  // [object, baseX, baseY, phase, drift]
  const fallers = [];   // [mesh, speed, phase]
  const twinklers = []; // [mesh, phase]

  function clearGroup(g) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse?.((o) => { if (o.geometry && !shared.includes(o.geometry)) o.geometry.dispose(); });
    }
  }

  // a cloud: a heap of squashed matte lumps, biggest in the middle
  function cloudMass(r, cx, cy, cz, width, lumps, size, m, parent = art) {
    const g = new THREE.Group();
    for (let i = 0; i < lumps; i++) {
      const t = lumps === 1 ? 0.5 : i / (lumps - 1);
      const x = (t - 0.5) * width + (r() - 0.5) * 0.5;
      const edge = 1 - Math.abs(t - 0.5) * 1.3;
      const s = size * (0.45 + edge * 0.55) * (0.8 + r() * 0.4);
      const y = (r() - 0.3) * size * 0.6 + edge * size * 0.35;
      add(g, sphereGeo, m, [x, y, (r() - 0.5) * size * 0.8], [s * (1.05 + r() * 0.25), s * 0.85, s]);
    }
    g.position.set(cx, cy, cz);
    parent.add(g);
    floaters.push([g, cx, cy, r() * 6, 0.15 + r() * 0.15]);
  }

  function buildArt(kind, isDay, cover, seed) {
    clearGroup(art);
    floaters.length = 0;
    fallers.length = 0;
    twinklers.length = 0;
    const r = rng(seed);
    const cm = kind === 'snow' || kind === 'fog' ? mat.cloudLight : mat.cloud;
    const overcast = kind !== 'clear' && kind !== 'partly';

    // sun or moon, peeking out from behind the clouds
    add(art, sphereGeo, isDay ? mat.sun : mat.moonPhase, [0, SKY_Y, 0.2], 2.6);
    glow.intensity = isDay ? (overcast ? 2 : 7) : 0;
    if (!isDay) {      for (let i = 0; i < 10; i++) {
        const st = add(art, sphereGeo, mat.star, [-4.5 + r() * 9, SKY_Y - 2 + r() * 5.5, -2.8], 0.07);
        st.castShadow = false;
        twinklers.push([st, r() * 6]);
      }
    }

    // clouds grow with cloud cover
    const c = Math.max(0, Math.min(1, cover / 100));
    if (overcast) {
      cloudMass(r, -0.2, SKY_Y - 1.2, 2.0, 7.6, 9, 1.55, cm);
      cloudMass(r, 0.6, SKY_Y + 0.3, 1.2, 4.2, 4, 1.4, cm);
    } else if (c > 0.12 && c < 0.45) {
      cloudMass(r, -2.4, SKY_Y - 1.3, 2.6, 2.6, 4, 0.9, cm);
      if (c > 0.25) cloudMass(r, 2.9, SKY_Y - 0.8, 2.3, 1.6, 3, 0.65, cm);
    } else if (c >= 0.45) {
      cloudMass(r, -1.8, SKY_Y - 1.4, 2.6, 4.2, 6, 1.2, cm);
      cloudMass(r, 2.4, SKY_Y - 0.6, 2.2, 3.0, 4, 1.0, cm);
      if (c > 0.7) cloudMass(r, 0.4, SKY_Y + 0.8, 3.0, 2.6, 3, 0.95, cm);
    }

    if (kind === 'rain' || kind === 'storm') {
      for (let i = 0; i < 18; i++) {
        const m = add(art, dropGeo, mat.drop, [-3.2 + r() * 6.4, 0, 1.8 + r() * 1.6], 1.2);
        fallers.push([m, 4 + r() * 1.5, r()]);
      }
    }
    if (kind === 'snow') {
      for (let i = 0; i < 24; i++) {
        const m = add(art, sphereGeo, mat.snow, [-3.4 + r() * 6.8, 0, 1.6 + r() * 1.8], 0.12 + r() * 0.06);
        fallers.push([m, 1 + r() * 0.5, r()]);
      }
    }
    if (kind === 'storm') {
      const sh = new THREE.Shape();
      sh.moveTo(0.2, 0); sh.lineTo(-0.7, -1.4); sh.lineTo(-0.05, -1.4); sh.lineTo(-0.5, -2.8); sh.lineTo(0.9, -0.9); sh.lineTo(0.2, -0.9); sh.lineTo(0.7, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
      const bolt = add(art, g, mat.bolt, [0.3, SKY_Y - 1.6, 3.2]);
      floaters.push([bolt, 0.3, SKY_Y - 1.6, 0, 0.05]);
    }
    if (kind === 'fog') {
      for (let i = 0; i < 3; i++) {
        const g = new THREE.CapsuleGeometry(0.22, 5.4 - i * 1.3, 6, 16);
        const m = add(art, g, mat.cloudLight, [0, SKY_Y - 2.2 - i * 0.6, 3]);
        m.rotation.z = Math.PI / 2;
        floaters.push([m, 0, SKY_Y - 2.2 - i * 0.6, i * 2, 0.35]);
      }
    }
  }

  let font = null;
  let text = '';
  // tall chamfered numerals, `height` units tall, standing on y = 0
  async function digitMesh(t, height) {
    font ||= await loadFont();
    const shapes = textShapes(font, t, 1);
    // one flat bevel segment = crisp 45° chamfers on every edge
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.2, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 1,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const s = height / (bb.max.y - bb.min.y);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const m = new THREE.Mesh(geo, mat.digit);
    m.scale.set(s * 0.62, s, 1.4 / 0.3); // tall, narrow, ~1.4 units deep
    m.castShadow = true;
    return m;
  }
  async function setText(t) {
    text = t;
    const m = await digitMesh(t, DIGIT_TOP + 4.2);
    if (text !== t) { m.geometry.dispose(); return; }
    clearGroup(digits);
    m.position.y = -4.2;
    digits.add(m);
  }

  // ----- detail pages: one model per page, slid in sideways -----
  let mode = 'hero';
  let detailGroup = null, leaving = null, slide = 1, slideDir = 1;
  const spinners = [];   // [object, speed]
  const detailRain = []; // [mesh, speed, phase]
  let vane = null;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.85, flatShading: true, bumpMap: grain, bumpScale: 0.4 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.4 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x8fc4ff, roughness: 0.15, transparent: true, opacity: 0.85 });

  // a floating chunk of rock: flat top, jagged underside
  function rock(r) {
    const geo = new THREE.CylinderGeometry(3.2, 0.9, 1.9, 11, 3, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0.9) {
        const k = (0.9 - y) / 1.9;
        pos.setX(i, pos.getX(i) * (0.85 + r() * 0.3));
        pos.setZ(i, pos.getZ(i) * (0.85 + r() * 0.3));
        pos.setY(i, y - r() * 0.9 * k);
      }
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMat);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  function anemometer(g) {
    add(g, new THREE.CylinderGeometry(0.06, 0.06, 6.2, 12), metalMat, [0, -0.6, 0]);
    const head = new THREE.Group();
    head.position.y = 2.5;
    g.add(head);
    add(head, sphereGeo, metalMat, [0, 0, 0], 0.18);
    const cupGeo = new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / 3) * Math.PI * 2;
      head.add(arm);
      add(arm, new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), metalMat, [0.75, 0, 0]).rotation.z = Math.PI / 2;
      const cup = add(arm, cupGeo, mat.cloud, [1.5, 0, 0]);
      cup.rotation.y = Math.PI / 2;
    }
    spinners.push([head, 0]);
    // wind vane: an arrow that turns to face the wind
    vane = new THREE.Group();
    vane.position.y = 0.6;
    g.add(vane);
    add(vane, new THREE.BoxGeometry(2.6, 0.05, 0.05), metalMat, [0, 0, 0]);
    add(vane, new THREE.BoxGeometry(0.05, 0.9, 0.9), mat.cloud, [-1.2, 0, 0]).rotation.x = Math.PI / 4;
    add(vane, new THREE.ConeGeometry(0.14, 0.4, 12), metalMat, [1.4, 0, 0]).rotation.z = -Math.PI / 2;
    // a thin ring sweeping round the mast
    const ring = add(g, new THREE.TorusGeometry(2.6, 0.03, 8, 96), metalMat, [0, 0.6, 0]);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false;
  }

  function buildDetail(page, info) {
    const g = new THREE.Group();
    const r = rng(17 + page.length * 13);
    spinners.length = 0;
    detailRain.length = 0;
    vane = null;
    if (page === 'sun') add(g, sphereGeo, mat.sun, [0, 0.2, 0], 2.7);
    else if (page === 'moon') add(g, sphereGeo, mat.moonPhase, [0, 0.2, 0], 2.7);
    else if (page === 'cloud') {
      const c = Math.max(0.15, Math.min(1, info.cloud / 100));
      cloudMass(r, -1.4, 0.4, 0.6, 3.6 * (0.6 + c * 0.4), 5, 0.9 + c * 0.5, mat.cloud, g);
      if (c > 0.35) cloudMass(r, 2.0, 1.1, -0.2, 2.6, 4, 0.7 + c * 0.4, mat.cloud, g);
      if (c > 0.7) cloudMass(r, 0.2, -0.6, 1.4, 3.4, 5, 0.9, mat.cloud, g);
    } else if (page === 'air') {
      anemometer(g);
    } else if (page === 'precip') {
      const isl = rock(r);
      isl.position.y = -1.2;
      g.add(isl);
      if (info.rain > 0) {
        const pool = add(g, new THREE.CylinderGeometry(2.4, 2.4, 0.08, 40), waterMat, [0, -0.2, 0]);
        pool.scale.setScalar(Math.min(1, 0.4 + info.rain / 6));
        pool.castShadow = false;
        const n = Math.min(26, 6 + Math.round(info.rain * 5));
        for (let i = 0; i < n; i++) {
          const m = add(g, info.snow ? sphereGeo : dropGeo, info.snow ? mat.snow : mat.drop, [-2.4 + r() * 4.8, 0, -1.4 + r() * 2.8], info.snow ? 0.12 : 1.2);
          detailRain.push([m, info.snow ? 1.2 : 4.5, r()]);
        }
      }
    } else if (page === 'temp') {
      digitMesh(String(info.temp), 5.6).then((m) => {
        if (!g.parent) { m.geometry.dispose(); return; }
        m.position.y = -2.6;
        g.add(m);
      });
    }
    return g;
  }

  function setDetail(page, info, dir = 0) {
    if (!page) {
      mode = 'hero';
      for (const x of [detailGroup, leaving]) if (x) { spin.remove(x); clearGroup(x); }
      detailGroup = leaving = null;
      art.visible = digits.visible = true;
      resize();
      return;
    }
    const first = mode !== 'detail';
    mode = 'detail';
    art.visible = digits.visible = false;
    if (leaving) { spin.remove(leaving); clearGroup(leaving); }
    leaving = first ? null : detailGroup;
    detailGroup = buildDetail(page, info);
    spin.add(detailGroup);
    slideDir = dir || 1;
    slide = dir && !first ? 0 : 1;
    tuneAir(info);
    resize();
  }
  // wind changes without rebuilding: turn the vane, speed up the cups
  function tuneAir(info) {
    if (vane) vane.rotation.y = -((info.dir ?? 0) * Math.PI) / 180 + Math.PI / 2;
    if (spinners[0]) spinners[0][1] = 0.6 + Math.min(6, info.wind ?? 0) * 0.9;
  }

  function setNight(night) {
    hemi.intensity = night ? 1.1 : 1.6;
    hemi.groundColor.set(night ? 0x1a1a1a : 0xdedede);
    key.intensity = night ? 1.3 : 2.0;
    fill.intensity = night ? 0.4 : 0.7;
    wall.material.opacity = night ? 0.3 : 0.11;
    mat.digit.color.set(night ? 0x4a4a4a : 0x171717);
    mat.cloud.color.set(night ? 0x3a3a3a : 0x232323);
  }

  // ----- size -----
  function resize() {
    const w = container.clientWidth, hgt = container.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${hgt}px`;
    camera.aspect = w / hgt;
    // hero: fit the 9.6 × 14.6 column (sky + numerals); detail: a 9 × 7.4 box round the model
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const [hw, hh, cy] = mode === 'detail' ? [4.5, 3.7, 0.3] : [4.8, 7.3, 3.0];
    const distH = hh / Math.tan(vFov / 2);
    const distW = hw / (Math.tan(vFov / 2) * camera.aspect);
    const d = Math.max(distH, distW) * 1.02;
    camera.position.set(0, cy + 0.1, d);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ----- drag to spin, with inertia, then settle back to the front -----
  let rotY = 0, rotX = 0, velY = 0, velX = 0, dragging = false, lastX = 0, lastY = 0, idleAt = 0, moved = 0;
  let flash = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    velX = velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    velY = dx * 0.012;
    velX = dy * 0.008;
    rotY += velY;
    rotX = THREE.MathUtils.clamp(rotX + velX, -0.7, 0.7);
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    idleAt = performance.now();
    if (moved < 6) { flash = 1; onTap?.(); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // ----- loop -----
  let raf = 0, last = performance.now();
  const clock0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - clock0) / 1000;
    if (!dragging) {
      rotY += velY; rotX += velX;
      velY *= 0.94; velX *= 0.9;
      // after a pause, ease back to the nearest front-facing angle
      if (now - idleAt > 1600 && Math.abs(velY) < 0.002) {
        const target = Math.round(rotY / (Math.PI * 2)) * Math.PI * 2;
        rotY += (target - rotY) * 0.06;
        rotX += (0 - rotX) * 0.08;
      }
    }
    spin.rotation.y = rotY + Math.sin(t * 0.5) * 0.05;
    spin.rotation.x = rotX;
    for (const [o, x, y, ph, drift] of floaters) {
      o.position.y = y + Math.sin(t * 0.8 + ph) * 0.08;
      o.position.x = x + Math.sin(t * 0.3 + ph) * drift;
    }
    for (const [m, ph] of twinklers) m.scale.setScalar(0.07 * (0.6 + 0.4 * Math.sin(t * 2.4 + ph)));
    for (const f of fallers) {
      const [m, speed] = f;
      f[2] = (f[2] + dt * speed / 4) % 1;
      m.position.y = SKY_Y - 2 - f[2] * 5;
      m.visible = f[2] < 0.9;
    }
    if (detailGroup) {
      if (slide < 1) {
        slide = Math.min(1, slide + dt / 0.45);
        const e = 1 - (1 - slide) ** 3;
        detailGroup.position.x = slideDir * 12 * (1 - e);
        if (leaving) leaving.position.x = -slideDir * 12 * e;
        if (slide >= 1 && leaving) { spin.remove(leaving); clearGroup(leaving); leaving = null; }
      }
      for (const sp of spinners) sp[0].rotation.y -= sp[1] * dt;
      for (const f of detailRain) {
        f[2] = (f[2] + dt * f[1] / 4) % 1;
        f[0].position.y = 4.2 - f[2] * 4.4;
        f[0].visible = f[2] < 0.95;
      }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 2.2);
      const k = flash * flash;
      mat.digit.emissive.setRGB(k, k, k);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setScene(kind, isDay, cover = 50, seed = 1) { buildArt(kind, isDay, cover, seed); setNight(!isDay); },
    // phase: 0 = new, 0.25 = first quarter (right half lit), 0.5 = full, 0.75 = last quarter
    setMoonPhase(phase) {
      const a = phase * Math.PI * 2;
      mat.moonPhase.uniforms.sunDir.value.set(Math.sin(a), 0, -Math.cos(a)).normalize();
    },
    setText,
    setDetail,
    tuneAir,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearGroup(art); clearGroup(digits);
      if (detailGroup) clearGroup(detailGroup);
      if (leaving) clearGroup(leaving);
      [rockMat, metalMat, waterMat].forEach((m) => m.dispose());
      Object.values(mat).forEach((m) => m.dispose());
      shared.forEach((g) => g.dispose());
      grain.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
