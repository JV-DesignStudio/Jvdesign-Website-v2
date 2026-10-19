/* assets/js/builders/castle.js
 * Castle preset module for the 3D Builder shell (workshops/3d-builder.html).
 * Extracted from workshops/castle-builder.html: mount(container) injects the
 * builder markup + CSS, runs the original builder core in a guarded scope
 * (window/document listeners and animation frames are tracked so unmount() can
 * tear it down), and exposes only the data-on/data-action handlers the shared
 * delegation needs. No other builder internals leak (module scope).
 */
export const ID = 'castle';
export const LABEL = 'Castle';
export const STYLES = ['../style-workshop-castle-builder.css?v=17'];
const HTML = "<div id=\"app\">\n\n  <!-- HEADER -->\n  <header class=\"hdr\">\n    <h1 class=\"logo\">🏰 Castle Builder</h1>\n<div class=\"callout tip\" style=\"border-left:3px solid #22c55e;background:rgba(34,197,94,.07);\"><div class=\"callout-icon\">📦</div><div><strong>Workshop reference pack:</strong> download an offline copy of every step in this workshop: <a href=\"/downloads/castle-builder-reference.zip\" download style=\"color:#16a34a;font-weight:800;text-decoration:underline;\">⬇ castle-builder-reference.zip</a>. Every code block also has a <strong>Copy</strong> button.</div></div>\n\n    <div class=\"hdr-right\">\n      <a href=\"../pages/workshop.html\" class=\"back-link\">← Workshop</a><a href=\"../pages/3d-builders.html\" class=\"back-link\" style=\"margin-left:8px\">🏗️ All Builders</a>\n      <button class=\"quick-btn\" data-on=\"randomCastle\" data-on-plain style=\"background:linear-gradient(135deg,#8b1a1a,#5a1010);box-shadow:0 3px 0 #3a0808\">🎲 Random</button>\n      <button class=\"quick-btn\" data-on=\"quickBuild\" data-on-plain style=\"font-size:.88rem\">⚡ Quick Build</button>\n    </div>\n  </header>\n  <!-- ── Ember Tip Bar ── -->\n  <div class=\"ember-builder-bar\" id=\"emberBar\" style=\"--ca-rgb:201,168,76\">\n    <svg viewBox=\"0 0 80 90\" width=\"26\" height=\"29\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\">\n      <path d=\"M20 52 Q10 80 15 88 H65 Q70 80 60 52 Q50 60 40 60 Q30 60 20 52Z\" fill=\"#12102a\"/>\n      <ellipse cx=\"40\" cy=\"36\" rx=\"16\" ry=\"17\" fill=\"#8B5CF6\"/>\n      <polygon points=\"24,22 19,8 30,18\" fill=\"#7C3AED\"/>\n      <polygon points=\"56,22 61,8 50,18\" fill=\"#7C3AED\"/>\n      <ellipse cx=\"40\" cy=\"40\" rx=\"10\" ry=\"8\" fill=\"#DDD6FE\"/>\n      <ellipse cx=\"35\" cy=\"34\" rx=\"3.5\" ry=\"4\" fill=\"#1e1a40\"/>\n      <ellipse cx=\"45\" cy=\"34\" rx=\"3.5\" ry=\"4\" fill=\"#1e1a40\"/>\n      <circle cx=\"36\" cy=\"33\" r=\"1.2\" fill=\"#fff\"/>\n      <circle cx=\"46\" cy=\"33\" r=\"1.2\" fill=\"#fff\"/>\n      <ellipse cx=\"40\" cy=\"39\" rx=\"2\" ry=\"1.4\" fill=\"#7C3AED\"/>\n    </svg>\n    <span><strong style=\"color:#c9a84c\">Ember says:</strong> <strong>Tower height</strong> sets the vibe , tall for medieval epic, shorter for fairy-tale charm. Add the moat in step 14 for the full effect!</span>\n    <button class=\"ember-bar-dismiss\" aria-label=\"Dismiss tip\" data-session-set=\"ember-bar-castle-builder:1\" data-remove-id=\"emberBar\">✕</button>\n  </div>\n\n  <!-- ── /Ember Tip Bar ── -->\n\n  <!-- SIDEBAR -->\n  <div id=\"sidebar\">\n    <div class=\"prog-section\">\n      <div class=\"prog-lbl\">Build Progress</div>\n      <div class=\"prog-track\"><div class=\"prog-fill\" id=\"progFill\" style=\"width:3%\"></div></div>\n      <div class=\"prog-ct\" id=\"progCt\">0 / 16 steps</div>\n    </div>\n    <div class=\"slist\" id=\"stepList\"></div>\n    <div class=\"cpan\" id=\"stepBody\"></div>\n    <div class=\"snav\">\n      <button class=\"btn-p\" id=\"navPrev\" data-on=\"goPrev\" data-on-plain disabled aria-label=\"Previous step\">← Back</button>\n      <button class=\"btn-n\" id=\"navNext\" data-on=\"goNext\" data-on-plain aria-label=\"Next step\">Next →</button>\n    </div>\n  </div>\n\n  <!-- VIEWPORT -->\n  <div id=\"viewport\">\n    <div class=\"scene-top\">\n      <span class=\"scene-top-l\">🏰 Live 3D Preview</span>\n      <div class=\"scene-top-r\">\n        <div class=\"live-wrap\"><span class=\"live-dot\"></span><span id=\"liveStatus\" aria-live=\"polite\">Apply Step 1 to begin</span></div>\n      </div>\n    </div>\n    <div class=\"scene-wrap\">\n      <canvas id=\"castleCanvas\" role=\"application\" aria-label=\"3D castle preview viewport\"></canvas>\n      <div class=\"castle-stats\" id=\"castleStats\"></div>\n      <div class=\"vhint\" id=\"sceneHint\">Drag to orbit · Scroll to zoom</div>\n      <div class=\"dims\" id=\"dimsOverlay\">\n        <div style=\"font-family:'Bebas Neue',sans-serif;font-size:.95rem;letter-spacing:.06em;color:#fff;margin-bottom:2px\" id=\"sName\">UNNAMED</div>\n        <div>Walls&nbsp;&nbsp;<span id=\"sWalls\">-</span></div>\n        <div>Towers&nbsp;<span id=\"sTowers\">-</span></div>\n        <div>Keep&nbsp;&nbsp;&nbsp;<span id=\"sKeep\">-</span></div>\n        <div>Gate&nbsp;&nbsp;&nbsp;<span id=\"sGate\">-</span></div>\n        <div>Moat&nbsp;&nbsp;&nbsp;<span id=\"sMoat\">-</span></div>\n      </div>\n    </div>\n    <div class=\"obar\" id=\"obar\" aria-live=\"polite\">👑 Name your castle to start building</div>\n  </div>\n\n  <!-- RIGHT BAR -->\n  <div id=\"rightbar\" aria-label=\"Quick controls\">\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🎨 Wall Colours</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-wallCol\">Wall</label>\n        <input type=\"color\" id=\"rb-wallCol\" value=\"#6b5a40\" data-bind=\"P.wallColor\" data-bind-type=\"value\" data-then=\"buildCastle\">\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-stoneCol\">Stone</label>\n        <input type=\"color\" id=\"rb-stoneCol\" value=\"#8b7355\" data-bind=\"P.stoneColor\" data-bind-type=\"value\" data-then=\"buildCastle\">\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-bannerCol\">Banner</label>\n        <input type=\"color\" id=\"rb-bannerCol\" value=\"#8b1a1a\" data-bind=\"P.bannerColor\" data-bind-type=\"value\" data-then=\"buildCastle\">\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🏰 Walls</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-wh\">Height</label>\n        <input type=\"range\" min=\"3\" max=\"8\" step=\"0.5\" value=\"5\" id=\"rb-wh\"\n          data-bind=\"P.wallHeight\" data-bind-type=\"float\" data-bind-display=\"rb-whv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-whv\">5.0</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-wt\">Thick</label>\n        <input type=\"range\" min=\"0.4\" max=\"1.5\" step=\"0.1\" value=\"0.8\" id=\"rb-wt\"\n          data-bind=\"P.wallThickness\" data-bind-type=\"float\" data-bind-display=\"rb-wtv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-wtv\">0.8</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🏰 Towers</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-tc\">Count</label>\n        <input type=\"range\" min=\"0\" max=\"8\" step=\"1\" value=\"4\" id=\"rb-tc\"\n          data-bind=\"P.towerCount\" data-bind-type=\"int\" data-bind-display=\"rb-tcv\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-tcv\">4</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-th\">Height</label>\n        <input type=\"range\" min=\"4\" max=\"14\" step=\"0.5\" value=\"8\" id=\"rb-th\"\n          data-bind=\"P.towerHeight\" data-bind-type=\"float\" data-bind-display=\"rb-thv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-thv\">8.0</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-ts\">Style</label>\n        <select id=\"rb-ts\" data-bind=\"P.towerStyle\" data-bind-type=\"value\" data-then=\"buildCastle\">\n          <option value=\"round\">Round</option>\n          <option value=\"square\">Square</option>\n        </select>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🚪 Gate</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-gs\">Style</label>\n        <select id=\"rb-gs\" data-bind=\"P.gateStyle\" data-bind-type=\"value\" data-then=\"buildCastle\">\n          <option value=\"arch\">Arch</option>\n          <option value=\"double\">Double</option>\n          <option value=\"portcullis\">Portcullis</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-gw\">Width</label>\n        <input type=\"range\" min=\"1\" max=\"4\" step=\"0.2\" value=\"2\" id=\"rb-gw\"\n          data-bind=\"P.gateWidth\" data-bind-type=\"float\" data-bind-display=\"rb-gwv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-gwv\">2.0</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🏰 Keep</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-kh\">Height</label>\n        <input type=\"range\" min=\"5\" max=\"16\" step=\"0.5\" value=\"10\" id=\"rb-kh\"\n          data-bind=\"P.keepHeight\" data-bind-type=\"float\" data-bind-display=\"rb-khv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-khv\">10.0</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-kw\">Width</label>\n        <input type=\"range\" min=\"2\" max=\"6\" step=\"0.2\" value=\"4\" id=\"rb-kw\"\n          data-bind=\"P.keepWidth\" data-bind-type=\"float\" data-bind-display=\"rb-kwv\" data-bind-fmt=\"0.0\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-kwv\">4.0</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">⚔ Details</div>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-moat\" data-bind=\"P.moat\" data-bind-type=\"checked\" data-then=\"buildCastle\">\n        Moat\n      </label>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-drawbridge\" data-bind=\"P.drawbridge\" data-bind-type=\"checked\" data-then=\"buildCastle\">\n        Drawbridge\n      </label>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-courtyard\" data-bind=\"P.courtyard\" data-bind-type=\"checked\" data-then=\"buildCastle\">\n        Courtyard\n      </label>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🏴 Banners & Flags</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-fc\">Count</label>\n        <input type=\"range\" min=\"0\" max=\"8\" step=\"1\" value=\"4\" id=\"rb-fc\"\n          data-bind=\"P.flagCount\" data-bind-type=\"int\" data-bind-display=\"rb-fcv\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rb-fcv\">4</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🔥 Torches</div>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-torches\" data-on=\"toggleTorches\" data-on-event=\"change\" data-on-args=\"checked\">\n        Torches\n      </label>\n      <div class=\"rb-row\">\n        <label for=\"rb-torchc\">Count</label>\n        <input type=\"range\" min=\"2\" max=\"16\" step=\"2\" value=\"8\" id=\"rb-torchc\"\n          data-bind=\"P.torchCount\" data-bind-type=\"int\" data-bind-display=\"rv-torchc\" data-then=\"buildCastle\">\n        <span class=\"rv\" id=\"rv-torchc\">8</span>\n      </div>\n    </div>\n\n    <div style=\"padding:4px 2px\">\n      <button class=\"run-btn\" style=\"font-size:.78rem;padding:9px;margin-top:0\" data-on=\"lightTorches\" data-on-plain>🔥 Light the Torches!</button>\n    </div>\n\n  </div>\n\n</div>\n\n";
const CSS = "/* ── Ember builder tip strip ─────────────── */\n.hdr-step-chip {\n  display: inline-flex;\n  align-items: center;\n  font-family: 'Nunito', sans-serif;\n  font-size: .72rem;\n  font-weight: 800;\n  letter-spacing: .05em;\n  padding: 3px 10px;\n  border-radius: 999px;\n  background: rgba(var(--ca-rgb, 255,255,255), .12);\n  border: 1px solid rgba(var(--ca-rgb, 255,255,255), .25);\n  color: rgba(255,255,255,.85);\n  margin-left: 10px;\n  vertical-align: middle;\n  flex-shrink: 0;\n}\n.ember-builder-bar {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 8px 16px;\n  background: rgba(var(--ca-rgb,139,92,246), .07);\n  border-bottom: 1px solid rgba(var(--ca-rgb,139,92,246), .18);\n  position: relative;\n  font-size: .8rem;\n  line-height: 1.45;\n  color: rgba(255,255,255,.65);\n}\n.ember-builder-bar strong { color: rgba(255,255,255,.9); }\n.ember-builder-bar svg { flex-shrink: 0; margin-top: 1px; }\n.ember-bar-dismiss {\n  position: absolute;\n  right: 10px;\n  top: 50%;\n  transform: translateY(-50%);\n  background: none;\n  border: none;\n  color: rgba(255,255,255,.3);\n  cursor: pointer;\n  font-size: 1rem;\n  line-height: 1;\n  padding: 2px 6px;\n  border-radius: 4px;\n  transition: color .2s;\n}\n.ember-bar-dismiss:hover { color: rgba(255,255,255,.7); }\n";
const ACTIONS = ["applyStep","goNext","goPrev","lightTorches","quickBuild","randomCastle","toggleTorches"];

export function mount(container) {
  var ac = new AbortController();
  var rafs = [];
  var winAdd = window.addEventListener.bind(window);
  var docAdd = document.addEventListener.bind(document);
  var origRaf = window.requestAnimationFrame.bind(window);
  function opt(o) { return Object.assign({}, (o && typeof o === 'object') ? o : {}, { signal: ac.signal }); }
  window.addEventListener = function (t, fn, o) { return winAdd(t, fn, opt(o)); };
  document.addEventListener = function (t, fn, o) { return docAdd(t, fn, opt(o)); };
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
'use strict';

/* -------------------------------
   THREE.JS SCENE
------------------------------- */
const canvas = document.getElementById('castleCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.useLegacyLights = true; // r160: keep the original r128 lighting look
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x0f0d0a);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0f0d0a, 30, 80);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 8, 20);

/* Lights */
const ambient = new THREE.AmbientLight(0x332211, 0.5);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff0d4, 1.2);
sun.position.set(8, 14, 10);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x445566, 0.3);
fill.position.set(-8, 4, -6);
scene.add(fill);
const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.25);
rimLight.position.set(0, 2, -12);
scene.add(rimLight);

/* Ground */
const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

/* Grass ring around moat area */
const grassGeo = new THREE.RingGeometry(12, 20, 48);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a5a28, roughness: 0.9 });
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.y = 0.005;
grass.receiveShadow = true;
scene.add(grass);

/* Stars */
(function(){
  const geo = new THREE.BufferGeometry();
  const verts = [];
  for (let i = 0; i < 600; i++) {
    verts.push((Math.random()-0.5)*120, 20 + Math.random()*50, (Math.random()-0.5)*120);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff8e0, size: 0.08 });
  scene.add(new THREE.Points(geo, mat));
})();

/* -------------------------------
   CASTLE STATE
------------------------------- */
const P = {
  castleName: 'Ironhold',
  wallHeight: 5, wallThickness: 0.8,
  wallColor: '#6b5a40', stoneColor: '#8b7355',
  towerCount: 4, towerHeight: 8, towerRadius: 1.2,
  towerStyle: 'round',
  gateStyle: 'arch',
  gateWidth: 2,
  battlementSize: 0.4,
  keepHeight: 10, keepWidth: 4,
  moat: true, moatWidth: 3,
  drawbridge: true,
  bannerColor: '#8b1a1a',
  flagCount: 4,
  windowCount: 8,
  torchCount: 8,
  courtyard: true,
};
window.P = P;

let castleGroup = null;
let torchLights = [];
let torchParticles = [];
let torchesLit = false;
let torchAnimFrame = 0;

function hexToThree(hex) { return new THREE.Color(hex); }

/* -------------------------------
   BUILD CASTLE
------------------------------- */
function toggleTorches(checked) { P.torchCount = checked ? 8 : 0; buildCastle(); }
function buildCastle() {
  if (castleGroup) scene.remove(castleGroup);
  castleGroup = new THREE.Group();
  castleGroup.name = 'castle';
  const part = (mesh, name) => { mesh.name = name; return mesh; };
  torchLights = [];

  const wallMat = new THREE.MeshStandardMaterial({ color: hexToThree(P.wallColor), roughness: 0.85, metalness: 0.05 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: hexToThree(P.stoneColor), roughness: 0.8, metalness: 0.08 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.9, metalness: 0.05 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85, metalness: 0.02 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.65 });
  const bannerMat = new THREE.MeshStandardMaterial({ color: hexToThree(P.bannerColor), roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.6, emissive: new THREE.Color(0x223344), emissiveIntensity: 0.3 });
  const torchMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7, metalness: 0.3 });
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.85 });
  const moatMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.8 });
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8, metalness: 0.02 });

  const halfSize = 6;
  const wh = P.wallHeight;
  const wt = P.wallThickness;
  const baseY = 0;

  /* ---- MOAT ---- */
  if (P.moat) {
    const moatW = P.moatWidth;
    const moatR = halfSize + moatW / 2 + wt;
    const moatGeo = new THREE.TorusGeometry(moatR, moatW / 2, 8, 48);
    const moatMesh = new THREE.Mesh(moatGeo, moatMat);
    moatMesh.rotation.x = Math.PI / 2;
    moatMesh.position.y = -0.3;
    castleGroup.add(part(moatMesh, 'moat'));

    /* Moat edge rings */
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
    const outerEdge = new THREE.Mesh(new THREE.TorusGeometry(moatR + moatW / 2 + 0.15, 0.15, 8, 48), edgeMat);
    outerEdge.rotation.x = Math.PI / 2;
    outerEdge.position.y = 0.05;
    castleGroup.add(part(outerEdge, 'moat_outer_lip'));
    const innerEdge = new THREE.Mesh(new THREE.TorusGeometry(moatR - moatW / 2 - 0.15, 0.15, 8, 48), edgeMat);
    innerEdge.rotation.x = Math.PI / 2;
    innerEdge.position.y = 0.05;
    castleGroup.add(part(innerEdge, 'moat_inner_lip'));
  }

  /* ---- DRAWBRIDGE ---- */
  if (P.drawbridge && P.moat) {
    const bridgeGeo = new THREE.BoxGeometry(P.gateWidth + 0.6, 0.2, P.moatWidth + 1);
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(0, 0.05, -halfSize - P.moatWidth / 2 - wt / 2);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    castleGroup.add(part(bridge, 'drawbridge'));

    /* Chain cables */
    const chainMat = ironMat;
    for (let side = -1; side <= 1; side += 2) {
      const chainGeo = new THREE.CylinderGeometry(0.03, 0.03, P.moatWidth + 2, 6);
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.set(side * (P.gateWidth / 2 + 0.3), wh * 0.6, -halfSize - P.moatWidth / 2);
      chain.rotation.x = Math.PI * 0.12;
      castleGroup.add(part(chain, side === -1 ? 'drawbridge_chain_left' : 'drawbridge_chain_right'));
    }
  }

  /* ---- WALLS (4 segments) ---- */
  const wallLength = halfSize * 2;
  const wallData = [
    { rx: 0, rz: 0, pos: [0, wh / 2 + baseY, -halfSize] },
    { rx: 0, rz: 0, pos: [0, wh / 2 + baseY, halfSize] },
    { rx: 0, rz: Math.PI / 2, pos: [-halfSize, wh / 2 + baseY, 0] },
    { rx: 0, rz: Math.PI / 2, pos: [halfSize, wh / 2 + baseY, 0] },
  ];

  wallData.forEach(function(w, wi) {
    const wallGeo = new THREE.BoxGeometry(wallLength, wh, wt);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
    wall.castShadow = true;
    wall.receiveShadow = true;
    castleGroup.add(part(wall, 'wall_' + ['north','south','west','east'][wi]));
  });

  /* Wall stone detail strips */
  for (let i = 0; i < 3; i++) {
    const stripY = wh * (0.2 + i * 0.3);
    const stripGeo = new THREE.BoxGeometry(wallLength + 0.05, 0.12, wt + 0.05);
    const strip = new THREE.Mesh(stripGeo, stoneMat);
    strip.position.set(0, stripY + baseY, -halfSize);
    castleGroup.add(part(strip, 'wall_stone_course_front_' + i));
    const strip2 = new THREE.Mesh(stripGeo.clone(), stoneMat);
    strip2.position.set(0, stripY + baseY, halfSize);
    castleGroup.add(part(strip2, 'wall_stone_course_back_' + i));
    const strip3 = new THREE.Mesh(new THREE.BoxGeometry(wt + 0.05, 0.12, wallLength + 0.05), stoneMat);
    strip3.position.set(-halfSize, stripY + baseY, 0);
    castleGroup.add(part(strip3, 'wall_stone_course_left_' + i));
    const strip4 = new THREE.Mesh(new THREE.BoxGeometry(wt + 0.05, 0.12, wallLength + 0.05), stoneMat);
    strip4.position.set(halfSize, stripY + baseY, 0);
    castleGroup.add(part(strip4, 'wall_stone_course_right_' + i));
  }

  /* ---- BATTLEMENTS ---- */
  const bSize = P.battlementSize;
  const bCount = Math.floor(wallLength / (bSize * 2));
  const wallPositions = [
    { axis: 'z', pos: [-halfSize, wh + baseY, -halfSize], dir: [0, 0, 1], length: wallLength },
    { axis: 'z', pos: [-halfSize, wh + baseY, halfSize], dir: [0, 0, 1], length: wallLength },
    { axis: 'x', pos: [-halfSize, wh + baseY, -halfSize], dir: [1, 0, 0], length: wallLength },
    { axis: 'x', pos: [halfSize, wh + baseY, -halfSize], dir: [1, 0, 0], length: wallLength },
  ];

  wallPositions.forEach(function(wp, wpi) {
    const bc = Math.floor(wp.length / (bSize * 2.5));
    for (let i = 0; i < bc; i++) {
      if (i % 2 === 0) {
        const bGeo = new THREE.BoxGeometry(bSize, bSize * 1.5, wt + 0.1);
        const bMesh = new THREE.Mesh(bGeo, wallMat);
        const t = (i / bc) * wp.length;
        if (wp.axis === 'z') {
          bMesh.position.set(wp.pos[0] + t + bSize, wp.pos[1] + bSize * 0.75, wp.pos[2]);
        } else {
          bMesh.position.set(wp.pos[0], wp.pos[1] + bSize * 0.75, wp.pos[2] + t + bSize);
        }
        bMesh.castShadow = true;
        castleGroup.add(part(bMesh, 'battlement_' + wpi + '_' + i));
      }
    }
  });

  /* ---- TOWERS ---- */
  const towerPositions = [
    [-halfSize, -halfSize],
    [halfSize, -halfSize],
    [halfSize, halfSize],
    [-halfSize, halfSize],
  ];

  /* Add extra tower positions for > 4 towers */
  if (P.towerCount > 4) {
    towerPositions.push([0, -halfSize]);
    towerPositions.push([0, halfSize]);
    towerPositions.push([-halfSize, 0]);
    towerPositions.push([halfSize, 0]);
  }

  const towerCount = Math.min(P.towerCount, towerPositions.length);
  for (let i = 0; i < towerCount; i++) {
    const tx = towerPositions[i][0];
    const tz = towerPositions[i][1];
    const tH = P.towerHeight;
    const tR = P.towerRadius;

    if (P.towerStyle === 'round') {
      const towerGeo = new THREE.CylinderGeometry(tR, tR * 1.05, tH, 16);
      const tower = new THREE.Mesh(towerGeo, wallMat);
      tower.position.set(tx, tH / 2 + baseY, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      castleGroup.add(part(tower, 'tower_' + i + '_shaft'));

      /* Conical roof */
      const roofGeo = new THREE.ConeGeometry(tR * 1.3, tH * 0.3, 16);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.75, metalness: 0.1 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(tx, tH + tH * 0.15 + baseY, tz);
      roof.castShadow = true;
      castleGroup.add(part(roof, 'tower_' + i + '_roof'));

      /* Tower stone bands */
      for (let b = 0; b < 3; b++) {
        const bandGeo = new THREE.TorusGeometry(tR + 0.05, 0.08, 6, 16);
        const band = new THREE.Mesh(bandGeo, stoneMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(tx, tH * (0.2 + b * 0.3) + baseY, tz);
        castleGroup.add(part(band, 'tower_' + i + '_stone_band_' + b));
      }
    } else {
      /* Square tower */
      const towerGeo = new THREE.BoxGeometry(tR * 2, tH, tR * 2);
      const tower = new THREE.Mesh(towerGeo, wallMat);
      tower.position.set(tx, tH / 2 + baseY, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      castleGroup.add(part(tower, 'tower_' + i + '_shaft'));

      /* Crenellations on square tower */
      for (let c = 0; c < 4; c++) {
        for (let j = 0; j < 3; j++) {
          if (j % 2 === 0) {
            const cGeo = new THREE.BoxGeometry(tR * 0.4, bSize * 1.2, bSize * 0.8);
            const cMesh = new THREE.Mesh(cGeo, wallMat);
            const angle = c * Math.PI / 2;
            const offset = (j - 1) * tR * 0.6;
            if (c === 0 || c === 2) {
              cMesh.position.set(tx + (c === 0 ? -tR : tR), tH + bSize * 0.6 + baseY, tz + offset);
            } else {
              cMesh.position.set(tx + offset, tH + bSize * 0.6 + baseY, tz + (c === 1 ? -tR : tR));
            }
            cMesh.castShadow = true;
            castleGroup.add(part(cMesh, 'tower_' + i + '_crenel_' + c + '_' + j));
          }
        }
      }

      /* Flat roof with slight raised edge */
      const capGeo = new THREE.BoxGeometry(tR * 2 + 0.2, 0.15, tR * 2 + 0.2);
      const cap = new THREE.Mesh(capGeo, stoneMat);
      cap.position.set(tx, tH + baseY, tz);
      castleGroup.add(part(cap, 'tower_' + i + '_roof'));
    }

    /* Tower windows */
    if (P.windowCount > 0) {
      const winCount = Math.min(2, Math.floor(P.windowCount / towerCount));
      for (let w = 0; w < winCount; w++) {
        const winAngle = (w / winCount) * Math.PI * 2;
        const winR = P.towerStyle === 'round' ? tR + 0.01 : tR + 0.01;
        const winX = tx + Math.cos(winAngle) * winR;
        const winZ = tz + Math.sin(winAngle) * winR;
        const winGeo = new THREE.CircleGeometry(0.2, 12);
        const win = new THREE.Mesh(winGeo, glassMat);
        win.position.set(winX, tH * 0.5 + baseY, winZ);
        win.lookAt(winX * 2, tH * 0.5 + baseY, winZ * 2);
        castleGroup.add(part(win, 'tower_' + i + '_window_' + w));
      }
    }
  }

  /* ---- GATE ---- */
  const gateY = baseY;
  const gateW = P.gateWidth;
  const gateH = wh * 0.65;

  if (P.gateStyle === 'arch') {
    /* Two pillars */
    const pillarGeo = new THREE.BoxGeometry(0.3, gateH, wt + 0.1);
    const pillarL = new THREE.Mesh(pillarGeo, darkStone);
    pillarL.position.set(-gateW / 2, gateH / 2 + gateY, -halfSize);
    pillarL.castShadow = true;
    castleGroup.add(part(pillarL, 'gate_pillar_left'));
    const pillarR = new THREE.Mesh(pillarGeo.clone(), darkStone);
    pillarR.position.set(gateW / 2, gateH / 2 + gateY, -halfSize);
    pillarR.castShadow = true;
    castleGroup.add(part(pillarR, 'gate_pillar_right'));

    /* Arch top - half torus */
    const archGeo = new THREE.TorusGeometry(gateW / 2, 0.2, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, darkStone);
    arch.position.set(0, gateH + gateY, -halfSize);
    arch.rotation.z = Math.PI;
    castleGroup.add(part(arch, 'gate_arch'));

    /* Dark interior */
    const interiorGeo = new THREE.PlaneGeometry(gateW - 0.2, gateH - 0.2);
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 });
    const interior = new THREE.Mesh(interiorGeo, interiorMat);
    interior.position.set(0, gateH / 2 + gateY + 0.1, -halfSize + 0.01);
    castleGroup.add(part(interior, 'gate_interior'));
  } else if (P.gateStyle === 'double') {
    /* Double doors */
    const doorGeo = new THREE.BoxGeometry(gateW / 2 - 0.1, gateH, 0.15);
    const doorL = new THREE.Mesh(doorGeo, woodMat);
    doorL.position.set(-gateW / 4 - 0.05, gateH / 2 + gateY, -halfSize);
    doorL.castShadow = true;
    castleGroup.add(part(doorL, 'gate_door_left'));
    const doorR = new THREE.Mesh(doorGeo.clone(), woodMat);
    doorR.position.set(gateW / 4 + 0.05, gateH / 2 + gateY, -halfSize);
    doorR.castShadow = true;
    castleGroup.add(part(doorR, 'gate_door_right'));

    /* Iron bands */
    for (let d = 0; d < 3; d++) {
      const bandY = gateH * (0.2 + d * 0.3);
      const bandGeo = new THREE.BoxGeometry(gateW + 0.1, 0.08, 0.17);
      const band = new THREE.Mesh(bandGeo, ironMat);
      band.position.set(0, bandY + gateY, -halfSize);
      castleGroup.add(part(band, 'gate_iron_band_' + d));
    }

    /* Door ring handles */
    for (let side = -1; side <= 1; side += 2) {
      const ringGeo = new THREE.TorusGeometry(0.12, 0.02, 6, 12);
      const ring = new THREE.Mesh(ringGeo, ironMat);
      ring.position.set(side * (gateW / 4 + 0.05), gateH * 0.45 + gateY, -halfSize - 0.1);
      castleGroup.add(part(ring, side === -1 ? 'gate_door_ring_left' : 'gate_door_ring_right'));
    }
  } else {
    /* Portcullis */
    const frameGeo = new THREE.BoxGeometry(gateW + 0.3, gateH + 0.3, 0.15);
    const frame = new THREE.Mesh(frameGeo, ironMat);
    frame.position.set(0, gateH / 2 + gateY, -halfSize);
    frame.castShadow = true;
    castleGroup.add(part(frame, 'gate_portcullis_frame'));

    /* Grid bars */
    const barCount = Math.floor(gateW / 0.3);
    for (let b = 0; b < barCount; b++) {
      const barGeo = new THREE.CylinderGeometry(0.03, 0.03, gateH, 6);
      const bar = new THREE.Mesh(barGeo, ironMat);
      bar.position.set(-gateW / 2 + 0.15 + b * (gateW / barCount), gateH / 2 + gateY, -halfSize - 0.08);
      castleGroup.add(part(bar, 'gate_portcullis_bar_' + b));
    }
    /* Horizontal bars */
    const hBarCount = Math.floor(gateH / 0.4);
    for (let h = 0; h < hBarCount; h++) {
      const hBarGeo = new THREE.CylinderGeometry(0.025, 0.025, gateW, 6);
      const hBar = new THREE.Mesh(hBarGeo, ironMat);
      hBar.rotation.z = Math.PI / 2;
      hBar.position.set(0, gateH * (0.15 + h * (1 / hBarCount)) + gateY, -halfSize - 0.08);
      castleGroup.add(part(hBar, 'gate_portcullis_crossbar_' + h));
    }

    /* Dark interior */
    const interiorGeo = new THREE.PlaneGeometry(gateW - 0.1, gateH - 0.1);
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 });
    const interior = new THREE.Mesh(interiorGeo, interiorMat);
    interior.position.set(0, gateH / 2 + gateY + 0.1, -halfSize + 0.02);
    castleGroup.add(part(interior, 'gate_interior'));
  }

  /* Gate arch top (for all styles) */
  const archTopGeo = new THREE.BoxGeometry(gateW + 0.6, 0.35, wt + 0.2);
  const archTop = new THREE.Mesh(archTopGeo, darkStone);
  archTop.position.set(0, gateH + 0.15 + gateY, -halfSize);
  castleGroup.add(part(archTop, 'gate_arch_top'));

  /* ---- KEEP ---- */
  const kH = P.keepHeight;
  const kW = P.keepWidth;
  const keepGeo = new THREE.BoxGeometry(kW, kH, kW);
  const keep = new THREE.Mesh(keepGeo, wallMat);
  keep.position.set(0, kH / 2 + baseY, 0);
  keep.castShadow = true;
  keep.receiveShadow = true;
  castleGroup.add(part(keep, 'keep'));

  /* Keep roof */
  const keepRoofGeo = new THREE.ConeGeometry(kW * 0.75, kH * 0.2, 4);
  const keepRoofMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.8 });
  const keepRoof = new THREE.Mesh(keepRoofGeo, keepRoofMat);
  keepRoof.position.set(0, kH + kH * 0.1 + baseY, 0);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  castleGroup.add(part(keepRoof, 'keep_roof'));

  /* Keep crenellations */
  for (let c = 0; c < 4; c++) {
    for (let j = 0; j < 4; j++) {
      if (j % 2 === 0) {
        const cGeo = new THREE.BoxGeometry(kW * 0.2, bSize * 1.5, bSize);
        const cMesh = new THREE.Mesh(cGeo, wallMat);
        const angle = c * Math.PI / 2;
        const offset = (j - 1.5) * kW * 0.22;
        if (c === 0 || c === 2) {
          cMesh.position.set((c === 0 ? -kW / 2 : kW / 2), kH + bSize * 0.75 + baseY, offset);
        } else {
          cMesh.rotation.y = Math.PI / 2;
          cMesh.position.set(offset, kH + bSize * 0.75 + baseY, (c === 1 ? -kW / 2 : kW / 2));
        }
        cMesh.castShadow = true;
        castleGroup.add(part(cMesh, 'keep_crenel_' + c + '_' + j));
      }
    }
  }

  /* Keep stone detail */
  for (let d = 0; d < 2; d++) {
    const dY = kH * (0.3 + d * 0.35);
    const dGeo = new THREE.BoxGeometry(kW + 0.1, 0.12, kW + 0.1);
    const dMesh = new THREE.Mesh(dGeo, stoneMat);
    dMesh.position.set(0, dY + baseY, 0);
    castleGroup.add(part(dMesh, 'keep_stone_band_' + d));
  }

  /* Keep windows */
  const keepWinCount = Math.min(4, Math.floor(P.windowCount / 3));
  for (let w = 0; w < keepWinCount; w++) {
    const wAngle = (w / keepWinCount) * Math.PI * 2;
    const wX = Math.cos(wAngle) * (kW / 2 + 0.01);
    const wZ = Math.sin(wAngle) * (kW / 2 + 0.01);
    const wGeo = new THREE.PlaneGeometry(0.5, 0.8);
    const wMesh = new THREE.Mesh(wGeo, glassMat);
    wMesh.position.set(wX, kH * 0.55 + baseY, wZ);
    wMesh.lookAt(wX * 3, kH * 0.55 + baseY, wZ * 3);
    castleGroup.add(part(wMesh, 'keep_window_' + w));
  }

  /* ---- COURTYARD ---- */
  if (P.courtyard) {
    const courtGeo = new THREE.BoxGeometry(kW * 1.6, 0.08, kW * 1.6);
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.9 });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.position.set(0, 0.04, 0);
    court.receiveShadow = true;
    castleGroup.add(part(court, 'courtyard'));
  }

  /* ---- WINDOWS (wall windows) ---- */
  const wallWinCount = Math.max(0, P.windowCount - keepWinCount - P.towerCount * 2);
  for (let w = 0; w < wallWinCount; w++) {
    const side = w % 4;
    const row = Math.floor(w / 4);
    const winGeo = new THREE.PlaneGeometry(0.4, 0.6);
    const winMesh = new THREE.Mesh(winGeo, glassMat);
    let wx, wy, wz, rotY = 0;
    wy = wh * 0.4 + row * wh * 0.2 + baseY;
    if (side === 0) { wx = -2 + (w % 2) * 4; wz = -halfSize - 0.01; rotY = 0; }
    else if (side === 1) { wx = -2 + (w % 2) * 4; wz = halfSize + 0.01; rotY = Math.PI; }
    else if (side === 2) { wx = -halfSize - 0.01; wz = -2 + (w % 2) * 4; rotY = Math.PI / 2; }
    else { wx = halfSize + 0.01; wz = -2 + (w % 2) * 4; rotY = -Math.PI / 2; }
    winMesh.position.set(wx, wy, wz);
    winMesh.rotation.y = rotY;
    castleGroup.add(part(winMesh, 'wall_window_' + w));
  }

  /* ---- BANNERS ---- */
  if (P.flagCount > 0) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.7, metalness: 0.3 });
    const bannerPositions = [];

    /* On towers */
    for (let i = 0; i < Math.min(P.towerCount, towerPositions.length); i++) {
      bannerPositions.push([towerPositions[i][0], P.towerHeight + baseY + 0.5, towerPositions[i][1]]);
    }
    /* Extra banner positions on walls */
    if (P.flagCount > P.towerCount) {
      bannerPositions.push([0, wh + 0.5, -halfSize]);
      bannerPositions.push([0, wh + 0.5, halfSize]);
      bannerPositions.push([-halfSize, wh + 0.5, 0]);
      bannerPositions.push([halfSize, wh + 0.5, 0]);
    }

    const bannerCount = Math.min(P.flagCount, bannerPositions.length);
    for (let i = 0; i < bannerCount; i++) {
      const bp = bannerPositions[i];
      /* Pole */
      const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(bp[0], bp[1] + 1, bp[2]);
      castleGroup.add(part(pole, 'banner_pole_' + i));

      /* Flag */
      const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
      const flag = new THREE.Mesh(flagGeo, bannerMat);
      flag.position.set(bp[0] + 0.45, bp[1] + 1.5, bp[2]);
      flag.rotation.y = Math.PI / 2;
      castleGroup.add(part(flag, 'banner_flag_' + i));

      /* Small ball on top */
      const ballGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const ball = new THREE.Mesh(ballGeo, ironMat);
      ball.position.set(bp[0], bp[1] + 2, bp[2]);
      castleGroup.add(part(ball, 'banner_finial_' + i));
    }
  }

  /* ---- TORCHES ---- */
  torchLights = [];
  if (P.torchCount > 0) {
    const torchPositions = [];
    /* Torches along walls */
    const perSide = Math.ceil(P.torchCount / 4);
    for (let side = 0; side < 4; side++) {
      for (let t = 0; t < perSide; t++) {
        if (torchPositions.length >= P.torchCount) break;
        const frac = (t + 1) / (perSide + 1);
        let tx, tz, tNormal;
        if (side === 0) { tx = -halfSize + frac * wallLength; tz = -halfSize; tNormal = [0, 0, -1]; }
        else if (side === 1) { tx = -halfSize + frac * wallLength; tz = halfSize; tNormal = [0, 0, 1]; }
        else if (side === 2) { tx = -halfSize; tz = -halfSize + frac * wallLength; tNormal = [-1, 0, 0]; }
        else { tx = halfSize; tz = -halfSize + frac * wallLength; tNormal = [1, 0, 0]; }
        torchPositions.push([tx, wh * 0.7 + baseY, tz, tNormal]);
      }
    }

    for (let i = 0; i < torchPositions.length; i++) {
      const tp = torchPositions[i];
      /* Bracket */
      const bracketGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
      const bracket = new THREE.Mesh(bracketGeo, torchMat);
      bracket.position.set(tp[0], tp[1], tp[2]);
      castleGroup.add(part(bracket, 'torch_bracket_' + i));

      /* Torch stick */
      const stickGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
      const stick = new THREE.Mesh(stickGeo, torchMat);
      stick.position.set(tp[0], tp[1] + 0.35, tp[2]);
      castleGroup.add(part(stick, 'torch_stick_' + i));

      /* Fire ball (glowing when lit) */
      const fireGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const fireClone = fireMat.clone();
      fireClone.opacity = 0;
      const fire = new THREE.Mesh(fireGeo, fireClone);
      fire.position.set(tp[0], tp[1] + 0.65, tp[2]);
      castleGroup.add(part(fire, 'torch_flame_' + i));

      /* Point light (off by default) */
      const light = new THREE.PointLight(0xff8833, 0, 6);
      light.position.set(tp[0], tp[1] + 0.7, tp[2]);
      castleGroup.add(light);

      torchLights.push({ fire: fire, light: light, basePos: [tp[0], tp[1] + 0.65, tp[2]] });
    }
  }

  /* Update torch toggle state */
  const torchToggle = document.getElementById('rb-torches');
  if (torchToggle) torchToggle.checked = P.torchCount > 0;

  scene.add(castleGroup);
  updateStats();
  updateSpecCard();
  syncRightBar();
}

/* -------------------------------
   ORBIT CONTROLS
------------------------------- */
let orbit = { theta: 0.4, phi: 1.0, radius: 20, dragging: false, lastX: 0, lastY: 0 };

function updateCamera() {
  orbit.phi = Math.max(0.2, Math.min(Math.PI - 0.2, orbit.phi));
  orbit.radius = Math.max(6, Math.min(40, orbit.radius));
  camera.position.x = orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
  camera.position.y = orbit.radius * Math.cos(orbit.phi) + 4;
  camera.position.z = orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
  camera.lookAt(0, 3, 0);
}

canvas.addEventListener('mousedown', function(e) { orbit.dragging = true; orbit.lastX = e.clientX; orbit.lastY = e.clientY; });
window.addEventListener('mouseup', function() { orbit.dragging = false; });
window.addEventListener('mousemove', function(e) {
  if (!orbit.dragging) return;
  orbit.theta -= (e.clientX - orbit.lastX) * 0.007;
  orbit.phi   -= (e.clientY - orbit.lastY) * 0.007;
  orbit.lastX = e.clientX; orbit.lastY = e.clientY;
});
canvas.addEventListener('wheel', function(e) { orbit.radius += e.deltaY * 0.015; e.preventDefault(); }, { passive: false });

BuilderGestures.attachTapSelect(canvas, camera, function () { return castleGroup; }, {
  onOrbit: function (dx, dy) { orbit.theta -= dx * 0.007; orbit.phi -= dy * 0.007; },
  onPinch: function (ratio) { orbit.radius *= ratio; },
  onDragStart: function () { orbit.dragging = true; },
  onDragEnd: function () { orbit.dragging = false; }
});

/* -------------------------------
   RESIZE + RENDER LOOP
------------------------------- */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  torchAnimFrame++;
  if (!orbit.dragging) orbit.theta += 0.002;
  updateCamera();

  /* Animate lit torches */
  if (torchesLit) {
    torchLights.forEach(function(t, i) {
      const flicker = 0.7 + Math.sin(torchAnimFrame * 0.15 + i * 1.7) * 0.3;
      t.light.intensity = 2.5 * flicker;
      t.fire.material.opacity = 0.6 + Math.sin(torchAnimFrame * 0.2 + i) * 0.3;
      const s = 0.9 + Math.sin(torchAnimFrame * 0.18 + i * 0.8) * 0.15;
      t.fire.scale.setScalar(s);
      t.fire.position.y = t.basePos[1] + Math.sin(torchAnimFrame * 0.12 + i) * 0.03;
    });
  }

  resize();
  renderer.render(scene, camera);
}
animate();

/* -------------------------------
   SPEC OVERLAY
------------------------------- */
function updateSpecCard() {
  document.getElementById('sName').textContent = P.castleName || 'UNNAMED';
  document.getElementById('sWalls').textContent = P.wallHeight + 'm tall';
  document.getElementById('sTowers').textContent = P.towerCount + ' 🏰 ' + P.towerStyle;
  document.getElementById('sKeep').textContent = P.keepHeight + 'm';
  document.getElementById('sGate').textContent = P.gateStyle.charAt(0).toUpperCase() + P.gateStyle.slice(1);
  document.getElementById('sMoat').textContent = P.moat ? P.moatWidth + 'm wide' : 'None';
}

function sout(m) { document.getElementById('obar').textContent = m; }

/* -------------------------------
   RIGHT BAR SYNC
------------------------------- */
function syncRightBar() {
  function sv(id, val) { const e = document.getElementById(id); if (e) e.value = val; }
  function sc(id, val) { const e = document.getElementById(id); if (e) e.checked = val; }
  function st(id, txt) { const e = document.getElementById(id); if (e) e.textContent = txt; }
  sv('rb-wallCol', P.wallColor);
  sv('rb-stoneCol', P.stoneColor);
  sv('rb-bannerCol', P.bannerColor);
  sv('rb-wh', P.wallHeight); st('rb-whv', P.wallHeight.toFixed(1));
  sv('rb-wt', P.wallThickness); st('rb-wtv', P.wallThickness.toFixed(1));
  sv('rb-tc', P.towerCount); st('rb-tcv', P.towerCount);
  sv('rb-th', P.towerHeight); st('rb-thv', P.towerHeight.toFixed(1));
  sv('rb-ts', P.towerStyle);
  sv('rb-gs', P.gateStyle);
  sv('rb-gw', P.gateWidth); st('rb-gwv', P.gateWidth.toFixed(1));
  sv('rb-kh', P.keepHeight); st('rb-khv', P.keepHeight.toFixed(1));
  sv('rb-kw', P.keepWidth); st('rb-kwv', P.keepWidth.toFixed(1));
  sc('rb-moat', P.moat);
  sc('rb-drawbridge', P.drawbridge);
  sc('rb-courtyard', P.courtyard);
  sv('rb-fc', P.flagCount); st('rb-fcv', P.flagCount);
  sc('rb-torches', P.torchCount > 0);
  sv('rb-torchc', P.torchCount); st('rb-torchc', P.torchCount);
}

/* -------------------------------
   STATS
------------------------------- */
function computeStats() {
  const defense = Math.min(10, Math.round(
    P.wallHeight * 0.6 + P.wallThickness * 1.5 + P.towerCount * 0.5 +
    P.battlementSize * 5 + (P.moat ? 2 : 0) + (P.towerHeight > P.wallHeight ? 1 : 0)
  ));
  const grandeur = Math.min(10, Math.round(
    P.keepHeight * 0.4 + P.towerCount * 0.3 + P.flagCount * 0.3 +
    P.windowCount * 0.15 + (P.towerStyle === 'round' ? 1 : 0) + P.wallHeight * 0.2
  ));
  const comfort = Math.min(10, Math.round(
    (P.courtyard ? 3 : 0) + P.windowCount * 0.2 + P.torchCount * 0.15 +
    (P.drawbridge ? 1 : 0) + P.keepWidth * 0.3
  ));
  const access = Math.min(10, Math.round(
    P.gateWidth * 1.5 + (P.drawbridge ? 3 : 0) + (P.gateStyle === 'portcullis' ? -1 : 0) +
    (P.moat ? 0 : 2)
  ));
  return {
    defense: Math.max(1, defense),
    grandeur: Math.max(1, grandeur),
    comfort: Math.max(1, comfort),
    access: Math.max(1, access)
  };
}

function updateStats() {
  const s = computeStats();
  const el = document.getElementById('castleStats');
  if (!el) return;
  const bar = (v, c) => `<div class="stat-track"><div class="stat-fill" style="width:${v * 10}%;background:${c}"></div></div>`;
  el.innerHTML = `<div class="stat-title">${P.castleName || 'Castle'} Stats</div>` +
    `<div class="stat-row"><span class="stat-lbl">Defense</span>${bar(s.defense, '#c9a84c')}<span class="stat-val">${s.defense}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Grandeur</span>${bar(s.grandeur, '#a78bfa')}<span class="stat-val">${s.grandeur}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Comfort</span>${bar(s.comfort, '#4ade80')}<span class="stat-val">${s.comfort}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Access</span>${bar(s.access, '#38bdf8')}<span class="stat-val">${s.access}</span></div>`;
}

/* -------------------------------
   LIGHT TORCHES
------------------------------- */
function lightTorches() {
  if (torchLights.length === 0) {
    toast('No torches to light! Add some first.');
    return;
  }
  torchesLit = !torchesLit;
  if (torchesLit) {
    toast('🔥 ' + (P.castleName || 'Your Castle') + ' is illuminated!');
    sout('🔥 ' + (P.castleName || 'Your Castle') + ' is illuminated!');
    document.getElementById('liveStatus').textContent = 'Torches lit!';
  } else {
    toast('Torches extinguished.');
    sout('Torches extinguished.');
    document.getElementById('liveStatus').textContent = 'Torches off.';
    torchLights.forEach(function(t) {
      t.light.intensity = 0;
      t.fire.material.opacity = 0;
    });
  }
}

/* -------------------------------
   STEPS
------------------------------- */
let currentStep = 0;
const stepDone = new Array(16).fill(false);

const FACTS = {
  name: 'The Tower of London has stood for over 900 years and has been a royal palace, prison, and fortress. It was founded by William the Conqueror in 1066.',
  wallHeight: 'Castle walls were typically 2-6 metres thick to withstand siege engines and battering rams. The walls of Krak des Chevaliers were up to 8 metres thick.',
  wallThickness: 'Thicker walls meant fewer arrowslits but greater resistance. Medieval engineers balanced defence with the need to see and shoot at attackers.',
  wallColor: 'Castle stone varied by region: limestone in England, granite in Scotland, sandstone in France. The colour told you where the stone was quarried.',
  stoneColor: 'Mortar was made from lime, sand, and water. Some Roman concrete formulas were so strong they still hold after 2000 years.',
  towers: 'Round towers were harder to undermine than square ones because there were no corners to weaken. Castles like Bodiam used round corner towers.',
  gate: 'The gatehouse was the most vulnerable point, so it was also the most heavily defended. Many had murder holes, drawbridges, and multiple portcullises.',
  battlements: 'Battlements (crenellations) let defenders shoot through the gaps (crenels) and hide behind the solid parts (merlons). They became a symbol of lordship.',
  keep: 'The keep was the last line of defence. The Tower of London\'s White Tower is 27 metres tall and has walls 4.5 metres thick at the base.',
  moat: 'Moats could be wet (filled with water) or dry (a deep ditch). Some were stocked with fish to feed the garrison during a siege.',
  drawbridge: 'Drawbridges could be raised in seconds. Some castles had counterweighted bridges that one person could operate with a windlass.',
  banners: 'Banners identified the lord of the castle. Heraldry developed in the 12th century so knights could be recognised wearing helmets.',
  windows: 'Early castle windows were tiny arrow slits. By the 14th century, larger decorative windows appeared as castles became more comfortable.',
  torches: 'Torches were made from bundled reeds soaked in pitch or tallow. A castle might burn through hundreds of torches per week.',
  courtyard: 'The courtyard was the heart of daily life. It held the well, the smithy, stables, kitchens, and space for mustering troops.',
  quiz: 'Medieval castles inspired fantasy worlds from Tolkien\'s Minas Tirith to Game of Thrones\' Winterfell. Real history is the best fantasy.'
};

function opts(id, options, currentVal, onChange) {
  return '<div class="opt-grid">' + options.map(function(o) {
    return '<button class="opt-btn' + (currentVal === o.val ? ' sel' : '') + '" data-action="' + onChange + '" data-arg="' + o.val + '">' +
      '<span class="opt-icon">' + o.icon + '</span>' + o.label + '</button>';
  }).join('') + '</div>';
}

function swatchRow(id, colours, currentVal, onChange) {
  return '<div class="swatch-row">' + colours.map(function(c) {
    return '<div class="swatch' + (currentVal === c ? ' sel' : '') + '" style="background:' + c + '" data-action="' + onChange + '" data-arg="' + c + '"></div>';
  }).join('') + '</div>' +
  '<div class="custom-colour"><span>Custom:</span><input type="color" value="' + currentVal + '" data-action-input="' + onChange + '"></div>';
}

const STEPS = [

/* 1 */ {
  title: 'Name Your Castle',
  tag: 'STEP 01 , IDENTITY',
  intro: 'Every great castle has a name. Ironhold. Stormreach. The Dun Cow. Names carry history, legend, and fear. What will your fortress be called?',
  boxes: [
    { t:'box-c', tx: FACTS.name },
    { t:'box-t', tx:'Keep it under 12 characters , it displays best on the spec overlay and profile card.' },
  ],
  tasks: ['Enter a castle name', 'Press Apply to lock it in'],
  html: function() { return '<input class="name-input" id="castleName" aria-label="Castle name" maxlength="14" placeholder="E.G. IRONHOLD" value="' + (P.castleName === 'Ironhold' ? '' : P.castleName) + '">'; },
  onApply: function() { P.castleName = document.getElementById('castleName')?.value?.trim() || 'Ironhold'; buildCastle(); sout('👑 ' + P.castleName + ' is founded. Now choose your walls.'); document.getElementById('liveStatus').textContent = 'Named!'; }
},

/* 2 */ {
  title: 'Wall Height',
  tag: 'STEP 02 , FORTIFICATION',
  intro: 'How tall are your castle walls? Taller walls are harder to scale with ladders and siege towers, but they need more stone and skilled masons.',
  boxes: [
    { t:'box-c', tx: FACTS.wallHeight },
    { t:'box-t', tx:'Start with Medium , it gives a balanced look with towers and the keep.' },
  ],
  tasks: ['Choose a wall height', 'Notice how towers and keep proportions change'],
  html: function() {
    return '<div style="padding:6px 0"><div class="slider-row">' +
      '<span class="slider-lbl">Wall Height</span>' +
      '<input type="range" min="3" max="8" step="0.5" value="' + P.wallHeight + '" ' +
      'data-param="P.wallHeight" data-parse="float" data-display="whVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="whVal">' + P.wallHeight.toFixed(1) + 'm</span>' +
    '</div></div>';
  },
  onApply: function() { buildCastle(); sout('Walls: ' + P.wallHeight + 'm tall. Strong foundation!'); document.getElementById('liveStatus').textContent = 'Walls set!'; }
},

/* 3 */ {
  title: 'Wall Thickness',
  tag: 'STEP 03 , RESILIENCE',
  intro: 'Thicker walls can withstand battering rams and catapults. But they cost more stone and reduce the interior courtyard space.',
  boxes: [
    { t:'box-c', tx: FACTS.wallThickness },
  ],
  tasks: ['Set the wall thickness'],
  html: function() {
    return '<div style="padding:6px 0"><div class="slider-row">' +
      '<span class="slider-lbl">Thickness</span>' +
      '<input type="range" min="0.4" max="1.5" step="0.1" value="' + P.wallThickness + '" ' +
      'data-param="P.wallThickness" data-parse="float" data-display="wtVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="wtVal">' + P.wallThickness.toFixed(1) + 'm</span>' +
    '</div></div>';
  },
  onApply: function() { buildCastle(); sout('Wall thickness: ' + P.wallThickness + 'm. Siege-resistant!'); document.getElementById('liveStatus').textContent = 'Thickness set!'; }
},

/* 4 */ {
  title: 'Wall Colour',
  tag: 'STEP 04 , APPEARANCE',
  intro: 'Choose the colour of your castle walls. Limestone is pale, granite is grey, sandstone is warm. The stone colour sets the entire mood of your fortress.',
  boxes: [
    { t:'box-c', tx: FACTS.wallColor },
  ],
  tasks: ['Choose a wall colour'],
  html: function() {
    return swatchRow('wc', ['#6b5a40','#8b7355','#a09080','#4a4a50','#3a3020','#7a6a50','#9a8a70','#c0b090'], P.wallColor, 'setWallColor');
  },
  onApply: function() { buildCastle(); sout('Wall colour applied!'); document.getElementById('liveStatus').textContent = 'Colour set!'; }
},

/* 5 */ {
  title: 'Stone Colour',
  tag: 'STEP 05 , DETAIL',
  intro: 'The secondary stone colour appears on decorative bands, window frames, and trim. A contrasting stone adds visual richness to the walls.',
  boxes: [
    { t:'box-c', tx: FACTS.stoneColor },
  ],
  tasks: ['Choose a stone accent colour'],
  html: function() {
    return swatchRow('sc', ['#8b7355','#6b5a40','#a09080','#4a4a50','#3a3020','#7a6a50','#c0b090','#5a5040'], P.stoneColor, 'setStoneColor');
  },
  onApply: function() { buildCastle(); sout('Stone accent applied!'); document.getElementById('liveStatus').textContent = 'Stone set!'; }
},

/* 6 */ {
  title: 'Towers',
  tag: 'STEP 06 , WATCHTOWERS',
  intro: 'Towers give height advantage for archers and lookouts. More towers mean more defensive positions. Round towers are harder to undermine; square towers are easier to build.',
  boxes: [
    { t:'box-c', tx: FACTS.towers },
    { t:'box-t', tx:'4 towers at the corners is the classic layout. Try 6 or 8 for a more imposing fortress.' },
  ],
  tasks: ['Set tower count, height, and style'],
  html: function() {
    return '<div style="padding:6px 0">' +
      '<div class="slider-row"><span class="slider-lbl">Count</span>' +
      '<input type="range" min="0" max="8" step="1" value="' + P.towerCount + '" ' +
      'data-param="P.towerCount" data-parse="int" data-display="tcVal" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="tcVal">' + P.towerCount + '</span></div>' +
      '<div class="slider-row"><span class="slider-lbl">Height</span>' +
      '<input type="range" min="4" max="14" step="0.5" value="' + P.towerHeight + '" ' +
      'data-param="P.towerHeight" data-parse="float" data-display="thVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="thVal">' + P.towerHeight.toFixed(1) + 'm</span></div>' +
      '<div class="slider-row"><span class="slider-lbl">Style</span>' +
      '<select data-param="P.towerStyle" data-parse="raw" data-rebuild="buildCastle"><option value="round"' + (P.towerStyle === 'round' ? ' selected' : '') + '>Round</option><option value="square"' + (P.towerStyle === 'square' ? ' selected' : '') + '>Square</option></select></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout(P.towerCount + ' ' + P.towerStyle + ' towers, ' + P.towerHeight + 'm tall.'); document.getElementById('liveStatus').textContent = 'Towers set!'; }
},

/* 7 */ {
  title: 'Gate Style',
  tag: 'STEP 07 , ENTRANCE',
  intro: 'The gate is the castle\'s weak point , and its most impressive feature. An arch gate is classic. Double doors are grand. A portcullis is imposing and heavily defended.',
  boxes: [
    { t:'box-c', tx: FACTS.gate },
  ],
  tasks: ['Choose a gate style', 'Set the gate width'],
  html: function() {
    return '<div style="padding:6px 0">' +
      opts('gate', [
        { val:'arch', icon:'🏰', label:'Arch' },
        { val:'double', icon:'🚪', label:'Double Door' },
        { val:'portcullis', icon:'⚔', label:'Portcullis' },
      ], P.gateStyle, 'setGateStyle') +
      '<div class="slider-row"><span class="slider-lbl">Width</span>' +
      '<input type="range" min="1" max="4" step="0.2" value="' + P.gateWidth + '" ' +
      'data-param="P.gateWidth" data-parse="float" data-display="gwVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="gwVal">' + P.gateWidth.toFixed(1) + 'm</span></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout('Gate: ' + P.gateStyle + ', ' + P.gateWidth + 'm wide.'); document.getElementById('liveStatus').textContent = 'Gate set!'; }
},

/* 8 */ {
  title: 'Battlements',
  tag: 'STEP 08 , CRENELLATIONS',
  intro: 'The notched pattern along the wall top is called crenellation. The solid parts (merlons) give cover, while the gaps (crenels) let archers fire.',
  boxes: [
    { t:'box-c', tx: FACTS.battlements },
  ],
  tasks: ['Set the battlement size'],
  html: function() {
    return '<div style="padding:6px 0"><div class="slider-row">' +
      '<span class="slider-lbl">Size</span>' +
      '<input type="range" min="0.2" max="0.8" step="0.05" value="' + P.battlementSize + '" ' +
      'data-param="P.battlementSize" data-parse="float" data-display="bsVal" data-fmt="f2m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="bsVal">' + P.battlementSize.toFixed(2) + 'm</span>' +
    '</div></div>';
  },
  onApply: function() { buildCastle(); sout('Battlements: ' + P.battlementSize.toFixed(2) + 'm. Defenders have cover!'); document.getElementById('liveStatus').textContent = 'Battlements set!'; }
},

/* 9 */ {
  title: 'The Keep',
  tag: 'STEP 09 , STRONGHOLD',
  intro: 'The keep is the innermost stronghold , the lord\'s residence and last refuge. A taller keep dominates the skyline. A wider keep provides more living space.',
  boxes: [
    { t:'box-c', tx: FACTS.keep },
  ],
  tasks: ['Set the keep height and width'],
  html: function() {
    return '<div style="padding:6px 0">' +
      '<div class="slider-row"><span class="slider-lbl">Height</span>' +
      '<input type="range" min="5" max="16" step="0.5" value="' + P.keepHeight + '" ' +
      'data-param="P.keepHeight" data-parse="float" data-display="khVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="khVal">' + P.keepHeight.toFixed(1) + 'm</span></div>' +
      '<div class="slider-row"><span class="slider-lbl">Width</span>' +
      '<input type="range" min="2" max="6" step="0.2" value="' + P.keepWidth + '" ' +
      'data-param="P.keepWidth" data-parse="float" data-display="kwVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="kwVal">' + P.keepWidth.toFixed(1) + 'm</span></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout('Keep: ' + P.keepHeight + 'm tall, ' + P.keepWidth + 'm wide.'); document.getElementById('liveStatus').textContent = 'Keep built!'; }
},

/* 10 */ {
  title: 'The Moat',
  tag: 'STEP 10 , WATER DEFENCE',
  intro: 'A moat surrounds the castle with water or a deep ditch, preventing miners from tunneling under the walls and stopping siege towers from reaching them.',
  boxes: [
    { t:'box-c', tx: FACTS.moat },
  ],
  tasks: ['Toggle the moat', 'Set its width'],
  html: function() {
    return '<div style="padding:6px 0">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;color:var(--text);margin-bottom:8px">' +
      '<input type="checkbox" ' + (P.moat ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--acc)" ' +
      'data-param="P.moat" data-parse="checked" data-rebuild="buildCastle"> Surround with a moat</label>' +
      '<div class="slider-row"><span class="slider-lbl">Width</span>' +
      '<input type="range" min="1" max="6" step="0.5" value="' + P.moatWidth + '" ' +
      'data-param="P.moatWidth" data-parse="float" data-display="mwVal" data-fmt="f1m" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="mwVal">' + P.moatWidth.toFixed(1) + 'm</span></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout(P.moat ? 'Moat: ' + P.moatWidth + 'm wide. No siege towers getting through!' : 'No moat , open ground defence.'); document.getElementById('liveStatus').textContent = P.moat ? 'Moat added!' : 'No moat'; }
},

/* 11 */ {
  title: 'Drawbridge',
  tag: 'STEP 11 , CROSSING',
  intro: 'A drawbridge spans the moat and can be raised to seal the gate. Counterweighted bridges could be raised by a single person with a windlass mechanism.',
  boxes: [
    { t:'box-c', tx: FACTS.drawbridge },
    { t:'box-t', tx:'Only appears if you have a moat enabled.' },
  ],
  tasks: ['Toggle the drawbridge'],
  html: function() {
    return '<div style="padding:6px 0"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;color:var(--text)">' +
      '<input type="checkbox" ' + (P.drawbridge ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--acc)" ' +
      'data-param="P.drawbridge" data-parse="checked" data-rebuild="buildCastle"> Add drawbridge</label></div>';
  },
  onApply: function() { buildCastle(); sout(P.drawbridge ? 'Drawbridge installed! Chain-operated.' : 'No drawbridge , bridge or open approach.'); document.getElementById('liveStatus').textContent = P.drawbridge ? 'Bridge added!' : 'No bridge'; }
},

/* 12 */ {
  title: 'Banners & Flags',
  tag: 'STEP 12 , HERALDRY',
  intro: 'Banners identify the lord of the castle and display their coat of arms. Coloured flags flying from towers were a sign of wealth and power.',
  boxes: [
    { t:'box-c', tx: FACTS.banners },
  ],
  tasks: ['Choose banner colour', 'Set flag count'],
  html: function() {
    return '<div style="padding:6px 0">' +
      swatchRow('bc', ['#8b1a1a','#1a3a6b','#2a5a2a','#6b4a1a','#4a1a5a','#1a5a5a','#c9a84c','#ffffff'], P.bannerColor, 'setBannerColor') +
      '<div class="slider-row"><span class="slider-lbl">Flags</span>' +
      '<input type="range" min="0" max="8" step="1" value="' + P.flagCount + '" ' +
      'data-param="P.flagCount" data-parse="int" data-display="fcVal" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="fcVal">' + P.flagCount + '</span></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout(P.flagCount + ' banners fly over ' + P.castleName + '.'); document.getElementById('liveStatus').textContent = 'Banners up!'; }
},

/* 13 */ {
  title: 'Windows',
  tag: 'STEP 13 , LIGHT',
  intro: 'Windows let light into the castle but also create weak points. Early windows were narrow arrow slits. Later castles had larger decorative windows.',
  boxes: [
    { t:'box-c', tx: FACTS.windows },
  ],
  tasks: ['Set the window count'],
  html: function() {
    return '<div style="padding:6px 0"><div class="slider-row">' +
      '<span class="slider-lbl">Windows</span>' +
      '<input type="range" min="0" max="16" step="1" value="' + P.windowCount + '" ' +
      'data-param="P.windowCount" data-parse="int" data-display="wncVal" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="wncVal">' + P.windowCount + '</span>' +
    '</div></div>';
  },
  onApply: function() { buildCastle(); sout(P.windowCount + ' windows let light into the castle.'); document.getElementById('liveStatus').textContent = 'Windows set!'; }
},

/* 14 */ {
  title: 'Torches',
  tag: 'STEP 14 , ILLUMINATION',
  intro: 'Torches light the castle walls and courtyards. They can be lit in the final step for a dramatic fire-lit scene. Set the count and position now.',
  boxes: [
    { t:'box-c', tx: FACTS.torches },
  ],
  tasks: ['Toggle torches on', 'Set the torch count'],
  html: function() {
    return '<div style="padding:6px 0">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;color:var(--text);margin-bottom:8px">' +
      '<input type="checkbox" ' + (P.torchCount > 0 ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--acc)" ' +
      'data-param="P.torchCount" data-parse="checked" data-checked-true="8" data-checked-false="0" data-rebuild="buildCastle"> Enable torches</label>' +
      '<div class="slider-row"><span class="slider-lbl">Count</span>' +
      '<input type="range" min="2" max="16" step="2" value="' + P.torchCount + '" ' +
      'data-param="P.torchCount" data-parse="int" data-display="tnVal" data-rebuild="buildCastle">' +
      '<span class="slider-val" id="tnVal">' + P.torchCount + '</span></div>' +
    '</div>';
  },
  onApply: function() { buildCastle(); sout(P.torchCount + ' torches placed. Light them in the final step!'); document.getElementById('liveStatus').textContent = 'Torches placed!'; }
},

/* 15 */ {
  title: 'Stats & Preview',
  tag: 'STEP 15 , OVERVIEW',
  intro: 'Your castle is complete. Review its statistics , Defense, Grandeur, Comfort, and Accessibility , then head to the final step to light the torches.',
  boxes: [
    { t:'box-r', tx:'<strong>' + (P.castleName || 'Your Castle') + '</strong> , Rotate the 3D view to admire your creation from every angle.' },
  ],
  tasks: ['Review your castle stats', 'Rotate the 3D view'],
  html: function() {
    const s = computeStats();
    return '<div style="padding:8px 0">' +
      '<div style="font-family:Bebas Neue,sans-serif;font-size:1.3rem;color:var(--acc-lt);letter-spacing:.08em;margin-bottom:8px">' + (P.castleName || 'YOUR CASTLE') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      statCard('Defense', s.defense, '#c9a84c', 'Walls, towers, battlements, moat') +
      statCard('Grandeur', s.grandeur, '#a78bfa', 'Keep, towers, banners, windows') +
      statCard('Comfort', s.comfort, '#4ade80', 'Courtyard, windows, torches') +
      statCard('Access', s.access, '#38bdf8', 'Gate width, drawbridge') +
      '</div></div>';
  },
  onApply: function() { sout('Stats reviewed. Ready for the final step!'); document.getElementById('liveStatus').textContent = 'Stats reviewed!'; }
},

/* 16 */ {
  title: 'Light the Torches!',
  tag: 'STEP 16 , ILLUMINATION',
  intro: 'The sun has set. Your garrison stands ready. It\'s time to light the torches and watch ' + (P.castleName || 'your castle') + ' come alive with firelight.',
  boxes: [
    { t:'box-r', tx:'🔥 The torches flicker to life, casting dancing shadows across the stone walls. The banners ripple in the warm updraft.' },
    { t:'box-c', tx: FACTS.quiz },
  ],
  tasks: ['Press to light the torches!'],
  html: function() {
    return '<div style="text-align:center;padding:8px 0">' +
      '<div style="font-size:2.4rem;margin-bottom:7px">🏰</div>' +
      '<div style="font-family:Bebas Neue,sans-serif;font-size:1.5rem;color:var(--acc-lt);letter-spacing:.1em;margin-bottom:6px">' + (P.castleName || 'YOUR CASTLE') + '</div>' +
      '<div style="font-size:.76rem;color:var(--muted);margin-bottom:14px;line-height:1.7">Night falls. The garrison prepares.<br>Light the fires.</div>' +
    '</div>' +
    '<button class="run-btn" style="font-size:1rem;padding:12px" data-action="applyStep" data-arg="' + currentStep + '">🔥 LIGHT THE TORCHES!</button>';
  },
  onApply: function() { lightTorches(); }
},

];

function statCard(label, value, color, desc) {
  return '<div style="background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:7px 9px">' +
    '<div style="font-family:JetBrains Mono,monospace;font-size:.5rem;text-transform:uppercase;letter-spacing:.08em;color:' + color + ';margin-bottom:3px">' + label + '</div>' +
    '<div style="font-family:Bebas Neue,sans-serif;font-size:1.4rem;color:var(--text);line-height:1">' + value + '<span style="font-size:.7rem;color:var(--muted)">/10</span></div>' +
    '<div style="font-size:.55rem;color:var(--muted);margin-top:2px">' + desc + '</div>' +
  '</div>';
}

function go(i) {
  if (i < 0 || i >= STEPS.length) return;
  currentStep = i;
  renderStep();
  updateProgress();
  const items = document.querySelectorAll('.si');
  if (items[i]) items[i].scrollIntoView({ block: 'nearest' });
  document.getElementById('navPrev').disabled = (i === 0);
  document.getElementById('navNext').disabled = (i === STEPS.length - 1);
  toast(STEPS[i].title);
}

function renderStep() {
  const s = STEPS[currentStep];
  const body = document.getElementById('stepBody');
  let html = '<div class="step-tag">' + s.tag + '</div>' +
    '<div class="step-title">' + s.title + '</div>' +
    '<div class="step-intro">' + s.intro + '</div>';
  (s.boxes || []).forEach(function(b) { html += '<div class="box ' + b.t + '">' + b.tx + '</div>'; });
  html += s.html ? s.html() : '';
  if (s.tasks) {
    html += '<div class="task-list">' + s.tasks.map(function(t) {
      var done = stepDone[currentStep];
      return '<div class="task-item' + (done ? ' done' : '') + '"><div class="task-dot"></div>' + t + '</div>';
    }).join('') + '</div>';
  }
  if (!s.html || !s.html().includes('run-btn')) {
    html += '<button class="run-btn" data-action="applyStep" data-arg="' + currentStep + '">✦ Apply to Castle</button>';
  }
  body.innerHTML = html;
  document.querySelectorAll('.si').forEach(function(el, i) { el.classList.toggle('active', i === currentStep); });
}

function applyStep(i) {
  STEPS[i].onApply();
  stepDone[i] = true;
  renderStep();
  updateProgress();
}

function updateProgress() {
  var done = stepDone.filter(Boolean).length;
  var pct = Math.max(3, Math.round((done / STEPS.length) * 100));
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progCt').textContent = done + ' / 16 steps';
  document.querySelectorAll('.si').forEach(function(el, i) {
    el.classList.toggle('done', stepDone[i]);
    el.classList.toggle('active', i === currentStep);
    var sn = el.querySelector('.sn');
    if (sn) sn.textContent = stepDone[i] ? '✓' : (i + 1);
  });
}

/* -------------------------------
   OPTION/SWATCH HANDLERS
------------------------------- */
window.setWallColor = function(c, el) {
  el = el || this;
  P.wallColor = c;
  el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(function(s) { s.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  buildCastle();
};
window.setStoneColor = function(c, el) {
  el = el || this;
  P.stoneColor = c;
  el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(function(s) { s.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  buildCastle();
};
window.setBannerColor = function(c, el) {
  el = el || this;
  P.bannerColor = c;
  el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(function(s) { s.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  buildCastle();
};
window.setGateStyle = function(v, el) {
  el = el || this;
  P.gateStyle = v;
  el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(function(b) { b.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  buildCastle();
};

/* -------------------------------
   QUICK BUILD
------------------------------- */
function quickBuild() {
  P.castleName = 'Stormreach';
  P.wallHeight = 6; P.wallThickness = 1.0;
  P.wallColor = '#6b5a40'; P.stoneColor = '#8b7355';
  P.towerCount = 6; P.towerHeight = 10; P.towerRadius = 1.2;
  P.towerStyle = 'round';
  P.gateStyle = 'portcullis'; P.gateWidth = 2.5;
  P.battlementSize = 0.5;
  P.keepHeight = 12; P.keepWidth = 4.5;
  P.moat = true; P.moatWidth = 3;
  P.drawbridge = true;
  P.bannerColor = '#8b1a1a';
  P.flagCount = 6;
  P.windowCount = 12;
  P.torchCount = 12;
  P.courtyard = true;
  torchesLit = false;
  buildCastle();
  sout('⚡ Quick build: Stormreach loaded! Press Light Torches at Step 16!');
  document.getElementById('liveStatus').textContent = 'Quick build active!';
  toast('Quick build: Stormreach loaded!');
}

/* -------------------------------
   RANDOM CASTLE
------------------------------- */
function randomCastle() {
  var rnd = function(mn, mx) { return mn + Math.random() * (mx - mn); };
  var names = ['Ironhold','Stormreach','Dunmore','Ashford','Ravencrest','Wolfhall','Thornkeep','Blackwall','Greystone','Redmoat','Cloudspire','Hawksworth','Nightguard','Kingsport'];
  var styles = ['round','square'];
  var gates = ['arch','double','portcullis'];
  var cols = ['#6b5a40','#8b7355','#a09080','#4a4a50','#3a3020','#7a6a50','#9a8a70','#c0b090'];
  var banners = ['#8b1a1a','#1a3a6b','#2a5a2a','#6b4a1a','#4a1a5a','#1a5a5a','#c9a84c'];

  P.castleName = names[Math.floor(Math.random() * names.length)];
  P.wallHeight = Math.round(rnd(4, 7) * 2) / 2;
  P.wallThickness = Math.round(rnd(0.5, 1.3) * 10) / 10;
  P.wallColor = cols[Math.floor(Math.random() * cols.length)];
  P.stoneColor = cols[Math.floor(Math.random() * cols.length)];
  P.towerCount = Math.round(rnd(3, 7));
  P.towerHeight = Math.round(rnd(6, 12) * 2) / 2;
  P.towerStyle = styles[Math.floor(Math.random() * styles.length)];
  P.gateStyle = gates[Math.floor(Math.random() * gates.length)];
  P.gateWidth = Math.round(rnd(1.2, 3) * 10) / 10;
  P.battlementSize = Math.round(rnd(0.25, 0.6) * 20) / 20;
  P.keepHeight = Math.round(rnd(7, 14) * 2) / 2;
  P.keepWidth = Math.round(rnd(2.5, 5) * 10) / 10;
  P.moat = Math.random() > 0.3;
  P.moatWidth = Math.round(rnd(2, 5) * 10) / 10;
  P.drawbridge = P.moat && Math.random() > 0.3;
  P.bannerColor = banners[Math.floor(Math.random() * banners.length)];
  P.flagCount = Math.round(rnd(2, 7));
  P.windowCount = Math.round(rnd(4, 14));
  P.torchCount = Math.round(rnd(4, 14));
  P.courtyard = Math.random() > 0.3;
  torchesLit = false;
  buildCastle();
  sout('🎲 Random castle: ' + P.castleName + ' generated!');
  document.getElementById('liveStatus').textContent = 'Random castle!';
  toast('Random: ' + P.castleName);
}

/* -------------------------------
   TOAST
------------------------------- */
function toast(m) {
  var t = document.getElementById('castleToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'castleToast';
    t.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:rgba(15,13,10,.92);border:1px solid rgba(201,168,76,.35);padding:8px 22px;font-family:Bebas Neue,sans-serif;font-size:.9rem;letter-spacing:.06em;color:var(--acc-lt);border-radius:8px;pointer-events:none;opacity:0;transition:opacity .3s;z-index:200;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.style.opacity = '1';
  clearTimeout(t._h);
  t._h = setTimeout(function() { t.style.opacity = '0'; }, 1800);
}

/* -------------------------------
   KEYBOARD NAV
------------------------------- */
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); if (currentStep < STEPS.length - 1) go(currentStep + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (currentStep > 0) go(currentStep - 1); }
});

/* -------------------------------
   INIT
------------------------------- */
function init() {
  var listEl = document.getElementById('stepList');
  STEPS.forEach(function(s, i) {
    var item = document.createElement('div');
    item.className = 'si' + (i === 0 ? ' active' : '');
    item.innerHTML = '<div class="sn">' + (i + 1) + '</div><div class="sl">' + s.title + '</div>';
    item.onclick = function() { go(i); };
    listEl.appendChild(item);
  });

  document.getElementById('navPrev').disabled = true;
  document.getElementById('navNext').disabled = false;

  buildCastle();
  renderStep();
  updateStats();
  updateSpecCard();
  syncRightBar();
}

init();

/* -------------------------------
   TEMPLATES + EXPORT
   Both are shared modules. This block only says where the model lives, so
   the dialog always reads the model that is actually on screen.
------------------------------- */
const CASTLE_TEMPLATES = [
  { id: 'stormreach', emoji: '🏰', name: 'Stormreach', note: 'Tall, moated and ready for a siege  -  the quick-build classic.',
    data: { castleName: 'Stormreach', wallHeight: 6, wallThickness: 1.0, wallColor: '#6b5a40', stoneColor: '#8b7355', towerCount: 6, towerHeight: 10, towerRadius: 1.2, towerStyle: 'round', gateStyle: 'portcullis', gateWidth: 2.5, battlementSize: 0.5, keepHeight: 12, keepWidth: 4.5, moat: true, moatWidth: 3, drawbridge: true, bannerColor: '#8b1a1a', flagCount: 6, windowCount: 12, torchCount: 12, courtyard: true } },
  { id: 'ironhold', emoji: '🛡️', name: 'Ironhold', note: 'Square towers, arch gate, no frills  -  easy to remix.',
    data: { castleName: 'Ironhold', wallHeight: 5, wallThickness: 0.8, wallColor: '#6b5a40', stoneColor: '#8b7355', towerCount: 4, towerHeight: 8, towerRadius: 1.2, towerStyle: 'square', gateStyle: 'arch', gateWidth: 2, battlementSize: 0.4, keepHeight: 10, keepWidth: 4, moat: true, moatWidth: 3, drawbridge: true, bannerColor: '#8b1a1a', flagCount: 4, windowCount: 8, torchCount: 8, courtyard: true } },
  { id: 'frostspire', emoji: '❄️', name: 'Frostspire', note: 'Pale stone, blue banners and tall round towers.',
    data: { castleName: 'Frostspire', wallHeight: 5.5, wallThickness: 0.9, wallColor: '#a09080', stoneColor: '#c0b090', towerCount: 4, towerHeight: 9, towerRadius: 1.3, towerStyle: 'round', gateStyle: 'arch', gateWidth: 2.2, battlementSize: 0.45, keepHeight: 11, keepWidth: 4.2, moat: true, moatWidth: 2.5, drawbridge: false, bannerColor: '#1a3a6b', flagCount: 4, windowCount: 10, torchCount: 6, courtyard: true } },
  { id: 'emberhold', emoji: '🔥', name: 'Emberhold', note: 'Warm red stone and double doors  -  great for banner practice.',
    data: { castleName: 'Emberhold', wallHeight: 4.5, wallThickness: 0.7, wallColor: '#7a6a50', stoneColor: '#9a8a70', towerCount: 4, towerHeight: 7, towerRadius: 1.1, towerStyle: 'square', gateStyle: 'double', gateWidth: 2.4, battlementSize: 0.4, keepHeight: 9, keepWidth: 3.8, moat: false, moatWidth: 3, drawbridge: false, bannerColor: '#c9a84c', flagCount: 5, windowCount: 8, torchCount: 10, courtyard: true } },
  { id: 'ravenkeep', emoji: '🦅', name: 'Ravenkeep', note: 'Dark slate walls, high keep and a dry moat.',
    data: { castleName: 'Ravenkeep', wallHeight: 6, wallThickness: 1.0, wallColor: '#4a4a50', stoneColor: '#3a3020', towerCount: 6, towerHeight: 11, towerRadius: 1.2, towerStyle: 'square', gateStyle: 'portcullis', gateWidth: 2, battlementSize: 0.5, keepHeight: 13, keepWidth: 4.8, moat: false, moatWidth: 3, drawbridge: false, bannerColor: '#4a1a5a', flagCount: 6, windowCount: 6, torchCount: 12, courtyard: false } },
  { id: 'sunspire', emoji: '☀️', name: 'Sunspire', note: 'Sandy stone, green banners and a cosy courtyard.',
    data: { castleName: 'Sunspire', wallHeight: 4, wallThickness: 0.6, wallColor: '#c0b090', stoneColor: '#a09080', towerCount: 4, towerHeight: 6, towerRadius: 1.0, towerStyle: 'round', gateStyle: 'arch', gateWidth: 2.2, battlementSize: 0.35, keepHeight: 8, keepWidth: 3.5, moat: true, moatWidth: 2, drawbridge: true, bannerColor: '#2a5a2a', flagCount: 3, windowCount: 12, torchCount: 4, courtyard: true } }
];

function loadCastleTemplate(t) {
  Object.assign(P, t.data);
  torchesLit = false;
  buildCastle(); updateStats(); updateSpecCard(); syncRightBar();
  sout('Template loaded: ' + t.data.castleName + '. Change anything, then export.');
  toast('Template: ' + t.data.castleName);
  if (window.builderTrack) builderTrack('quick_build');
}

if (window.BuilderTemplates) {
  BuilderTemplates.install({
    mount: '.hdr-right',
    templates: CASTLE_TEMPLATES.map(function (t) { return { id: t.id, emoji: t.emoji, name: t.name, note: t.note, apply: function () { loadCastleTemplate(t); } }; }),
    random: randomCastle,
    onApply: function () { if (typeof go === 'function') go(0); else if (typeof renderStep === 'function') renderStep(); }
  });
}
// STATE HOOKS (share / reload)
window._builderGetState = function () { return { params: JSON.parse(JSON.stringify(P)), step: currentStep }; };
window._builderSetState = function (s) {
  if (s && s.params) Object.assign(P, s.params);
  if (s && typeof s.step === 'number') currentStep = s.step;
  buildCastle(); renderStep(); updateProgress(); syncRightBar(); updateStats();
  if (window.builderScheduleAutoSave) window.builderScheduleAutoSave();
};
if (window.JVExporter) {
  JVExporter.installUI({
    tool: 'Castle Builder',
    units: 'm',
    accent: '#c9a84c',
    getGroup: function () { return castleGroup; },
    getName: function () { return P.castleName || 'castle'; },
    say: sout,

    track: function () { if (window.builderTrack) window.builderTrack.apply(null, arguments); }
  });
}
function goPrev(){go(currentStep-1)}
function goNext(){go(currentStep+1)}

  try { window.randomCastle = randomCastle; } catch (e) { /* not a local handler */ }
  try { window.quickBuild = quickBuild; } catch (e) { /* not a local handler */ }
  try { window.goPrev = goPrev; } catch (e) { /* not a local handler */ }
  try { window.goNext = goNext; } catch (e) { /* not a local handler */ }
  try { window.toggleTorches = toggleTorches; } catch (e) { /* not a local handler */ }
  try { window.lightTorches = lightTorches; } catch (e) { /* not a local handler */ }
  try { window.applyStep = applyStep; } catch (e) { /* not a local handler */ }
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
    try { delete window.randomCastle; } catch (e) {}
    try { delete window.quickBuild; } catch (e) {}
    try { delete window.goPrev; } catch (e) {}
    try { delete window.goNext; } catch (e) {}
    try { delete window.toggleTorches; } catch (e) {}
    try { delete window.lightTorches; } catch (e) {}
    try { delete window.applyStep; } catch (e) {}
    try { delete window.P; } catch (e) {}
    stage.remove();
    sheet.remove();
  };
}
