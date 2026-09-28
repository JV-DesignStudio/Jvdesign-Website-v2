/* JVExporter, shared 3D export for every JVDS 3D builder.
   Loaded as ../workshops/jv-exporter.js from workshops/*-builder.html.

   HOUSE RULE, taken from the learners: whatever they built on the page is what
   they get. So this module never silently rescales, re-pivots, merges or
   renames anything. It bakes the world transform the builder authored, keeps
   the part names the builder gave its meshes, and writes the builder's native
   units into the file. The two things it will change are opt-in and labelled:
     pivotToBase  moves the model so it sits on min-Y = 0 (translation only)
     units        only ever used as a label, never as a conversion factor

   Formats: OBJ (+MTL), GLB, STL (ASCII), FBX (ASCII 7.4).
   Axes: the data is Y-up (Three.js native) and every writer declares Y-up, so
   no importer rotates the model. UnitScaleFactor is 1.0 on purpose, which keeps
   FBX at exactly the same scale as OBJ and GLB instead of FBX's usual cm.
*/
(function (global) {
  'use strict';

  /* ---------- small helpers ---------- */

  function round(n, p) {
    var f = Math.pow(10, p);
    var v = Math.round(n * f) / f;
    if (Object.is) { if (Object.is(v, -0)) v = 0; }
    else if (v === 0) { v = 0; }
    return v;
  }

  // Shortest sensible text for an FBX/OBJ number: fixed precision, no trailing
  // zeros, no exponent. Keeps ASCII FBX from doubling in size for nothing.
  function num(n, p) {
    if (!isFinite(n)) n = 0;
    var s = round(n, p === undefined ? 5 : p).toFixed(p === undefined ? 5 : p);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  function safeName(s, fallback) {
    var t = String(s == null ? '' : s).replace(/[\r\n\t"]+/g, ' ').replace(/\s+/g, '_').trim();
    if (!t) t = fallback || 'part';
    return t;
  }

  function fileSafe(s, fallback) {
    var t = String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return t || (fallback || 'model');
  }

  function colOf(mat) {
    if (!mat) return { r: 0.5, g: 0.5, b: 0.5, opacity: 1, metalness: 0, roughness: 0.6, transparent: false };
    var c = mat.color;
    return {
      r: c ? c.r : 0.5,
      g: c ? c.g : 0.5,
      b: c ? c.b : 0.5,
      opacity: mat.opacity != null ? mat.opacity : 1,
      metalness: mat.metalness != null ? mat.metalness : 0,
      roughness: mat.roughness != null ? mat.roughness : 0.6,
      transparent: !!mat.transparent
    };
  }

  /* ---------- collect ----------
     Walks the builder's group, bakes matrixWorld into a clone of each geometry
     and returns flat triangle data. Nothing is moved or resized. */

  function collect(root, opts) {
    opts = opts || {};
    if (!root) throw new Error('JVExporter: nothing built yet.');
    var units = opts.units === 'mm' ? 'mm' : 'm';
    // opts.name is the name the learner typed, so it has to win over the
    // group name, which is only an internal label like "castle".
    var model = (opts.name || root.name || 'model');

    var parts = [];
    var min = [Infinity, Infinity, Infinity];
    var max = [-Infinity, -Infinity, -Infinity];
    var tris = 0, verts = 0;

    root.updateWorldMatrix(true, true);

    root.traverse(function (node) {
      if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
      // Skip anything the builder itself has flagged as not part of the model
      // (helper grids, ground planes, glow shells used only for the preview).
      if (node.userData && node.userData.jvExcludeFromExport) return;

      var g = node.geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(node.matrixWorld);

      var pos = g.attributes.position;
      var nor = g.attributes.normal;
      var uv = g.attributes.uv || null;
      var idx = g.index;

      // Flatten to triangles. Three's primitives are already triangles; if a
      // builder ever hands us a polygon we fan it rather than emit garbage.
      var ti = [];
      if (idx) {
        for (var i = 0; i < idx.count; i++) ti.push(idx.getX(i));
        if (ti.length % 3 !== 0) ti = fanTriangles(pos.count);
      } else {
        ti = fanTriangles(pos.count);
      }

      var P = new Float32Array(ti.length * 3);
      var N = new Float32Array(ti.length * 3);
      var U = new Float32Array(ti.length * 2);
      var hasUV = !!uv;
      for (var t = 0; t < ti.length; t++) {
        var vi = ti[t];
        var x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
        P[t * 3] = x; P[t * 3 + 1] = y; P[t * 3 + 2] = z;
        N[t * 3] = nor.getX(vi); N[t * 3 + 1] = nor.getY(vi); N[t * 3 + 2] = nor.getZ(vi);
        if (hasUV) { U[t * 2] = uv.getX(vi); U[t * 2 + 1] = uv.getY(vi); }
        if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
        if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
        if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
      }

      var mat = node.material;
      if (Array.isArray(mat)) mat = mat[0];
      var col = colOf(mat);

      parts.push({
        name: safeName(node.name, 'part_' + parts.length),
        authored: !!(node.name && String(node.name).trim()),
        P: P, N: N, U: U, hasUV: hasUV,
        colour: col
      });
      tris += ti.length / 3;
      verts += pos.count;
      g.dispose();
    });

    if (!parts.length) throw new Error('JVExporter: no mesh parts found in the build.');

    var size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    var centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];

    // Opt-in only. Translation, never scale, so the model keeps its proportions.
    var offset = [0, 0, 0];
    if (opts.pivotToBase) offset = [-centre[0], -min[1], -centre[2]];

    return {
      name: model,
      fileBase: fileSafe(model, 'model'),
      units: units,
      unitLabel: units === 'mm' ? 'millimetres' : 'metres',
      pivotToBase: !!opts.pivotToBase,
      offset: offset,
      parts: parts,
      min: min, max: max, size: size, centre: centre,
      stats: { parts: parts.length, triangles: tris, vertices: verts, named: parts.filter(function (p) { return p.authored; }).length }    };
  }

  function fanTriangles(count) {
    var out = [];
    for (var i = 0; i + 2 < count; i += 3) out.push(i, i + 1, i + 2);
    return out;
  }

  function applyOffset(m, i, offset) {
    return m[i] + offset[0] + ' ' + (m[i + 1] + offset[1]) + ' ' + (m[i + 2] + offset[2]);
  }

  function header(model, tool) {
    return [
      '; Exported from ' + tool + ' on jvdesignstudio.co.uk',
      '; Model: ' + model.name,
      '; Units: ' + model.unitLabel + ' (1 unit = 1 ' + (model.units === 'mm' ? 'mm' : 'm') + ')',
      '; Pivot: ' + (model.pivotToBase ? 'moved to base centre (chosen at export)' : 'as built on the page'),
      '; Triangles: ' + model.stats.triangles + ' across ' + model.stats.parts + ' parts',
      '; Nothing was rescaled, merged or renamed. These are the on-page units.'
    ].join('\n') + '\n';
  }

  /* ---------- OBJ + MTL ---------- */

  function obj(model, tool) {
    var name = model.fileBase;
    var out = header(model, tool || 'the 3D builder');
    out += 'mtllib ' + name + '.mtl\n';

    var mtl = header(model, tool || 'the 3D builder');
    var matName = {};
    var matList = [];
    var vOff = 1;

    for (var p = 0; p < model.parts.length; p++) {
      var part = model.parts[p];
      var c = part.colour;
      var key = [c.r, c.g, c.b, c.opacity].join(',');
      if (!matName[key]) {
        var mn = 'mat_' + matList.length;
        matName[key] = mn;
        matList.push({ name: mn, c: c });
      }

      var corners = part.P.length / 3;
      out += '\no ' + part.name + '\ng ' + part.name + '\nusemtl ' + matName[key] + '\n';
      for (var v = 0; v < corners; v++) {
        out += 'v ' + applyOffset(part.P, v * 3, model.offset) + '\n';
      }
      if (part.hasUV) {
        for (var u = 0; u < corners; u++) {
          out += 'vt ' + num(part.U[u * 2]) + ' ' + num(part.U[u * 2 + 1]) + '\n';
        }
      }
      for (var w = 0; w < corners; w++) {
        out += 'vn ' + num(part.N[w * 3]) + ' ' + num(part.N[w * 3 + 1]) + ' ' + num(part.N[w * 3 + 2]) + '\n';
      }
      // P is already flattened to triangle corners, so step three at a time.
      for (var f = 0; f + 2 < corners; f += 3) {
        var a = f + vOff, b = f + 1 + vOff, cc = f + 2 + vOff;
        out += part.hasUV
          ? 'f ' + a + '/' + a + '/' + a + ' ' + b + '/' + b + '/' + b + ' ' + cc + '/' + cc + '/' + cc + '\n'
          : 'f ' + a + '//' + a + ' ' + b + '//' + b + ' ' + cc + '//' + cc + '\n';
      }
      vOff += corners;
    }

    for (var mi = 0; mi < matList.length; mi++) {
      var m = matList[mi], cc2 = m.c;
      mtl += '\nnewmtl ' + m.name + '\n';
      mtl += 'Kd ' + num(cc2.r, 4) + ' ' + num(cc2.g, 4) + ' ' + num(cc2.b, 4) + '\n';
      mtl += 'Ka 0 0 0\n';
      mtl += 'Ks ' + num(0.15 + cc2.metalness * 0.4, 3) + ' ' + num(0.15 + cc2.metalness * 0.4, 3) + ' ' + num(0.15 + cc2.metalness * 0.4, 3) + '\n';
      mtl += 'Ns ' + num(Math.max(1, Math.round((1 - cc2.roughness) * 220)), 0) + '\n';
      mtl += 'Ni 1.45\n';
      mtl += 'illum 2\n';
      if (cc2.opacity < 1) mtl += 'd ' + num(cc2.opacity, 4) + '\n';
    }

    return { obj: out, mtl: mtl, name: name + '.obj', mtlName: name + '.mtl' };
  }

  /* ---------- STL (ASCII) ----------
     STL has no materials and no part names, so it is the one format where a
     named build cannot survive. The UI says so rather than pretending. */

  function stl(model, tool) {
    var out = model.name.replace(/\s+/g, '_');
    out = out.slice(0, 79);
    var body = '';
    for (var p = 0; p < model.parts.length; p++) {
      var part = model.parts[p];
      for (var t = 0; t < part.P.length / 9; t++) {
        var i = t * 9;
        var ax = part.P[i] + model.offset[0], ay = part.P[i + 1] + model.offset[1], az = part.P[i + 2] + model.offset[2];
        var bx = part.P[i + 3] + model.offset[0], by = part.P[i + 4] + model.offset[1], bz = part.P[i + 5] + model.offset[2];
        var cx = part.P[i + 6] + model.offset[0], cy = part.P[i + 7] + model.offset[1], cz = part.P[i + 8] + model.offset[2];
        var ux = bx - ax, uy = by - ay, uz = bz - az;
        var vx = cx - ax, vy = cy - ay, vz = cz - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len; ny /= len; nz /= len;
        body += '  facet normal ' + num(nx) + ' ' + num(ny) + ' ' + num(nz) + '\n    outer loop\n';
        body += '      vertex ' + num(ax) + ' ' + num(ay) + ' ' + num(az) + '\n';
        body += '      vertex ' + num(bx) + ' ' + num(by) + ' ' + num(bz) + '\n';
        body += '      vertex ' + num(cx) + ' ' + num(cy) + ' ' + num(cz) + '\n';
        body += '    endloop\n  endfacet\n';
      }
    }
    return { text: 'solid ' + out + '\n' + body + 'endsolid ' + out + '\n', name: model.fileBase + '.stl' };
  }

  /* ---------- GLB ----------
     Handed to Three's own GLTFExporter, so PBR, UVs and node names come out
     the way an engine expects. The opt-in pivot becomes a wrapper group with a
     translation, which keeps the original hierarchy untouched. */

  function glb(root, model, GLTFExporterCtor) {
    var Exporter = GLTFExporterCtor || (global.THREE && global.THREE.GLTFExporter);
    if (!Exporter) return Promise.reject(new Error('GLTF exporter not loaded yet. Try again in a moment.'));
    var sceneRoot = root;
    if (model.pivotToBase) {
      sceneRoot = new global.THREE.Group();
      sceneRoot.name = root.name || model.name;
      sceneRoot.position.set(model.offset[0], model.offset[1], model.offset[2]);
      sceneRoot.add(root);
      sceneRoot.updateMatrixWorld(true, true);
    }
    return new Promise(function (resolve, reject) {
      var exp = new Exporter();
      exp.parse(sceneRoot, function (result) {
        resolve({ buffer: result, name: model.fileBase + '.glb' });
      }, { binary: true, onlyVisible: false }, function (err) { reject(err || new Error('GLB export failed.')); });
    });
  }

  /* ---------- FBX (ASCII 7.4) ---------- */

  function fbx(model, tool) {
    var GEO = 100000, MOD = 200000, MAT = 300000;
    var lines = [];
    var matIndex = {};
    var mats = [];

    function matId(c) {
      var key = [c.r, c.g, c.b, c.opacity].join(',');
      if (matIndex[key] == null) {
        matIndex[key] = mats.length;
        mats.push(c);
      }
      return matIndex[key];
    }

    var geoIds = [];
    lines.push('; FBX 7.4.0 project file');
    lines.push('; ' + (tool || 'the 3D builder') + ' on jvdesignstudio.co.uk');
    lines.push('; Model: ' + model.name);
    lines.push('; Units: ' + model.unitLabel + ' (UnitScaleFactor 1.0 so FBX matches OBJ and GLB exactly)');
    lines.push('; Pivot: ' + (model.pivotToBase ? 'moved to base centre (chosen at export)' : 'as built on the page'));
    lines.push('; Triangles: ' + model.stats.triangles + ' across ' + model.stats.parts + ' named parts');
    lines.push('; Axes declared Y-up to match the data, so importers do not rotate the model.');
    lines.push('');
    lines.push('FBXHeaderExtension:  {');
    lines.push('\tFBXHeaderVersion: 1003');
    lines.push('\tFBXVersion: 7400');
    lines.push('\tCreator: "JVDesignStudio 3D Builder"');
    lines.push('}');
    lines.push('GlobalSettings:  {');
    lines.push('\tVersion: 1000');
    lines.push('\tProperties70:  {');
    lines.push('\t\tP: "UpAxis", "int", "Integer", "",1');
    lines.push('\t\tP: "UpAxisSign", "int", "Integer", "",1');
    lines.push('\t\tP: "FrontAxis", "int", "Integer", "",2');
    lines.push('\t\tP: "FrontAxisSign", "int", "Integer", "",-1');
    lines.push('\t\tP: "CoordAxis", "int", "Integer", "",0');
    lines.push('\t\tP: "CoordAxisSign", "int", "Integer", "",1');
    lines.push('\t\tP: "OriginalUpAxis", "int", "Integer", "",-1');
    lines.push('\t\tP: "OriginalUpAxisSign", "int", "Integer", "",1');
    lines.push('\t\tP: "OriginalFrontAxis", "int", "Integer", "",-1');
    lines.push('\t\tP: "OriginalFrontAxisSign", "int", "Integer", "",1');
    lines.push('\t\tP: "OriginalCoordAxis", "int", "Integer", "",-1');
    lines.push('\t\tP: "OriginalCoordAxisSign", "int", "Integer", "",1');
    lines.push('\t\tP: "UnitScaleFactor", "double", "Number", "",1');
    lines.push('\t}');
    lines.push('}');

    // Everything pushed from here to the end of the object loop is an FBX
    // object, and FBX ASCII only accepts those inside the Objects: block, so
    // the block is cut out again and re-inserted in the right place below.
    var objStart = lines.length;
    var conns = [];
    var usedMats = {};

    for (var p = 0; p < model.parts.length; p++) {
      var part = model.parts[p];
      var gid = GEO + p;
      var mid = MOD + p;
      var mi = matId(part.colour);
      usedMats[mi] = true;
      geoIds.push(gid);

      var vc = part.P.length / 3;
      var vlist = new Array(vc);
      for (var i = 0; i < vc; i++) vlist[i] = applyOffset(part.P, i * 3, model.offset);
      var nlist = new Array(vc);
      for (var j = 0; j < vc; j++) nlist[j] = num(part.N[j * 3]) + ' ' + num(part.N[j * 3 + 1]) + ' ' + num(part.N[j * 3 + 2]);

      lines.push('Geometry: ' + gid + ', "Geometry::' + part.name + '", "Mesh" {');
      lines.push('\tVertices: *' + (vc * 3) + ' {');
      lines.push('\t\ta: ' + vlist.join(','));
      lines.push('\t}');
      // FBX marks the final index of each polygon with its bitwise complement.
      var poly = new Array(vc);
      for (var k = 0; k < vc; k++) poly[k] = (k % 3 === 2) ? (~k) : k;
      lines.push('\tPolygonVertexIndex: *' + vc + ' {');
      lines.push('\t\ta: ' + poly.join(','));
      lines.push('\t}');
      lines.push('\tGeometryVersion: 124');
      lines.push('\tLayerElementNormal: 0 {');
      lines.push('\t\tVersion: 101');
      lines.push('\t\tName: ""');
      lines.push('\t\tMappingInformationType: "ByPolygonVertex"');
      lines.push('\t\tReferenceInformationType: "Direct"');
      lines.push('\t\tNormals: *' + (vc * 3) + ' {');
      lines.push('\t\ta: ' + nlist.join(','));
      lines.push('\t\t}');
      lines.push('\t}');
      lines.push('\tLayerElementMaterial: 0 {');
      lines.push('\t\tVersion: 101');
      lines.push('\t\tName: ""');
      lines.push('\t\tMappingInformationType: "AllSame"');
      lines.push('\t\tReferenceInformationType: "IndexToDirect"');
      lines.push('\t\tMaterials: *1 {');
      lines.push('\t\t\ta: ' + mi);
      lines.push('\t\t}');
      lines.push('\t}');
      if (part.hasUV) {
        var ul = new Array(vc);
        for (var u = 0; u < vc; u++) ul[u] = num(part.U[u * 2]) + ' ' + num(part.U[u * 2 + 1]);
        lines.push('\tLayerElementUV: 0 {');
        lines.push('\t\tVersion: 101');
        lines.push('\t\tName: "UVMap"');
        lines.push('\t\tMappingInformationType: "ByPolygonVertex"');
        lines.push('\t\tReferenceInformationType: "Direct"');
        lines.push('\t\tUV: *' + (vc * 2) + ' {');
        lines.push('\t\ta: ' + ul.join(','));
        lines.push('\t\t}');
        lines.push('\t}');
      }
      lines.push('\tLayer: 0 {');
      lines.push('\t\tVersion: 100');
      lines.push('\t\tLayerElement:  { Type: "LayerElementNormal", TypedIndex: 0 }');
      lines.push('\t\tLayerElement:  { Type: "LayerElementMaterial", TypedIndex: 0 }');
      if (part.hasUV) lines.push('\t\tLayerElement:  { Type: "LayerElementUV", TypedIndex: 0 }');
      lines.push('\t}');
      lines.push('}');

      lines.push('Model: ' + mid + ', "Model::' + part.name + '", "Mesh" {');
      lines.push('\tVersion: 232');
      lines.push('\tProperties70:  {');
      lines.push('\t\tP: "Lcl Translation", "Lcl Translation", "", "A",0,0,0');
      lines.push('\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0');
      lines.push('\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1');
      lines.push('\t}');
      lines.push('\tShading: T');
      lines.push('\tCulling: "CullingOff"');
      lines.push('}');

      conns.push('\tC: "OO",' + gid + ',' + mid);
      conns.push('\tC: "OO",' + mid + ',0');
    }

    var matIds = [];
    for (var mk in usedMats) {
      if (!Object.prototype.hasOwnProperty.call(usedMats, mk)) continue;
      var idx = parseInt(mk, 10);
      var c = mats[idx];
      var id = MAT + idx;
      matIds.push(id);
      lines.push('Material: ' + id + ', "Material::mat_' + idx + '", "" {');
      lines.push('\tVersion: 102');
      lines.push('\tShadingModel: "phong"');
      lines.push('\tMultiLayer: 0');
      lines.push('\tProperties70:  {');
      lines.push('\t\tP: "DiffuseColor", "Color", "", "A",' + num(c.r, 4) + ',' + num(c.g, 4) + ',' + num(c.b, 4));
      var sp = num(0.15 + c.metalness * 0.4, 3);
      lines.push('\t\tP: "SpecularColor", "Color", "", "A",' + sp + ',' + sp + ',' + sp);
      lines.push('\t\tP: "EmissiveColor", "Color", "", "A",0,0,0');
      lines.push('\t\tP: "TransparencyFactor", "double", "Number", "",' + num(c.opacity, 4));
      lines.push('\t\tP: "Shininess", "double", "Number", "",' + num(Math.max(1, Math.round((1 - c.roughness) * 220)), 0));
      lines.push('\t}');
      lines.push('}');
      for (var q = 0; q < model.parts.length; q++) {
        if (matId(model.parts[q].colour) === idx) conns.push('\tC: "OO",' + id + ',' + (MOD + q));
      }
    }

    var objBody = lines.splice(objStart);

    lines.push('Definitions:  {');
    lines.push('\tVersion: 100');
    lines.push('\tCount: ' + (model.parts.length * 2 + matIds.length));
    lines.push('\tObjectType: "GlobalSettings" { Count: 1 }');
    lines.push('\tObjectType: "Geometry" { Count: ' + model.parts.length + ' }');
    lines.push('\tObjectType: "Model" { Count: ' + model.parts.length + ' }');
    lines.push('\tObjectType: "Material" { Count: ' + matIds.length + ' }');
    lines.push('}');

    lines.push('Objects:  {');
    lines.push(objBody.join('\n'));
    lines.push('}');
    lines.push('');
    lines.push('Connections:  {');
    lines.push(conns.join('\n'));
    lines.push('}');

    return { text: lines.join('\n') + '\n', name: model.fileBase + '.fbx' };
  }

  /* ---------- public helpers ---------- */

  function download(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // Filename carries the unit so a folder of exports is never ambiguous.
  function tagged(model, ext) {
    return model.fileBase + '__' + model.units + '.' + ext;
  }

  function summary(model) {
    var s = model.stats;
    return {
      parts: s.parts,
      named: s.named,
      triangles: s.triangles,
      corners: s.vertices,
      units: model.units,
      unitLabel: model.unitLabel,
      pivotToBase: model.pivotToBase,
      size: model.size.map(function (n) { return round(n, 2); }),
      // minY as authored, and minY as it will land in the file once the
      // opt-in pivot shift is applied. The UI shows both so nobody is
      // surprised by a model sitting below the floor.
      minYAsBuilt: round(model.min[1], 3),
      minYInFile: round(model.min[1] + model.offset[1], 3)
    };
  }

  /* ---------- shared export UI ----------
     One Export button and one dialog, byte-for-byte the same on every builder.
     A builder calls installUI() with where its model lives and nothing else;
     the dialog reads the live group every time it opens, so what the learner
     is looking at is always what leaves the page. */

  var UI = null;
  var STYLE_ID = 'jv-export-style';

  var FORMATS = [
    { id: 'obj', icon: '&#8681;', label: 'OBJ + MTL', sub: 'Blender, Tinkercad import' },
    { id: 'glb', icon: '&#128230;', label: 'GLB', sub: 'Unity, Godot, Roblox Studio' },
    { id: 'fbx', icon: '&#127916;', label: 'FBX', sub: 'Unreal, Blender, Maya' },
    { id: 'stl', icon: '&#128424;', label: 'STL', sub: '3D printing (shape only)' },
    { id: 'png', icon: '&#128444;', label: 'PNG', sub: 'A picture of your build', needsPng: true }
  ];

  function fmtNum(n) {
    var r = Math.round(n * 100) / 100;
    return Object.is(r, -0) ? '0' : String(r);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.jv-x-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}',
      '.jv-export-backdrop{position:fixed;inset:0;background:rgba(4,6,12,.78);backdrop-filter:blur(5px);z-index:400;display:flex;align-items:center;justify-content:center;padding:18px}',
      '.jv-export-sheet{width:min(560px,100%);max-height:90vh;overflow:auto;background:linear-gradient(150deg,#12162a,#0a0d18);border:1px solid rgba(120,140,255,.28);border-radius:16px;padding:20px 22px 22px;box-shadow:0 26px 70px rgba(0,0,0,.6);color:#e7ecff;font:400 14px/1.5 Inter,system-ui,sans-serif}',
      '.jv-export-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}',
      '.jv-export-head h2{margin:0;font:700 1.15rem/1.2 Bebas Neue,Inter,sans-serif;letter-spacing:.06em;color:var(--jv-acc,#8ea8ff)}',
      '.jv-export-x{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#cfd8ff;border-radius:8px;width:30px;height:30px;font-size:.9rem;cursor:pointer;line-height:1}',
      '.jv-export-x:hover{background:rgba(255,255,255,.15)}',
      '.jv-export-rule{margin:0 0 12px;font-size:.78rem;color:#9fb0e0;border-left:3px solid var(--jv-acc,#8ea8ff);padding-left:9px}',
      '.jv-export-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin-bottom:12px}',
      '.jv-fact{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:7px 9px}',
      '.jv-fact b{display:block;font:700 1.02rem/1.15 Bebas Neue,Inter,sans-serif;color:#fff;letter-spacing:.03em}',
      '.jv-fact span{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.09em;color:#8fa2d4;margin-top:2px}',
      '.jv-export-pivot{display:flex;gap:8px;align-items:flex-start;font-size:.79rem;color:#c3cdf0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:9px 11px;margin-bottom:13px;cursor:pointer}',
      '.jv-export-pivot input{margin-top:2px;accent-color:var(--jv-acc,#8ea8ff)}',
      '.jv-export-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}',
      '.jv-fmt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:#eef2ff;cursor:pointer;font:600 .85rem/1.2 Inter,system-ui,sans-serif}',
      '.jv-fmt:hover:not(:disabled){background:rgba(255,255,255,.13);border-color:var(--jv-acc,#8ea8ff);transform:translateY(-1px)}',
      '.jv-fmt:disabled{opacity:.4;cursor:not-allowed}',
      '.jv-fmt i{font-style:normal;font-size:1.05rem}',
      '.jv-fmt u{text-decoration:none;font-weight:400;font-size:.7rem;color:#9db0e2}',
      '.jv-export-status{min-height:20px;margin-top:12px;font-size:.79rem;color:var(--jv-acc,#a9c0ff)}',
      '@media(max-width:480px){.jv-export-grid{grid-template-columns:repeat(auto-fit,minmax(124px,1fr))}}'
    ].join('');
    document.head.appendChild(s);
  }

  function mountButton() {
    if (!UI || UI.buttonMounted) return;
    var host = null;
    var sel = UI.mount || '.hdr-right, .hdr-btns, .hb';
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].offsetParent !== null || nodes[i].getClientRects().length) { host = nodes[i]; break; }
    }
    if (!host && nodes.length) host = nodes[0];
    if (!host) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jv-x-btn' + (host.classList.contains('hdr-right') ? ' quick-btn' : '');
    b.setAttribute('data-jv-export', '1');
    b.title = 'Download exactly what you built, as OBJ, GLB, FBX or STL';
    b.innerHTML = '&#8681; Export';
    if (host.classList.contains('hdr-right')) {
      b.style.cssText = 'background:linear-gradient(135deg,#2d6a4f,#1a4035);box-shadow:0 3px 0 #0d2e24;color:#fff';
    }
    b.addEventListener('click', function (e) { e.preventDefault(); openDialog(); });
    host.appendChild(b);
    UI.buttonMounted = true;
  }

  function root() { return UI && UI.getGroup ? UI.getGroup() : null; }

  function modelOf(pivot) {
    var g = root();
    if (!g) throw new Error('Nothing to export yet - build something first.');
    return collect(g, {
      units: (UI && UI.units) || 'm',
      pivotToBase: !!pivot,
      name: (UI && UI.getName ? UI.getName() : '') || (UI && UI.tool) || 'model'
    });
  }

  function factsHTML(model) {
    var s = summary(model);
    var cells = [
      [s.parts, 'parts'],
      [s.triangles, 'triangles'],
      [fmtNum(s.size[0]) + ' \u00d7 ' + fmtNum(s.size[1]) + ' \u00d7 ' + fmtNum(s.size[2]), 'size in ' + s.units],
      ['1 unit = 1 ' + (s.units === 'mm' ? 'mm' : 'm'), 'units as built']
    ];
    var html = '';
    for (var i = 0; i < cells.length; i++) {
      html += '<div class="jv-fact"><b>' + cells[i][0] + '</b><span>' + cells[i][1] + '</span></div>';
    }
    return html;
  }

  function buildSheet() {
    var back = document.createElement('div');
    back.className = 'jv-export-backdrop';
    back.id = 'jvExportBackdrop';
    back.innerHTML =
      '<div class="jv-export-sheet" role="dialog" aria-modal="true" aria-labelledby="jvExportTitle">' +
        '<div class="jv-export-head">' +
          '<h2 id="jvExportTitle">&#8681; Export your ' + ((UI && UI.tool) || 'model') + '</h2>' +
          '<button class="jv-export-x" type="button" aria-label="Close export">&#10005;</button>' +
        '</div>' +
        '<p class="jv-export-rule">Exactly what is on screen. Same parts, same names, same size - nothing rescaled, merged or renamed.</p>' +
        '<div class="jv-export-facts" id="jvExportFacts"></div>' +
        '<label class="jv-export-pivot"><input type="checkbox" id="jvPivotToggle">' +
          '<span>Sit it flat on the floor (moves the pivot to the base centre - a nudge, never a resize)</span></label>' +
        '<div class="jv-export-grid" id="jvExportGrid"></div>' +
        '<div class="jv-export-status" id="jvExportStatus" aria-live="polite"></div>' +
      '</div>';
    back.querySelector('.jv-export-x').addEventListener('click', closeDialog);
    back.addEventListener('mousedown', function (e) { if (e.target === back) closeDialog(); });
    back.querySelector('#jvPivotToggle').addEventListener('change', refreshFacts);
    document.body.appendChild(back);

    var grid = back.querySelector('#jvExportGrid');
    for (var i = 0; i < FORMATS.length; i++) {
      (function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'jv-fmt';
        b.dataset.fmt = f.id;
        b.innerHTML = '<i>' + f.icon + '</i>' + f.label + '<u>' + f.sub + '</u>';
        b.addEventListener('click', function () { runFormat(f.id); });
        grid.appendChild(b);
      })(FORMATS[i]);
    }
    refreshFacts();
    return back;
  }

  function refreshFacts() {
    var back = document.getElementById('jvExportBackdrop');
    if (!back) return;
    var facts = back.querySelector('#jvExportFacts');
    var pivot = back.querySelector('#jvPivotToggle');
    var btns = back.querySelectorAll('.jv-fmt');
    var status = back.querySelector('#jvExportStatus');
    var model = null, err = null;
    try { model = modelOf(pivot && pivot.checked); } catch (e) { err = e.message || String(e); }

    if (!model) {
      facts.innerHTML = '<div class="jv-fact"><b>&#8212;</b><span>nothing built yet</span></div>';
      status.textContent = err || 'Build something first.';
      for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
      return;
    }
    for (var j = 0; j < btns.length; j++) {
      btns[j].disabled = !!(FORMATS[j].needsPng && !(UI && UI.png));
    }
    facts.innerHTML = factsHTML(model);
    status.textContent = model.name + ' \u00b7 ' + (summary(model).minYAsBuilt === 0
      ? 'already sitting on the floor'
      : 'sits at Y ' + summary(model).minYAsBuilt + ' as built');
  }

  function say(msg) {
    var back = document.getElementById('jvExportBackdrop');
    if (back) { var s = back.querySelector('#jvExportStatus'); if (s) s.textContent = msg; }
    if (UI && UI.say) { try { UI.say(msg); } catch (e) { /* status line is optional */ } }
  }

  function runFormat(format) {
    var pivotBox = document.getElementById('jvPivotToggle');
    var model;
    try { model = modelOf(pivotBox && pivotBox.checked); }
    catch (e) { say(e.message || String(e)); return; }
    var tool = (UI && UI.tool) || 'the 3D builder';
    say('Preparing ' + format.toUpperCase() + '\u2026');
    try {
      if (format === 'obj') {
        var r = obj(model, tool);
        download(tagged(model, 'obj'), new Blob([r.obj], { type: 'text/plain' }));
        setTimeout(function () { download(tagged(model, 'mtl'), new Blob([r.mtl], { type: 'text/plain' })); }, 300);
        say('Downloaded ' + tagged(model, 'obj') + ' + .mtl. Import both together in Blender.');
      } else if (format === 'stl') {
        var s = stl(model, tool);
        download(tagged(model, 'stl'), new Blob([s.text], { type: 'text/plain' }));
        say('Downloaded ' + tagged(model, 'stl') + ' for 3D printing. STL keeps the shape, not the colours.');
      } else if (format === 'fbx') {
        var f = fbx(model, tool);
        download(tagged(model, 'fbx'), new Blob([f.text], { type: 'application/octet-stream' }));
        say('Downloaded ' + tagged(model, 'fbx') + '. Y-up, 1 unit = 1 ' + (model.units === 'mm' ? 'mm' : 'm') + '.');
      } else if (format === 'png') {
        if (!UI || !UI.png) { say('PNG is not available in this builder.'); return; }
        UI.png();
        say('Picture downloaded.');
      } else {
        glb(root(), model).then(function (r) {
          download(tagged(model, 'glb'), new Blob([r.buffer], { type: 'application/octet-stream' }));
          say('Downloaded ' + tagged(model, 'glb') + '. Best all-rounder for engines.');
        }, function (e) {
          say('GLB export failed: ' + (e && e.message ? e.message : 'unknown error'));
        });
      }
      if (UI && UI.track) { try { UI.track('export', { format: format }); } catch (e) { /* analytics optional */ } }
    } catch (e) {
      say('Export failed: ' + (e && e.message ? e.message : e));
    }
  }

  function openDialog() {
    ensureStyle();
    if (!document.getElementById('jvExportBackdrop')) buildSheet();
    var back = document.getElementById('jvExportBackdrop');
    back.style.display = 'flex';
    refreshFacts();
    var x = back.querySelector('.jv-export-x');
    if (x) x.focus();
  }

  function closeDialog() {
    var back = document.getElementById('jvExportBackdrop');
    if (back) back.style.display = 'none';
  }

  function installUI(cfg) {
    UI = cfg || {};
    if (UI.accent) {
      document.documentElement.style.setProperty('--jv-acc', UI.accent);
    }
    ensureStyle();
    // The header can render after this script, so give the DOM a moment.
    mountButton();
    if (!UI.buttonMounted) setTimeout(mountButton, 300);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDialog();
    });
    if (UI.ready) { try { UI.ready(); } catch (e) { /* optional handshake */ } }
    return true;
  }

  // One entry point. No argument opens the dialog; a format exports straight
  // through, which is what the older per-builder buttons call.
  global.jvExport = function (format) {
    if (!UI) UI = {};
    if (format) { runFormat(String(format).toLowerCase()); return; }
    openDialog();
  };

  global.JVExporter = {
    collect: collect,
    obj: obj,
    stl: stl,
    glb: glb,
    fbx: fbx,
    download: download,
    tagged: tagged,
    summary: summary,
    fileSafe: fileSafe,
    installUI: installUI,
    openDialog: openDialog,
    exportFormat: runFormat,
    version: '1.1.0'
  };
})(typeof window !== 'undefined' ? window : this);
