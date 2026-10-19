/* assets/js/builders/pirate-cannon.js
 * Pirate Cannon preset module for the 3D Builder shell (workshops/3d-builder.html).
 * Extracted from workshops/pirate-cannon-builder.html: mount(container) injects the
 * builder markup + CSS, runs the original builder core in a guarded scope
 * (window/document listeners and animation frames are tracked so unmount() can
 * tear it down), and exposes only the data-on/data-action handlers the shared
 * delegation needs. No other builder internals leak (module scope).
 */
export const ID = 'pirate-cannon';
export const LABEL = 'Pirate Cannon';
export const STYLES = ['../style-workshop-pirate-cannon-builder.css?v=17'];
const HTML = "<div id=\"app\">\n  <header id=\"main-content\">\n\n    <h1>💣 Build a Pirate Cannon Game</h1>\n<div class=\"callout tip\" style=\"border-left:3px solid #22c55e;background:rgba(34,197,94,.07);\"><div class=\"callout-icon\">📦</div><div><strong>Workshop reference pack:</strong> download an offline copy of the notes for this workshop: <a href=\"/downloads/pirate-cannon-builder-reference.zip\" download style=\"color:#16a34a;font-weight:800;text-decoration:underline;\">⬇ pirate-cannon-builder-reference.zip</a>. Every code block also has a <strong>Copy</strong> button.</div></div>\n\n    <div class=\"header-actions\">\n      <button data-on=\"openSaveModal\" data-on-plain>💾 Save</button>\n      <button data-on=\"openLoadModal\" data-on-plain>📂 Load</button>\n      <button data-on=\"resetAll\" data-on-plain>🔄 Reset</button>\n    </div>\n  </header>\n\n  <div id=\"sidebar\">\n    <div class=\"step-progress\">\n      <div class=\"progress-label\">Forge Progress</div>\n      <div class=\"progress-bar\"><div class=\"progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"step-counter\" id=\"stepCounter\">Step 1 of 15</div>\n    </div>\n    <div class=\"step-list\" id=\"stepList\"></div>\n    <div class=\"controls-panel\" id=\"controlsPanel\"></div>\n    <div class=\"step-nav\">\n      <button class=\"btn-prev\" id=\"btnPrev\" data-on=\"prevStep\" data-on-plain>◀ Previous</button>\n      <button class=\"btn-next\" id=\"btnNext\" data-on=\"nextStep\" data-on-plain>Next ?</button>\n    </div>\n  </div>\n\n  <div id=\"viewport\">\n    <div class=\"step-toast\" id=\"stepToast\"></div>\n    <div class=\"dim-display\" id=\"dimDisplay\">Workshop: <span id=\"wsWidth\">3</span>m × <span id=\"wsDepth\">3</span>m × <span id=\"wsHeight\">2.5</span>m</div>\n    <div class=\"viewport-hint\">Drag to orbit · Scroll to zoom</div>\n  </div>\n</div>\n\n<!-- Save/Load Modal -->\n<div class=\"modal-overlay\" id=\"modalOverlay\">\n  <div class=\"modal\" id=\"modalContent\"></div>\n</div>\n\n";
const CSS = "";
const ACTIONS = ["closeModal","doDelete","doLoad","doSave","goToStep","nextStep","openLoadModal","openSaveModal","prevStep","resetAll","updateParamChecked","updateParamFloat","updateParamRaw"];

export function mount(container) {
  var ac = new AbortController();
  var rafs = [];
  var winAdd = window.addEventListener.bind(window);
  var docAdd = document.addEventListener.bind(document);
  var origRaf = window.requestAnimationFrame.bind(window);
  function opt(o) { return Object.assign({}, (o && typeof o === 'object') ? o : {}, { signal: ac.signal }); }
  window.addEventListener = function (t, fn, o) { return winAdd(t, fn, opt(o)); };
  document.addEventListener = function (t, fn, o) {
    var r = docAdd(t, fn, opt(o));
    // Modules mount after the page has finished loading, so a builder that waits
    // for DOMContentLoaded would never initialise. Run that handler now instead.
    if (t === 'DOMContentLoaded' && document.readyState !== 'loading') { try { fn.call(document, new Event('DOMContentLoaded')); } catch (e) {} }
    return r;
  };
  window.requestAnimationFrame = function (fn) { var id = origRaf(fn); rafs.push(id); return id; };

  var stage = document.createElement('div');
  stage.id = 'bsStage';
  stage.className = 'bs-stage';
  stage.innerHTML = HTML;
  container.appendChild(stage);
  var sheet = document.createElement('style');
  sheet.setAttribute('data-bs-css', ID);
  sheet.textContent = CSS;
  document.head.appendChild(sheet);

  try {
// ============ DATA MODEL ============
const STEPS = [
  { id:'workshop', name:'Workshop Size', desc:'Set the dimensions of your workshop space' },
  { id:'barrelLen', name:'Barrel Length', desc:'How long is the main cannon barrel?' },
  { id:'barrelDia', name:'Barrel Diameter', desc:'Set the bore and outer diameter' },
  { id:'barrelShape', name:'Barrel Taper', desc:'Taper and flare of the barrel' },
  { id:'muzzle', name:'Muzzle Ring', desc:'Decorative ring at the mouth' },
  { id:'muzzleFlare', name:'Muzzle Flare', desc:'Bell-out at the cannon mouth' },
  { id:'cascabel', name:'Cascabel (Rear Knob)', desc:'The rounded knob at the breech' },
  { id:'trunnions', name:'Trunnions', desc:'Side mounting cylinders' },
  { id:'reinforceRings', name:'Reinforce Rings', desc:'Decorative bands along the barrel' },
  { id:'ventHole', name:'Vent / Touch Hole', desc:'The ignition vent on top' },
  { id:'carriage', name:'Gun Carriage', desc:'The wooden carriage body' },
  { id:'wheels', name:'Wheels', desc:'Carriage wheels' },
  { id:'axle', name:'Axle & Hardware', desc:'Connecting axle and metal bands' },
  { id:'materials', name:'Materials & Color', desc:'Color and finish of cannon parts' },
  { id:'details', name:'Final Details', desc:'Rope, wedge, and finishing touches' },
];

let params = {
  wsWidth: 3, wsDepth: 3, wsHeight: 2.5,
  barrelLen: 1.2, barrelOuterR: 0.12, barrelInnerR: 0.06,
  barrelTaper: 0.15, barrelFlare: 0.0,
  muzzleRingSize: 0.03, muzzleRingWidth: 0.04,
  muzzleFlare: 0.04,
  cascabelR: 0.06, cascabelNeckR: 0.035,
  trunnionR: 0.03, trunnionLen: 0.08,
  ringCount: 2, ringSize: 0.015,
  ventHoleR: 0.008,
  carriageLen: 0.9, carriageW: 0.35, carriageH: 0.18, carriageAngle: 8,
  wheelR: 0.2, wheelThick: 0.04, spokeCount: 8,
  axleR: 0.02,
  barrelColor: '#3a3a3a', carriageColor: '#6d4c2a', wheelColor: '#5a3d1e',
  metalColor: '#555555', ropeColor: '#c9a84c',
  showRope: true, showWedge: true
};

let currentStep = 0;
let scene, camera, renderer, cannonGroup, workshopBox, gridHelper;
let isMouseDown = false, mouseX = 0, mouseY = 0, camTheta = 0.6, camPhi = 0.8, camDist = 3;

// ============ THREE.JS SETUP ============
function initThree() {
  const vp = document.getElementById('viewport');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d1f2d, 0.15);

  camera = new THREE.PerspectiveCamera(45, vp.clientWidth / vp.clientHeight, 0.01, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.useLegacyLights = true; // r160: keep the original r128 lighting look
  renderer.setSize(vp.clientWidth, vp.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  vp.appendChild(renderer.domElement);

  // Lights
  const amb = new THREE.AmbientLight(0x4477aa, 0.5);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffeedd, 1.0);
  dir.position.set(3, 5, 3);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024,1024);
  scene.add(dir);
  const rim = new THREE.DirectionalLight(0x88aacc, 0.3);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const point = new THREE.PointLight(0xffcc77, 0.4, 10);
  point.position.set(0, 2, 0);
  scene.add(point);

  cannonGroup = new THREE.Group();
  cannonGroup.name = 'pirate_cannon';
  const part = (mesh, name) => { mesh.name = name; return mesh; };
  scene.add(cannonGroup);

  // Controls
  const cvs = renderer.domElement;
  cvs.addEventListener('mousedown', e => { isMouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
  cvs.addEventListener('mousemove', e => {
    if (!isMouseDown) return;
    const dx = e.clientX - mouseX, dy = e.clientY - mouseY;
    camTheta -= dx * 0.005;
    camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi - dy * 0.005));
    mouseX = e.clientX; mouseY = e.clientY;
  });
  window.addEventListener('mouseup', () => isMouseDown = false);
  cvs.addEventListener('wheel', e => {
    camDist = Math.max(0.8, Math.min(8, camDist + e.deltaY * 0.003));
    e.preventDefault();
  }, { passive: false });

  // Touch
  BuilderGestures.attachTapSelect(cvs, camera, function(){ return cannonGroup; }, {
    onOrbit: function(dx,dy){ camTheta-=dx*0.005; camPhi=Math.max(0.1,Math.min(Math.PI-0.1,camPhi-dy*0.005)); },
    onPinch: function(ratio,dist,prev){ camDist=Math.max(0.8,Math.min(8,camDist-(dist-prev)*0.008)); }
  });

  window.addEventListener('resize', () => {
    camera.aspect = vp.clientWidth / vp.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(vp.clientWidth, vp.clientHeight);
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const cx = camDist * Math.sin(camPhi) * Math.cos(camTheta);
  const cy = camDist * Math.cos(camPhi);
  const cz = camDist * Math.sin(camPhi) * Math.sin(camTheta);
  camera.position.set(cx, cy + 0.3, cz);
  camera.lookAt(0, 0.3, 0);
  renderer.render(scene, camera);
}

// ============ CANNON BUILDER ============
function rebuildCannon() {
  while (cannonGroup.children.length) cannonGroup.remove(cannonGroup.children[0]);
  if (workshopBox) { scene.remove(workshopBox); workshopBox = null; }
  if (gridHelper) { scene.remove(gridHelper); gridHelper = null; }
  const part = (mesh, name) => { mesh.name = name; return mesh; };

  const p = params;

  // Workshop wireframe
  const wGeo = new THREE.BoxGeometry(p.wsWidth, p.wsHeight, p.wsDepth);
  const wEdges = new THREE.EdgesGeometry(wGeo);
  workshopBox = new THREE.LineSegments(wEdges, new THREE.LineBasicMaterial({ color: 0xc9a84c, opacity: 0.25, transparent: true }));
  workshopBox.position.y = p.wsHeight / 2;
  scene.add(workshopBox);

  // Grid floor
  gridHelper = new THREE.GridHelper(Math.max(p.wsWidth, p.wsDepth), 20, 0x334455, 0x223344);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  const barrelMat = new THREE.MeshStandardMaterial({ color: p.barrelColor, roughness: 0.4, metalness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: p.metalColor, roughness: 0.3, metalness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: p.carriageColor, roughness: 0.7, metalness: 0.05 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: p.wheelColor, roughness: 0.65, metalness: 0.05 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: p.ropeColor, roughness: 0.9, metalness: 0 });
  const boreMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5, metalness: 0.3 });

  const angleRad = p.carriageAngle * Math.PI / 180;
  const carriageTopY = p.wheelR + p.carriageH;

  // =============================================
  // BARREL PIVOT GROUP
  // Local space: barrel extends along +Z (breech at -Z, muzzle at +Z).
  // Pivot sits at trunnion mount on carriage top.
  // Elevation: rotate around X to tilt muzzle up.
  // =============================================
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, carriageTopY + p.barrelOuterR * 0.55, -p.carriageLen * 0.05);
  barrelPivot.rotation.x = angleRad; // positive X rotation tilts muzzle (+Z) upward
  barrelPivot.name = 'barrel_pivot';
  cannonGroup.add(barrelPivot);

  // Helper: radius at a given t (0=breech, 1=muzzle)
  function radiusAt(t) {
    let r = p.barrelOuterR;
    r -= p.barrelTaper * 0.1 * t;
    if (t > 0.92) r += p.muzzleFlare * ((t - 0.92) / 0.08);
    return Math.max(r, 0.01);
  }

  // Pivot is at 25% of barrel length from breech
  const breechZ = -p.barrelLen * 0.25;
  const muzzleZ = p.barrelLen * 0.75;

  // --- Barrel (built as a LatheGeometry along Y, then rotated to Z) ---
  const barrelPts = [];
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    barrelPts.push(new THREE.Vector2(radiusAt(t), t * p.barrelLen));
  }
  const barrelGeo = new THREE.LatheGeometry(barrelPts, 32);
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.castShadow = true;
  // Lathe grows along Y; rotate so it grows along +Z instead
  barrel.rotation.x = -Math.PI / 2;
  barrel.position.z = breechZ;
  barrelPivot.add(part(barrel, 'barrel'));

  // Inner bore (cylinder along Y ? rotate to Z)
  const boreGeo = new THREE.CylinderGeometry(p.barrelInnerR, p.barrelInnerR, p.barrelLen * 0.92, 16);
  const bore = new THREE.Mesh(boreGeo, boreMat);
  bore.rotation.x = Math.PI / 2;
  bore.position.z = breechZ + p.barrelLen * 0.5;
  barrelPivot.add(part(bore, 'barrel_bore'));

  // --- Muzzle Ring (torus wrapping around barrel at muzzle) ---
  if (p.muzzleRingSize > 0) {
    const tipR = radiusAt(1.0);
    const mRingGeo = new THREE.TorusGeometry(tipR + p.muzzleRingSize * 0.3, p.muzzleRingSize, 12, 32);
    const mRing = new THREE.Mesh(mRingGeo, metalMat);
    // Torus default is in XY plane; for it to circle around Z axis, we leave rotation alone
    // (XY torus around Z axis is exactly what we want)
    mRing.position.z = muzzleZ;
    mRing.castShadow = true;
    barrelPivot.add(part(mRing, 'muzzle_ring'));
  }

  // --- Cascabel (rear knob + neck, behind breech) ---
  const cascGeo = new THREE.SphereGeometry(p.cascabelR, 16, 12);
  const casc = new THREE.Mesh(cascGeo, metalMat);
  casc.position.z = breechZ - p.cascabelR * 0.6;
  casc.castShadow = true;
  barrelPivot.add(part(casc, 'cascabel'));

  const cascNeckGeo = new THREE.CylinderGeometry(p.cascabelNeckR, p.cascabelNeckR, p.cascabelR * 0.8, 12);
  const cascNeck = new THREE.Mesh(cascNeckGeo, metalMat);
  cascNeck.rotation.x = Math.PI / 2; // align along Z
  cascNeck.position.z = breechZ - p.cascabelR * 0.15;
  barrelPivot.add(part(cascNeck, 'cascabel_neck'));

  // --- Trunnions (stick out sideways at pivot point Z=0) ---
  const trGeo = new THREE.CylinderGeometry(p.trunnionR, p.trunnionR, p.trunnionLen, 12);
  [-1, 1].forEach(side => {
    const tr = new THREE.Mesh(trGeo, metalMat);
    // Cylinder along Y ? rotate to extend along X
    tr.rotation.z = Math.PI / 2;
    tr.position.set(side * (radiusAt(0.25) + p.trunnionLen * 0.5), 0, 0);
    tr.castShadow = true;
    barrelPivot.add(part(tr, `trunnion_${side>0?'starboard':'port'}`));
  });

  // --- Reinforce Rings (torus bands along barrel) ---
  for (let i = 0; i < p.ringCount; i++) {
    const t = 0.15 + (i / Math.max(p.ringCount, 1)) * 0.5;
    const rr = radiusAt(t) + p.ringSize;
    const ringGeo = new THREE.TorusGeometry(rr, p.ringSize, 8, 32);
    const ring = new THREE.Mesh(ringGeo, metalMat);
    // Torus in XY plane circles around Z , perfect
    ring.position.z = breechZ + p.barrelLen * t;
    ring.castShadow = true;
    barrelPivot.add(part(ring, `reinforce_ring_${i}`));
  }

  // --- Vent / Touch Hole (pokes out radially near breech) ---
  const ventZ = breechZ + p.barrelLen * 0.12;
  const ventGeo = new THREE.CylinderGeometry(p.ventHoleR, p.ventHoleR, radiusAt(0.12) * 2.2, 8);
  const ventMat2 = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 });
  const vent = new THREE.Mesh(ventGeo, ventMat2);
  // Vent pokes upward (along Y local) from barrel surface
  vent.position.set(0, radiusAt(0.12) * 0.5, ventZ);
  barrelPivot.add(part(vent, 'vent'));

  // =============================================
  // CARRIAGE GROUP , the wooden body, cheeks,
  // metal bands, rope, wedge. All parented so
  // they stay together.
  // =============================================
  const carriageGroup = new THREE.Group();
  carriageGroup.name = 'carriage';
  cannonGroup.add(carriageGroup);

  // Main carriage box
  const cGeo = new THREE.BoxGeometry(p.carriageW, p.carriageH, p.carriageLen);
  const carriage = new THREE.Mesh(cGeo, woodMat);
  carriage.position.y = p.wheelR + p.carriageH / 2;
  carriage.castShadow = true;
  carriage.receiveShadow = true;
  carriageGroup.add(part(carriage, 'carriage_body'));

  // Carriage side cheeks (tapered)
  [-1, 1].forEach(side => {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0);
    cheekShape.lineTo(p.carriageLen * 0.5, 0);
    cheekShape.lineTo(p.carriageLen * 0.45, p.carriageH * 1.2);
    cheekShape.lineTo(-p.carriageLen * 0.3, p.carriageH * 0.8);
    cheekShape.lineTo(-p.carriageLen * 0.4, 0);
    const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, { depth: 0.025, bevelEnabled: false });
    const cheek = new THREE.Mesh(cheekGeo, woodMat);
    cheek.rotation.y = Math.PI / 2;
    cheek.position.set(side * (p.carriageW / 2 + 0.012), p.wheelR, 0);
    cheek.castShadow = true;
    carriageGroup.add(part(cheek, `carriage_cheek_${side>0?'starboard':'port'}`));
  });

  // Barrel cradle notches on top of cheeks
  [-1, 1].forEach(side => {
    const cradleGeo = new THREE.TorusGeometry(p.barrelOuterR + 0.005, 0.012, 6, 16, Math.PI);
    const cradle = new THREE.Mesh(cradleGeo, metalMat);
    cradle.position.set(side * (p.carriageW / 2 + 0.012), carriageTopY + p.barrelOuterR * 0.1, -p.carriageLen * 0.05);
    cradle.rotation.x = Math.PI / 2;
    cradle.rotation.z = side > 0 ? Math.PI : 0;
    carriageGroup.add(part(cradle, `carriage_cradle_${side>0?'starboard':'port'}`));
  });

  // Metal bands on carriage
  for (let i = 0; i < 3; i++) {
    const bandZ = -p.carriageLen * 0.3 + i * p.carriageLen * 0.3;
    const bandGeo = new THREE.BoxGeometry(p.carriageW + 0.01, 0.015, 0.02);
    const band = new THREE.Mesh(bandGeo, metalMat);
    band.position.set(0, p.wheelR + p.carriageH + 0.005, bandZ);
    carriageGroup.add(part(band, `carriage_band_${i}`));
  }

  // --- Rope ---
  if (p.showRope) {
    [-1, 1].forEach(side => {
      const ropeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * p.carriageW * 0.4, carriageTopY + 0.05, p.carriageLen * 0.4),
        new THREE.Vector3(side * p.carriageW * 0.55, carriageTopY - 0.05, p.carriageLen * 0.2),
        new THREE.Vector3(side * p.carriageW * 0.4, carriageTopY + 0.02, 0),
      ]);
      const ropeGeo = new THREE.TubeGeometry(ropeCurve, 20, 0.006, 6, false);
      carriageGroup.add(part(new THREE.Mesh(ropeGeo, ropeMat), `carriage_rope_${side>0?'starboard':'port'}`));
    });
  }

  // --- Quoin Wedge (elevation wedge under barrel at rear) ---
  if (p.showWedge) {
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(0, 0);
    wedgeShape.lineTo(0.12, 0);
    wedgeShape.lineTo(0.12, 0.04);
    wedgeShape.lineTo(0, 0.015);
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.06, bevelEnabled: false });
    const wedge = new THREE.Mesh(wedgeGeo, woodMat);
    wedge.position.set(-0.03, carriageTopY, -p.carriageLen * 0.32);
    carriageGroup.add(part(wedge, 'quoin_wedge'));
  }

  // =============================================
  // WHEEL + AXLE GROUP
  // =============================================
  const wheelAxleGroup = new THREE.Group();
  wheelAxleGroup.name = 'wheels';
  cannonGroup.add(wheelAxleGroup);

  [-1, 1].forEach(side => {
    const wheelGroup = new THREE.Group();
    // Rim
    const rimGeo = new THREE.TorusGeometry(p.wheelR, p.wheelThick * 0.5, 8, 32);
    const rim = new THREE.Mesh(rimGeo, wheelMat);
    wheelGroup.add(part(rim, `wheel_rim_${side>0?'starboard':'port'}`));
    // Hub
    const hubGeo = new THREE.CylinderGeometry(p.wheelThick, p.wheelThick, p.wheelThick * 1.5, 12);
    const hub = new THREE.Mesh(hubGeo, metalMat);
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(part(hub, `wheel_hub_${side>0?'starboard':'port'}`));
    // Spokes
    for (let s = 0; s < p.spokeCount; s++) {
      const ang = (s / p.spokeCount) * Math.PI * 2;
      const spokeGeo = new THREE.CylinderGeometry(0.008, 0.008, p.wheelR * 0.9, 6);
      const spoke = new THREE.Mesh(spokeGeo, wheelMat);
      spoke.position.set(Math.cos(ang) * p.wheelR * 0.45, Math.sin(ang) * p.wheelR * 0.45, 0);
      spoke.rotation.z = ang + Math.PI / 2;
      wheelGroup.add(part(spoke, `wheel_spoke_${side>0?'starboard':'port'}_${s}`));
    }
    wheelGroup.rotation.y = Math.PI / 2;
    wheelGroup.position.set(side * (p.carriageW / 2 + p.wheelThick), p.wheelR, -p.carriageLen * 0.15);
    wheelGroup.children.forEach(c => c.castShadow = true);
    wheelAxleGroup.add(wheelGroup);
  });

  // Axle
  const axleGeo = new THREE.CylinderGeometry(p.axleR, p.axleR, p.carriageW + p.wheelThick * 4, 8);
  const axle = new THREE.Mesh(axleGeo, metalMat);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, p.wheelR, -p.carriageLen * 0.15);
  wheelAxleGroup.add(part(axle, 'axle'));

  // Ground plane
  const floorGeo = new THREE.PlaneGeometry(p.wsWidth, p.wsDepth);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.3 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  cannonGroup.add(part(floor, 'ground'));

  // Update dimension display
  document.getElementById('wsWidth').textContent = p.wsWidth.toFixed(1);
  document.getElementById('wsDepth').textContent = p.wsDepth.toFixed(1);
  document.getElementById('wsHeight').textContent = p.wsHeight.toFixed(1);
}

// ============ STEP CONTROLS ============
function getControlsForStep(stepIdx) {
  const s = STEPS[stepIdx].id;
  switch(s) {
    case 'workshop': return [
      { type:'range', key:'wsWidth', label:'Width (m)', min:1, max:6, step:0.1 },
      { type:'range', key:'wsDepth', label:'Depth (m)', min:1, max:6, step:0.1 },
      { type:'range', key:'wsHeight', label:'Height (m)', min:1.5, max:4, step:0.1 },
    ];
    case 'barrelLen': return [
      { type:'range', key:'barrelLen', label:'Barrel Length (m)', min:0.4, max:2.5, step:0.05 },
    ];
    case 'barrelDia': return [
      { type:'range', key:'barrelOuterR', label:'Outer Radius (m)', min:0.05, max:0.25, step:0.005 },
      { type:'range', key:'barrelInnerR', label:'Bore Radius (m)', min:0.02, max:0.15, step:0.005 },
    ];
    case 'barrelShape': return [
      { type:'range', key:'barrelTaper', label:'Taper Amount', min:0, max:0.5, step:0.01 },
    ];
    case 'muzzle': return [
      { type:'range', key:'muzzleRingSize', label:'Ring Thickness', min:0, max:0.06, step:0.005 },
      { type:'range', key:'muzzleRingWidth', label:'Ring Width', min:0.01, max:0.08, step:0.005 },
    ];
    case 'muzzleFlare': return [
      { type:'range', key:'muzzleFlare', label:'Flare Amount', min:0, max:0.1, step:0.005 },
    ];
    case 'cascabel': return [
      { type:'range', key:'cascabelR', label:'Knob Radius', min:0.02, max:0.12, step:0.005 },
      { type:'range', key:'cascabelNeckR', label:'Neck Radius', min:0.01, max:0.06, step:0.005 },
    ];
    case 'trunnions': return [
      { type:'range', key:'trunnionR', label:'Trunnion Radius', min:0.01, max:0.06, step:0.005 },
      { type:'range', key:'trunnionLen', label:'Trunnion Length', min:0.03, max:0.15, step:0.005 },
    ];
    case 'reinforceRings': return [
      { type:'range', key:'ringCount', label:'Number of Rings', min:0, max:6, step:1 },
      { type:'range', key:'ringSize', label:'Ring Thickness', min:0.005, max:0.04, step:0.002 },
    ];
    case 'ventHole': return [
      { type:'range', key:'ventHoleR', label:'Vent Radius', min:0.003, max:0.02, step:0.001 },
    ];
    case 'carriage': return [
      { type:'range', key:'carriageLen', label:'Length (m)', min:0.5, max:1.8, step:0.05 },
      { type:'range', key:'carriageW', label:'Width (m)', min:0.2, max:0.6, step:0.02 },
      { type:'range', key:'carriageH', label:'Height (m)', min:0.08, max:0.35, step:0.01 },
      { type:'range', key:'carriageAngle', label:'Elevation (°)', min:0, max:25, step:1 },
    ];
    case 'wheels': return [
      { type:'range', key:'wheelR', label:'Wheel Radius (m)', min:0.1, max:0.45, step:0.01 },
      { type:'range', key:'wheelThick', label:'Wheel Thickness', min:0.02, max:0.08, step:0.005 },
      { type:'range', key:'spokeCount', label:'Spokes', min:4, max:16, step:1 },
    ];
    case 'axle': return [
      { type:'range', key:'axleR', label:'Axle Radius', min:0.01, max:0.04, step:0.002 },
    ];
    case 'materials': return [
      { type:'color', key:'barrelColor', label:'Barrel Color' },
      { type:'color', key:'carriageColor', label:'Carriage Color' },
      { type:'color', key:'wheelColor', label:'Wheel Color' },
      { type:'color', key:'metalColor', label:'Metal Fittings' },
      { type:'color', key:'ropeColor', label:'Rope Color' },
    ];
    case 'details': return [
      { type:'toggle', key:'showRope', label:'Show Rope' },
      { type:'toggle', key:'showWedge', label:'Show Quoin Wedge' },
    ];
    default: return [];
  }
}

function renderControls() {
  const panel = document.getElementById('controlsPanel');
  const ctrls = getControlsForStep(currentStep);
  let html = `<div class="control-title">${STEPS[currentStep].desc}</div>`;
  ctrls.forEach(c => {
    if (c.type === 'range') {
      html += `<div class="control-group">
        <label>${c.label} <span class="range-val" id="val_${c.key}">${params[c.key]}</span>
        <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${params[c.key]}"
          data-action-input="updateParamFloat" data-arg="${c.key}"></label>
      </div>`;
    } else if (c.type === 'color') {
      html += `<div class="control-group">
        <label>${c.label}
        <input type="color" value="${params[c.key]}"
          data-action-input="updateParamRaw" data-arg="${c.key}"></label>
      </div>`;
    } else if (c.type === 'toggle') {
      html += `<div class="control-group">
        <label><input type="checkbox" ${params[c.key] ? 'checked' : ''}
          data-action-change="updateParamChecked" data-arg="${c.key}"> ${c.label}</label>
      </div>`;
    }
  });
  panel.innerHTML = html;
}

function updateParamFloat(v){ updateParam(this.getAttribute('data-arg'), parseFloat(v)); }
function updateParamRaw(v){ updateParam(this.getAttribute('data-arg'), v); }
function updateParamChecked(){ updateParam(this.getAttribute('data-arg'), this.checked); }
function updateParam(key, val) {
  params[key] = val;
  const ve = document.getElementById('val_' + key);
  if (ve) ve.textContent = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(3)) : val;
  rebuildCannon();
}

// ============ STEP NAVIGATION ============
function renderStepList() {
  const list = document.getElementById('stepList');
  list.innerHTML = STEPS.map((s, i) => `
    <div class="step-item ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}"
         data-action="goToStep" data-arg="${i}">
      <div class="step-num">${i < currentStep ? '?' : i + 1}</div>
      <div class="step-name">${s.name}</div>
    </div>
  `).join('');
}

function goToStep(idx) {
  currentStep = idx;
  updateUI();
  showToast(STEPS[idx].name);
}

function nextStep() { if (currentStep < STEPS.length - 1) goToStep(currentStep + 1); }
function prevStep() { if (currentStep > 0) goToStep(currentStep - 1); }

function updateUI() {
  renderStepList();
  renderControls();
  document.getElementById('progressFill').style.width = ((currentStep + 1) / STEPS.length * 100) + '%';
  document.getElementById('stepCounter').textContent = `Step ${currentStep + 1} of ${STEPS.length}`;
  document.getElementById('btnPrev').disabled = currentStep === 0;
  document.getElementById('btnNext').disabled = currentStep === STEPS.length - 1;

  // Scroll active step into view
  const activeEl = document.querySelector('.step-item.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function showToast(msg) {
  const t = document.getElementById('stepToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ============ SAVE / LOAD / EXPORT ============
function getSaves() {
  try { return JSON.parse(localStorage.getItem('cannonSaves') || '{}'); } catch { return {}; }
}
function setSaves(s) { localStorage.setItem('cannonSaves', JSON.stringify(s)); }

function openSaveModal() {
  const m = document.getElementById('modalContent');
  m.innerHTML = `
    <h2>💾 Save Cannon</h2>
    <input type="text" id="saveName" aria-label="Cannon name" placeholder="Enter a name for your cannon...">
    <div class="modal-btns">
      <button class="btn-cancel" data-on="closeModal" data-on-plain>Cancel</button>
      <button class="btn-save-confirm" data-action="doSave">Save</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('saveName').focus(), 100);
}

function openLoadModal() {
  const saves = getSaves();
  const keys = Object.keys(saves);
  const m = document.getElementById('modalContent');
  let listHtml = '';
  if (keys.length === 0) {
    listHtml = '<p style="color:var(--parchment-dark);font-size:13px;padding:10px 0;">No saved cannons yet.</p>';
  } else {
    listHtml = '<div class="saves-list">' + keys.map(k => {
      const d = new Date(saves[k].date).toLocaleDateString();
      return `<div class="save-entry" data-action="doLoad" data-arg="${k.replace(/"/g,'&quot;')}">
        <div><div class="save-name">${k}</div><div class="save-date">${d}</div></div>
        <button class="del-btn" data-action="doDelete" data-arg="${k.replace(/"/g,'&quot;')}" data-stop>?</button>
      </div>`;
    }).join('') + '</div>';
  }
  m.innerHTML = `<h2>📂 Load Cannon</h2>${listHtml}
    <div class="modal-btns"><button class="btn-cancel" data-on="closeModal" data-on-plain>Close</button></div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function doSave() {
  const name = document.getElementById('saveName').value.trim();
  if (!name) return;
  const saves = getSaves();
  saves[name] = { params: { ...params }, step: currentStep, date: Date.now() };
  setSaves(saves);
  closeModal();
  showToast('Cannon saved!');
}

function doLoad(name) {
  const saves = getSaves();
  if (!saves[name]) return;
  params = { ...saves[name].params };
  currentStep = saves[name].step || 0;
  closeModal();
  rebuildCannon();
  updateUI();
  showToast(`Loaded: ${name}`);
}

function doDelete(name) {
  const saves = getSaves();
  delete saves[name];
  setSaves(saves);
  openLoadModal();
}

function resetAll() {
  if (!confirm('Reset all parameters to defaults?')) return;
  Object.assign(params, {
    wsWidth:3,wsDepth:3,wsHeight:2.5,barrelLen:1.2,barrelOuterR:0.12,barrelInnerR:0.06,
    barrelTaper:0.15,barrelFlare:0,muzzleRingSize:0.03,muzzleRingWidth:0.04,muzzleFlare:0.04,
    cascabelR:0.06,cascabelNeckR:0.035,trunnionR:0.03,trunnionLen:0.08,ringCount:2,ringSize:0.015,
    ventHoleR:0.008,carriageLen:0.9,carriageW:0.35,carriageH:0.18,carriageAngle:8,wheelR:0.2,
    wheelThick:0.04,spokeCount:8,axleR:0.02,barrelColor:'#3a3a3a',carriageColor:'#6d4c2a',
    wheelColor:'#5a3d1e',metalColor:'#555555',ropeColor:'#c9a84c',showRope:true,showWedge:true
  });
  currentStep = 0;
  rebuildCannon();
  updateUI();
  showToast('Reset to defaults');
}



// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initThree();
  rebuildCannon();
  updateUI();
});

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Keyboard nav
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextStep();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevStep();
});

// STATE HOOKS (share / reload)
window._builderGetState = function () { return { params: JSON.parse(JSON.stringify(params)), step: currentStep }; };
window._builderSetState = function (s) {
  if (s && s.params) Object.assign(params, s.params);
  if (s && typeof s.step === 'number') currentStep = s.step;
  rebuildCannon(); updateUI();
  if (window.builderScheduleAutoSave) window.builderScheduleAutoSave();
};
if (window.JVExporter) {
  JVExporter.installUI({
    tool: 'Pirate Cannon Forge',
    units: 'm',
    accent: '#c9a84c',
    mount: '.header-actions',
    getGroup: function () { return cannonGroup; },
    getName: function () { return 'pirate-cannon'; },
    track: function () { if (window.builderTrack) window.builderTrack.apply(null, arguments); }
  });
}

  try { window.openSaveModal = openSaveModal; } catch (e) { /* not a local handler */ }
  try { window.openLoadModal = openLoadModal; } catch (e) { /* not a local handler */ }
  try { window.resetAll = resetAll; } catch (e) { /* not a local handler */ }
  try { window.prevStep = prevStep; } catch (e) { /* not a local handler */ }
  try { window.nextStep = nextStep; } catch (e) { /* not a local handler */ }
  try { window.closeModal = closeModal; } catch (e) { /* not a local handler */ }
  try { window.goToStep = goToStep; } catch (e) { /* not a local handler */ }
  try { window.doSave = doSave; } catch (e) { /* not a local handler */ }
  try { window.doLoad = doLoad; } catch (e) { /* not a local handler */ }
  try { window.doDelete = doDelete; } catch (e) { /* not a local handler */ }
  try { window.updateParamFloat = updateParamFloat; } catch (e) { /* not a local handler */ }
  try { window.updateParamRaw = updateParamRaw; } catch (e) { /* not a local handler */ }
  try { window.updateParamChecked = updateParamChecked; } catch (e) { /* not a local handler */ }
  } finally {
    window.addEventListener = winAdd;
    document.addEventListener = docAdd;
    window.requestAnimationFrame = origRaf;
  }

  return function unmount() {
    try { ac.abort(); } catch (e) {}
    rafs.forEach(function (id) { try { cancelAnimationFrame(id); } catch (e) {} });
    window._builderGetState = null;
    window._builderApplyState = null;
    window._builderSetState = null;
    try { delete window.openSaveModal; } catch (e) {}
    try { delete window.openLoadModal; } catch (e) {}
    try { delete window.resetAll; } catch (e) {}
    try { delete window.prevStep; } catch (e) {}
    try { delete window.nextStep; } catch (e) {}
    try { delete window.closeModal; } catch (e) {}
    try { delete window.goToStep; } catch (e) {}
    try { delete window.doSave; } catch (e) {}
    try { delete window.doLoad; } catch (e) {}
    try { delete window.doDelete; } catch (e) {}
    try { delete window.updateParamFloat; } catch (e) {}
    try { delete window.updateParamRaw; } catch (e) {}
    try { delete window.updateParamChecked; } catch (e) {}
    stage.remove();
    sheet.remove();
  };
}
