/**
 * printables.js - SVG printable sticker sheet and shirt template generator.
 * Triggered at Level 5 (sticker sheet) and Level 10 (shirt design).
 * Produces downloadable SVG files. No external dependencies.
 */

const MASCOTS = [
  { emoji: '🦊', name: 'Lumo',     color: '#70A3A7' },
  { emoji: '🐢', name: 'Pip',      color: '#f39c12' },
  { emoji: '🐅', name: 'Ember',    color: '#BC4749' },
  { emoji: '🦎', name: 'Echo',     color: '#70A3A7' },
  { emoji: '✨', name: 'Stardust', color: '#f39c12' },
];

/** Build SVG text content for a sticker sheet (Level 5 unlock) */
function buildStickerSheetSVG() {
  const W = 744, H = 1052; // A4 at 96dpi
  const cols = 3, rows = 5;
  const cellW = 220, cellH = 180;
  const startX = (W - cols * cellW) / 2;
  const startY = 80;

  let cells = '';
  MASCOTS.forEach((m, idx) => {
    // 3 stickers per mascot (common, rare, epic) -- one per cell
    const variants = [
      { label: 'Common',    extra: '' },
      { label: 'Rare',      extra: '✨' },
      { label: 'Epic',      extra: '🔥' },
    ];
    variants.forEach((v, vi) => {
      const col = (idx + vi) % cols;
      const row = Math.floor((idx * 3 + vi) / cols);
      const x = startX + col * cellW + 10;
      const y = startY + row * cellH + 10;
      const cx = x + cellW / 2 - 10;
      const cy = y + cellH / 2 - 10;
      cells += `
        <g>
          <rect x="${x}" y="${y}" width="${cellW - 20}" height="${cellH - 20}"
            rx="16" ry="16"
            fill="#F0EAD6" stroke="${m.color}" stroke-width="2"
            stroke-dasharray="6 3"/>
          <text x="${cx}" y="${cy - 24}" font-size="48" text-anchor="middle" dominant-baseline="central">${m.emoji}${v.extra}</text>
          <text x="${cx}" y="${cy + 36}" font-size="12" text-anchor="middle"
            font-family="Fredoka, sans-serif" fill="#403B33">${m.name} - ${v.label}</text>
        </g>`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#fff"/>
  <!-- Title -->
  <text x="${W / 2}" y="48" font-size="22" text-anchor="middle"
    font-family="Fredoka, sans-serif" fill="#403B33">JVDesignStudio - Mascot Sticker Sheet</text>
  <text x="${W / 2}" y="68" font-size="11" text-anchor="middle"
    font-family="sans-serif" fill="#70A3A7">Level 5 Reward - Print, cut, and stick!</text>
  ${cells}
  <!-- Footer -->
  <text x="${W / 2}" y="${H - 20}" font-size="10" text-anchor="middle"
    font-family="sans-serif" fill="#b0a898">jvdesignstudio.com</text>
</svg>`;
}

/** Build SVG for a heat-transfer shirt design (Level 10 unlock) */
function buildShirtDesignSVG() {
  const W = 600, H = 600;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#fff"/>
  <!-- Circle badge -->
  <circle cx="${W / 2}" cy="${H / 2}" r="240" fill="#1a1a1a"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="228" fill="none" stroke="#70A3A7" stroke-width="4"/>
  <!-- Mascot cluster -->
  <text x="220" y="230" font-size="56" text-anchor="middle">🦊</text>
  <text x="380" y="230" font-size="56" text-anchor="middle">🐢</text>
  <text x="300" y="310" font-size="72" text-anchor="middle">✨</text>
  <text x="180" y="390" font-size="56" text-anchor="middle">🐅</text>
  <text x="420" y="390" font-size="56" text-anchor="middle">🦎</text>
  <!-- Brand text -->
  <text x="${W / 2}" y="458" font-size="22" text-anchor="middle"
    font-family="Fredoka, sans-serif" fill="#F0EAD6">JVDesignStudio</text>
  <text x="${W / 2}" y="480" font-size="11" text-anchor="middle"
    font-family="sans-serif" fill="#70A3A7">LEVEL 10 - GAME MAKER</text>
  <!-- Arc text path -->
  <path id="arc-top" d="M 80 300 A 220 220 0 0 1 520 300" fill="none"/>
  <text font-size="13" font-family="sans-serif" fill="#70A3A7">
    <textPath href="#arc-top" startOffset="15%">CODE . CREATE . PLAY . IMPROVE . IMAGINE</textPath>
  </text>
</svg>`;
}

/**
 * Build a minimal ASCII STL file for a mascot figure placeholder.
 * Players can open this in any slicer (Cura, PrusaSlicer) as a base template.
 * Each mascot gets a labelled flat disc - a starting point for remixing.
 */
function buildMascotSTL(mascotName, mascotEmoji) {
  // Flat cylinder approximated as a 16-sided prism (printable coaster/token shape)
  const R = 20, H = 3, SIDES = 16;
  const triangles = [];
  for (let i = 0; i < SIDES; i++) {
    const a0 = (i / SIDES) * 2 * Math.PI;
    const a1 = ((i + 1) / SIDES) * 2 * Math.PI;
    const x0 = R * Math.cos(a0), y0 = R * Math.sin(a0);
    const x1 = R * Math.cos(a1), y1 = R * Math.sin(a1);
    // Top face
    triangles.push(`  facet normal 0 0 1\n    outer loop\n      vertex 0 0 ${H}\n      vertex ${x0.toFixed(4)} ${y0.toFixed(4)} ${H}\n      vertex ${x1.toFixed(4)} ${y1.toFixed(4)} ${H}\n    endloop\n  endfacet`);
    // Bottom face
    triangles.push(`  facet normal 0 0 -1\n    outer loop\n      vertex 0 0 0\n      vertex ${x1.toFixed(4)} ${y1.toFixed(4)} 0\n      vertex ${x0.toFixed(4)} ${y0.toFixed(4)} 0\n    endloop\n  endfacet`);
    // Side face (two triangles)
    triangles.push(`  facet normal ${Math.cos((a0+a1)/2).toFixed(4)} ${Math.sin((a0+a1)/2).toFixed(4)} 0\n    outer loop\n      vertex ${x0.toFixed(4)} ${y0.toFixed(4)} 0\n      vertex ${x1.toFixed(4)} ${y1.toFixed(4)} 0\n      vertex ${x1.toFixed(4)} ${y1.toFixed(4)} ${H}\n    endloop\n  endfacet`);
    triangles.push(`  facet normal ${Math.cos((a0+a1)/2).toFixed(4)} ${Math.sin((a0+a1)/2).toFixed(4)} 0\n    outer loop\n      vertex ${x0.toFixed(4)} ${y0.toFixed(4)} 0\n      vertex ${x1.toFixed(4)} ${y1.toFixed(4)} ${H}\n      vertex ${x0.toFixed(4)} ${y0.toFixed(4)} ${H}\n    endloop\n  endfacet`);
  }
  return `solid jvds_${mascotName.toLowerCase()}_token\n` + triangles.join('\n') + `\nendsolid jvds_${mascotName.toLowerCase()}_token`;
}

/** Trigger STL download */
function downloadSTL(stlContent, filename) {
  const blob = new Blob([stlContent], { type: 'model/stl' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger SVG download */
function downloadSVG(svgContent, filename) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Check if the player has just hit a printable milestone.
 * Call this from app.js after addXP / levelUp.
 * @param {number} newLevel
 * @param {number} prevLevel
 */
export function checkPrintableUnlock(newLevel, prevLevel) {
  if (prevLevel < 5 && newLevel >= 5) {
    showPrintablePopup({
      title: 'Level 5 Unlocked!',
      body:  'You earned a printable mascot sticker sheet. Print it, cut out your favourites, and stick them everywhere.',
      btnLabel: '🖨️ Download Sticker Sheet',
      onDownload: () => downloadSVG(buildStickerSheetSVG(), 'jvds-sticker-sheet.svg'),
    });
  }
  if (prevLevel < 10 && newLevel >= 10) {
    showPrintablePopup({
      title: 'Level 10 Unlocked!',
      body:  'You earned a heat-transfer shirt design. Take it to a print shop or iron it on yourself.',
      btnLabel: '🎽 Download Shirt Design',
      onDownload: () => downloadSVG(buildShirtDesignSVG(), 'jvds-shirt-design.svg'),
    });
  }
  if (prevLevel < 15 && newLevel >= 15) {
    showPrintablePopup({
      title: 'Level 15 Unlocked!',
      body:  'You earned a 3D printable mascot token template. Open it in any slicer (Cura, PrusaSlicer) and print your own Lumo figure.',
      btnLabel: '🖨️ Download 3D Token (STL)',
      onDownload: () => downloadSTL(buildMascotSTL('Lumo', '🦊'), 'jvds-lumo-token.stl'),
    });
  }
}

function showPrintablePopup({ title, body, btnLabel, onDownload }) {
  document.getElementById('jvds-printable-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'jvds-printable-popup';
  popup.style.cssText = `
    position:fixed;inset:0;z-index:13000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.8);backdrop-filter:blur(4px);
  `;
  popup.innerHTML = `
    <div style="
      background:#1a1a1a;border:2px solid #f39c12;border-radius:14px;
      padding:2.5rem;max-width:400px;text-align:center;
      font-family:var(--font-body,sans-serif);color:#F0EAD6;
    ">
      <div style="font-size:3rem;margin-bottom:.75rem">🎉</div>
      <h2 style="font-family:var(--font-heading,'Fredoka'),sans-serif;color:#f39c12;margin:0 0 .75rem">${title}</h2>
      <p style="font-size:.88rem;color:#b0a898;line-height:1.6;margin:0 0 1.5rem">${body}</p>
      <button id="printable-dl-btn" style="
        background:#f39c12;color:#000;border:none;border-radius:8px;
        padding:.65rem 1.5rem;font-size:.9rem;font-weight:700;cursor:pointer;
        font-family:inherit;display:block;width:100%;margin-bottom:.75rem;
      ">${btnLabel}</button>
      <button id="printable-close-btn" style="
        background:none;border:none;color:#524c42;font-size:.8rem;
        cursor:pointer;font-family:inherit;
      ">Close</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('printable-dl-btn').onclick   = () => { onDownload(); };
  document.getElementById('printable-close-btn').onclick = () => popup.remove();
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
}
