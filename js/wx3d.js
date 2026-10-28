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
  // no filmic tone mapping: keeps the whites white and the red vivid, like a bright studio shot
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  const grain = grainTexture();

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe4e4e4, 1.7);
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-6, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10; key.shadow.camera.right = 10;
  key.shadow.camera.top = 12; key.shadow.camera.bottom = -8;
  key.shadow.radius = 8;
  key.shadow.bias = -0.0008;
  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(6, 3, 12);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(8, 4, -6);
  // warm bounce from the sun onto the tops of the numerals
  const glow = new THREE.PointLight(0xff2a2a, 0, 7, 1.6);
  glow.position.set(0, 3.4, 1.6);
  scene.add(hemi, key, fill, rim, glow);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.09 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.35;
  ground.receiveShadow = true;
  scene.add(ground);

  const spin = new THREE.Group();     // rotated by the user
  const art = new THREE.Group();
  const digits = new THREE.Group();
  art.position.y = 0.9; // keep the sky clear of the numerals
  spin.add(art, digits);
  scene.add(spin);

  const mat = {
    sun: new THREE.MeshStandardMaterial({ color: 0xff2b2b, roughness: 0.62, bumpMap: grain, bumpScale: 0.35, emissive: 0x7a0606 }),
    moon: new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.9, bumpMap: grain, bumpScale: 0.4, emissive: 0x3a3a36 }),
    crater: new THREE.MeshStandardMaterial({ color: 0xd9dad3, roughness: 0.95 }),
    cloud: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.36, bumpMap: grain, bumpScale: 0.2 }),
    cloudLight: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.55, bumpMap: grain, bumpScale: 0.2 }),
    streak: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4 }),
    drop: new THREE.MeshStandardMaterial({ color: 0x3b8cff, roughness: 0.25, emissive: 0x0a2a66 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x333333 }),
    star: new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xfff0a0, emissiveIntensity: 0.8 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.45, emissive: 0x8a6400 }),
    digit: new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.38, metalness: 0.05, bumpMap: grain, bumpScale: 0.12 }),
  };
  const sphereGeo = new THREE.SphereGeometry(1, 64, 48);
  const arcGeo = new THREE.TorusGeometry(1.2, 0.085, 12, 40, 0.9);
  // teardrop raindrop: a lathe profile, round at the bottom and pointed on top
  const dropGeo = new THREE.LatheGeometry(
    Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      return new THREE.Vector2(Math.sin(Math.PI * t) * (1 - t * 0.85) * 0.16, -0.16 + t * 0.5);
    }), 20);

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
  const fallers = [];   // [mesh, x, z, speed, phase]
  const twinklers = []; // [mesh, phase]
  let breather = null;  // sun/moon gently breathes

  function clearGroup(g) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse?.((o) => { if (o.geometry && ![sphereGeo, arcGeo, dropGeo].includes(o.geometry)) o.geometry.dispose(); });
    }
  }

  // a puffy cloud: one big ball, two shoulders and a couple of little bumps, flat-ish bottom
  function puff(x, y, z, size, m) {
    const g = new THREE.Group();
    const balls = [[0, 0.25, 0, 1], [-0.9, -0.05, 0.1, 0.72], [0.95, -0.02, 0.05, 0.78], [-1.6, -0.3, 0.2, 0.42], [1.7, -0.28, 0.15, 0.45], [0.2, -0.35, 0.45, 0.62]];
    for (const [bx, by, bz, r] of balls) add(g, sphereGeo, m, [bx, by, bz], [r, r * 0.9, r]);
    g.position.set(x, y, z);
    g.scale.setScalar(size);
    art.add(g);
    floaters.push([g, x, y, Math.random() * 6, 0.12 + Math.random() * 0.1]);
    return g;
  }
  function swoosh(x, y, z, size, rot, flip = 1) {
    const s = add(art, arcGeo, mat.streak, [x, y, z], [size * flip, size, size]);
    s.rotation.z = rot;
    s.castShadow = false;
    floaters.push([s, x, y, Math.random() * 6, 0.25]);
  }
  function celestialBody(isDay, pos, r) {
    const body = add(art, sphereGeo, isDay ? mat.sun : mat.moon, pos, r);
    breather = [body, r];
    if (!isDay) {
      for (const [cx, cy, cr] of [[-0.35, 0.3, 0.2], [0.25, -0.2, 0.14], [0.1, 0.45, 0.09], [-0.15, -0.45, 0.12]]) {
        const v = new THREE.Vector3(cx, cy, Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy)) * 0.93);
        const c = add(body, sphereGeo, mat.crater, v.toArray(), [cr, cr, cr * 0.35]);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());
      }
      for (let i = 0; i < 9; i++) {
        const st = add(art, sphereGeo, mat.star, [-4.2 + Math.random() * 8.4, 3 + Math.random() * 6.5, -2 - Math.random() * 2], 0.06 + Math.random() * 0.06);
        st.castShadow = false;
        twinklers.push([st, Math.random() * 6]);
      }
    } else {
      glow.intensity = 6;
    }
    return body;
  }

  function buildArt(kind, isDay) {
    clearGroup(art);
    floaters.length = 0;
    fallers.length = 0;
    twinklers.length = 0;
    breather = null;
    glow.intensity = 0;
    const cm = kind === 'snow' || kind === 'fog' ? mat.cloudLight : mat.cloud;
    if (kind === 'clear') {
      celestialBody(isDay, [0, 5.3, -0.4], 2.8);
      swoosh(-2.6, 7.6, 1.0, 1.0, 0.5); swoosh(2.8, 6.4, 1.2, 0.9, -0.2, -1);
    } else if (kind === 'partly') {
      celestialBody(isDay, [0.6, 5.7, -1.2], 2.6);
      puff(-1.3, 4.1, 1.4, 1.2, cm);
      puff(2.8, 3.9, 0.9, 0.75, cm);
      swoosh(-2.8, 7.3, 0.4, 0.9, 0.55); swoosh(3.2, 7.2, 0.2, 0.8, -0.3, -1); swoosh(1.2, 2.9, 2.4, 0.7, -0.1, -1);
    } else {
      if (kind === 'cloudy') celestialBody(isDay, [2.2, 6.9, -2.4], 1.5);
      puff(-1.6, 5.6, 0.0, 1.25, cm);
      puff(1.8, 5.0, 0.6, 1.1, cm);
      puff(-0.2, 3.9, 1.5, 0.9, cm);
      swoosh(-3.2, 7.6, 0.4, 0.8, 0.5); swoosh(3.4, 7.1, 0.3, 0.75, -0.3, -1);
      if (kind === 'rain' || kind === 'storm') {
        for (let i = 0; i < 18; i++) {
          const x = -3.2 + Math.random() * 6.4, z = -0.2 + Math.random() * 2.4;
          fallers.push([add(art, dropGeo, mat.drop, [x, 3, z], 1.1), x, z, 4 + Math.random() * 1.5, Math.random()]);
        }
      }
      if (kind === 'snow') {
        for (let i = 0; i < 24; i++) {
          const x = -3.4 + Math.random() * 6.8, z = -0.4 + Math.random() * 2.4;
          fallers.push([add(art, sphereGeo, mat.snow, [x, 3, z], 0.12 + Math.random() * 0.06), x, z, 1.0 + Math.random() * 0.5, Math.random()]);
        }
      }
      if (kind === 'storm') {
        const sh = new THREE.Shape();
        sh.moveTo(0.2, 0); sh.lineTo(-0.7, -1.4); sh.lineTo(-0.05, -1.4); sh.lineTo(-0.5, -2.8); sh.lineTo(0.9, -0.9); sh.lineTo(0.2, -0.9); sh.lineTo(0.7, 0);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
        const bolt = add(art, g, mat.bolt, [0.1, 3.9, 1.9]);
        floaters.push([bolt, 0.1, 3.9, 0, 0.05]);
      }
      if (kind === 'fog') {
        for (let i = 0; i < 3; i++) {
          const g = new THREE.CapsuleGeometry(0.2, 5.4 - i * 1.3, 6, 16);
          const m = add(art, g, mat.cloudLight, [0, 3.0 - i * 0.55, 1.8]);
          m.rotation.z = Math.PI / 2;
          floaters.push([m, 0, 3.0 - i * 0.55, i * 2, 0.35]);
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
      depth: 0.16, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.034, bevelSegments: 4,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const h = bb.max.y - bb.min.y;
    const s = 5.9 / h; // digits always stand 5.9 units tall
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const m = new THREE.Mesh(geo, mat.digit);
    m.scale.set(s * 0.94, s, 1.5 / 0.28); // tall and narrow, ~1.5 units thick
    m.position.y = -3.35;
    m.castShadow = true;
    m.receiveShadow = true;
    digits.add(m);
  }

  function setNight(night) {
    hemi.intensity = night ? 0.9 : 1.7;
    hemi.groundColor.set(night ? 0x202020 : 0xe4e4e4);
    key.intensity = night ? 1.3 : 1.9;
    fill.intensity = night ? 0.45 : 0.75;
    ground.material.opacity = night ? 0.3 : 0.09;
    mat.digit.color.set(night ? 0x3a3a3a : 0x2c2c2c);
    mat.cloud.color.set(night ? 0x3a3a3a : 0x2a2a2a);
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
    for (const [o, x, y, ph, drift] of floaters) {
      o.position.y = y + Math.sin(t * 0.9 + ph) * 0.09;
      o.position.x = x + Math.sin(t * 0.35 + ph) * drift;
    }
    for (const [m, ph] of twinklers) m.scale.setScalar(0.07 * (0.6 + 0.4 * Math.sin(t * 2.4 + ph)));
    if (breather) breather[0].scale.setScalar(breather[1] * (1 + Math.sin(t * 1.1) * 0.012));
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
      sphereGeo.dispose(); arcGeo.dispose(); dropGeo.dispose(); grain.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
