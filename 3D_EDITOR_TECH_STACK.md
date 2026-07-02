# 🛠️ 3D Voxel Editor - Technical Architecture

**Technology Stack & Implementation Details**

---

## 📦 Core Libraries

### Three.js (3D Rendering)
```javascript
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
scene.add(ambientLight, directionalLight);

// Rendering loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

**Why Three.js:**
- Battle-tested, large community
- Easy mesh generation
- Built-in camera controls
- Good export/import support
- Runs in browser

---

## 🧊 Voxel Grid System

### Data Structure
```javascript
class VoxelGrid {
  constructor(width = 32, height = 32, depth = 32) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    
    // Use Map for sparse storage (not all voxels are filled)
    this.voxels = new Map(); // key: "x,y,z" → value: {color, material}
  }
  
  // Core operations
  set(x, y, z, voxel) {
    if (this.isInBounds(x, y, z)) {
      const key = `${x},${y},${z}`;
      this.voxels.set(key, voxel);
      return true;
    }
    return false;
  }
  
  get(x, y, z) {
    const key = `${x},${y},${z}`;
    return this.voxels.get(key) || null;
  }
  
  delete(x, y, z) {
    const key = `${x},${y},${z}`;
    this.voxels.delete(key);
  }
  
  isInBounds(x, y, z) {
    return x >= 0 && x < this.width &&
           y >= 0 && y < this.height &&
           z >= 0 && z < this.depth;
  }
  
  // Get all neighbors
  getNeighbors(x, y, z) {
    const dirs = [
      [1,0,0], [-1,0,0],
      [0,1,0], [0,-1,0],
      [0,0,1], [0,0,-1]
    ];
    return dirs.map(([dx,dy,dz]) => 
      this.get(x+dx, y+dy, z+dz)
    );
  }
  
  // Check if voxel is visible (has empty neighbor)
  isVisible(x, y, z) {
    const neighbors = this.getNeighbors(x, y, z);
    return neighbors.some(n => n === null);
  }
}
```

**Why this design:**
- Sparse storage (efficient memory)
- Fast lookups (O(1) with Map)
- Easy visibility culling
- Simple to serialize/save

---

## 🎨 Mesh Generation

### Greedy Meshing Algorithm
```javascript
class VoxelMesh {
  static generateMesh(grid) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    const indices = [];
    
    let vertexIndex = 0;
    
    // Iterate through all voxels
    grid.voxels.forEach((voxel, key) => {
      const [x, y, z] = key.split(',').map(Number);
      
      // Only process visible voxels
      if (!grid.isVisible(x, y, z)) return;
      
      // For each face, check if neighbor exists
      const faces = [
        { normal: [1,0,0], plane: 'x' },   // right
        { normal: [-1,0,0], plane: 'x' },  // left
        { normal: [0,1,0], plane: 'y' },   // top
        { normal: [0,-1,0], plane: 'y' },  // bottom
        { normal: [0,0,1], plane: 'z' },   // front
        { normal: [0,0,-1], plane: 'z' }   // back
      ];
      
      faces.forEach((face, i) => {
        const [nx, ny, nz] = face.normal;
        
        // Check if neighbor exists
        if (grid.get(x+nx, y+ny, z+nz) === null) {
          // Add face to mesh
          const faceVertices = this.getFaceVertices(x, y, z, i);
          this.addFace(vertices, colors, indices, 
                       faceVertices, voxel.color, vertexIndex);
          vertexIndex += 4;
        }
      });
    });
    
    geometry.setAttribute('position', 
      new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('color', 
      new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(new THREE.BufferAttribute(
      new Uint32Array(indices), 1));
    
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      flatShading: true
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  static getFaceVertices(x, y, z, faceIndex) {
    const size = 0.5; // Voxel is 1×1×1, offset by 0.5
    const v = [
      [x-size, y-size, z-size],
      [x+size, y-size, z-size],
      [x+size, y+size, z-size],
      [x-size, y+size, z-size],
      // ... all 8 corners
    ];
    
    // Return 4 vertices for this face
    // (faces are defined by which neighbors don't exist)
  }
  
  static addFace(vertices, colors, indices, 
                 faceVerts, color, startIdx) {
    // Add 4 vertices
    faceVerts.forEach(v => vertices.push(...v));
    
    // Add color for each vertex
    const c = this.colorToRGB(color);
    for (let i = 0; i < 4; i++) {
      colors.push(c[0], c[1], c[2]);
    }
    
    // Add two triangles (indices)
    indices.push(startIdx, startIdx+1, startIdx+2);
    indices.push(startIdx, startIdx+2, startIdx+3);
  }
  
  static colorToRGB(color) {
    const hex = color.substring(1);
    return [
      parseInt(hex.substr(0,2), 16) / 255,
      parseInt(hex.substr(2,2), 16) / 255,
      parseInt(hex.substr(4,2), 16) / 255
    ];
  }
}
```

**Why this approach:**
- Only renders visible faces (huge performance win)
- Handles color per-face easily
- Scales to thousands of voxels
- Works with sparse grids

---

## 🎮 Input System

### Mouse & Keyboard Handling
```javascript
class InputHandler {
  constructor(renderer, voxelEditor) {
    this.renderer = renderer;
    this.editor = voxelEditor;
    
    // Mouse tracking
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    
    // Camera controls
    this.orbiting = false;
    this.panning = false;
    
    // Setup listeners
    this.setupMouseListeners();
    this.setupKeyboardListeners();
  }
  
  setupMouseListeners() {
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      
      // Update raycaster
      this.raycaster.setFromCamera(this.mouse, this.editor.camera);
      
      if (this.orbiting) {
        this.orbitCamera(e);
      }
      if (this.panning) {
        this.panCamera(e);
      }
    });
    
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.orbiting = true;
        this.placeVoxel();
      }
      if (e.button === 2) { // Right click
        this.panning = true;
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.orbiting = false;
      this.panning = false;
    });
    
    document.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomCamera(e.deltaY);
    });
  }
  
  placeVoxel() {
    // Check intersection with grid
    const intersects = this.raycaster.intersectObject(
      this.editor.gridMesh
    );
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const face = intersects[0].face;
      const normal = face.normal;
      
      // Get voxel position (round to nearest)
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      const z = Math.round(point.z);
      
      // Place voxel at grid position
      this.editor.grid.set(x, y, z, {
        color: this.editor.currentColor,
        material: 'matte'
      });
      
      // Regenerate mesh
      this.editor.updateMesh();
    }
  }
  
  orbitCamera(e) {
    const deltaX = e.movementX * 0.01;
    const deltaY = e.movementY * 0.01;
    
    // Rotate around center
    // Using spherical coordinates
  }
  
  setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      switch(e.key.toLowerCase()) {
        case 'q': this.editor.setTool('delete'); break;
        case 'e': this.editor.setTool('paint'); break;
        case 'z': 
          if (e.ctrlKey) this.editor.undo();
          break;
        case 'y':
          if (e.ctrlKey) this.editor.redo();
          break;
        case 's':
          if (e.ctrlKey) this.editor.save();
          break;
      }
    });
  }
}
```

**Key features:**
- Raycasting for voxel selection
- Smooth camera controls
- Keyboard shortcuts
- Touch support (optional)

---

## 💾 Save/Export System

### Local Storage
```javascript
class StorageManager {
  static saveProject(project) {
    const data = {
      name: project.name,
      version: 1,
      timestamp: Date.now(),
      grid: {
        width: project.grid.width,
        height: project.grid.height,
        depth: project.grid.depth,
        voxels: Array.from(project.grid.voxels.entries())
      },
      colors: project.colors,
      metadata: project.metadata
    };
    
    const key = `voxel_project_${project.name}`;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  
  static loadProject(name) {
    const key = `voxel_project_${name}`;
    const json = localStorage.getItem(key);
    
    if (!json) return null;
    
    const data = JSON.parse(json);
    const project = new VoxelProject(data.name);
    
    // Restore grid
    data.grid.voxels.forEach(([key, voxel]) => {
      const [x,y,z] = key.split(',').map(Number);
      project.grid.set(x, y, z, voxel);
    });
    
    project.colors = data.colors;
    return project;
  }
  
  static listProjects() {
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('voxel_project_')) {
        const data = JSON.parse(localStorage.getItem(key));
        projects.push({
          name: data.name,
          timestamp: data.timestamp,
          size: data.grid.voxels.length
        });
      }
    }
    return projects.sort((a, b) => b.timestamp - a.timestamp);
  }
}
```

### OBJ Export
```javascript
class OBJExporter {
  static export(grid, name = 'model') {
    let obj = `# Voxel Model: ${name}\n`;
    let mtl = `newmtl voxel_material\n`;
    
    const vertices = [];
    const faces = [];
    const colors = new Map();
    
    // Generate mesh data
    VoxelMesh.generateMesh(grid);
    // ... extract vertices and faces
    
    // Build OBJ
    obj += '# Vertices\n';
    vertices.forEach(v => {
      obj += `v ${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.z.toFixed(3)}\n`;
    });
    
    // Build faces with color materials
    obj += '# Faces\n';
    faces.forEach((face, i) => {
      obj += `usemtl color_${face.color}\n`;
      obj += `f ${face.a}/${face.a} ${face.b}/${face.b} ${face.c}/${face.c}\n`;
    });
    
    // Save files
    this.downloadFile(obj, `${name}.obj`);
    this.downloadFile(mtl, `${name}.mtl`);
  }
  
  static downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

---

## 🎯 Performance Optimization

### Techniques Used
```javascript
// 1. Frustum culling (don't render off-screen voxels)
const frustum = new THREE.Frustum();
frustum.setFromProjectionMatrix(
  camera.projectionMatrix.multiply(camera.matrixWorldInverse)
);

// 2. Level of detail (LOD)
// Don't render distant voxels at full detail

// 3. Mesh optimization
geometry.computeVertexNormals();
geometry.setIndex(/* reuse indices */);

// 4. Lazy updates
// Only regenerate mesh when voxels change
// Not on every frame

// 5. Batch rendering
// Render all voxels in single draw call
// Use instancing for repeated elements
```

---

## 📱 Responsive Design

### Mobile Considerations
```javascript
// Touch support
document.addEventListener('touchstart', (e) => {
  // Handle touch for mobile
  const touch = e.touches[0];
  // Convert to mouse coordinates
});

document.addEventListener('touchmove', (e) => {
  // Pinch zoom detection
  if (e.touches.length === 2) {
    const dist = getTouchDistance(e.touches[0], e.touches[1]);
    // Zoom camera based on distance
  }
});

// Responsive canvas
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
}

window.addEventListener('resize', onWindowResize);
```

---

## 🔄 Update Loop

```javascript
class VoxelEditor {
  constructor() {
    this.grid = new VoxelGrid(32, 32, 32);
    this.mesh = null;
    this.needsUpdate = false;
  }
  
  addVoxel(x, y, z, color) {
    this.grid.set(x, y, z, { color, material: 'matte' });
    this.needsUpdate = true;
    this.pushToHistory(this.grid.clone());
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Only regenerate mesh if needed
    if (this.needsUpdate) {
      if (this.mesh) {
        this.scene.remove(this.mesh);
      }
      this.mesh = VoxelMesh.generateMesh(this.grid);
      this.scene.add(this.mesh);
      this.needsUpdate = false;
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}
```

---

## 📊 Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Frame Rate | 60 FPS | Lazy mesh updates, frustum culling |
| Voxels | 10,000+ | Sparse grid, greedy meshing |
| Load Time | < 2 sec | Pre-load assets, lazy rendering |
| Memory | < 50 MB | Sparse storage, cleanup |
| Export | < 5 MB | Compression, selective faces |

---

## 🎓 Learning Resources

Needed to build this:
- Three.js fundamentals (2-3 hours)
- Mesh generation algorithms (2 hours)
- Raycasting & picking (1 hour)
- WebGL basics (optional but helpful)

Recommended learning:
- Three.js documentation
- "Greedy Meshing" papers
- Voxel rendering tutorials
- Game dev math basics

---

**Status:** Architecture Ready  
**Complexity:** Medium (3,000-4,000 lines of code)  
**Development Time:** 4 weeks (80-100 hours)  
**Ready to Start:** ✅ Yes
