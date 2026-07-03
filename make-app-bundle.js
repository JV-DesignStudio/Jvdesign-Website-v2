// make-app-bundle.js
// Creates a clean deployable folder (quest-board-deploy/) ready for:
//   1. Netlify drag-and-drop deploy
//   2. PWABuilder submission to Google Play
//
// RUN: node make-app-bundle.js
// BEFORE RUNNING: Open icon-generator.html in your browser and download
//   both icons into F:\Website\Jvdesign-Website-v2\icons\

'use strict';
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DEST = path.join(__dirname, 'quest-board-deploy');

// ── Helpers ──────────────────────────────────────────────────────────────────
function mkdir(p){ if(!fs.existsSync(p))fs.mkdirSync(p,{recursive:true}); }
function copy(src,dst){ fs.copyFileSync(src,dst); console.log('  copied',path.basename(src)); }
function write(dst,content){ fs.writeFileSync(dst,content,'utf8'); console.log('  wrote',path.basename(dst)); }
function fileExists(p){ try{fs.statSync(p);return true;}catch{return false;} }

console.log('\n⚔️  Building Quest Board app bundle...\n');

// ── Create folder structure ──────────────────────────────────────────────────
mkdir(DEST);
mkdir(path.join(DEST,'icons'));
mkdir(path.join(DEST,'.well-known'));
mkdir(path.join(DEST,'screenshots'));

// ── Copy core files ───────────────────────────────────────────────────────────
console.log('Core files:');

// quest-board.html → index.html (the app itself)
let app = fs.readFileSync(path.join(SRC,'quest-board.html'),'utf8');
// Update sw.js path to be relative
app = app.replace(/register\('\/sw\.js'\)/g, "register('/sw.js')");
// Update manifest link (already correct)
write(path.join(DEST,'index.html'), app);

copy(path.join(SRC,'manifest.json'),  path.join(DEST,'manifest.json'));
copy(path.join(SRC,'sw.js'),          path.join(DEST,'sw.js'));
copy(path.join(SRC,'privacy-policy.html'), path.join(DEST,'privacy-policy.html'));

// ── Icons ─────────────────────────────────────────────────────────────────────
console.log('\nIcons:');
const icons = ['icon-192.png','icon-512.png'];
let iconsMissing = false;
icons.forEach(icon => {
  const src = path.join(SRC,'icons',icon);
  if(fileExists(src)){
    copy(src, path.join(DEST,'icons',icon));
  } else {
    console.log('  ⚠️  MISSING: icons/'+icon+', open icon-generator.html and download it first!');
    iconsMissing = true;
  }
});

// ── Screenshots (optional but good for Play Store) ────────────────────────────
console.log('\nScreenshots (optional):');
const shots = ['dashboard.png','board.png'];
mkdir(path.join(DEST,'screenshots'));
shots.forEach(s => {
  const src = path.join(SRC,'screenshots',s);
  if(fileExists(src)){
    copy(src, path.join(DEST,'screenshots',s));
  } else {
    console.log('  (missing: screenshots/'+s+', add manually for a better Play Store listing)');
  }
});

// ── Digital Asset Links (fill in after getting your Play Console SHA) ─────────
console.log('\nDigital Asset Links:');
const assetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.jvdesignstudio.questboard',  // change to your actual package name
      sha256_cert_fingerprints: [
        'PASTE_YOUR_SHA256_FINGERPRINT_HERE'           // from Google Play Console after first upload
      ]
    }
  }
];
write(
  path.join(DEST,'.well-known','assetlinks.json'),
  JSON.stringify(assetLinks, null, 2)
);
console.log('  NOTE: Update the SHA256 fingerprint after your first Play Console upload');

// ── Netlify config (removes need for _redirects workarounds) ──────────────────
write(path.join(DEST,'_redirects'), [
  '/quest-board  /index.html  200',
  '/app          /index.html  200',
].join('\n'));

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────');

if(iconsMissing){
  console.log('\n⚠️  ICONS MISSING, do this first:');
  console.log('  1. Open icon-generator.html in your browser');
  console.log('  2. Click "Download icon-512.png" and "Download icon-192.png"');
  console.log('  3. Put both files into: F:\\Website\\Jvdesign-Website-v2\\icons\\');
  console.log('  4. Run this script again\n');
} else {
  console.log('\n✅ Bundle ready at: quest-board-deploy/\n');
  console.log('NEXT STEPS:');
  console.log('');
  console.log('  STEP 1, Deploy to Netlify:');
  console.log('    → Go to netlify.com → "Add new site" → "Deploy manually"');
  console.log('    → Drag the quest-board-deploy/ FOLDER onto the drop zone');
  console.log('    → You get a URL like: https://random-name.netlify.app');
  console.log('    → (Optional) Buy questboard.app on Namecheap, connect in Netlify settings)');
  console.log('');
  console.log('  STEP 2, Test your PWA:');
  console.log('    → Open https://pagespeed.web.dev and enter your Netlify URL');
  console.log('    → Need Lighthouse PWA score of 80+ for Play Store');
  console.log('');
  console.log('  STEP 3, Generate Play Store bundle:');
  console.log('    → Go to pwabuilder.com');
  console.log('    → Enter your Netlify URL');
  console.log('    → Click "Package for stores" → "Google Play"');
  console.log('    → Download the generated .aab file');
  console.log('');
  console.log('  STEP 4, Google Play Console:');
  console.log('    → play.google.com/console → Create app');
  console.log('    → One-time $25 developer fee');
  console.log('    → Upload the .aab from Step 3');
  console.log('    → Copy the SHA256 fingerprint from the Console');
  console.log('    → Paste it into quest-board-deploy/.well-known/assetlinks.json');
  console.log('    → Redeploy to Netlify');
  console.log('    → Submit for review (usually 3-7 days)');
  console.log('');
  console.log('  TOTAL COST: $25 one-time (Google Play fee) + ~£10/yr domain (optional)');
}

// List the bundle contents
console.log('\nBundle contents:');
function listDir(dir, prefix=''){
  fs.readdirSync(dir).forEach(f=>{
    const full=path.join(dir,f);
    const stat=fs.statSync(full);
    if(stat.isDirectory()) listDir(full,prefix+'  '+f+'/');
    else console.log('  '+prefix+f+' ('+Math.round(stat.size/1024)+'KB)');
  });
}
listDir(DEST);
console.log('─────────────────────────────────────────────────────────────\n');
