// Global (IIFE) build of Three.js r160 for the classic-script 3D builders.
// Bundled with esbuild into build/three.global.js, which sets window.THREE so
// the builders keep working unchanged (they expect a global THREE plus
// THREE.GLTFExporter). Rebuild with:
//   node_modules/.bin/esbuild assets/vendor/three-0.160.0/three-global.entry.js \
//     --bundle --format=iife --minify --outfile=assets/vendor/three-0.160.0/build/three.global.js
import * as ThreeNS from './build/three.module.js';
import { GLTFExporter } from './examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from './examples/jsm/loaders/OBJLoader.js';

// The ESM namespace object is immutable, so copy it into a plain object that we
// can extend with the addon exporters the builders expect on THREE.
const THREE = Object.assign({}, ThreeNS);
THREE.GLTFExporter = GLTFExporter;
THREE.OBJLoader = OBJLoader;
globalThis.THREE = THREE;
