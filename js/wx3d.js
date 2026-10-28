// Weather hero as a real 3D scene: a matte sun or moon, lumpy clouds and tall
// chamfered numerals, lit like a studio shot against a white wall that catches
// soft shadows. Drag to spin it all the way around.
import * as THREE from '../vendor/three.module.min.js';

let fontPromise;
let fontData = null;
function loadFont() {
  fontPromise ||= fetch(new URL('../vendor/digits.typeface.json', import.meta.url)).then((r) => r.json()).then((f) => (fontData = f));
  return fontPromise;
}
loadFont(); // start early so the numerals are ready by the time the scene first draws

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
  // fog fades the neighbouring pages in the detail carousel; parked out of reach otherwise
  scene.fog = new THREE.Fog(0xffffff, 900, 1000);
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
          vN = normalize(normal); // object space: the lit side turns with the moon
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
  const digitMeshSync = (t, height) => { font ||= fontData; return buildDigits(t, height); };
  // tall chamfered numerals, `height` units tall, standing on y = 0
  async function digitMesh(t, height) {
    font ||= fontData || await loadFont();
    return buildDigits(t, height);
  }
  function buildDigits(t, height) {
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
    const m = fontData ? digitMeshSync(t, DIGIT_TOP + 4.2) : await digitMesh(t, DIGIT_TOP + 4.2);
    if (text !== t) { m.geometry.dispose(); return; }
    clearGroup(digits);
    m.position.y = -4.2;
    digits.add(m);
  }

  // ----- detail pages: a carousel with one model per page -----
  // Every page has its own model and its own rotation; the current one sits in
  // front and its neighbours wait, faded, to the left and right.
  let mode = 'hero';
  const carousel = new THREE.Group();
  scene.add(carousel);
  let models = [];          // [{ page, wrap, inner, anim, key, rotY, rotX, velY, velX, idleAt }]
  let current = 0, pos = 0; // target page and the animated carousel position
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, flatShading: true, bumpMap: grain, bumpScale: 0.6 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.32, metalness: 0.55 });
  const darkMatte = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.55, bumpMap: grain, bumpScale: 0.25, side: THREE.DoubleSide });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.8 });
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

  // smooth 3D value noise, enough to make rock look like rock
  const hash3 = (x, y, z) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const f = (t) => t * t * (3 - 2 * t);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
      L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.3, y * 2.3, z * 2.3) * 0.28 + noise3(x * 5.1, y * 5.1, z * 5.1) * 0.12;

  // a floating island: a flat, slightly uneven top and a jagged, faceted underside
  // with stepped cliffs; faces are shaded individually so the rock reads as carved
  function rockGeometry(radius, seed, detail = 5) {
    const geo = new THREE.IcosahedronGeometry(1, detail); // non-indexed, so facets stay sharp
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const ang = Math.atan2(v.z, v.x);
      const n = fbm(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2);
      const len = Math.max(0.0001, Math.hypot(v.x, v.z));
      let x, y, z;
      if (v.y > 0.1) {
        // top: nearly flat, gently domed, with a ragged outline
        const r = radius * (0.9 + n * 0.18) * Math.min(1, len / 0.995);
        x = (v.x / len) * r;
        z = (v.z / len) * r;
        y = 0.3 + (1 - len) * 0.12 + (n - 0.5) * 0.1;
      } else {
        // underside: tapers to a crooked point; blocky crags and stepped ledges
        const depth = Math.min(1, (0.1 - v.y) / 1.1);
        const crag = hash3(Math.floor((ang + Math.PI) * 2.6), Math.floor(depth * 6), seed) - 0.5;
        const ledge = Math.floor(depth * 5) / 5;
        const shrink = Math.pow(1 - (depth * 0.6 + ledge * 0.4), 1.25);
        const r = radius * shrink * (0.82 + n * 0.45 + crag * 0.35) * Math.min(1, len * 1.3);
        x = (v.x / len) * r;
        z = (v.z / len) * r;
        y = 0.3 - depth * radius * (0.85 + n * 0.55) - Math.max(0, crag) * 0.5 * depth;
      }
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    // per-face tone: lighter weathered top, darker varied cliffs
    const col = new Float32Array(p.count * 3);
    for (let f = 0; f < p.count; f += 3) {
      const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
      const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
      const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
      const k = hash3(Math.round(cx * 7), Math.round(cy * 7), Math.round(cz * 7));
      const g = cy > 0.2 ? 0.05 + k * 0.012 : 0.018 + k * 0.022; // linear values: near-black stone
      for (let j = 0; j < 3; j++) col.set([g, g, g * 0.98], (f + j) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }

  function islandModel(info) {
    const g = new THREE.Group();
    const r = rng(41);
    // tipped toward the viewer so the top surface (and any rain pooling on it) shows
    g.rotation.x = 0.42;
    g.position.y = 0.9;
    const body = new THREE.Mesh(rockGeometry(2.9, 3.7), rockMat);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // a few loose pebbles drifting under it
    const pebbles = [];
    for (let i = 0; i < 7; i++) {
      const peb = new THREE.Mesh(rockGeometry(0.18 + r() * 0.22, i * 9.1, 2), rockMat);
      const a = (i / 7) * Math.PI * 2 + r() * 0.5, d = 1.9 + r() * 1.3;
      peb.position.set(Math.cos(a) * d, -0.6 - r() * 1.8, Math.sin(a) * d);
      peb.rotation.set(r() * 3, r() * 3, r() * 3);
      peb.castShadow = true;
      g.add(peb);
      pebbles.push([peb, peb.position.y, r() * 6]);
    }
    const anim = { pebbles, rain: [], ripples: [] };
    if (info.rain > 0) {
      const amount = Math.min(1, 0.35 + info.rain / 5);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.3 * amount, 48), waterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.46;
      g.add(pool);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 40), rippleMat.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.set((r() - 0.5) * 2 * amount, 0.48, (r() - 0.5) * 2 * amount);
        g.add(ring);
        anim.ripples.push([ring, i / 3]);
      }
      const n = Math.min(28, 8 + Math.round(info.rain * 5));
      for (let i = 0; i < n; i++) {
        const m = add(g, info.snow ? sphereGeo : dropGeo, info.snow ? mat.snow : mat.drop, [-2.3 + r() * 4.6, 0, -2 + r() * 4], info.snow ? 0.12 : 1.15);
        anim.rain.push([m, info.snow ? 1.2 : 4.8, r()]);
      }
    }
    return [g, anim];
  }

  function anemometerModel(info) {
    const g = new THREE.Group();
    // mast and a small weighted base
    add(g, new THREE.CylinderGeometry(0.07, 0.09, 5.6, 24), metalMat, [0, -0.4, 0]);
    add(g, new THREE.CylinderGeometry(0.5, 0.6, 0.18, 40), metalMat, [0, -3.2, 0]);
    // spinning cup head
    const head = new THREE.Group();
    head.position.y = 2.5;
    g.add(head);
    add(head, new THREE.CylinderGeometry(0.14, 0.18, 0.4, 24), metalMat, [0, 0, 0]);
    add(head, new THREE.ConeGeometry(0.16, 0.25, 24), metalMat, [0, 0.32, 0]);
    const cupGeo = new THREE.SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / 3) * Math.PI * 2;
      head.add(arm);
      const rod = add(arm, new THREE.CylinderGeometry(0.035, 0.035, 1.55, 12), metalMat, [0.8, 0, 0]);
      rod.rotation.z = Math.PI / 2;
      const cup = add(arm, cupGeo, darkMatte, [1.62, 0, 0]);
      cup.rotation.x = Math.PI / 2; // open side faces the direction of spin
    }
    // wind vane: tail fin and arrow on a short arm, turned toward the wind
    const vane = new THREE.Group();
    vane.position.y = 0.9;
    g.add(vane);
    const rod = add(vane, new THREE.CylinderGeometry(0.03, 0.03, 2.8, 12), metalMat, [0, 0, 0]);
    rod.rotation.z = Math.PI / 2;
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.lineTo(-0.9, 0.55); fin.lineTo(-1.0, -0.45); fin.lineTo(0, -0.1);
    const finMesh = add(vane, new THREE.ExtrudeGeometry(fin, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), darkMatte, [-1.0, 0, -0.02]);
    finMesh.castShadow = true;
    const tip = add(vane, new THREE.ConeGeometry(0.16, 0.5, 4), metalMat, [1.6, 0, 0]);
    tip.rotation.z = -Math.PI / 2;
    // a thin orbit ring
    const ring = add(g, new THREE.TorusGeometry(2.7, 0.025, 8, 160), metalMat, [0, 0.9, 0]);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false;
    const anim = { head, vane, speed: 0 };
    tuneModel(anim, info);
    return [g, anim];
  }
  function tuneModel(anim, info) {
    if (anim.vane) anim.vane.rotation.y = -((info.dir ?? 0) * Math.PI) / 180 + Math.PI / 2;
    if (anim.head) anim.speed = 0.6 + Math.min(8, info.wind ?? 0) * 0.85;
  }

  function cloudModel(info) {
    const g = new THREE.Group();
    const r = rng(23);
    const c = Math.max(0.12, Math.min(1, info.cloud / 100));
    cloudMass(r, -1.3, 0.5, 0.4, 3.6 * (0.6 + c * 0.4), 7, 0.85 + c * 0.55, mat.cloud, g);
    if (c > 0.3) cloudMass(r, 2.1, 1.2, -0.4, 2.6, 5, 0.65 + c * 0.45, mat.cloud, g);
    if (c > 0.65) cloudMass(r, 0.3, -0.7, 1.2, 3.4, 6, 0.85, mat.cloud, g);
    return [g, {}];
  }

  function buildModel(page, info) {
    if (page === 'precip') return islandModel(info);
    if (page === 'air') return anemometerModel(info);
    if (page === 'cloud') return cloudModel(info);
    const g = new THREE.Group();
    if (page === 'sun') add(g, sphereGeo, mat.sun, [0, 0.2, 0], 2.7);
    if (page === 'moon') add(g, sphereGeo, mat.moonPhase, [0, 0.2, 0], 2.7);
    if (page === 'temp') {
      digitMesh(String(info.temp), 5.6).then((m) => {
        if (!g.parent) { m.geometry.dispose(); return; }
        m.position.y = -2.6;
        g.add(m);
      });
    }
    return [g, {}];
  }

  // start the carousel on `index`; pages = [{ page, info, key }]
  function enterDetail(pages, index) {
    exitDetail();
    mode = 'detail';
    art.visible = digits.visible = false;
    wall.position.z = -9; // behind the receding neighbours, so it never cuts through them
    models = pages.map(({ page, info, key }) => {
      const wrap = new THREE.Group();
      const [inner, anim] = buildModel(page, info);
      wrap.add(inner);
      carousel.add(wrap);
      return { page, wrap, inner, anim, key, rotY: 0, rotX: 0, velY: 0, velX: 0, idleAt: 0 };
    });
    current = pos = index;
    scene.fog.color.set(night ? 0x1f1f1f : 0xffffff);
    resize();
  }
  // rebuild one page's model when its data changes (e.g. the scrubber moved)
  function updateDetail(i, info, key) {
    const m = models[i];
    if (!m) return;
    if (m.key === key) { tuneModel(m.anim, info); return; }
    m.wrap.remove(m.inner);
    clearGroup(m.inner);
    const [inner, anim] = buildModel(m.page, info);
    m.inner = inner; m.anim = anim; m.key = key;
    m.wrap.add(inner);
  }
  function showPage(i) { current = i; }
  function exitDetail() {
    for (const m of models) { carousel.remove(m.wrap); clearGroup(m.wrap); }
    models = [];
    if (mode === 'detail') {
      mode = 'hero';
      wall.position.z = -3.2;
      art.visible = digits.visible = true;
      resize();
    }
  }

  let night = false;
  function setNight(isNight) {
    night = isNight;
    scene.fog.color.set(night ? 0x1f1f1f : 0xffffff);
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
    if (mode === 'detail') { scene.fog.near = d + 1.5; scene.fog.far = d + 11; } else { scene.fog.near = 900; scene.fog.far = 1000; }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ----- drag to spin, with inertia, then settle back to the front -----
  // In the hero the whole scene turns; on a detail page only that page's model does.
  const heroRot = { rotY: 0, rotX: 0, velY: 0, velX: 0, idleAt: 0 };
  const target = () => (mode === 'detail' ? models[current] || heroRot : heroRot);
  let dragging = false, lastX = 0, lastY = 0, moved = 0, held = heroRot;
  let flash = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0;
    held = target();
    lastX = e.clientX; lastY = e.clientY;
    held.velX = held.velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    held.velY = dx * 0.012;
    held.velX = dy * 0.008;
    held.rotY += held.velY;
    held.rotX = THREE.MathUtils.clamp(held.rotX + held.velX, -0.8, 0.8);
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    held.idleAt = performance.now();
    if (moved < 6) { flash = 1; onTap?.(); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // inertia, then a slow return to the nearest front-facing angle
  function settle(r, now, active) {
    if (active) return;
    r.rotY += r.velY; r.rotX += r.velX;
    r.velY *= 0.94; r.velX *= 0.9;
    if (now - r.idleAt > 1800 && Math.abs(r.velY) < 0.002) {
      const front = Math.round(r.rotY / (Math.PI * 2)) * Math.PI * 2;
      r.rotY += (front - r.rotY) * 0.05;
      r.rotX += (0 - r.rotX) * 0.07;
    }
  }

  // ----- loop -----
  let raf = 0, last = performance.now();
  const clock0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - clock0) / 1000;
    settle(heroRot, now, dragging && held === heroRot);
    spin.rotation.y = heroRot.rotY + Math.sin(t * 0.5) * 0.05;
    spin.rotation.x = heroRot.rotX;
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
    if (models.length) {
      // slide the carousel toward the chosen page (wrapping round)
      const N = models.length;
      let diff = current - pos;
      diff -= Math.round(diff / N) * N;
      pos += diff * Math.min(1, dt * 7);
      models.forEach((m, k) => {
        let o = k - pos;
        o -= Math.round(o / N) * N;
        const a = Math.min(1, Math.abs(o));
        m.wrap.visible = Math.abs(o) < 1.6;
        m.wrap.position.set(o * 7.8, 0, -a * 5);
        m.wrap.scale.setScalar(1 - a * 0.12);
        settle(m, now, dragging && held === m);
        m.wrap.rotation.y = m.rotY + Math.sin(t * 0.5 + k) * 0.05;
        m.wrap.rotation.x = m.rotX;
        const an = m.anim;
        if (an.head) an.head.rotation.y -= an.speed * dt;
        for (const [peb, y, ph] of an.pebbles || []) { peb.position.y = y + Math.sin(t * 0.9 + ph) * 0.12; peb.rotation.y += dt * 0.2; }
        for (const f of an.rain || []) {
          f[2] = (f[2] + dt * f[1] / 4) % 1;
          f[0].position.y = 4.4 - f[2] * 3.9;
          f[0].visible = f[2] < 0.97;
        }
        for (const rp of an.ripples || []) {
          const k2 = (t * 0.6 + rp[1]) % 1;
          rp[0].scale.setScalar(0.4 + k2 * 3.2);
          rp[0].material.opacity = 0.6 * (1 - k2);
        }
      });
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
    // draw right away instead of waiting for the next animation frame
    renderNow() { resize(); renderer.render(scene, camera); },
    enterDetail,
    updateDetail,
    showPage,
    exitDetail,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearGroup(art); clearGroup(digits);
      exitDetail();
      [rockMat, metalMat, darkMatte, waterMat, rippleMat].forEach((m) => m.dispose());
      Object.values(mat).forEach((m) => m.dispose());
      shared.forEach((g) => g.dispose());
      grain.dispose();
      renderer.dispose();
      // hand the GPU context back right away: Safari only allows a few at once, and
      // leaked ones make later scenes drop out (a white blink)
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
