const fs = require('fs');
const path = require('path');
const glob = require('fs');

const workshopDir = path.join(__dirname, '..', 'workshops');
const files = fs.readdirSync(workshopDir).filter(f => f.endsWith('.html'));

function hasTools(h) { return h.includes('tools/'); }

function getCallout(file) {
  const lower = file.toLowerCase();
  // engine-specific cheatsheets
  if (lower.startsWith('pico8-')) {
    return `<!-- A44:tool-callout:pico8-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tools for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83C\uDFAE</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the PICO-8 cheatsheet + Pixel Studio open</p>
      <p class="tool-callout-desc">Lua syntax for PICO-8 in one tab, draw 16×16 sprites in the other — stay on-site while you build.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <a href="/tools/pico8-cheatsheet.html" class="tool-callout-btn">Open PICO-8 Cheatsheet →</a>
      <a href="/tools/pixel-studio.html" class="tool-callout-btn" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff">Try Pixel Studio →</a>
    </div>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('defold-') || lower === 'my-first-defold-game.html') {
    return `<!-- A44:tool-callout:defold-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\u2699\uFE0F</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the Defold cheatsheet handy</p>
      <p class="tool-callout-desc">Components, game objects and messages in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/defold-cheatsheet.html" class="tool-callout-btn">Open Defold Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('unity-')) {
    return `<!-- A44:tool-callout:unity-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\u2B1B</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the Unity cheatsheet handy</p>
      <p class="tool-callout-desc">MonoBehaviour, physics and UI in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/unity-cheatsheet.html" class="tool-callout-btn">Open Unity Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('unreal-')) {
    return `<!-- A44:tool-callout:unreal-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83D\uDD35</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the Unreal cheatsheet handy</p>
      <p class="tool-callout-desc">Blueprints + C++ classes in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/unreal-cheatsheet.html" class="tool-callout-btn">Open Unreal Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('gdevelop-')) {
    return `<!-- A44:tool-callout:gdevelop-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83C\uDFAF</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the GDevelop cheatsheet handy</p>
      <p class="tool-callout-desc">Events, conditions and actions in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/gdevelop-cheatsheet.html" class="tool-callout-btn">Open GDevelop Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('gml-') || lower.includes('gml_')) {
    return `<!-- A44:tool-callout:gamemaker-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83D\uDD79\uFE0F</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the GML cheatsheet handy</p>
      <p class="tool-callout-desc">Events, variables and drawing in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/gamemaker-cheatsheet.html" class="tool-callout-btn">Open GML Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('cpp-')) {
    return `<!-- A44:tool-callout:cpp-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83D\uDD27</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the SFML cheatsheet handy</p>
      <p class="tool-callout-desc">Window, sprites and input in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/cpp-cheatsheet.html" class="tool-callout-btn">Open C++ Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('java-')) {
    return `<!-- A44:tool-callout:java-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\u2615</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Keep the Java cheatsheet handy</p>
      <p class="tool-callout-desc">JFrame + Graphics2D in one place — use it beside this workshop.</p>
    </div>
    <a href="/tools/java-cheatsheet.html" class="tool-callout-btn">Open Java Cheatsheet →</a>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('minecraft-') ) {
    return `<!-- A44:tool-callout:minecraft-cheatsheet -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tool for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\u26CF\uFE0F</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Build your texture in Pixel Studio</p>
      <p class="tool-callout-desc">Draw 16×16 textures here, then keep the modding cheatsheet open while you code.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <a href="/tools/pixel-studio.html" class="tool-callout-btn">Open Pixel Studio →</a>
      <a href="/tools/minecraft-cheatsheet.html" class="tool-callout-btn" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff">Open Modding Cheatsheet →</a>
    </div>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('mugen-') || lower === 'add-your-own-stage.html') {
    return `<!-- A44:tool-callout:pixel-studio -->
<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">
<div class="tool-callout" role="complementary" aria-label="Companion tools for this workshop">
  <div class="tool-callout-inner">
    <div class="tool-callout-icon">\uD83E\uDD4A</div>
    <div class="tool-callout-body">
      <p class="tool-callout-head">Design your fighter + sprites on-site</p>
      <p class="tool-callout-desc">Use the unified Pixel Studio — Simple for quick sketches, Character templates for fighters, Draw for polish.</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <a href="/tools/pixel-studio.html" class="tool-callout-btn">Open Pixel Studio →</a>
      <a href="/tools/pixel-studio.html#character" class="tool-callout-btn" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff">Character mode →</a>
    </div>
  </div>
</div>
</section>`;
  }
  if (lower.startsWith('blender-')) {
    return `<!-- A44:tool-callout:generic-3d -->
<section style="max-width:860px;margin:32px auto 0;padding:0 20px;">
  <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px">
    <p style="font-weight:800;margin:0 0 12px">Keep creating on-site — try these tools next</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <a href="../tools/colour-palette.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83C\uDFA8</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">Colour Palette</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Build a scheme</div></div></a>
      <a href="../tools/pixel-studio.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83C\uDFA8</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">Pixel Studio</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Draw sprites</div></div></a>
      <a href="../tools/buildlab.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83E\uDDE0</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">BuildLab</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">3D blocks</div></div></a>
      <a href="../tools/sfx-generator.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83D\uDD0A</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">SFX Generator</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Make sounds</div></div></a>
    </div>
  </div>
</section>`;
  }
  // generic fallback - 4 creative tools grid (keeps users on-site)
  return `<!-- A44:tool-callout:generic-create -->
<section style="max-width:860px;margin:32px auto 0;padding:0 20px;">
  <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px">
    <p style="font-weight:800;margin:0 0 12px">Keep creating on-site — try a companion tool</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <a href="../tools/pixel-studio.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83C\uDFA8</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">Pixel Studio</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Draw sprites</div></div></a>
      <a href="../tools/sfx-generator.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83D\uDD0A</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">SFX Generator</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Make sounds</div></div></a>
      <a href="../tools/level-designer.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83D\uDDF8\uFE0F</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">Level Designer</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Plan levels</div></div></a>
      <a href="../tools/colour-palette.html" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;"><span style="font-size:1.7rem;">\uD83C\uDFA8</span><div><div style="font-weight:700;font-size:.88rem;color:#F0EAD6;">Colour Palette</div><div style="font-size:.72rem;color:rgba(240,234,214,.55);">Build a scheme</div></div></a>
    </div>
  </div>
</section>`;
}

let changed = 0;
let skipped = 0;
for (const file of files) {
  const full = path.join(workshopDir, file);
  const html = fs.readFileSync(full, 'utf8');
  if (hasTools(html)) { skipped++; continue; }
  // skip index-like pages that are not workshops? but keep all zero-tool workshops
  // don't inject into cheatsheets themselves - they are reference, but they already have tools? cheatsheets have 0 but shouldn't get self-link
  if (file.includes('cheatsheet')) { skipped++; continue; }
  if (file === 'my-progress.html' || file === 'learn.html' || file === 'learning-lab.html' || file === 'tiny-learners.html') { skipped++; continue; }
  const callout = getCallout(file);
  let next;
  if (html.includes('<!-- BUILD:footer-content -->')) {
    next = html.replace('<!-- BUILD:footer-content -->', callout + '\n\n<!-- BUILD:footer-content -->');
  } else if (html.includes('<footer class="site-footer">')) {
    next = html.replace('<footer class="site-footer">', callout + '\n\n<footer class="site-footer">');
  } else {
    next = html.replace('</main>', '</main>\n' + callout);
  }
  if (next !== html) {
    fs.writeFileSync(full, next, 'utf8');
    changed++;
    console.log('injected', file);
  }
}
console.log(`Done: changed ${changed}, skipped ${skipped} (already had tools)`);
