import * as THREE from 'three';
import { OrbitControls } from '../blender-workflow/vendor/examples/jsm/controls/OrbitControls.js';

// Natural Earth 1:110m land polygons, stored locally. Natural Earth is public domain.
const LAND_URL = new URL('./assets/globe-land.geojson', import.meta.url);
const COLORS = { ocean: '#132c24', land: '#506b4b', coast: '#b3bd92', accent: '#e9ac65', active: '#f6d59d' };
const SVG_NS = 'http://www.w3.org/2000/svg';
let landPromise;

const getLand = () => (landPromise ||= fetch(LAND_URL).then((response) => {
  if (!response.ok) throw new Error('Local land geometry is unavailable');
  return response.json();
}));
const coordinates = (feature) => feature.geometry.type === 'Polygon'
  ? [feature.geometry.coordinates]
  : feature.geometry.coordinates;
const validEvents = (events = []) => events.filter((event) =>
  event && event.id != null && Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng))
  && Number(event.lat) >= -90 && Number(event.lat) <= 90
).map((event) => ({ ...event, lat: Number(event.lat), lng: Number(event.lng) }));

function positionFor(lat, lng, radius = 1) {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  return new THREE.Vector3(
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.sin(latitude),
    -radius * Math.cos(latitude) * Math.sin(longitude),
  );
}

function makeMapTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.fillStyle = COLORS.ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, context, texture };
}

function paintLand({ canvas, context, texture }, data) {
  const width = canvas.width;
  const height = canvas.height;
  context.fillStyle = COLORS.ocean;
  context.fillRect(0, 0, width, height);
  context.fillStyle = COLORS.land;
  context.strokeStyle = COLORS.coast;
  context.lineWidth = 0.75;
  for (const feature of data.features) {
    for (const polygon of coordinates(feature)) {
      context.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lng, lat], index) => {
          const x = (lng + 180) / 360 * width;
          const y = (90 - lat) / 180 * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      }
      context.fill('evenodd');
      context.globalAlpha = 0.47;
      context.stroke();
      context.globalAlpha = 1;
    }
  }
  // Fine printed-map grain gives the land a softer, editorial finish.
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = 'rgba(224,229,195,.045)';
  for (let y = 2; y < height; y += 5) {
    for (let x = (y % 2) + 1; x < width; x += 5) context.fillRect(x, y, 1, 1);
  }
  context.globalCompositeOperation = 'source-over';
  texture.needsUpdate = true;
}

function makeGraticule() {
  const positions = [];
  const segment = (a, b) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lng = -180; lng < 180; lng += 3) {
      segment(positionFor(lat, lng, 1.003), positionFor(lat, lng + 3, 1.003));
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    for (let lat = -90; lat < 90; lat += 3) {
      segment(positionFor(lat, lng, 1.003), positionFor(lat + 3, lng, 1.003));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xc2c5a6, transparent: true, opacity: 0.17, depthWrite: false,
  }));
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function createMapFallback({ container, events, onSelect, previousSelection = null }) {
  let currentEvents = validEvents(events);
  let selectedId = previousSelection ?? currentEvents[0]?.id ?? null;
  let disposed = false;
  const svg = svgElement('svg', {
    viewBox: '0 0 720 420', role: 'group', 'aria-label': 'Speaking locations on a world map',
  });
  Object.assign(svg.style, { width: '100%', height: '100%', display: 'block', minHeight: '250px' });
  const title = svgElement('title');
  title.textContent = 'Speaking around the world — select a city';
  svg.append(title);
  const land = svgElement('g', { fill: '#53694f', stroke: '#b3bd92', 'stroke-width': '.45' });
  const grid = svgElement('g', { fill: 'none', stroke: '#94a18d', 'stroke-width': '.5', opacity: '.3' });
  for (let x = 60; x < 720; x += 60) grid.append(svgElement('path', { d: `M${x} 38V382` }));
  for (let y = 60; y < 400; y += 60) grid.append(svgElement('path', { d: `M0 ${y}H720` }));
  svg.append(grid, land);
  const markerLayer = svgElement('g');
  svg.append(markerLayer);
  container.append(svg);

  function renderMarkers(requestedFocusId = null) {
    const previousFocusId = markerLayer.contains(document.activeElement)
      ? document.activeElement.getAttribute('data-event-id')
      : null;
    const focusId = requestedFocusId ?? previousFocusId;
    let focusTarget = null;
    markerLayer.replaceChildren();
    currentEvents.forEach((event) => {
      const x = (event.lng + 180) * 2;
      const y = 30 + (90 - event.lat) * 2;
      const active = event.id === selectedId;
      const marker = svgElement('g', {
        transform: `translate(${x} ${y})`, role: 'button', tabindex: '0',
        'aria-label': `${event.city}: ${event.title}`, 'aria-pressed': String(active),
        'data-event-id': event.id,
      });
      marker.style.cursor = 'pointer';
      const markerTitle = svgElement('title');
      markerTitle.textContent = `${event.city}: ${event.title}`;
      marker.append(markerTitle);
      marker.append(svgElement('circle', { r: active ? 14 : 10, fill: COLORS.accent, opacity: '.18' }));
      marker.append(svgElement('circle', { r: active ? 5 : 3.5, fill: active ? COLORS.active : COLORS.accent, stroke: COLORS.ocean, 'stroke-width': '1.5' }));
      // Nearby cities remain discoverable through their points and event list;
      // one selected label avoids overlapping place names at small map sizes.
      if (active) {
        marker.append(svgElement('rect', {
          x: '9', y: '-10', width: String(event.city?.length * 11 + 8 || 40), height: '19',
          rx: '2', fill: '#f5f3ec', stroke: '#9ca98c', 'stroke-width': '.5',
        }));
        const label = svgElement('text', {
          x: '13', y: '4', fill: '#253b2e', 'font-family': 'inherit', 'font-size': '11',
        });
        label.textContent = event.city;
        marker.append(label);
      }
      const choose = () => {
        selectedId = event.id;
        renderMarkers(String(event.id));
        onSelect?.(event.id);
      };
      marker.addEventListener('click', choose);
      marker.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose();
        }
      });
      markerLayer.append(marker);
      if (String(event.id) === focusId) focusTarget = marker;
    });
    focusTarget?.focus({ preventScroll: true });
  }
  renderMarkers();
  getLand().then((data) => {
    if (disposed) return;
    for (const feature of data.features) {
      for (const polygon of coordinates(feature)) {
        const d = polygon.map((ring) => ring.map(([lng, lat], index) =>
          `${index ? 'L' : 'M'}${((lng + 180) * 2).toFixed(2)} ${(30 + (90 - lat) * 2).toFixed(2)}`
        ).join('') + 'Z').join('');
        land.append(svgElement('path', { d, 'fill-rule': 'evenodd' }));
      }
    }
  }).catch(() => {
    const label = svgElement('text', { x: '360', y: '410', 'text-anchor': 'middle', fill: '#aeb8a5', 'font-size': '11' });
    label.textContent = 'CITY COORDINATES · WORLD ATLAS';
    svg.append(label);
  });
  return {
    select(id) {
      if (!currentEvents.some((event) => event.id === id)) return;
      selectedId = id;
      renderMarkers();
    },
    setRotating() {},
    setEvents(next) {
      currentEvents = validEvents(next);
      if (!currentEvents.some((event) => event.id === selectedId)) selectedId = currentEvents[0]?.id ?? null;
      renderMarkers();
    },
    resize() {},
    dispose() { disposed = true; svg.remove(); },
    getState: () => ({ selectedId, rotating: false, mode: 'map', ready: true }),
  };
}

/**
 * Local, interactive speaking atlas. All event content is supplied by the caller.
 * Public select() never calls onSelect; onSelect is reserved for user activation.
 */
export function createGlobe({ container, events = [], onSelect, reducedMotion = false } = {}) {
  if (!(container instanceof Element)) throw new TypeError('createGlobe requires a container element');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return createMapFallback({ container, events, onSelect });
  }
  let currentEvents = validEvents(events);
  let selectedId = currentEvents[0]?.id ?? null;
  let rotating = !reducedMotion;
  let disposed = false;
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let focusAnimation = null;
  let fallback = null;
  let autoResumeAt = 0;
  const cleanupListeners = [];
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Interactive globe of speaking locations. Drag to rotate, or choose a city in the event list.');
  canvas.setAttribute('role', 'img');
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(canvas);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.copy(positionFor(28, 58, 4.05));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.55;
  controls.autoRotateSpeed = 0.32;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  canvas.style.touchAction = 'pan-y';

  const map = makeMapTexture();
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.MeshStandardMaterial({ map: map.texture, roughness: 1, metalness: 0 }),
  );
  scene.add(planet, makeGraticule());
  scene.add(new THREE.AmbientLight(0xe6eddb, 1.45));
  const keyLight = new THREE.DirectionalLight(0xffecd3, 2.1);
  keyLight.position.set(2.6, 3.8, 3.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x9cbca3, 0.65);
  fillLight.position.set(-3, -1, -3);
  scene.add(fillLight);

  // A very fine atmospheric rim keeps the silhouette legible on dark backgrounds.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.028, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color(0xa5b78c) } },
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(color,rim*.21);}',
    }),
  );
  scene.add(atmosphere);

  let eventGroup = new THREE.Group();
  scene.add(eventGroup);
  let markers = [];
  const label = document.createElement('span');
  label.className = 'globe-city-label';
  Object.assign(label.style, {
    position: 'absolute', pointerEvents: 'none', zIndex: '2', color: '#f4d3a5',
    font: '500 10px/1.2 var(--font-mono, monospace)', letterSpacing: '.08em',
    textTransform: 'uppercase', whiteSpace: 'nowrap', transform: 'translate(13px,-50%)',
    textShadow: '0 1px 10px #132c24, 0 1px 3px #132c24',
  });
  container.append(label);

  function makeEvents() {
    scene.remove(eventGroup);
    disposeObject(eventGroup);
    eventGroup = new THREE.Group();
    scene.add(eventGroup);
    markers = [];
    for (const event of currentEvents) {
      const normal = positionFor(event.lat, event.lng);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.017, 16, 12),
        new THREE.MeshBasicMaterial({ color: event.id === selectedId ? COLORS.active : COLORS.accent }),
      );
      marker.position.copy(normal).multiplyScalar(1.018);
      marker.userData = { event, normal };
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.031, 0.037, 40),
        new THREE.MeshBasicMaterial({
          color: COLORS.accent, side: THREE.DoubleSide, transparent: true,
          opacity: event.id === selectedId ? 0.7 : 0.28, depthWrite: false,
        }),
      );
      halo.position.copy(normal).multiplyScalar(1.012);
      halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      marker.userData.halo = halo;
      eventGroup.add(marker, halo);
      markers.push(marker);
    }
    for (let index = 1; index < currentEvents.length; index++) {
      const a = positionFor(currentEvents[index - 1].lat, currentEvents[index - 1].lng);
      const b = positionFor(currentEvents[index].lat, currentEvents[index].lng);
      const points = [];
      const angle = a.angleTo(b);
      const height = Math.min(0.24, 0.045 + angle * 0.13);
      for (let step = 0; step <= 72; step++) {
        const t = step / 72;
        const point = new THREE.Vector3().lerpVectors(a, b, t);
        if (point.lengthSq() < 1e-5) point.set(0, 1, 0);
        points.push(point.normalize().multiplyScalar(1.016 + Math.sin(t * Math.PI) * height));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({
          color: COLORS.accent, transparent: true, opacity: 0.38,
          dashSize: 0.022, gapSize: 0.016, depthWrite: false,
        }),
      );
      line.computeLineDistances();
      eventGroup.add(line);
    }
  }
  makeEvents();

  function updateLabel() {
    const marker = markers.find((item) => item.userData.event.id === selectedId);
    if (!marker) {
      label.hidden = true;
      return;
    }
    const front = marker.userData.normal.dot(camera.position.clone().normalize()) > 0.22;
    const point = marker.position.clone().project(camera);
    label.hidden = !front || Math.abs(point.x) > 1 || Math.abs(point.y) > 1;
    label.textContent = marker.userData.event.city;
    label.style.left = `${(point.x * 0.5 + 0.5) * canvas.clientWidth}px`;
    label.style.top = `${(-point.y * 0.5 + 0.5) * canvas.clientHeight}px`;
  }

  function render(time = performance.now()) {
    frame = 0;
    if (disposed || fallback || !visible || document.hidden) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    if (focusAnimation) {
      const t = Math.min(1, (time - focusAnimation.started) / 1050);
      const eased = t * t * (3 - 2 * t);
      const rotation = new THREE.Quaternion().slerpQuaternions(
        new THREE.Quaternion(), focusAnimation.rotation, eased,
      );
      camera.position.copy(focusAnimation.from).applyQuaternion(rotation);
      if (t >= 1) {
        focusAnimation = null;
        autoResumeAt = time + 1800;
      }
    }
    controls.autoRotate = rotating && !reducedMotion && !focusAnimation && time > autoResumeAt;
    controls.update(delta);
    for (const marker of markers) {
      const active = marker.userData.event.id === selectedId;
      marker.scale.setScalar(active ? 1.35 : 1);
      marker.material.color.set(active ? COLORS.active : COLORS.accent);
      marker.userData.halo.material.opacity = active ? 0.75 : 0.26;
      marker.userData.halo.scale.setScalar(active && !reducedMotion ? 1 + Math.sin(time / 750) * 0.12 : 1);
    }
    updateLabel();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }
  function start() {
    if (!frame && !disposed && !fallback && visible && !document.hidden) {
      lastTime = 0;
      frame = requestAnimationFrame(render);
    }
  }
  function resize() {
    if (fallback) return fallback.resize();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight || width);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    start();
  }
  function select(id) {
    if (fallback) return fallback.select(id);
    const event = currentEvents.find((item) => item.id === id);
    if (!event) return;
    selectedId = id;
    const target = positionFor(event.lat, event.lng).normalize();
    const from = camera.position.clone();
    if (reducedMotion) {
      camera.position.copy(target).multiplyScalar(from.length());
      controls.update();
    } else {
      focusAnimation = {
        started: performance.now(), from,
        rotation: new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), target),
      };
    }
    start();
  }

  let pointerDown = null;
  function markerAt(event) {
    const rect = canvas.getBoundingClientRect();
    // A slightly expanded hit target is easier to use than the visible point.
    const direction = camera.position.clone().normalize();
    let best = null;
    let bestDistance = 15;
    for (const marker of markers) {
      if (marker.userData.normal.dot(direction) < 0.12) continue;
      const projected = marker.position.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
      const distance = Math.hypot(x - event.clientX, y - event.clientY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = marker;
      }
    }
    return best;
  }
  const listen = (element, name, handler, options) => {
    element.addEventListener(name, handler, options);
    cleanupListeners.push(() => element.removeEventListener(name, handler, options));
  };
  listen(canvas, 'pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
    focusAnimation = null;
    autoResumeAt = performance.now() + 4000;
  });
  listen(canvas, 'pointermove', (event) => {
    canvas.style.cursor = markerAt(event) ? 'pointer' : pointerDown ? 'grabbing' : 'grab';
  });
  listen(canvas, 'pointerup', (event) => {
    const isClick = pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 7;
    pointerDown = null;
    autoResumeAt = performance.now() + 3000;
    if (!isClick) return;
    const marker = markerAt(event);
    if (marker) {
      const id = marker.userData.event.id;
      select(id);
      onSelect?.(id);
    }
  });
  listen(canvas, 'pointercancel', () => { pointerDown = null; });
  listen(canvas, 'pointerleave', () => { canvas.style.cursor = 'grab'; });
  canvas.style.cursor = 'grab';

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  });
  visibilityObserver.observe(container);
  listen(document, 'visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else start();
  });
  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.style.display = 'none';
    label.hidden = true;
    fallback = createMapFallback({ container, events: currentEvents, onSelect, previousSelection: selectedId });
  });
  getLand().then((data) => {
    if (!disposed) {
      paintLand(map, data);
      start();
    }
  }).catch(() => {
    // The local asset normally exists; keep a usable coordinate atlas if it cannot load.
    if (!disposed && !fallback) {
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.style.display = 'none';
      label.hidden = true;
      fallback = createMapFallback({ container, events: currentEvents, onSelect, previousSelection: selectedId });
    }
  });
  resize();
  return {
    select,
    setRotating(value) {
      if (fallback) return fallback.setRotating(value);
      rotating = Boolean(value) && !reducedMotion;
      start();
    },
    setEvents(next) {
      currentEvents = validEvents(next);
      if (fallback) return fallback.setEvents(currentEvents);
      if (!currentEvents.some((event) => event.id === selectedId)) selectedId = currentEvents[0]?.id ?? null;
      makeEvents();
      start();
    },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      cleanupListeners.forEach((cleanup) => cleanup());
      controls.dispose();
      disposeObject(scene);
      map.texture.dispose();
      renderer.dispose();
      canvas.remove();
      label.remove();
      fallback?.dispose();
    },
    getState: () => fallback?.getState() ?? ({ selectedId, rotating, mode: 'webgl', ready: true }),
  };
}
