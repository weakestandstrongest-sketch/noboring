// Weather hero as a real 3D scene: grainy sun/moon, glossy cloud spheres and
// thick extruded numerals. Drag to spin it all the way around.
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
    x += g.ha * scale * 0.96;
  }
  return shapes;
}

// fine noise used as a bump/roughness map so surfaces look sandblasted
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
  t.repeat.set(3, 3);
  return t;
}

export function createWeather3D(container, { onTap } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const grain = grainTexture();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.5);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-6, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10; key.shadow.camera.right = 10;
  key.shadow.camera.top = 12; key.shadow.camera.bottom = -8;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0008;
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(8, 4, -6);
  scene.add(hemi, key, rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.35;
  ground.receiveShadow = true;
  scene.add(ground);

  const spin = new THREE.Group();     // rotated by the user
  const art = new THREE.Group();
  const digits = new THREE.Group();
  art.position.y = 0.7; // keep the sky clear of the numerals
  spin.add(art, digits);
  scene.add(spin);

  const mat = {
    sun: new THREE.MeshStandardMaterial({ color: 0xff1a24, roughness: 0.78, bumpMap: grain, bumpScale: 0.6, emissive: 0x330000 }),
    moon: new THREE.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 0.92, bumpMap: grain, bumpScale: 0.6, emissive: 0x222222 }),
    cloud: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.42, bumpMap: grain, bumpScale: 0.4 }),
    cloudLight: new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.6, bumpMap: grain, bumpScale: 0.4 }),
    streak: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
    drop: new THREE.MeshStandardMaterial({ color: 0x2f7fe0, roughness: 0.3 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.5, emissive: 0x664400 }),
    digit: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, bumpMap: grain, bumpScale: 0.25 }),
  };
  const sphereGeo = new THREE.SphereGeometry(1, 64, 48);

  function add(group, geo, material, pos, scale = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  const floaters = [];  // [mesh, baseY, phase]
  const fallers = [];   // [mesh, x, z, speed, phase]

  function clearGroup(g) {
    for (const c of [...g.children]) {
      g.remove(c);
      if (c.geometry && c.geometry !== sphereGeo) c.geometry.dispose();
    }
  }

  function buildArt(kind, isDay) {
    clearGroup(art);
    floaters.length = 0;
    fallers.length = 0;
    const cm = kind === 'snow' || kind === 'fog' ? mat.cloudLight : mat.cloud;
    const celestial = isDay ? mat.sun : mat.moon;
    const cloud = (x, y, z, r) => floaters.push([add(art, sphereGeo, cm, [x, y, z], r), y, Math.random() * 6]);
    const streak = (x, y, z, len, rot) => {
      const s = add(art, sphereGeo, mat.streak, [x, y, z], [len, 0.06, 0.16]);
      s.rotation.z = rot;
    };
    if (kind === 'clear') {
      add(art, sphereGeo, celestial, [0, 5.4, -0.6], 2.9);
      streak(-1.8, 8.2, 1.2, 1.3, -0.08); streak(2.4, 7.4, 1.4, 1.1, 0.12);
    } else if (kind === 'partly') {
      add(art, sphereGeo, celestial, [0.2, 5.6, -1.2], 2.7);
      cloud(-3.0, 5.0, 0.6, 0.95); cloud(-3.1, 3.7, 1.0, 0.8); cloud(-2.2, 3.5, 1.6, 0.7);
      cloud(-1.2, 4.6, 1.8, 0.62); cloud(1.4, 4.7, 1.7, 0.62); cloud(3.1, 4.5, 0.8, 0.85); cloud(4.4, 3.8, 0.4, 0.35);
      streak(-1.5, 8.0, 0.6, 1.2, -0.06); streak(2.3, 7.9, 0.4, 1.2, 0.1); streak(0.4, 5.2, 2.4, 1.3, 0.02); streak(2.2, 4.3, 2.2, 1.2, -0.22);
    } else {
      if (kind === 'cloudy') add(art, sphereGeo, celestial, [1.6, 6.6, -2.2], 1.6);
      cloud(-2.4, 5.3, 0.2, 1.35); cloud(0.2, 6.0, -0.4, 1.6); cloud(2.6, 5.2, 0.1, 1.3);
      cloud(-1.1, 4.1, 1.3, 1.1); cloud(1.4, 4.0, 1.2, 1.05); cloud(-3.8, 4.0, 0.6, 0.6); cloud(4.0, 4.1, 0.5, 0.55);
      streak(-2.0, 7.8, 0.6, 1.1, -0.1); streak(2.6, 7.6, 0.4, 1.2, 0.12);
      if (kind === 'rain' || kind === 'storm') {
        const g = new THREE.CapsuleGeometry(0.07, 0.38, 4, 8);
        for (let i = 0; i < 22; i++) {
          const x = -3.4 + Math.random() * 6.8, z = -0.4 + Math.random() * 2.4;
          fallers.push([add(art, g, mat.drop, [x, 3, z]), x, z, 5 + Math.random() * 2, Math.random()]);
        }
      }
      if (kind === 'snow') {
        const g = new THREE.SphereGeometry(0.11, 12, 10);
        for (let i = 0; i < 26; i++) {
          const x = -3.4 + Math.random() * 6.8, z = -0.4 + Math.random() * 2.4;
          fallers.push([add(art, g, mat.snow, [x, 3, z]), x, z, 1.1 + Math.random() * 0.6, Math.random()]);
        }
      }
      if (kind === 'storm') {
        const s = new THREE.Shape();
        s.moveTo(0.2, 0); s.lineTo(-0.7, -1.4); s.lineTo(-0.05, -1.4); s.lineTo(-0.5, -2.8); s.lineTo(0.9, -0.9); s.lineTo(0.2, -0.9); s.lineTo(0.7, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
        add(art, g, mat.bolt, [0.1, 3.8, 1.6]);
      }
      if (kind === 'fog') {
        for (let i = 0; i < 3; i++) {
          const g = new THREE.CapsuleGeometry(0.16, 6 - i * 1.4, 4, 12);
          const m = add(art, g, mat.cloudLight, [0, 3.0 - i * 0.5, 1.6]);
          m.rotation.z = Math.PI / 2;
        }
      }
    }
  }

  let font = null;
  let text = '';
  async function setText(t) {
    text = t;
    font ||= await loadFont();
    if (text !== t) return;
    clearGroup(digits);
    const shapes = textShapes(font, t, 1);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.16, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.028, bevelSegments: 3,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const h = bb.max.y - bb.min.y;
    const s = 5.6 / h; // digits always stand 5.6 units tall
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const m = new THREE.Mesh(geo, mat.digit);
    m.scale.set(s * 1.05, s, 1.5 / 0.26); // ~1.5 units thick
    m.position.y = -3.35;
    m.castShadow = true;
    m.receiveShadow = true;
    digits.add(m);
  }

  function setNight(night) {
    hemi.intensity = night ? 0.7 : 1.5;
    hemi.groundColor.set(night ? 0x111111 : 0x9a9a9a);
    key.intensity = night ? 1.4 : 2.6;
    ground.material.opacity = night ? 0.35 : 0.16;
    mat.digit.color.set(night ? 0x2c2c2c : 0x1b1b1b);
  }

  // ----- size -----
  function resize() {
    const w = container.clientWidth, hgt = container.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${hgt}px`;
    camera.aspect = w / hgt;
    // fit a 10×13 box (art + numerals) into the view
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = 6.5 / Math.tan(vFov / 2);
    const distW = 5.0 / (Math.tan(vFov / 2) * camera.aspect);
    const d = Math.max(distH, distW) * 1.04;
    camera.position.set(0, 3.2, d);
    camera.lookAt(0, 3.05, 0);
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
    spin.rotation.y = rotY + Math.sin(t * 0.6) * 0.06;
    spin.rotation.x = rotX;
    for (const [m, y, ph] of floaters) m.position.y = y + Math.sin(t * 0.9 + ph) * 0.08;
    for (const f of fallers) {
      const [m, , , speed] = f;
      f[4] = (f[4] + dt * speed / 4) % 1;
      m.position.y = 3.6 - f[4] * 4.2;
      m.visible = f[4] < 0.92;
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
    setScene(kind, isDay) { buildArt(kind, isDay); setNight(!isDay); },
    setText,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearGroup(art); clearGroup(digits);
      Object.values(mat).forEach((m) => m.dispose());
      sphereGeo.dispose(); grain.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
