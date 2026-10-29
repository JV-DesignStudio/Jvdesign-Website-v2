/**
 * mobile-keys.js - Touch-friendly quick-syntax toolbar for the workspace editor.
 * Renders a row of 1-tap keys above the mobile keyboard.
 * Only activates on touch viewports (<= 768px wide).
 */

const KEYS = [
  { label: '{ }', insert: '{}',         cursor: -1 },
  { label: '[ ]', insert: '[]',         cursor: -1 },
  { label: '( )', insert: '()',         cursor: -1 },
  { label: '=',   insert: ' = ',        cursor: 0  },
  { label: ';',   insert: ';',          cursor: 0  },
  { label: '=>',  insert: ' => ',       cursor: 0  },
  { label: 'const', insert: 'const ',   cursor: 0  },
  { label: 'let',   insert: 'let ',     cursor: 0  },
  { label: 'fn',    insert: 'function (', cursor: 0 },
  { label: 'ret',   insert: 'return ',  cursor: 0  },
  { label: '`',   insert: '``',        cursor: -1 },
];

/**
 * Mount the toolbar above `editorEl`.
 * Returns the toolbar element (or null on non-touch viewports).
 */
export function mountMobileToolbar(editorEl) {
  if (!editorEl) return null;

  // Only show on touch/narrow screens
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches
    || ('ontouchstart' in window);

  const toolbar = document.createElement('div');
  toolbar.id = 'mobile-key-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Quick syntax keys');

  toolbar.style.cssText = `
    display:flex;gap:4px;padding:4px 6px;
    background:#242424;border-top:1px solid #403B33;
    overflow-x:auto;-webkit-overflow-scrolling:touch;
    scrollbar-width:none;flex-shrink:0;
  `;

  KEYS.forEach(({ label, insert, cursor }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      flex-shrink:0;padding:6px 10px;
      background:#403B33;color:#F0EAD6;
      border:none;border-radius:4px;font-size:.78rem;
      font-family:var(--font-code,'JetBrains Mono'),monospace;
      cursor:pointer;white-space:nowrap;line-height:1;
      touch-action:manipulation;user-select:none;
      -webkit-tap-highlight-color:transparent;
    `;
    btn.addEventListener('mousedown', e => {
      // Prevent the textarea from losing focus
      e.preventDefault();
      insertAtCursor(editorEl, insert, cursor);
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    toolbar.appendChild(btn);
  });

  // Insert toolbar just before the editor
  editorEl.parentNode?.insertBefore(toolbar, editorEl);

  // Toggle visibility based on viewport size
  const applyVisibility = () => {
    toolbar.style.display = isMobile() ? 'flex' : 'none';
  };
  applyVisibility();
  window.addEventListener('resize', applyVisibility);

  return toolbar;
}

/** Insert text at textarea cursor; cursor=-1 means place inside the last char pair */
function insertAtCursor(el, text, cursorOffset) {
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;
  const pos = cursorOffset === -1
    ? start + text.length - 1  // between pair like {}
    : start + text.length;
  el.setSelectionRange(pos, pos);
  el.focus();
}
