/**
 * skill-tree.js - SVG skill tree renderer for the index dashboard.
 *
 * API: new SkillTreeRenderer(containerId, trackData).render()
 *
 * Node states:
 *   completed - fill #70A3A7 (teal), stroke #F0EAD6 (beige), icon checkmark
 *   unlocked  - fill #403B33 (charcoal), stroke #70A3A7 (teal), icon first letter
 *   locked    - fill #1a1a1a (dark), stroke #BC4749 (rose), icon lock
 *
 * Clicking an unlocked or completed node navigates to workspace.html?node={nodeId}.
 */
import { GameState } from './state.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_R   = 30;
const COL_W    = 160;
const ROW_H    = 120;
const PAD      = 60;

export class SkillTreeRenderer {
  constructor(containerId, trackData) {
    this._container = document.getElementById(containerId);
    this._track     = trackData;
  }

  render() {
    if (!this._container || !this._track) return;
    this._container.innerHTML = '';

    const nodes    = this._track.nodes ?? [];
    const state    = GameState.get();
    const completed = new Set(state.completedNodes);

    // Compute layout positions (simple top-to-bottom chain with branch offset)
    const positions = this._layoutNodes(nodes);
    const maxX = Math.max(...Object.values(positions).map(p => p.x)) + PAD + NODE_R;
    const maxY = Math.max(...Object.values(positions).map(p => p.y)) + PAD + NODE_R;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(maxY));
    svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
    svg.style.display = 'block';

    // Draw edges first (behind nodes)
    nodes.forEach(node => {
      (node.prerequisites ?? []).forEach(prereqId => {
        const from = positions[prereqId];
        const to   = positions[node.id];
        if (!from || !to) return;

        const prereqDone = completed.has(prereqId);
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        line.setAttribute('stroke', prereqDone ? '#70A3A7' : '#403B33');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', prereqDone ? 'none' : '6 4');
        svg.appendChild(line);
      });
    });

    // Draw nodes
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;

      const isDone      = completed.has(node.id);
      const prereqsMet  = (node.prerequisites ?? []).every(id => completed.has(id));
      const isUnlocked  = !isDone && prereqsMet;
      const isLocked    = !isDone && !prereqsMet;
      const isClickable = isDone || isUnlocked;

      const g = document.createElementNS(NS, 'g');
      g.style.cursor = isClickable ? 'pointer' : 'default';

      // Outer glow ring for unlocked
      if (isUnlocked) {
        const glow = document.createElementNS(NS, 'circle');
        glow.setAttribute('cx', String(pos.x));
        glow.setAttribute('cy', String(pos.y));
        glow.setAttribute('r',  String(NODE_R + 7));
        glow.setAttribute('fill', 'rgba(112,163,167,0.18)');
        g.appendChild(glow);
      }

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(pos.x));
      circle.setAttribute('cy', String(pos.y));
      circle.setAttribute('r',  String(NODE_R));
      circle.setAttribute('fill',   isDone ? '#70A3A7' : isUnlocked ? '#403B33' : '#1a1a1a');
      circle.setAttribute('stroke', isDone ? '#F0EAD6' : isUnlocked ? '#70A3A7' : '#BC4749');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      const icon = document.createElementNS(NS, 'text');
      icon.setAttribute('x', String(pos.x));
      icon.setAttribute('y', String(pos.y + 1));
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('dominant-baseline', 'middle');
      icon.setAttribute('font-size', '16');
      icon.setAttribute('fill', isDone ? '#1a1a1a' : isUnlocked ? '#F0EAD6' : '#BC4749');
      icon.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      icon.setAttribute('font-weight', '700');
      icon.textContent = isDone ? '✓' : isLocked ? '🔒' : (node.title?.[0] ?? '?');
      g.appendChild(icon);

      // Label below node
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(pos.x));
      label.setAttribute('y', String(pos.y + NODE_R + 16));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', isDone ? '#70A3A7' : isUnlocked ? '#F0EAD6' : '#524c42');
      label.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      label.textContent = node.title ?? node.id;
      g.appendChild(label);

      // XP badge
      if (!isLocked) {
        const badge = document.createElementNS(NS, 'text');
        badge.setAttribute('x', String(pos.x + NODE_R - 2));
        badge.setAttribute('y', String(pos.y - NODE_R + 2));
        badge.setAttribute('text-anchor', 'middle');
        badge.setAttribute('font-size', '9');
        badge.setAttribute('fill', '#f39c12');
        badge.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        badge.textContent = `+${node.xp ?? 0}`;
        g.appendChild(badge);
      }

      if (isClickable) {
        g.addEventListener('click', () => {
          window.location.href = `workspace.html?node=${encodeURIComponent(node.id)}`;
        });
      }

      svg.appendChild(g);
    });

    this._container.appendChild(svg);
  }

  /**
   * Simple layout: arrange nodes in order, branching right if they share a row.
   * Returns { [nodeId]: { x, y } }
   */
  _layoutNodes(nodes) {
    const positions = {};
    const rowCount  = {};

    nodes.forEach((node, idx) => {
      // Determine row based on longest prerequisite chain
      const row = node.prerequisites?.length
        ? Math.max(...node.prerequisites.map(id => {
            const p = positions[id];
            return p ? Math.round((p.y - PAD) / ROW_H) + 1 : 0;
          }))
        : 0;

      rowCount[row] = (rowCount[row] ?? 0);
      const col = rowCount[row];
      rowCount[row]++;

      positions[node.id] = {
        x: PAD + col * COL_W + NODE_R,
        y: PAD + row * ROW_H + NODE_R,
      };
    });

    return positions;
  }
}
