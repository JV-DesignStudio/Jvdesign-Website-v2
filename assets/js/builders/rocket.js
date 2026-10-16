/* assets/js/builders/rocket.js (A1618)
 * Rocket preset module for the 3D Builder shell (workshops/3d-builder.html).
 * Extracted from workshops/rocket-builder.html: mount(container) injects the
 * builder markup + CSS, runs the original builder core in a guarded scope
 * (window/document listeners and animation frames are tracked so unmount() can
 * tear it down), and exposes only the data-on action handlers the shared
 * delegation needs. No other builder internals leak (module scope).
 */
export const ID = 'rocket';
export const LABEL = 'Rocket';
export const STYLES = ['../style-workshop-rocket-builder.css?v=17'];
const HTML = "<div id=\"app\">\n\n  <!-- HEADER -->\n  <header class=\"hdr\">\n    <h1 class=\"logo\">🚀 Rocket Builder</h1>\n<div class=\"callout tip\" style=\"border-left:3px solid #22c55e;background:rgba(34,197,94,.07);\"><div class=\"callout-icon\">📦</div><div><strong>Workshop reference pack:</strong> download an offline copy of every step in this workshop: <a href=\"/downloads/rocket-builder-reference.zip\" download style=\"color:#16a34a;font-weight:800;text-decoration:underline;\">⬇ rocket-builder-reference.zip</a>. Every code block also has a <strong>Copy</strong> button.</div></div>\n\n    <div class=\"hdr-right\">\n      <a href=\"../pages/workshop.html\" class=\"back-link\">← Workshop</a><a href=\"../pages/3d-builders.html\" class=\"back-link\" style=\"margin-left:8px\">🏗️ All Builders</a>\n      <button class=\"quick-btn\" data-on=\"randomRocket\" data-on-plain style=\"background:linear-gradient(135deg,#7c3aed,#4c1d95);box-shadow:0 3px 0 #3b0764\">🎲 Random</button>\n      <button class=\"quick-btn\" data-on=\"openSaveModal\" data-on-plain style=\"background:linear-gradient(135deg,#b45309,#78350f);box-shadow:0 3px 0 #451a03\">💾 Save</button>\n      <button class=\"quick-btn\" data-on=\"openLoadModal\" data-on-plain style=\"background:linear-gradient(135deg,#92400e,#713f12);box-shadow:0 3px 0 #422006\">📂 Load</button>\n      <button class=\"quick-btn\" data-on=\"quickBuild\" data-on-plain>⚡ Quick Build</button>\n    </div>\n  </header>\n  <!-- ── Ember Tip Bar ── -->\n  <div class=\"ember-builder-bar\" id=\"emberBar\" style=\"--ca-rgb:232,84,58\">\n    <svg viewBox=\"0 0 80 90\" width=\"26\" height=\"29\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\">\n      <path d=\"M20 52 Q10 80 15 88 H65 Q70 80 60 52 Q50 60 40 60 Q30 60 20 52Z\" fill=\"#12102a\"/>\n      <ellipse cx=\"40\" cy=\"36\" rx=\"16\" ry=\"17\" fill=\"#8B5CF6\"/>\n      <polygon points=\"24,22 19,8 30,18\" fill=\"#7C3AED\"/>\n      <polygon points=\"56,22 61,8 50,18\" fill=\"#7C3AED\"/>\n      <ellipse cx=\"40\" cy=\"40\" rx=\"10\" ry=\"8\" fill=\"#DDD6FE\"/>\n      <ellipse cx=\"35\" cy=\"34\" rx=\"3.5\" ry=\"4\" fill=\"#1e1a40\"/>\n      <ellipse cx=\"45\" cy=\"34\" rx=\"3.5\" ry=\"4\" fill=\"#1e1a40\"/>\n      <circle cx=\"36\" cy=\"33\" r=\"1.2\" fill=\"#fff\"/>\n      <circle cx=\"46\" cy=\"33\" r=\"1.2\" fill=\"#fff\"/>\n      <ellipse cx=\"40\" cy=\"39\" rx=\"2\" ry=\"1.4\" fill=\"#7C3AED\"/>\n    </svg>\n    <span><strong style=\"color:#e8543a\">Ember says:</strong> Try the <strong>nosecone</strong> first , it sets the whole silhouette. Hit <strong>⚡ Quick Build</strong> for instant inspiration, then customise from there!</span>\n    <button class=\"ember-bar-dismiss\" aria-label=\"Dismiss tip\" data-session-set=\"ember-bar-rocket-builder:1\" data-remove-id=\"emberBar\">✕</button>\n  </div>\n  \n  <!-- ── /Ember Tip Bar ── -->\n\n  <!-- SIDEBAR -->\n  <div id=\"sidebar\">\n    <div class=\"prog-section\">\n      <div class=\"prog-lbl\">Build Progress</div>\n      <div class=\"prog-track\"><div class=\"prog-fill\" id=\"progFill\" style=\"width:3%\"></div></div>\n      <div class=\"prog-ct\" id=\"progCt\">0 / 17 steps</div>\n    </div>\n    <div class=\"slist\" id=\"stepList\"></div>\n    <div class=\"cpan\" id=\"stepBody\"></div>\n    <div class=\"snav\">\n      <button class=\"btn-p\" id=\"navPrev\" data-on=\"goPrev\" data-on-plain disabled aria-label=\"Previous step\">← Back</button>\n      <button class=\"btn-n\" id=\"navNext\" data-on=\"goNext\" data-on-plain aria-label=\"Next step\">Next →</button>\n    </div>\n  </div>\n\n  <!-- VIEWPORT -->\n  <div id=\"viewport\">\n    <div class=\"scene-top\">\n      <span class=\"scene-top-l\">🎥 Live 3D Preview</span>\n      <div class=\"scene-top-r\">\n        <div class=\"live-wrap\"><span class=\"live-dot\"></span><span id=\"liveStatus\" aria-live=\"polite\">Apply Step 1 to begin</span></div>\n      </div>\n    </div>\n    <div class=\"scene-wrap\">\n      <canvas id=\"rocketCanvas\" role=\"application\" aria-label=\"3D rocket preview viewport\"></canvas>\n      <div class=\"rocket-stats\" id=\"rocketStats\"></div>\n      <div class=\"vhint\" id=\"sceneHint\">Drag to orbit · Scroll to zoom</div>\n      <div class=\"dims\" id=\"dimsOverlay\">\n        <div style=\"font-family:'Bebas Neue',sans-serif;font-size:.95rem;letter-spacing:.06em;color:#fff;margin-bottom:2px\" id=\"sName\">UNNAMED</div>\n        <div>Nose&nbsp;&nbsp;&nbsp;<span id=\"sNose\">, </span></div>\n        <div>Height&nbsp;<span id=\"sHeight\">, </span></div>\n        <div>Boost&nbsp;&nbsp;<span id=\"sBoosters\">, </span></div>\n        <div>Fins&nbsp;&nbsp;&nbsp;<span id=\"sFins\">, </span></div>\n        <div>Engines <span id=\"sEngines\">, </span></div>\n      </div>\n    </div>\n    <div class=\"obar\" id=\"obar\" aria-live=\"polite\">🚀 Choose a nosecone to start building</div>\n  </div>\n\n  <!-- RIGHT BAR, live quick controls -->\n  <div id=\"rightbar\" aria-label=\"Quick controls\">\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🎨 Colors</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-prim\">Primary</label>\n        <input type=\"color\" id=\"rb-prim\" value=\"#e8543a\" data-bind=\"R.primaryCol\" data-bind-type=\"value\" data-then=\"buildRocket\">\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-sec\">Secondary</label>\n        <input type=\"color\" id=\"rb-sec\" value=\"#ffffff\" data-bind=\"R.secondaryCol\" data-bind-type=\"value\" data-then=\"buildRocket\">\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-stripe-col\">Stripe</label>\n        <input type=\"color\" id=\"rb-stripe-col\" value=\"#ffffff\" data-bind=\"R.stripeCol\" data-bind-type=\"value\" data-then=\"buildRocket\">\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-glow\">Exhaust</label>\n        <input type=\"color\" id=\"rb-glow\" value=\"#ff6600\" data-bind=\"R.glowCol\" data-bind-type=\"value\">\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">📐 Shape</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-h\">Height</label>\n        <input type=\"range\" min=\"2.2\" max=\"5.5\" step=\"0.1\" value=\"3\" id=\"rb-h\"\n          data-bind=\"R.bodyHeight\" data-bind-type=\"float\" data-bind-display=\"rb-hv\" data-bind-fmt=\"0.0m\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-hv\">3.0m</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-r\">Radius</label>\n        <input type=\"range\" min=\"0.26\" max=\"0.46\" step=\"0.02\" value=\"0.35\" id=\"rb-r\"\n          data-bind=\"R.bodyRadius\" data-bind-type=\"float\" data-bind-display=\"rb-rv\" data-bind-fmt=\"0.00\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-rv\">0.35</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">❌ Nose &amp; Fairing</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-nose\">Nose</label>\n        <select id=\"rb-nose\" data-bind=\"R.nosecone\" data-bind-type=\"value\" data-then=\"buildRocket\">\n          <option value=\"cone\">Cone</option>\n          <option value=\"ogive\">Ogive</option>\n          <option value=\"blunt\">Blunt</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-nosescale\">Nose Len</label>\n        <input type=\"range\" min=\"4\" max=\"20\" step=\"1\" value=\"10\" id=\"rb-nosescale\"\n          data-bind=\"R.noseconeScale\" data-bind-type=\"nval\" data-bind-scale=\"0.1\" data-bind-display=\"rb-nsv\" data-bind-fmt=\"0.0×\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-nsv\">1.0×</span>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-fair\">Fairing</label>\n        <select id=\"rb-fair\" data-bind=\"R.fairing\" data-bind-type=\"value\" data-then=\"buildRocket\">\n          <option value=\"none\">None</option>\n          <option value=\"standard\">Standard</option>\n          <option value=\"xl\">XL</option>\n        </select>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🔧 Details</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-win\">Windows</label>\n        <select id=\"rb-win\" data-bind=\"R.windowStyle\" data-bind-type=\"value\" data-then=\"buildRocket\">\n          <option value=\"none\">None</option>\n          <option value=\"porthole\">Portholes</option>\n          <option value=\"row\">Row</option>\n          <option value=\"rect\">Rect</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-wincount\">Win #</label>\n        <input type=\"range\" min=\"1\" max=\"8\" step=\"1\" value=\"2\" id=\"rb-wincount\"\n          data-bind=\"R.windowCount\" data-bind-type=\"int\" data-bind-display=\"rb-wcv\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-wcv\">2</span>\n      </div>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-stripe-on\" data-bind=\"R.stripeOn\" data-bind-type=\"checked\" data-then=\"buildRocket\">\n        Stripe band\n      </label>\n      <div class=\"rb-row\">\n        <label for=\"rb-stripepos\">Stripe Y</label>\n        <input type=\"range\" min=\"10\" max=\"85\" step=\"5\" value=\"35\" id=\"rb-stripepos\"\n          data-bind=\"R.stripePos\" data-bind-type=\"nval\" data-bind-scale=\"0.01\" data-bind-display=\"rb-spv\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-spv\">35%</span>\n      </div>\n      <label class=\"rb-toggle\">\n        <input type=\"checkbox\" id=\"rb-legs\" data-bind=\"R.landingLegs\" data-bind-type=\"checked\" data-then=\"buildRocket\">\n        Landing legs\n      </label>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🔷 Fins</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-finstyle\">Style</label>\n        <select id=\"rb-finstyle\" data-bind=\"R.finStyle\" data-bind-type=\"value\" data-then=\"buildRocket\">\n          <option value=\"delta\">Delta</option>\n          <option value=\"swept\">Swept</option>\n          <option value=\"grid\">Grid</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-fincount\">Count</label>\n        <select id=\"rb-fincount\" data-bind=\"R.finCount\" data-bind-type=\"int\" data-then=\"buildRocket\">\n          <option value=\"3\">3 Fins</option>\n          <option value=\"4\">4 Fins</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-finscale\">Fin Size</label>\n        <input type=\"range\" min=\"3\" max=\"20\" step=\"1\" value=\"10\" id=\"rb-finscale\"\n          data-bind=\"R.finScale\" data-bind-type=\"nval\" data-bind-scale=\"0.1\" data-bind-display=\"rb-fsv\" data-bind-fmt=\"0.0×\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-fsv\">1.0×</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🔥 Propulsion</div>\n      <div class=\"rb-row\">\n        <label for=\"rb-eng\">Engines</label>\n        <select id=\"rb-eng\" data-bind=\"R.engineCount\" data-bind-type=\"int\" data-then=\"buildRocket\">\n          <option value=\"1\">1, Single</option>\n          <option value=\"3\">3, Triple</option>\n          <option value=\"5\">5, Cluster</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-boost\">Boosters</label>\n        <select id=\"rb-boost\" data-bind=\"R.boosters\" data-bind-type=\"int\" data-then=\"buildRocket\">\n          <option value=\"0\">None</option>\n          <option value=\"2\">2 Boosters</option>\n          <option value=\"4\">4 Boosters</option>\n        </select>\n      </div>\n      <div class=\"rb-row\">\n        <label for=\"rb-bs\">Boost #</label>\n        <input type=\"range\" min=\"4\" max=\"10\" step=\"1\" value=\"6\" id=\"rb-bs\"\n          data-bind=\"R.boosterSize\" data-bind-type=\"nval\" data-bind-scale=\"0.1\" data-bind-display=\"rb-bsv\" data-bind-fmt=\"0.0×\" data-then=\"buildRocket\">\n        <span class=\"rv\" id=\"rb-bsv\">0.6×</span>\n      </div>\n    </div>\n\n    <div class=\"rb-section\">\n      <div class=\"rb-title\">🏁 Livery Presets</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:4px\">\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"nasa\" data-on-plain>🇺🇸 NASA</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"spacex\" data-on-plain>🚀 SpaceX</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"soviet\" data-on-plain>☭ Soviet</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"saturn\" data-on-plain>🌙 Saturn V</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"ariane\" data-on-plain>🇪🇺 Ariane</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"fire\" data-on-plain>🔥 Firestorm</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"stealth\" data-on-plain>🖤 Stealth</button>\n        <button class=\"preset-btn\" data-on=\"applyPreset\" data-on-arg=\"aurora\" data-on-plain>🌌 Aurora</button>\n      </div>\n    </div>\n\n    <div class=\"rb-section\" style=\"margin-top:6px\">\n      <div class=\"rb-title\">📦 Presets</div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:4px\">\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Saturn V\" data-on-plain>Saturn V</button>\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Falcon\" data-on-plain>Falcon</button>\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Delta\" data-on-plain>Delta</button>\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Ares\" data-on-plain>Ares</button>\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Voyager\" data-on-plain>Voyager</button>\n        <button class=\"preset-btn\" data-on=\"applyRocketPreset\" data-on-arg=\"Phoenix\" data-on-plain>Phoenix</button>\n      </div>\n    </div>\n\n    <div style=\"padding:4px 2px\">\n      <button class=\"run-btn\" style=\"font-size:.78rem;padding:9px;margin-top:0\" data-on=\"launch\" data-on-plain>🚀 LAUNCH</button>\n    </div>\n\n  </div>\n\n</div>\n<div id=\"modalOverlay\" style=\"display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;align-items:center;justify-content:center;backdrop-filter:blur(4px)\"><div id=\"modalContent\" style=\"background:linear-gradient(145deg,#0c0e18,#07090f);border:1px solid rgba(232,84,58,.3);border-radius:12px;padding:22px;width:380px;max-width:90vw\"></div></div>";
const CSS = "/* ── Ember builder tip strip ─────────────── */\n.hdr-step-chip {\n  display: inline-flex;\n  align-items: center;\n  font-family: 'Nunito', sans-serif;\n  font-size: .72rem;\n  font-weight: 800;\n  letter-spacing: .05em;\n  padding: 3px 10px;\n  border-radius: 999px;\n  background: rgba(var(--ca-rgb, 255,255,255), .12);\n  border: 1px solid rgba(var(--ca-rgb, 255,255,255), .25);\n  color: rgba(255,255,255,.85);\n  margin-left: 10px;\n  vertical-align: middle;\n  flex-shrink: 0;\n}\n.ember-builder-bar {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 8px 16px;\n  background: rgba(var(--ca-rgb,139,92,246), .07);\n  border-bottom: 1px solid rgba(var(--ca-rgb,139,92,246), .18);\n  position: relative;\n  font-size: .8rem;\n  line-height: 1.45;\n  color: rgba(255,255,255,.65);\n}\n.ember-builder-bar strong { color: rgba(255,255,255,.9); }\n.ember-builder-bar svg { flex-shrink: 0; margin-top: 1px; }\n.ember-bar-dismiss {\n  position: absolute;\n  right: 10px;\n  top: 50%;\n  transform: translateY(-50%);\n  background: none;\n  border: none;\n  color: rgba(255,255,255,.3);\n  cursor: pointer;\n  font-size: 1rem;\n  line-height: 1;\n  padding: 2px 6px;\n  border-radius: 4px;\n  transition: color .2s;\n}\n.ember-bar-dismiss:hover { color: rgba(255,255,255,.7); }";
const ACTIONS = ["randomRocket","openSaveModal","openLoadModal","quickBuild","goPrev","goNext","applyPreset","applyRocketPreset","launch"];

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
const canvas = document.getElementById('rocketCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.useLegacyLights = true; // r160: keep the original r128 lighting look
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x07090f);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07090f, 20, 60);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 3, 12);

// Lights
const ambient = new THREE.AmbientLight(0x334466, 0.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff5ee, 1.4);
sun.position.set(5, 10, 6);
sun.castShadow = true;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x4466aa, 0.4);
fill.position.set(-6, 2, -4);
scene.add(fill);
const engineGlow = new THREE.PointLight(0xff5500, 0, 3);
scene.add(engineGlow);

// Stars background
(function(){
  const geo = new THREE.BufferGeometry();
  const verts = [];
  for (let i = 0; i < 1500; i++) {
    verts.push((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 });
  scene.add(new THREE.Points(geo, mat));
})();

// Ground pad
const padGeo = new THREE.CylinderGeometry(2, 2, 0.15, 32);
const padMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.9 });
const pad = new THREE.Mesh(padGeo, padMat);
pad.position.y = -0.075;
pad.receiveShadow = true;
scene.add(pad);

/* -------------------------------
   ROCKET STATE
------------------------------- */
const R = {
  name: 'UNNAMED',
  nosecone: 'cone',
  bodyHeight: 3,
  bodyRadius: 0.35,
  primaryCol: '#e8543a',
  secondaryCol: '#ffffff',
  finStyle: 'delta',
  finCount: 4,
  boosters: 0,
  boosterSize: 0.6,
  engineCount: 1,
  fairing: 'none',
  stripeOn: false,
  stripeCol: '#ffffff',
  glowCol: '#ff6600',
  windowStyle: 'none',
  landingLegs: false,
  launched: false,
  launchY: 0,
  // extended customisation
  finScale: 1.0,
  stripePos: 0.35,
  noseconeScale: 1.0,
  windowCount: 2,
};

let rocketGroup = null;
let exhaustParticles = [];

function hexToThree(hex) {
  return new THREE.Color(hex);
}

/* -------------------------------
   OBJ EXPORT
------------------------------- */
function downloadRocket() {
  if (!rocketGroup) { sout('Build your rocket first!'); return; }
  if(window.builderTrack)builderTrack('export',{format:'obj'});
  rocketGroup.updateMatrixWorld(true);

  const name = (R.name && R.name !== 'UNNAMED' ? R.name : 'rocket').replace(/\s+/g, '-').toLowerCase();
  sout('⏳ Preparing OBJ export…');

  let obj = '# ' + R.name + ', JV Rocket Builder\n# jvdesignstudio.co.uk\nmtllib ' + name + '-rocket.mtl\n';
  let mtl = '# Materials for ' + R.name + '\n# jvdesignstudio.co.uk\n';

  const matMap = {};
  let matIdx = 0;
  let vOff = 1; // OBJ is 1-indexed
  let meshIdx = 0;

  rocketGroup.traverse(function(node) {
    if (!node.isMesh) return;

    // --- material ---
    const col = node.material.color ? node.material.color : new THREE.Color(0x888888);
    const hex = col.getHexString();
    if (!matMap[hex]) {
      const mName = 'm' + (matIdx++);
      matMap[hex] = mName;
      mtl += '\nnewmtl ' + mName + '\n';
      mtl += 'Kd ' + col.r.toFixed(4) + ' ' + col.g.toFixed(4) + ' ' + col.b.toFixed(4) + '\n';
      mtl += 'Ka 0.05 0.05 0.05\nKs 0.2 0.2 0.2\nNs 25\n';
      if (node.material.transparent) {
        mtl += 'd ' + (node.material.opacity != null ? node.material.opacity : 1).toFixed(4) + '\n';
      }
    }

    // --- geometry ---
    const g = node.geometry.clone();
    g.applyMatrix4(node.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();

    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const idx = g.index;
    const n = pos.count;

    obj += '\ng mesh' + (meshIdx++) + '\nusemtl ' + matMap[hex] + '\n';

    for (let i = 0; i < n; i++) {
      obj += 'v ' + pos.getX(i).toFixed(5) + ' ' + pos.getY(i).toFixed(5) + ' ' + pos.getZ(i).toFixed(5) + '\n';
    }
    for (let i = 0; i < n; i++) {
      obj += 'vn ' + nor.getX(i).toFixed(5) + ' ' + nor.getY(i).toFixed(5) + ' ' + nor.getZ(i).toFixed(5) + '\n';
    }

    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i) + vOff, b = idx.getX(i+1) + vOff, c = idx.getX(i+2) + vOff;
        obj += 'f ' + a + '//' + a + ' ' + b + '//' + b + ' ' + c + '//' + c + '\n';
      }
    } else {
      for (let i = 0; i < n; i += 3) {
        const a = i + vOff, b = i+1 + vOff, c = i+2 + vOff;
        obj += 'f ' + a + '//' + a + ' ' + b + '//' + b + ' ' + c + '//' + c + '\n';
      }
    }
    vOff += n;
  });

  // Download .obj
  const objBlob = new Blob([obj], { type: 'text/plain' });
  const objUrl = URL.createObjectURL(objBlob);
  const la = document.createElement('a');
  la.href = objUrl; la.download = name + '-rocket.obj'; la.click();
  URL.revokeObjectURL(objUrl);

  // Download .mtl (slight delay so browser doesn't block second download)
  setTimeout(function() {
    const mtlBlob = new Blob([mtl], { type: 'text/plain' });
    const mtlUrl = URL.createObjectURL(mtlBlob);
    const lb = document.createElement('a');
    lb.href = mtlUrl; lb.download = name + '-rocket.mtl'; lb.click();
    URL.revokeObjectURL(mtlUrl);
  }, 300);

  sout('✅ ' + name + '-rocket.obj + .mtl downloaded! Open in Blender: File → Import → Wavefront (.obj)');
}


/* -------------------------------
   BUILD ROCKET
------------------------------- */
function buildRocket() {
  if (rocketGroup) scene.remove(rocketGroup);
  exhaustParticles = [];
  rocketGroup = new THREE.Group();
  rocketGroup.name = 'rocket';
  const part = (mesh, name) => { mesh.name = name; return mesh; };
  rocketGroup.position.y = R.launchY;

  const pMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.primaryCol), roughness: 0.35, metalness: 0.55 });
  const sMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.secondaryCol), roughness: 0.4, metalness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.6, metalness: 0.3 });
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8 });

  const bh = R.bodyHeight;
  const br = R.bodyRadius;
  const baseY = 0;

  // Body
  const bodyGeo = new THREE.CylinderGeometry(br, br, bh, 24);
  const body = new THREE.Mesh(bodyGeo, pMat);
  body.position.y = baseY + bh / 2;
  body.castShadow = true;
  rocketGroup.add(part(body, 'body'));

  // Stripe band
  if (R.stripeOn) {
    const stripGeo = new THREE.CylinderGeometry(br + 0.005, br + 0.005, 0.22, 24);
    const stripMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.stripeCol), roughness: 0.4, metalness: 0.5 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = baseY + bh * R.stripePos;
    rocketGroup.add(part(strip, 'body_stripe'));
  }

  // Payload fairing
  const noseBase = baseY + bh;
  let noseLift = 0;
  if (R.fairing !== 'none') {
    const fH = R.fairing === 'xl' ? bh * 0.55 : bh * 0.32;
    const fR = br * (R.fairing === 'xl' ? 1.32 : 1.2);
    const fMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.secondaryCol), roughness: 0.45, metalness: 0.4 });
    const transGeo = new THREE.CylinderGeometry(fR, br, fH * 0.2, 20);
    const trans = new THREE.Mesh(transGeo, fMat);
    trans.position.y = noseBase + fH * 0.1;
    trans.castShadow = true;
    rocketGroup.add(part(trans, 'fairing_transition'));
    const barrelGeo = new THREE.CylinderGeometry(fR, fR, fH * 0.8, 20);
    const barrel = new THREE.Mesh(barrelGeo, fMat);
    barrel.position.y = noseBase + fH * 0.2 + fH * 0.4;
    barrel.castShadow = true;
    rocketGroup.add(part(barrel, 'fairing_barrel'));
    const seamGeo = new THREE.TorusGeometry(fR, 0.025, 6, 24);
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.8 });
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.rotation.x = Math.PI / 2;
    seam.position.y = noseBase + fH * 0.2 + fH * 0.8;
    rocketGroup.add(part(seam, 'fairing_seam'));
    noseLift = fH;
  }

  // Nosecone
  const effectiveNoseBase = noseBase + noseLift;
  const nsc = Math.max(0.4, R.noseconeScale); // nosecone length scale
  if (R.nosecone === 'cone') {
    const noseH = bh * 0.55 * nsc;
    const noseGeo = new THREE.ConeGeometry(R.fairing !== 'none' ? br * (R.fairing === 'xl' ? 1.32 : 1.2) : br, noseH, 24);
    const nose = new THREE.Mesh(noseGeo, sMat);
    nose.position.y = effectiveNoseBase + noseH / 2;
    nose.castShadow = true;
    rocketGroup.add(part(nose, 'nosecone'));
  } else if (R.nosecone === 'ogive') {
    const noseR = R.fairing !== 'none' ? br * (R.fairing === 'xl' ? 1.32 : 1.2) : br;
    const noseH = bh * 0.65 * nsc;
    const noseGeo = new THREE.ConeGeometry(noseR, noseH, 24);
    const nose = new THREE.Mesh(noseGeo, sMat);
    nose.position.y = effectiveNoseBase + noseH / 2;
    nose.castShadow = true;
    rocketGroup.add(part(nose, 'nosecone'));
    const tipGeo = new THREE.SphereGeometry(noseR * 0.18, 10, 10);
    const tip = new THREE.Mesh(tipGeo, sMat);
    tip.position.y = effectiveNoseBase + noseH;
    rocketGroup.add(part(tip, 'nosecone_tip'));
    const shGeo = new THREE.CylinderGeometry(noseR * 1.06, noseR, noseH * 0.18, 24);
    const sh = new THREE.Mesh(shGeo, sMat);
    sh.position.y = effectiveNoseBase + noseH * 0.09;
    rocketGroup.add(part(sh, 'nosecone_shoulder'));
  } else { // blunt
    const noseR = R.fairing !== 'none' ? br * (R.fairing === 'xl' ? 1.32 : 1.2) : br;
    const noseH = bh * 0.28 * nsc;
    const noseGeo = new THREE.CylinderGeometry(noseR * 0.55, noseR, noseH, 24);
    const nose = new THREE.Mesh(noseGeo, sMat);
    nose.position.y = effectiveNoseBase + noseH / 2;
    nose.castShadow = true;
    rocketGroup.add(part(nose, 'nosecone'));
    const capGeo = new THREE.SphereGeometry(noseR * 0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, sMat);
    cap.position.y = effectiveNoseBase + noseH;
    rocketGroup.add(part(cap, 'nosecone_cap'));
  }

  // Engine interstage ring
  const ringGeo = new THREE.TorusGeometry(br, 0.04, 8, 24);
  const ring = new THREE.Mesh(ringGeo, darkMat);
  ring.position.y = baseY + 0.3;
  ring.rotation.x = Math.PI / 2;
  rocketGroup.add(part(ring, 'interstage_ring'));

  // Engine bells
  const enginePositions = [];
  if (R.engineCount === 1) {
    enginePositions.push([0, 0]);
  } else if (R.engineCount === 3) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      enginePositions.push([Math.cos(a) * br * 0.45, Math.sin(a) * br * 0.45]);
    }
  } else {
    enginePositions.push([0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      enginePositions.push([Math.cos(a) * br * 0.55, Math.sin(a) * br * 0.55]);
    }
  }

  const bellR = R.engineCount > 1 ? br * 0.28 : br * 0.42;
  enginePositions.forEach(function([ex, ez], ei) {
    const bellGeo = new THREE.CylinderGeometry(bellR * 1.5, bellR * 0.7, 0.35, 16);
    const bell = new THREE.Mesh(bellGeo, exhaustMat);
    bell.position.set(ex, baseY - 0.18, ez);
    rocketGroup.add(part(bell, 'engine_bell_' + ei));
    const throatGeo = new THREE.CylinderGeometry(bellR * 0.7, bellR * 0.7, 0.08, 12);
    const throat = new THREE.Mesh(throatGeo, darkMat);
    throat.position.set(ex, baseY - 0.38, ez);
    rocketGroup.add(part(throat, 'engine_throat_' + ei));
  });

  // Fins
  const finAngles = [];
  for (let i = 0; i < R.finCount; i++) finAngles.push((i / R.finCount) * Math.PI * 2);
  const finMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.secondaryCol), roughness: 0.4, metalness: 0.55, side: THREE.DoubleSide });

  const fs = Math.max(0.3, R.finScale); // fin size multiplier
  finAngles.forEach(function(angle, fi) {
    let finMesh;
    if (R.finStyle === 'delta') {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0, bh * 0.5 * fs); shape.lineTo(br * 2.2 * fs, 0); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      finMesh = new THREE.Mesh(geo, finMat);
      finMesh.position.y = baseY;
    } else if (R.finStyle === 'swept') {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(br * 0.8 * fs, bh * 0.42 * fs); shape.lineTo(br * 2.0 * fs, bh * 0.42 * fs); shape.lineTo(br * 2.0 * fs, 0); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      finMesh = new THREE.Mesh(geo, finMat);
      finMesh.position.y = baseY;
    } else { // grid
      const gGroup = new THREE.Group();
      gGroup.name = 'fin_' + fi;
      const barMat = new THREE.MeshStandardMaterial({ color: hexToThree(R.secondaryCol), roughness: 0.5, metalness: 0.5 });
      const gW = br * 1.8 * fs, gH = bh * 0.38 * fs, gD = 0.06;
      [-gH * 0.33, 0, gH * 0.33].forEach(function(gy, gi) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(gD, gD, gW), barMat);
        g.position.set(gW * 0.5 + br, gy + baseY + gH * 0.5, 0);
        gGroup.add(part(g, 'fin_' + fi + '_bar_' + gi));
      });
      [-gW * 0.33, 0, gW * 0.33].forEach(function(gx, gi) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(gD, gH, gD), barMat);
        g.position.set(gx + gW * 0.5 + br, baseY + gH * 0.5, 0);
        gGroup.add(part(g, 'fin_' + fi + '_bar_' + gi));
      });
      gGroup.rotation.y = angle;
      rocketGroup.add(gGroup);
      return;
    }
    finMesh.castShadow = true;
    const wrapper = new THREE.Group();
    wrapper.name = 'fin_' + fi;
    wrapper.add(part(finMesh, 'fin_' + fi + '_blade'));
    wrapper.rotation.y = angle;
    rocketGroup.add(wrapper);
  });

  // Side boosters
  if (R.boosters > 0) {
    const bsr = R.boosterSize * 0.16;
    const bsh = bh * R.boosterSize * 0.72;
    const bDist = br + bsr * 2.5;
    const boosterAngles = [];
    for (let i = 0; i < R.boosters; i++) boosterAngles.push((i / R.boosters) * Math.PI * 2);

    boosterAngles.forEach(function(a, bi) {
      const bx = Math.cos(a) * bDist, bz = Math.sin(a) * bDist;
      const bBody = new THREE.Mesh(new THREE.CylinderGeometry(bsr, bsr, bsh, 16), pMat.clone());
      bBody.position.set(bx, baseY + bsh / 2, bz); bBody.castShadow = true; rocketGroup.add(part(bBody, 'booster_' + bi + '_body'));
      const bNose = new THREE.Mesh(new THREE.ConeGeometry(bsr, bsh * 0.35, 16), sMat.clone());
      bNose.position.set(bx, baseY + bsh + bsh * 0.175, bz); rocketGroup.add(part(bNose, 'booster_' + bi + '_nose'));
      const bBell = new THREE.Mesh(new THREE.CylinderGeometry(bsr * 1.4, bsr * 0.7, 0.22, 12), exhaustMat.clone());
      bBell.position.set(bx, baseY - 0.11, bz); rocketGroup.add(part(bBell, 'booster_' + bi + '_bell'));
      const strutLen = bDist - br - bsr;
      const strutGeo = new THREE.CylinderGeometry(0.025, 0.025, strutLen, 6);
      const strut = new THREE.Mesh(strutGeo, darkMat);
      const strutY = baseY + bsh * 0.6;
      const fromPt = new THREE.Vector3(Math.cos(a) * br, strutY, Math.sin(a) * br);
      const toPt   = new THREE.Vector3(bx, strutY, bz);
      const strutDir = toPt.clone().sub(fromPt).normalize();
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strutDir);
      strut.position.copy(fromPt).lerp(toPt, 0.5);
      rocketGroup.add(part(strut, 'booster_' + bi + '_strut_upper'));
      const strut2Geo = new THREE.CylinderGeometry(0.02, 0.02, strutLen, 6);
      const strut2 = new THREE.Mesh(strut2Geo, darkMat);
      const strut2Y = baseY + bsh * 0.2;
      const from2 = new THREE.Vector3(Math.cos(a) * br, strut2Y, Math.sin(a) * br);
      const to2   = new THREE.Vector3(bx, strut2Y, bz);
      const dir2  = to2.clone().sub(from2).normalize();
      strut2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir2);
      strut2.position.copy(from2).lerp(to2, 0.5);
      rocketGroup.add(part(strut2, 'booster_' + bi + '_strut_lower'));
    });
  }

  // Windows / Portholes
  if (R.windowStyle !== 'none') {
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75, emissive: new THREE.Color(0x224466), emissiveIntensity: 0.3 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.5, metalness: 0.7 });
    const winHeights = [bh * 0.55, bh * 0.72];
    const wCount = Math.max(1, Math.min(8, R.windowCount));
    const winAngles = [];
    for (let i = 0; i < wCount; i++) winAngles.push((i / wCount) * Math.PI * 2);
    winHeights.forEach(function(wh, hi) {
      winAngles.forEach(function(wa, wi) {
        const wx = Math.cos(wa) * (br + 0.005);
        const wz = Math.sin(wa) * (br + 0.005);
        if (R.windowStyle === 'porthole' || R.windowStyle === 'row') {
          const rimGeo = new THREE.TorusGeometry(0.075, 0.018, 8, 18);
          const rim = new THREE.Mesh(rimGeo, rimMat);
          rim.position.set(wx, baseY + wh, wz);
          rim.lookAt(wx * 5, baseY + wh, wz * 5);
          rocketGroup.add(part(rim, 'window_' + hi + '_' + wi + '_rim'));
          const glassGeo = new THREE.CircleGeometry(0.06, 16);
          const glass = new THREE.Mesh(glassGeo, glassMat);
          glass.position.set(wx, baseY + wh, wz);
          glass.lookAt(wx * 5, baseY + wh, wz * 5);
          rocketGroup.add(part(glass, 'window_' + hi + '_' + wi + '_glass'));
        } else { // rect
          const frameGeo = new THREE.BoxGeometry(0.06, 0.14, 0.01);
          const frame = new THREE.Mesh(frameGeo, rimMat);
          frame.position.set(wx, baseY + wh, wz);
          frame.lookAt(wx * 5, baseY + wh, wz * 5);
          rocketGroup.add(part(frame, 'window_' + hi + '_' + wi + '_frame'));
          const rectGlassGeo = new THREE.PlaneGeometry(0.044, 0.11);
          const rectGlass = new THREE.Mesh(rectGlassGeo, glassMat);
          rectGlass.position.set(wx, baseY + wh, wz);
          rectGlass.lookAt(wx * 5, baseY + wh, wz * 5);
          rocketGroup.add(part(rectGlass, 'window_' + hi + '_' + wi + '_rectGlass'));
        }
      });
    });
  }

  // Landing Legs (Falcon 9 style)
  if (R.landingLegs) {
    const legCount = 4;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5, metalness: 0.6 });
    for (let i = 0; i < legCount; i++) {
      const la = (i / legCount) * Math.PI * 2;
      const lx = Math.cos(la), lz = Math.sin(la);
      const strutTopX = lx * br * 0.95, strutTopZ = lz * br * 0.95;
      const strutBotX = lx * (br + bh * 0.38), strutBotZ = lz * (br + bh * 0.38);
      const strutLen = Math.hypot(strutBotX - strutTopX, bh * 0.35, strutBotZ - strutTopZ);
      const mainGeo = new THREE.CylinderGeometry(0.022, 0.018, strutLen, 6);
      const main = new THREE.Mesh(mainGeo, legMat);
      const mid = new THREE.Vector3((strutTopX + strutBotX) / 2, baseY - bh * 0.175, (strutTopZ + strutBotZ) / 2);
      main.position.copy(mid);
      const top = new THREE.Vector3(strutTopX, baseY, strutTopZ);
      const bot = new THREE.Vector3(strutBotX, baseY - bh * 0.35, strutBotZ);
      main.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bot.clone().sub(top).normalize());
      rocketGroup.add(part(main, 'leg_' + i + '_strut'));
      const footGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10);
      const foot = new THREE.Mesh(footGeo, legMat);
      foot.position.set(strutBotX, baseY - bh * 0.35, strutBotZ);
      rocketGroup.add(part(foot, 'leg_' + i + '_foot'));
      const braceLen = bh * 0.22;
      const braceGeo = new THREE.CylinderGeometry(0.014, 0.014, braceLen, 6);
      const brace = new THREE.Mesh(braceGeo, legMat);
      brace.position.set(lx * (br + 0.05), baseY - bh * 0.08, lz * (br + 0.05));
      const braceDir = new THREE.Vector3(lx, -0.55, lz).normalize();
      brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), braceDir);
      rocketGroup.add(part(brace, 'leg_' + i + '_brace'));
    }
  }

  // Exhaust flame
  if (R.launched) {
    const glowColor = new THREE.Color(R.glowCol);
    engineGlow.color = glowColor;
    engineGlow.intensity = 2.5;
    engineGlow.position.y = baseY - 0.6 + R.launchY;
    enginePositions.forEach(function([ex, ez], ei) {
      for (let i = 0; i < 3; i++) {
        const fh = 0.3 + Math.random() * 0.5;
        const fGeo = new THREE.ConeGeometry(bellR * (0.6 + Math.random() * 0.6), fh, 8);
        const fMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.6 + Math.random() * 0.3 });
        const flame = new THREE.Mesh(fGeo, fMat);
        flame.position.set(ex, baseY - 0.45 - fh / 2, ez);
        flame.rotation.x = Math.PI;
        rocketGroup.add(part(flame, 'exhaust_flame_' + ei + '_' + i));
        exhaustParticles.push({ mesh: flame, baseY: baseY - 0.45 - fh / 2, phase: Math.random() * Math.PI * 2 });
      }
    });
  } else {
    engineGlow.intensity = 0;
  }

  scene.add(rocketGroup);
  updateSpecCard();
  updateStats();
  syncRightBar();
}

/* -------------------------------
   ORBIT CONTROLS
------------------------------- */
let orbit = { theta: 0.3, phi: 1.1, radius: 12, dragging: false, lastX: 0, lastY: 0 };

function updateCamera() {
  orbit.phi = Math.max(0.2, Math.min(Math.PI - 0.2, orbit.phi));
  orbit.radius = Math.max(4, Math.min(24, orbit.radius));
  camera.position.x = orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
  camera.position.y = orbit.radius * Math.cos(orbit.phi) + R.bodyHeight / 2 + 1;
  camera.position.z = orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
  camera.lookAt(0, R.bodyHeight / 2, 0);
}

canvas.addEventListener('mousedown', function(e) { orbit.dragging = true; orbit.lastX = e.clientX; orbit.lastY = e.clientY; });
window.addEventListener('mouseup', function() { orbit.dragging = false; });
window.addEventListener('mousemove', function(e) {
  if (!orbit.dragging) return;
  orbit.theta -= (e.clientX - orbit.lastX) * 0.007;
  orbit.phi   -= (e.clientY - orbit.lastY) * 0.007;
  orbit.lastX = e.clientX; orbit.lastY = e.clientY;
});
canvas.addEventListener('wheel', function(e) { orbit.radius += e.deltaY * 0.012; e.preventDefault(); }, { passive: false });

BuilderGestures.attachTapSelect(canvas, camera, function () { return rocketGroup; }, {
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

let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  frame++;
  if (!orbit.dragging) orbit.theta += 0.003;
  updateCamera();

  exhaustParticles.forEach(function(p) {
    p.mesh.position.y = p.baseY + R.launchY - Math.abs(Math.sin(frame * 0.12 + p.phase)) * 0.15;
    p.mesh.material.opacity = 0.5 + Math.sin(frame * 0.18 + p.phase) * 0.3;
    const s = 0.85 + Math.sin(frame * 0.14 + p.phase) * 0.15;
    p.mesh.scale.setScalar(s);
  });

  if (R.launched && R.launchY < 80) {
    R.launchY += 0.07;
    if (rocketGroup) rocketGroup.position.y = R.launchY;
    if (R.launchY > 3) scene.fog.near = 20 - R.launchY * 0.2;
    engineGlow.position.y = R.launchY - 0.6;
    orbit.phi = Math.max(0.5, orbit.phi - 0.003);
  }

  resize();
  renderer.render(scene, camera);
}
animate();

/* -------------------------------
   SPEC OVERLAY
------------------------------- */
function updateSpecCard() {
  document.getElementById('sName').textContent = R.name || 'UNNAMED';
  document.getElementById('sNose').textContent = {cone:'Cone',ogive:'Ogive',blunt:'Blunt'}[R.nosecone] || '-';
  document.getElementById('sHeight').textContent = R.bodyHeight ? R.bodyHeight.toFixed(1)+'m' : '-';
  document.getElementById('sBoosters').textContent = R.boosters || 'None';
  document.getElementById('sFins').textContent = R.finCount + ' × ' + R.finStyle;
  document.getElementById('sEngines').textContent = R.engineCount + (R.engineCount > 1 ? ' engines' : ' engine');
}

function sout(m) { document.getElementById('obar').textContent = m; }

/* -------------------------------
   RIGHT BAR SYNC
------------------------------- */
function syncRightBar() {
  function sv(id, val) { const e = document.getElementById(id); if (e) e.value = val; }
  function sc(id, val) { const e = document.getElementById(id); if (e) e.checked = val; }
  function st(id, txt) { const e = document.getElementById(id); if (e) e.textContent = txt; }
  sv('rb-prim', R.primaryCol);
  sv('rb-sec', R.secondaryCol);
  sv('rb-stripe-col', R.stripeCol);
  sv('rb-glow', R.glowCol);
  sv('rb-h', R.bodyHeight); st('rb-hv', parseFloat(R.bodyHeight).toFixed(1) + 'm');
  sv('rb-r', R.bodyRadius); st('rb-rv', parseFloat(R.bodyRadius).toFixed(2));
  sv('rb-nose', R.nosecone);
  sv('rb-fair', R.fairing);
  sv('rb-win', R.windowStyle);
  sc('rb-stripe-on', R.stripeOn);
  sc('rb-legs', R.landingLegs);
  sv('rb-eng', R.engineCount);
  sv('rb-boost', R.boosters);
  sv('rb-bs', Math.round(R.boosterSize * 10)); st('rb-bsv', R.boosterSize.toFixed(1) + '×');
  sv('rb-finstyle', R.finStyle);
  sv('rb-fincount', R.finCount);
  sv('rb-finscale', Math.round(R.finScale * 10)); st('rb-fsv', R.finScale.toFixed(1) + '×');
  sv('rb-nosescale', Math.round(R.noseconeScale * 10)); st('rb-nsv', R.noseconeScale.toFixed(1) + '×');
  sv('rb-stripepos', Math.round(R.stripePos * 100)); st('rb-spv', Math.round(R.stripePos * 100) + '%');
  sv('rb-wincount', R.windowCount); st('rb-wcv', R.windowCount);
}

/* -------------------------------
   LIVERY PRESETS
------------------------------- */
const PRESETS = {
  nasa:    { primaryCol:'#f0ede8', secondaryCol:'#1a1a2a', stripeOn:false, stripeCol:'#1a1a2a', glowCol:'#88ccff', finStyle:'delta',  noseconeScale:1.0, finScale:1.0 },
  spacex:  { primaryCol:'#1e1e22', secondaryCol:'#c0c8d0', stripeOn:false, stripeCol:'#ffffff', glowCol:'#88ccff', finStyle:'grid',   noseconeScale:1.2, finScale:0.9 },
  soviet:  { primaryCol:'#cc2222', secondaryCol:'#c0c0c0', stripeOn:true,  stripeCol:'#f5c842', glowCol:'#ff6600', finStyle:'delta',  noseconeScale:0.9, finScale:1.1 },
  saturn:  { primaryCol:'#f5f0e8', secondaryCol:'#1a1a2a', stripeOn:true,  stripeCol:'#1a1a2a', glowCol:'#ff8800', finStyle:'swept',  noseconeScale:0.8, finScale:1.2 },
  ariane:  { primaryCol:'#e8e8ec', secondaryCol:'#ffffff', stripeOn:true,  stripeCol:'#38bdf8', glowCol:'#88ccff', finStyle:'swept',  noseconeScale:1.1, finScale:0.9 },
  fire:    { primaryCol:'#e8543a', secondaryCol:'#f5c842', stripeOn:true,  stripeCol:'#ff2200', glowCol:'#ff3300', finStyle:'delta',  noseconeScale:1.0, finScale:1.3 },
  stealth: { primaryCol:'#0d0d12', secondaryCol:'#1a2030', stripeOn:false, stripeCol:'#334455', glowCol:'#6666ff', finStyle:'swept',  noseconeScale:1.4, finScale:0.8 },
  aurora:  { primaryCol:'#0d1b2a', secondaryCol:'#4ade80', stripeOn:true,  stripeCol:'#a78bfa', glowCol:'#44ffaa', finStyle:'delta',  noseconeScale:1.0, finScale:1.0 },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(R, p);
  buildRocket();
  const labels = { nasa:'NASA Classic', spacex:'SpaceX Dark', soviet:'Soviet Red', saturn:'Saturn V', ariane:'ESA Ariane', fire:'Firestorm', stealth:'Stealth Black', aurora:'Aurora' };
  sout('🎯 ' + (labels[name] || name) + ' livery applied!');
  document.getElementById('liveStatus').textContent = labels[name] || name;
}

/* -------------------------------
   ROCKET PRESETS (Advanced)
------------------------------- */
const ROCKET_PRESETS = {
  'Saturn V': {primaryCol:'#f5f5f5',secondaryCol:'#1a1a1a',finStyle:'swept',finCount:4,engineCount:5,nosecone:'ogive',boosters:0,fairing:'standard',stripeOn:true,stripeCol:'#e8543a'},
  'Falcon': {primaryCol:'#e0e0e0',secondaryCol:'#333333',finStyle:'grid',finCount:4,engineCount:9,nosecone:'ogive',boosters:2,boosterSize:0.8,fairing:'xl',stripeOn:false},
  'Delta': {primaryCol:'#1a3a5a',secondaryCol:'#e8e8e8',finStyle:'delta',finCount:3,engineCount:1,nosecone:'cone',boosters:0,fairing:'none',stripeOn:true,stripeCol:'#38bdf8'},
  'Ares': {primaryCol:'#8b1a1a',secondaryCol:'#f0c850',finStyle:'swept',finCount:4,engineCount:3,nosecone:'ogive',boosters:2,boosterSize:0.6,fairing:'standard',stripeOn:true,stripeCol:'#f0c850'},
  'Voyager': {primaryCol:'#2a1a4a',secondaryCol:'#a78bfa',finStyle:'delta',finCount:3,engineCount:2,nosecone:'ogive',boosters:0,fairing:'standard',stripeOn:false,windowStyle:'porthole'},
  'Phoenix': {primaryCol:'#ff6600',secondaryCol:'#ffcc00',finStyle:'swept',finCount:4,engineCount:4,nosecone:'ogive',boosters:1,boosterSize:0.7,fairing:'xl',stripeOn:true,stripeCol:'#ffcc00',glowCol:'#ff3300'},
};
function applyRocketPreset(name) {
  var p = ROCKET_PRESETS[name]; if (!p) return;
  builderPushUndo();
  Object.assign(R, p); R.launched = false; R.launchY = 0;
  buildRocket(); updateStats(); syncRightBar();
  toast('Preset: ' + name);
}

/* -------------------------------
   STEPS
------------------------------- */
let currentStep = 0;
const stepDone = new Array(17).fill(false);

function nav(i) { return ''; }

function opts(id, options, currentVal, onChange) {
  return `<div class="opt-grid">${options.map(o =>
    `<button class="opt-btn${currentVal===o.val?' sel':''}" data-action="${onChange}" data-arg="${o.val}">
      <span class="opt-icon">${o.icon}</span>${o.label}</button>`
  ).join('')}</div>`;
}

function swatchRow(id, colours, currentVal, onChange) {
  return `<div class="swatch-row">${colours.map(c =>
    `<div class="swatch${currentVal===c?' sel':''}" style="background:${c}" data-action="${onChange}" data-arg="${c}"></div>`
  ).join('')}</div>
  <div class="custom-colour">
    <span>Custom:</span>
    <input type="color" value="${currentVal}" data-action-input="${onChange}">
  </div>`;
}

function selectOpt(val, el, field, rebuild) {
  R[field] = val;
  el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('sel'));
  if (el) el.classList.add('sel');
  if (rebuild) buildRocket();
}

function selectSwatch(col, el, field) {
  R[field] = col;
  el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
  if (el) el.classList.add('sel');
  buildRocket();
}

const STEPS = [

/* 1 */ {
  title: 'Name Your Rocket',
  tag: 'STEP 01 · IDENTITY',
  intro: `Every rocket needs a name. NASA, SpaceX, ESAthey all name their launch vehicles. Saturn V. Falcon 9. Ariane 6. What will yours be called?`,
  boxes: [
    { t:'box-c', tx:'Rocket names often reflect power, place, or mythology. Saturn V was named after the Roman god. Falcon after the Millennium Falcon. Name yours something that means something to you.' },
    { t:'box-t', tx:'Keep it under 12 characters it looks best on the spec overlay.' },
  ],
  tasks: ['Enter a rocket name', 'Press Apply to lock it in'],
  html() { return `<input class="name-input" id="rocketName" aria-label="Rocket name" maxlength="14" placeholder="E.G. NOVA-7" value="${R.name==='UNNAMED'?'':R.name}">`; },
  onApply() { R.name = document.getElementById('rocketName')?.value?.trim().toUpperCase() || 'NOVA'; buildRocket(); sout('✅ ' + R.name + ' is registered. Now choose a nosecone shape.'); document.getElementById('liveStatus').textContent = 'Named!'; }
},

/* 2 */ {
  title: 'Nosecone Shape',
  tag: 'STEP 02 · AERODYNAMICS',
  intro: `The nosecone cuts through the atmosphere. Different shapes work best at different speeds. Coneis classic. Ogiveis more aerodynamic. Bluntis used on crew capsules.`,
  boxes: [
    { t:'box-c', tx:'Real rockets use <em>von Kármán ogives</em> mathematically optimised curves. The Falcon 9 uses a conic section. The Dragon capsule uses a blunt body to create a shock wave that deflects heat during re-entry.' },
    { t:'box-t', tx:'For maximum style points, try Ogive it adds a shoulder fairing that looks very professional.' },
  ],
  tasks: ['Choose a nosecone', 'See how it changes the silhouette'],
  html() {
    const o = `(function(v,el){R.nosecone=v;el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('nose', [
      { val:'cone',  icon:'📐', label:'Cone' },
      { val:'ogive', icon:'🔺', label:'Ogive' },
      { val:'blunt', icon:'🔘', label:'Blunt Cap' },
    ], R.nosecone, o);
  },
  onApply() { buildRocket(); sout('Nosecone: ' + R.nosecone + '. Looking good!'); document.getElementById('liveStatus').textContent = 'Nosecone set!'; }
},

/* 3 */ {
  title: 'Body Height',
  tag: 'STEP 03 · SCALE',
  intro: `How tallis your rocket? A small sounding rocket might be 8m. Saturn V was 111m. Taller rockets carry more fuel and reach higher orbits but need bigger engines.`,
  boxes: [
    { t:'box-c', tx:'The mass ratioof a rocket determines how high it can go. More body height = more fuel capacity. The Tsiolkovsky rocket equation governs all of this.' },
    { t:'box-t', tx:'Try Medium first it balances well visually with boosters and fins.' },
  ],
  tasks: ['Pick a body height', 'Notice how the fin and booster positions adapt'],
  html() {
    const o = `(function(v,el){R.bodyHeight=parseFloat(v);el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('height', [
      { val:'2.2', icon:'📏', label:'Compact' },
      { val:'3.2', icon:'📐', label:'Medium' },
      { val:'4.4', icon:'📏', label:'Tall' },
      { val:'5.5', icon:'📦', label:'Heavy' },
    ], String(R.bodyHeight), o);
  },
  onApply() { buildRocket(); sout('Body height: ' + R.bodyHeight + 'm equivalent.'); document.getElementById('liveStatus').textContent = 'Height set!'; }
},

/* 4 */ {
  title: 'Body Diameter',
  tag: 'STEP 04 · GIRTH',
  intro: `A wider body holds more fuel, but creates more aerodynamic drag. Falcon 9's core is 3.7m wide. SLS is 8.4m. Your choice affects how the fins and boosters look attached.`,
  boxes: [
    { t:'box-c', tx:'Wider rockets are called <em>wide-body launchers</em>. They\'re often used for heavy cargo where drag is less important than payload mass.' },
  ],
  tasks: ['Set the body diameter'],
  html() {
    const o = `(function(v,el){R.bodyRadius=parseFloat(v);el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('diam', [
      { val:'0.26', icon:'📏', label:'Slim' },
      { val:'0.35', icon:'📐', label:'Standard' },
      { val:'0.46', icon:'📦', label:'Wide' },
    ], String(R.bodyRadius), o);
  },
  onApply() { buildRocket(); sout('Body diameter adjusted.'); document.getElementById('liveStatus').textContent = 'Diameter set!'; }
},

/* 5 */ {
  title: 'Primary Colour',
  tag: 'STEP 05 · LIVERY',
  intro: `The main body colour. Whitereflects sunlight and keeps fuel tanks cool. NASA's SLS is white. SpaceX's Falcon 9 is white. But your rocket can be any colour you want.`,
  boxes: [
    { t:'box-c', tx:'Rockets are painted white not just for lookswhite paint reflects solar radiation, stopping liquid hydrogen or oxygen tanks from boiling off before launch.' },
    { t:'box-t', tx:'Pick a bold colour you\'ll add a contrasting secondary in the next step.' },
  ],
  tasks: ['Choose a primary colour'],
  html() {
    const o = `(function(c,el){R.primaryCol=c;el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(s=>s.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return swatchRow('pc', ['#e8543a','#f5c842','#38bdf8','#4ade80','#a78bfa','#fb923c','#ffffff','#1a1a2a'], R.primaryCol, o);
  },
  onApply() { buildRocket(); sout('Primary colour applied!'); document.getElementById('liveStatus').textContent = 'Colour set!'; }
},

/* 6 */ {
  title: 'Secondary Colour',
  tag: 'STEP 06 · CONTRAST',
  intro: `The secondary colour appears on the nosecone, fins, and engine bells</strong>. A contrasting colour makes your rocket look more designed and intentional.`,
  boxes: [
    { t:'box-t', tx:'Classic combos: white body + black nosecone (Ariane 5). Red body + white fins. Or match them for a clean monochrome look.' },
  ],
  tasks: ['Choose a secondary colour'],
  html() {
    const o = `(function(c,el){R.secondaryCol=c;el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(s=>s.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return swatchRow('sc', ['#ffffff','#1a1a2a','#e8543a','#f5c842','#38bdf8','#4ade80','#a78bfa','#c0c0c0'], R.secondaryCol, o);
  },
  onApply() { buildRocket(); sout('Secondary colour applied!'); document.getElementById('liveStatus').textContent = 'Colour set!'; }
},

/* 7 */ {
  title: 'Fin Style',
  tag: 'STEP 07 · STABILITY',
  intro: `Fins keep the rocket flying straight</strong>. Without them, it would tumble. Different shapes give different handling characteristics and visual personality.`,
  boxes: [
    { t:'box-c', tx:'Delta finsare the simplest a triangle. Swept finsare angled back to reduce drag at high speed. Grid fins(like Falcon 9) fold out and can steer the rocket during descent.' },
    { t:'box-t', tx:'Grid fins look the most technical and futuristic. Swept fins look the most "classic rocket".' },
  ],
  tasks: ['Choose a fin style', 'See how they attach to the body'],
  html() {
    const o = `(function(v,el){R.finStyle=v;el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('fins', [
      { val:'delta',  icon:'🔺', label:'Delta' },
      { val:'swept',  icon:'📐', label:'Swept' },
      { val:'grid',   icon:'⊞', label:'Grid Fins' },
    ], R.finStyle, o);
  },
  onApply() { buildRocket(); sout('Fins: ' + R.finStyle + ' style applied.'); document.getElementById('liveStatus').textContent = 'Fins added!'; }
},

/* 8 */ {
  title: 'Fin Count',
  tag: 'STEP 08 · SYMMETRY',
  intro: `3 finsis the lightest and fastest option most model rockets use 3. 4 finsgives more stability and a more symmetrical look. Real rockets often use 4.`,
  boxes: [
    { t:'box-c', tx:'3 fins give a 120° symmetry. 4 fins give 90° symmetry. More fins = more drag but more stability at low speeds. Most high-power rockets use 3 to reduce weight.' },
  ],
  tasks: ['Choose 3 or 4 fins'],
  html() {
    const o = `(function(v,el){R.finCount=parseInt(v);el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('fc', [
      { val:'3', icon:'🔺', label:'3 Fins' },
      { val:'4', icon:'🔷', label:'4 Fins' },
    ], String(R.finCount), o);
  },
  onApply() { buildRocket(); sout('Fin count: ' + R.finCount + '.'); document.getElementById('liveStatus').textContent = 'Fins set!'; }
},

/* 9 */ {
  title: 'Side Boosters',
  tag: 'STEP 09 · THRUST',
  intro: `Boostersare additional rockets strapped to the core. They provide extra thrust at launch and then separate. Falcon Heavy has 2 side boosters. SLS has 2 solid rocket boosters.`,
  boxes: [
    { t:'box-c', tx:'Side boosters dramatically increase lift capacity. They burn out first and are then jettisoned, reducing weight at the point where the core rocket takes over.' },
    { t:'box-r', tx:'SpaceX even lands their Falcon 9 boosters back on the launch pad the most iconic rocket moment of the 2010s.' },
  ],
  tasks: ['Choose how many boosters to add'],
  html() {
    const o = `(function(v,el){R.boosters=parseInt(v);el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('boosters', [
      { val:'0', icon:'🚫', label:'None' },
      { val:'2', icon:'🚀', label:'2 Boosters' },
      { val:'4', icon:'🚀', label:'4 Boosters' },
    ], String(R.boosters), o);
  },
  onApply() { buildRocket(); sout(R.boosters ? '🚀 ' + R.boosters + ' boosters attached!' : 'No boosters, lean and clean.'); document.getElementById('liveStatus').textContent = 'Boosters set!'; }
},

/* 10 */ {
  title: 'Booster Size',
  tag: 'STEP 10 · PROPORTIONS',
  intro: `Set how large your boosters are relative to the main body. Smallboosters are strap-on solid rockets. Largeboosters are full liquid fuel cores like Falcon Heavy's.`,
  boxes: [
    { t:'box-t', tx:'Skip this step if you chose no boosters. If you have 4 boosters and make them large, your rocket will look impressively chunky.' },
  ],
  tasks: ['Adjust booster size'],
  html() {
    return `<div style="padding:6px 0"><div class="slider-row">
      <span class="slider-lbl">Booster Size</span>
      <input type="range" min="4" max="10" step="1" value="${Math.round(R.boosterSize*10)}"
        data-param="R.boosterSize" data-parse="float" data-divisor="10" data-display="bsVal" data-fmt="f1×" data-rebuild="buildRocket">
      <span class="slider-val" id="bsVal">${R.boosterSize.toFixed(1)}×</span>
    </div></div>`;
  },
  onApply() { buildRocket(); sout('Booster size: ' + R.boosterSize.toFixed(1) + '×'); document.getElementById('liveStatus').textContent = 'Boosters sized!'; }
},

/* 11 */ {
  title: 'Engine Count',
  tag: 'STEP 11 · POWER',
  intro: `How many engines in the main core? 1 engineis simple and powerful. 3is like Falcon 9 (Merlin cluster). 5is raw cluster power.`,
  boxes: [
    { t:'box-c', tx:'The Falcon 9 Full Thrust has 9 Merlin engines in an Octaweb pattern. Starship has 33 Raptor engines. More engines = more redundancy if one fails, the mission can still continue.' },
    { t:'box-t', tx:'5 engines only really looks right on a wide body. Try Wide diameter from Step 4 before selecting 5.' },
  ],
  tasks: ['Choose engine count', 'See the engine bells at the base'],
  html() {
    const o = `(function(v,el){R.engineCount=parseInt(v);el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('eng', [
      { val:'1', icon:'💎', label:'Single' },
      { val:'3', icon:'🔥🔥🔥', label:'Triple' },
      { val:'5', icon:'💎', label:'5-Engine' },
    ], String(R.engineCount), o);
  },
  onApply() { buildRocket(); sout(R.engineCount + ' engine' + (R.engineCount>1?'s':'')+' installed.'); document.getElementById('liveStatus').textContent = 'Engines set!'; }
},

/* 12 */ {
  title: 'Payload Fairing',
  tag: 'STEP 12 · PAYLOAD',
  intro: `The payload fairingis the nose shell that protects cargo during ascent. It splits and falls away once above the atmosphere. Standard for satellites. XL for large space telescopes.`,
  boxes: [
    { t:'box-c', tx:'Fairings cost millions and SpaceX actually catches them with nets on ships to reuse them. The fairing protects satellites from aerodynamic forces and heating during the first few minutes of flight.' },
  ],
  tasks: ['Add a payload fairing or leave bare'],
  html() {
    const o = `(function(v,el){R.fairing=v;el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('fairing', [
      { val:'none',     icon:'🚫', label:'None' },
      { val:'standard', icon:'📦', label:'Standard' },
      { val:'xl',       icon:'📦', label:'XL Fairing' },
    ], R.fairing, o);
  },
  onApply() { buildRocket(); sout(R.fairing==='none' ? 'No fairing, raw payload.' : 'Payload fairing: ' + R.fairing + '.'); document.getElementById('liveStatus').textContent = 'Payload set!'; }
},

/* 13 */ {
  title: 'Stripe Decal',
  tag: 'STEP 13 · MARKINGS',
  intro: `Add a colour stripearound the body a classic rocket marking used to break up large surfaces and identify different sections of the fuel tank.`,
  boxes: [
    { t:'box-t', tx:'The Saturn V had black rollout stripes. Ariane 5 has a red band. Pick a contrasting stripe colour for best effect.' },
  ],
  tasks: ['Toggle stripe on/off', 'Choose a stripe colour'],
  html() {
    const o = `(function(c,el){R.stripeCol=c;el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(s=>s.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return `<div style="display:flex;align-items:center;gap:9px;margin:8px 0">
      <span style="font-size:.78rem;color:var(--muted)">Stripe:</span>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.78rem;color:var(--text)">
        <input type="checkbox" ${R.stripeOn?'checked':''} style="width:16px;height:16px;accent-color:var(--acc)" data-param="R.stripeOn" data-parse="checked" data-rebuild="buildRocket">
        Show stripe band
      </label>
    </div>` + swatchRow('stc', ['#ffffff','#f5c842','#38bdf8','#4ade80','#e8543a','#1a1a2a','#a78bfa','#fb923c'], R.stripeCol, o);
  },
  onApply() { buildRocket(); sout(R.stripeOn ? '🎨 Stripe added in ' + R.stripeCol : 'No stripe, clean body.'); document.getElementById('liveStatus').textContent = 'Markings set!'; }
},

/* 14 */ {
  title: 'Windows',
  tag: 'STEP 14 · CREW COMPARTMENT',
  intro: `Add windowsto your rocket. Crew capsules and observation pods have portholes. Cargo rockets usually have none. Choose a style that matches your mission.`,
  boxes: [
    { t:'box-c', tx:'The Apollo command module had five windows. SpaceX Dragon has four. ISS has the Cupola a seven-window dome. Every crewed spacecraft needs a view.' },
    { t:'box-t', tx:'Portholes look great on wider bodies. Rectangular windows suit taller rockets with a more industrial look.' },
  ],
  tasks: ['Choose a window style (or none)'],
  html() {
    const o = `(function(v,el){R.windowStyle=v;el?.closest('.opt-grid')?.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('sel'));if(el)el.classList.add('sel');buildRocket();})`;
    return opts('win', [
      { val:'none',     icon:'🚫', label:'None' },
      { val:'porthole', icon:'🔵', label:'Portholes' },
      { val:'row',      icon:'?',  label:'Row × 4' },
      { val:'rect',     icon:'▬',  label:'Rect Windows' },
    ], R.windowStyle, o);
  },
  onApply() { buildRocket(); sout(R.windowStyle === 'none' ? 'No windows cargo rocket.' : 'Windows: ' + R.windowStyle + ' style added.'); document.getElementById('liveStatus').textContent = 'Windows set!'; }
},

/* 15 */ {
  title: 'Landing Legs',
  tag: 'STEP 15 · REUSABILITY',
  intro: `Add Falcon 9-style landing legsto your rocket. Reusable rockets fold out their legs just before touchdown and land propulsively. SpaceX changed everything with this.`,
  boxes: [
    { t:'box-c', tx:'Falcon 9\'s four legs are made from carbon fibre and aluminium honeycomb. They deploy from the base of the first stage and extend outward for landing. Each leg spans about 18m.' },
    { t:'box-r', tx:'The first successful Falcon 9 landing was on 21 December 2015 the moment reusable orbital rockets became real.' },
    { t:'box-t', tx:'Turn legs on for a reusable first-stage look. Leave off for a disposable or upper-stage rocket.' },
  ],
  tasks: ['Toggle landing legs on or off'],
  html() {
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0">
      <span style="font-size:.82rem;color:var(--muted)">Landing Legs:</span>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem;color:var(--text)">
        <input type="checkbox" ${R.landingLegs?'checked':''} style="width:18px;height:18px;accent-color:var(--acc)" data-param="R.landingLegs" data-parse="checked" data-rebuild="buildRocket">
        Deploy Falcon-style landing legs
      </label>
    </div>`;
  },
  onApply() { buildRocket(); sout(R.landingLegs ? '🦿 Landing legs deployed ready to land!' : 'No landing legs, expendable configuration.'); document.getElementById('liveStatus').textContent = R.landingLegs ? 'Legs deployed!' : 'No legs'; }
},

/* 16 */ {
  title: 'Engine Glow',
  tag: 'STEP 16 · EXHAUST',
  intro: `Choose the colour of your engine exhaust flame</strong>. Kerosene engines burn orange-yellow. Hydrogen engines burn nearly invisible blue-white. Ion drives glow blue-violet.`,
  boxes: [
    { t:'box-c', tx:'Rocket exhaust colours depend entirely on propellant. LOX/kerosene = orange. LOX/hydrogen = blue-white, almost invisible. Methalox (Raptor) = tight blue diamond shocks. Ion drives = electric purple-blue glow.' },
    { t:'box-t', tx:'The glow appears when you launch in Step 17!' },
  ],
  tasks: ['Pick an exhaust glow colour'],
  html() {
    const o = `(function(c,el){R.glowCol=c;el?.closest('.swatch-row')?.querySelectorAll('.swatch').forEach(s=>s.classList.remove('sel'));if(el)el.classList.add('sel');})`;
    return swatchRow('gc', ['#ff6600','#ffcc00','#88ccff','#ffffff','#ff88ff','#44ffaa','#ff3300','#6666ff'], R.glowCol, o);
  },
  onApply() { sout('Exhaust colour set. Ready to launch!'); document.getElementById('liveStatus').textContent = 'Glow ready!'; }
},

/* 17 */ {
  title: 'Launch!',
  tag: 'STEP 17 · LIFTOFF',
  intro: `All systems are go.Your rocket is fully designed. Hit the launch button to ignite the engines and watch it lift off.`,
  boxes: [
    { t:'box-r', tx: '3, 2, 1, Ignition! The engines fire, the clamps release, and your rocket climbs into the void.' },
    { t:'box-c', tx: 'A complete launch vehicle needs: nosecone (aerodynamics), body (fuel/structure), fins (stability), engines (thrust), and a payload. You\'ve built all of them.' },
    { t:'box-t', tx: 'Hit ? the Export button in the header to download your rocket as an OBJ, GLB or STL file, open it in Blender, MeshLab, or any 3D app. Hit ? Quick Buildto reset and try a completely different design.' },
  ],
  tasks: ['Press Launch and watch it go!'],
  html() {
    return `<div style="text-align:center;padding:8px 0">
      <div style="font-size:2.4rem;margin-bottom:7px">🚀</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--acc-lt);letter-spacing:.1em;margin-bottom:6px">${R.name || 'YOUR ROCKET'}</div>
      <div style="font-size:.76rem;color:var(--muted);margin-bottom:14px;line-height:1.7">All systems nominal.<br>Ready for launch.</div>
    </div>
    <button class="run-btn" style="font-size:1rem;padding:12px" data-action="applyStep" data-arg="currentStep">🚀 IGNITION, LAUNCH!</button>`;
  },
  onApply() { launch(); }
},

];

function launch() {
  R.launched = true;
  if(window.builderTrack)builderTrack('activate');
  R.launchY = 0;
  buildRocket();
  sout('🚀 IGNITION! ' + (R.name || 'ROCKET') + ' is lifting off!');
  document.getElementById('liveStatus').textContent = 'LIFTOFF! 🚀';
  document.getElementById('sceneHint').textContent = 'Drag to follow the rocket';
  // Mark the launch step as done and tick it off
  stepDone[STEPS.length - 1] = true;
  updateProgress();
  renderStep();
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
  let html = `<div class="step-tag">${s.tag}</div>
    <div class="step-title">${s.title}</div>
    <div class="step-intro">${s.intro}</div>`;
  (s.boxes || []).forEach(b => { html += `<div class="box ${b.t}">${b.tx}</div>`; });
  html += s.html ? s.html() : '';
  if (s.tasks) {
    html += `<div class="task-list">${s.tasks.map(t => {
      const done = stepDone[currentStep];
      return `<div class="task-item${done?' done':''}"><div class="task-dot"></div>${t}</div>`;
    }).join('')}</div>`;
  }
  // Add apply button unless the step provides its own run-btn
  if (!s.html || !s.html().includes('run-btn')) {
    html += `<button class="run-btn" data-action="applyStep" data-arg="${currentStep}">▶ Apply to Rocket</button>`;
  }
  body.innerHTML = html;
  document.querySelectorAll('.si').forEach((el, i) => el.classList.toggle('active', i === currentStep));
}

function applyStep(i) {
  STEPS[i].onApply();
  stepDone[i] = true;
  renderStep();
  updateProgress();
}

function updateProgress() {
  const done = stepDone.filter(Boolean).length;
  const pct = Math.max(3, Math.round((done / STEPS.length) * 100));
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progCt').textContent = done + ' / 17 steps';
  document.querySelectorAll('.si').forEach((el, i) => {
    el.classList.toggle('done', stepDone[i]);
    el.classList.toggle('active', i === currentStep);
    const sn = el.querySelector('.sn');
    if (sn) sn.textContent = stepDone[i] ? '?' : (i + 1);
  });
}

function quickBuild() {
  R.name = 'NOVA-7'; R.nosecone = 'ogive'; R.bodyHeight = 3.2; R.bodyRadius = 0.35;
  R.primaryCol = '#e8543a'; R.secondaryCol = '#ffffff'; R.finStyle = 'swept'; R.finCount = 4;
  R.boosters = 2; R.boosterSize = 0.7; R.engineCount = 3; R.fairing = 'standard';
  R.stripeOn = true; R.stripeCol = '#f5c842'; R.glowCol = '#ff6600';
  R.windowStyle = 'porthole'; R.landingLegs = true;
  R.launched = false; R.launchY = 0;
  R.finScale = 1.0; R.stripePos = 0.35; R.noseconeScale = 1.0; R.windowCount = 2;
  buildRocket();
  sout('⚡ Quick build: NOVA-7 is ready. Press Launch at Step 17!');
  document.getElementById('liveStatus').textContent = 'Quick build active!';
  toast('Quick build: NOVA-7 loaded!');
}

// STATE HOOKS (for share/undo)
window._builderGetState = function() { return { params: { ...R }, step: currentStep }; };
window._builderApplyState = function(s) {
  if (s.params) Object.assign(R, s.params);
  if (typeof s.step === 'number') currentStep = s.step;
  R.launched = false; R.launchY = 0;
  buildRocket(); renderStep(); updateProgress(); syncRightBar(); updateStats();
  if (window.builderScheduleAutoSave) builderScheduleAutoSave();
};

// ---------------------------------------
// TOAST
// ---------------------------------------
function toast(m) {
  let t = document.getElementById('rocketToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'rocketToast';
    t.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:rgba(7,9,15,.92);border:1px solid rgba(232,84,58,.35);padding:8px 22px;font-family:Bebas Neue,sans-serif;font-size:.9rem;letter-spacing:.06em;color:var(--acc-lt);border-radius:8px;pointer-events:none;opacity:0;transition:opacity .3s;z-index:200;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.style.opacity = '1';
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.opacity = '0'; }, 1800);
}

// ---------------------------------------
// STATS
// ---------------------------------------
function computeStats() {
  const thrust = Math.min(10, Math.round(R.engineCount * 2.5 + R.boosters * 1.5 + (R.bodyRadius / 0.5 * 2)));
  const stability = Math.min(10, Math.round(R.finCount * 1.8 + (R.finStyle === 'grid' ? 2 : R.finStyle === 'swept' ? 1.5 : 1) + (R.landingLegs ? 1 : 0)));
  const payload = Math.min(10, Math.round((R.fairing === 'none' ? 1 : R.fairing === 'standard' ? 3 : 5) + R.bodyHeight * 0.8 + R.windowCount * 0.3));
  const range = Math.min(10, Math.round(R.bodyHeight * 1.5 + R.boosters * 1.2 + R.engineCount * 0.8 - R.bodyRadius * 2));
  return { thrust: Math.max(1, thrust), stability: Math.max(1, stability), payload: Math.max(1, payload), range: Math.max(1, range) };
}

function updateStats() {
  const s = computeStats();
  const el = document.getElementById('rocketStats');
  if (!el) return;
  const bar = (v, c) => `<div class="stat-track"><div class="stat-fill" style="width:${v * 10}%;background:${c}"></div></div>`;
  el.innerHTML = `<div class="stat-title">Rocket Stats</div>` +
    `<div class="stat-row"><span class="stat-lbl">Thrust</span>${bar(s.thrust, '#e8543a')}<span class="stat-val">${s.thrust}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Stable</span>${bar(s.stability, '#4ade80')}<span class="stat-val">${s.stability}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Payload</span>${bar(s.payload, '#38bdf8')}<span class="stat-val">${s.payload}</span></div>` +
    `<div class="stat-row"><span class="stat-lbl">Range</span>${bar(s.range, '#f5c842')}<span class="stat-val">${s.range}</span></div>`;
}

// ---------------------------------------
// RANDOM BUILD
// ---------------------------------------
function randomRocket() {
  const rnd = (mn, mx, s) => { const v = mn + Math.random() * (mx - mn); return s ? Math.round(v / s) * s : Math.round(v * 100) / 100; };
  const noses = ['cone', 'ogive', 'parabolic', 'blunt', 'von karman'];
  const fins = ['delta', 'swept', 'grid'];
  const fairs = ['none', 'standard', 'large'];
  const wins = ['none', 'porthole', 'rect', 'row'];
  Object.assign(R, {
    name: 'R-' + Math.round(100 + Math.random() * 900),
    nosecone: noses[Math.floor(Math.random() * noses.length)],
    bodyHeight: rnd(1.5, 5, 0.1), bodyRadius: rnd(0.2, 0.5, 0.02),
    primaryCol: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    secondaryCol: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    finStyle: fins[Math.floor(Math.random() * fins.length)],
    finCount: Math.round(3 + Math.random() * 5),
    boosters: Math.round(Math.random() * 3), boosterSize: rnd(0.4, 0.9, 0.05),
    engineCount: Math.round(1 + Math.random() * 5),
    fairing: fairs[Math.floor(Math.random() * fairs.length)],
    stripeOn: Math.random() > 0.4,
    stripeCol: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    glowCol: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    windowStyle: wins[Math.floor(Math.random() * wins.length)],
    landingLegs: Math.random() > 0.5,
    launched: false, launchY: 0,
    finScale: rnd(0.6, 1.4, 0.05), stripePos: rnd(0.15, 0.65, 0.05),
    noseconeScale: rnd(0.6, 1.4, 0.05), windowCount: Math.round(1 + Math.random() * 6),
  });
  buildRocket(); updateStats(); syncRightBar(); toast('Random rocket generated!');
  if(window.builderTrack)builderTrack('random_build');
}

// ---------------------------------------
// SAVE / LOAD
// ---------------------------------------
function getSaves() { try { return JSON.parse(localStorage.getItem('rocketSaves') || '{}'); } catch { return {}; } }
function setSaves(s) { localStorage.setItem('rocketSaves', JSON.stringify(s)); }

function openSaveModal() {
  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;
  content.innerHTML = `<h2 style="font-family:Bebas Neue,sans-serif;color:var(--acc-lt);margin-bottom:12px">Save Rocket</h2><input type="text" id="rocketSaveName" placeholder="Name your rocket..." style="width:100%;padding:8px 12px;background:var(--bg3);border:1px solid rgba(232,84,58,.3);border-radius:7px;color:var(--acc-lt);font-family:Bebas Neue,sans-serif;font-size:1rem;letter-spacing:.06em;outline:none;margin-bottom:12px"><div style="display:flex;gap:8px;justify-content:flex-end"><button data-on="closeModal" data-on-plain style="padding:7px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;cursor:pointer;font-size:.8rem">Cancel</button><button data-action="doRocketSave" style="padding:7px 16px;background:var(--acc);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Bebas Neue,sans-serif;font-size:.85rem;letter-spacing:.06em">Save</button></div>`;
  modal.classList.add('open');
  setTimeout(() => { const inp = document.getElementById('rocketSaveName'); if (inp) inp.focus(); }, 100);
}

function openLoadModal() {
  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;
  const sv = getSaves(), ks = Object.keys(sv);
  let h = '';
  if (!ks.length) h = '<p style="color:var(--muted);font-size:.8rem;padding:8px 0">No saved rockets yet.</p>';
  else h = '<div style="max-height:180px;overflow-y:auto;margin-bottom:12px">' + ks.map(k => {
    const d = new Date(sv[k].date).toLocaleDateString();
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .2s" data-hover="background:rgba(232,84,58,.05)" data-hover-out="background:transparent" data-action="doRocketLoad" data-arg="${k.replace(/'/g, '&#39;')}"><div><div style="font-size:.82rem;color:var(--text)">${k}</div><div style="font-family:JetBrains Mono,monospace;font-size:.55rem;color:var(--muted)">${d}</div></div><button data-action="doRocketDel" data-arg="${k.replace(/'/g, '&#39;')}" data-stop style="background:none;border:none;color:#f87171;cursor:pointer;font-size:.9rem;padding:2px 5px">?</button></div>`;
  }).join('') + '</div>';
  content.innerHTML = `<h2 style="font-family:Bebas Neue,sans-serif;color:var(--acc-lt);margin-bottom:12px">Load Rocket</h2>${h}<div style="display:flex;justify-content:flex-end"><button data-on="closeModal" data-on-plain style="padding:7px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;cursor:pointer;font-size:.8rem">Close</button></div>`;
  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('modalOverlay');
  if (modal) modal.classList.remove('open');
}

function doRocketSave() {
  const inp = document.getElementById('rocketSaveName');
  if (!inp) return;
  const n = inp.value.trim();
  if (!n) return;
  const sv = getSaves();
  sv[n] = { params: { ...R }, step: currentStep, date: Date.now() };
  setSaves(sv);
  closeModal();
  if(window.builderTrack)builderTrack('save');
  toast('Rocket saved!');
}

function doRocketLoad(n) {
  const sv = getSaves();
  if (!sv[n]) return;
  Object.assign(R, sv[n].params);
  currentStep = sv[n].step || 0;
  R.launched = false; R.launchY = 0;
  closeModal();
  buildRocket();
  renderStep();
  updateProgress();
  syncRightBar();
  toast('Loaded: ' + n);
}

function doRocketDel(n) {
  const sv = getSaves();
  delete sv[n];
  setSaves(sv);
  openLoadModal();
}

// ---------------------------------------
// KEYBOARD NAV
// ---------------------------------------
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); if (currentStep < STEPS.length - 1) go(currentStep + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); if (currentStep > 0) go(currentStep - 1); }
  if (e.key === 'Escape') closeModal();
});

function init() {
  const listEl = document.getElementById('stepList');
  STEPS.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'si' + (i === 0 ? ' active' : '');
    item.innerHTML = `<div class="sn">${i + 1}</div><div class="sl">${s.title}</div>`;
    item.onclick = () => go(i);
    listEl.appendChild(item);
  });

  document.getElementById('navPrev').disabled = true;
  document.getElementById('navNext').disabled = false;

  buildRocket();
  renderStep();
  updateStats();
  updateSpecCard();
  syncRightBar();
  const modal = document.getElementById('modalOverlay');
  if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
}

init();

/* -------------------------------
   TEMPLATES + EXPORT
   Both are shared modules. This block only says where the model lives, so
   the dialog always reads the model that is actually on screen.
------------------------------- */
const ROCKET_TEMPLATES = [
  { id: 'nova7', emoji: '🚀', name: 'Nova-7', note: 'The house favourite: ogive nose, twin boosters, four swept fins.',
    data: { name: 'NOVA-7', nosecone: 'ogive', bodyHeight: 3.2, bodyRadius: 0.35, primaryCol: '#e8543a', secondaryCol: '#ffffff', finStyle: 'swept', finCount: 4, boosters: 2, boosterSize: 0.7, engineCount: 3, fairing: 'standard', stripeOn: true, stripeCol: '#f5c842', glowCol: '#ff6600', windowStyle: 'porthole', landingLegs: true, finScale: 1.0, stripePos: 0.35, noseconeScale: 1.0, windowCount: 2 } },
  { id: 'saturn', emoji: '🌕', name: 'Saturn V', note: 'Tall, white and black, five engines, no boosters.',
    data: { name: 'SATURN V', nosecone: 'ogive', bodyHeight: 5.2, bodyRadius: 0.44, primaryCol: '#f5f5f5', secondaryCol: '#1a1a1a', finStyle: 'swept', finCount: 4, boosters: 0, boosterSize: 0.6, engineCount: 5, fairing: 'standard', stripeOn: true, stripeCol: '#1a1a1a', glowCol: '#ff6600', windowStyle: 'none', landingLegs: false, finScale: 1.1, stripePos: 0.55, noseconeScale: 1.1, windowCount: 1 } },
  { id: 'falcon', emoji: '🦅', name: 'Falcon Heavy', note: 'White core, two side boosters, grid fins, nine engines.',
    data: { name: 'FALCON', nosecone: 'ogive', bodyHeight: 4.4, bodyRadius: 0.4, primaryCol: '#e0e0e0', secondaryCol: '#333333', finStyle: 'grid', finCount: 4, boosters: 2, boosterSize: 0.8, engineCount: 5, fairing: 'xl', stripeOn: false, stripeCol: '#888888', glowCol: '#88ccff', windowStyle: 'none', landingLegs: true, finScale: 0.8, stripePos: 0.3, noseconeScale: 1.3, windowCount: 1 } },
  { id: 'firestorm', emoji: '🔥', name: 'Firestorm', note: 'Orange and yellow, delta fins, made to look fast.',
    data: { name: 'FIRESTORM', nosecone: 'cone', bodyHeight: 2.8, bodyRadius: 0.32, primaryCol: '#e8543a', secondaryCol: '#f5c842', finStyle: 'delta', finCount: 3, boosters: 0, boosterSize: 0.6, engineCount: 3, fairing: 'none', stripeOn: true, stripeCol: '#ff2200', glowCol: '#ff3300', windowStyle: 'rect', landingLegs: false, finScale: 1.3, stripePos: 0.4, noseconeScale: 1.0, windowCount: 3 } },
  { id: 'scout', emoji: '🔬', name: 'Scout Probe', note: 'A small blunt-nosed research rocket. Quick to print.',
    data: { name: 'SCOUT', nosecone: 'blunt', bodyHeight: 1.7, bodyRadius: 0.28, primaryCol: '#e8e8ec', secondaryCol: '#38bdf8', finStyle: 'delta', finCount: 3, boosters: 0, boosterSize: 0.5, engineCount: 1, fairing: 'none', stripeOn: true, stripeCol: '#38bdf8', glowCol: '#88ccff', windowStyle: 'porthole', landingLegs: false, finScale: 0.9, stripePos: 0.6, noseconeScale: 1.4, windowCount: 2 } },
  { id: 'aurora', emoji: '🌌', name: 'Aurora', note: 'Midnight blue with green trim and glowing portholes.',
    data: { name: 'AURORA', nosecone: 'ogive', bodyHeight: 3.8, bodyRadius: 0.37, primaryCol: '#0d1b2a', secondaryCol: '#4ade80', finStyle: 'delta', finCount: 4, boosters: 4, boosterSize: 0.55, engineCount: 3, fairing: 'standard', stripeOn: true, stripeCol: '#a78bfa', glowCol: '#44ffaa', windowStyle: 'row', landingLegs: true, finScale: 1.0, stripePos: 0.25, noseconeScale: 1.1, windowCount: 5 } }
];

function loadRocketTemplate(t) {
  Object.assign(R, t.data, { launched: false, launchY: 0 });
  buildRocket(); updateStats(); updateSpecCard(); syncRightBar();
  sout('Template loaded: ' + t.data.name + '. Change anything, then export.');
  toast('Template: ' + t.data.name);
  if (window.builderTrack) builderTrack('quick_build');
}

if (window.BuilderTemplates) {
  BuilderTemplates.install({
    mount: '.hdr-right',
    templates: ROCKET_TEMPLATES.map(function (t) { return { id: t.id, emoji: t.emoji, name: t.name, note: t.note, apply: function () { loadRocketTemplate(t); } }; }),
    random: randomRocket,
    onApply: function () { if (typeof go === 'function') go(0); else if (typeof renderStep === 'function') renderStep(); }
  });
}
window._builderSetState = window._builderSetState || window._builderApplyState;
if (window.JVExporter) {
  JVExporter.installUI({
    tool: 'Rocket Builder',
    units: 'm',
    accent: '#e8543a',
    getGroup: function () { return rocketGroup; },
    getName: function () { return (R.name && R.name !== 'UNNAMED') ? R.name : 'rocket'; },
    say: sout,

    track: function () { if (window.builderTrack) window.builderTrack.apply(null, arguments); }
  });
}
function goPrev(){go(currentStep-1)}
function goNext(){go(currentStep+1)}
  } finally {
    window.addEventListener = winAdd;
    document.addEventListener = docAdd;
    window.requestAnimationFrame = origRaf;
  }

  // Expose only the delegated handlers this builder's markup needs.
  try { window.randomRocket = randomRocket; } catch (e) { /* not a local handler */ }
  try { window.openSaveModal = openSaveModal; } catch (e) { /* not a local handler */ }
  try { window.openLoadModal = openLoadModal; } catch (e) { /* not a local handler */ }
  try { window.quickBuild = quickBuild; } catch (e) { /* not a local handler */ }
  try { window.goPrev = goPrev; } catch (e) { /* not a local handler */ }
  try { window.goNext = goNext; } catch (e) { /* not a local handler */ }
  try { window.applyPreset = applyPreset; } catch (e) { /* not a local handler */ }
  try { window.applyRocketPreset = applyRocketPreset; } catch (e) { /* not a local handler */ }
  try { window.launch = launch; } catch (e) { /* not a local handler */ }

  return function unmount() {
    try { ac.abort(); } catch (e) {}
    rafs.forEach(function (id) { try { cancelAnimationFrame(id); } catch (e) {} });
    window._builderGetState = null;
    window._builderApplyState = null;
    window._builderSetState = null;
    try { delete window.randomRocket; } catch (e) {}
    try { delete window.openSaveModal; } catch (e) {}
    try { delete window.openLoadModal; } catch (e) {}
    try { delete window.quickBuild; } catch (e) {}
    try { delete window.goPrev; } catch (e) {}
    try { delete window.goNext; } catch (e) {}
    try { delete window.applyPreset; } catch (e) {}
    try { delete window.applyRocketPreset; } catch (e) {}
    try { delete window.launch; } catch (e) {}
    stage.remove();
    sheet.remove();
  };
}
