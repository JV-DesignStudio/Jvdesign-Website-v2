/**
 * skill-tree.js — SVG-based skill tree renderer + interaction.
 * Nodes are positioned on a logical grid; edges drawn with SVG paths.
 */
import { State } from './state.js';
import { FX } from './fx.js';

export class SkillTree {
  constructor(container, nodes, onUnlock) {
    this._container = container;
    this._nodes = nodes;       // Array<SkillNode>
    this._onUnlock = onUnlock; // callback(nodeId)
    this._svg = null;
    this._W = 0; this._H = 0;
    this.NODE_R = 28;
    this.GRID = 100;
  }

  render() {
    this._container.innerHTML = '';
    const maxCol = Math.max(...this._nodes.map(n => n.col));
    const maxRow = Math.max(...this._nodes.map(n => n.row));
    this._W = (maxCol + 1) * this._GRID(1.4) + this.NODE_R * 2;
    this._H = (maxRow + 1) * this._GRID(1.4) + this.NODE_R * 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${this._W} ${this._H}`);
    svg.style.cssText = `width:100%;max-width:${this._W}px;display:block;`;
    this._svg = svg;

    this._drawEdges();
    this._drawNodes();
    this._container.appendChild(svg);
  }

  _cx(node) { return node.col * this._GRID(1.4) + this.NODE_R + 20; }
  _cy(node) { return node.row * this._GRID(1.4) + this.NODE_R + 20; }
  _GRID(mul = 1) { return this.GRID * mul; }

  _drawEdges() {
    this._nodes.forEach(node => {
      (node.requires ?? []).forEach(reqId => {
        const parent = this._nodes.find(n => n.id === reqId);
        if (!parent) return;
        const x1 = this._cx(parent), y1 = this._cy(parent);
        const x2 = this._cx(node),   y2 = this._cy(node);
        const unlocked = State.hasSkill(reqId);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const mx = (x1 + x2) / 2;
        path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', unlocked ? '#7c3aed' : '#2d2d4e');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', unlocked ? 'none' : '6,4');
        this._svg.appendChild(path);
      });
    });
  }

  _drawNodes() {
    this._nodes.forEach(node => {
      const cx = this._cx(node);
      const cy = this._cy(node);
      const unlocked = State.hasSkill(node.id);
      const prereqsMet = (node.requires ?? []).every(id => State.hasSkill(id));
      const available = !unlocked && prereqsMet;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = available ? 'pointer' : 'default';

      // Glow for available
      if (available) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', cx); glow.setAttribute('cy', cy);
        glow.setAttribute('r', this.NODE_R + 6);
        glow.setAttribute('fill', 'rgba(124,58,237,0.2)');
        g.appendChild(glow);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
      circle.setAttribute('r', this.NODE_R);
      circle.setAttribute('fill', unlocked ? '#7c3aed' : available ? '#1a1a2e' : '#0f0f1a');
      circle.setAttribute('stroke', unlocked ? '#a78bfa' : available ? '#7c3aed' : '#2d2d4e');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', cx); icon.setAttribute('y', cy + 2);
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('dominant-baseline', 'middle');
      icon.setAttribute('font-size', '18');
      icon.textContent = node.icon ?? '⭐';
      g.appendChild(icon);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', cx); label.setAttribute('y', cy + this.NODE_R + 14);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', unlocked ? '#e2e8f0' : '#64748b');
      label.setAttribute('font-family', 'Inter,system-ui,sans-serif');
      label.textContent = node.name;
      g.appendChild(label);

      if (available) {
        g.addEventListener('click', () => this._unlock(node));
      }
      this._svg.appendChild(g);
    });
  }

  _unlock(node) {
    State.unlockSkill(node.id);
    FX.playSFX('pass');
    FX.confetti();
    this._onUnlock?.(node.id, node);
    this.render(); // re-render to update edges/states
  }
}
