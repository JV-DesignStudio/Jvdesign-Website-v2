/**
 * ai-assistant.js - Privacy-first mascot hint engine.
 * Analyzes failing test assertions and returns character-themed debugging hints
 * without revealing the answer. All logic is local; no network calls unless
 * the optional Ollama/WebLLM bridge is explicitly enabled by the player.
 */

/* ── Mascot hint personas ── */
const PERSONAS = {
  lumo:     { name: 'Lumo',     avatar: '🦊', color: '#70A3A7' },
  pip:      { name: 'Pip',      avatar: '🐢', color: '#f39c12' },
  ember:    { name: 'Ember',    avatar: '🐅', color: '#BC4749' },
  echo:     { name: 'Echo',     avatar: '🦎', color: '#70A3A7' },
  stardust: { name: 'Stardust', avatar: '✨', color: '#f39c12' },
};

/* ── Pattern-based hint rules (ordered: most specific first) ── */
const HINT_RULES = [
  {
    pattern: /is not defined|ReferenceError/i,
    hints: [
      "A variable can't be used before it's declared. Check you spelled its name exactly right.",
      "Try logging the variable name to the console — does it exist in this scope?",
      "Lumo says: 'Variables are like boxes. Make sure you created the box before you reach into it.'",
    ],
  },
  {
    pattern: /is not a function|TypeError.*not a function/i,
    hints: [
      "You're calling something as a function that isn't one. Is it a method? Check the object type.",
      "Try `typeof yourThing` to see what kind of value it is before you call it.",
      "Echo says: 'If it doesn't behave like a function, it probably isn't one — yet.'",
    ],
  },
  {
    pattern: /Cannot read propert|undefined|null/i,
    hints: [
      "Something is `undefined` or `null` when you expected a value. Log the variable one step earlier.",
      "Check that you're returning the right thing from the function above this one.",
      "Pip says: 'Undefined is like frame zero — nothing exists until you create it.'",
    ],
  },
  {
    pattern: /SyntaxError|Unexpected token|Unexpected end/i,
    hints: [
      "There's a syntax error — a missing `{`, `}`, `(`, `)`, or `;` somewhere.",
      "Check the line the error points to and the line just above it.",
      "Ember says: 'Every open bracket needs a matching close. Count them like brushstrokes.'",
    ],
  },
  {
    pattern: /return/i,
    hints: [
      "The test expects a returned value. Did you use the `return` keyword?",
      "Functions without `return` give back `undefined` automatically.",
      "Lumo says: 'The answer lives inside the function. Use `return` to let it out.'",
    ],
  },
  {
    pattern: /array|\.length|\.map|\.filter|\.reduce/i,
    hints: [
      "Working with an array — make sure you're not accidentally mutating the original.",
      "`.map()` gives a new array back; `.forEach()` gives nothing back. Which do you need?",
      "Echo says: 'Arrays love chaining. But each method returns something — check what that something is.'",
    ],
  },
  {
    pattern: /loop|for|while|infinite/i,
    hints: [
      "Make sure your loop has a condition that eventually becomes false.",
      "Check that your counter variable actually changes inside the loop.",
      "Pip says: 'A loop without an exit is like a game without a win condition. Add one.'",
    ],
  },
  {
    pattern: /canvas|fillRect|drawImage|ctx/i,
    hints: [
      "Canvas operations need a 2D context: `canvas.getContext('2d')`.",
      "Remember to set `fillStyle` before calling `fillRect`.",
      "Ember says: 'The canvas is blank until you tell it what colour to paint with.'",
    ],
  },
  {
    // Default fallback
    pattern: /./,
    hints: [
      "Read the error message carefully — it often tells you the exact line and type of problem.",
      "Try adding `console.log()` calls to trace where your values go wrong.",
      "Stardust says: 'Every bug is a clue. The error message is the first clue. Read it twice.'",
    ],
  },
];

/**
 * Analyse a list of test results and return one mascot-themed hint string.
 * @param {{ description: string, passed: boolean, error: string|null }[]} results
 * @param {string[]} consoleLogs - raw console lines from the run
 * @param {string} [mascotId] - which mascot persona to prefer
 * @returns {{ hint: string, persona: object } | null}
 */
export function getHint(results, consoleLogs = [], mascotId = 'lumo') {
  const failed = results.filter(r => !r.passed);
  if (!failed.length) return null;

  // Combine first error message + first console error for matching
  const errorText = [
    failed[0]?.error ?? '',
    failed[0]?.description ?? '',
    consoleLogs.find(l => l.startsWith('[error]')) ?? '',
  ].join(' ');

  for (const rule of HINT_RULES) {
    if (rule.pattern.test(errorText)) {
      const hint = rule.hints[Math.floor(Math.random() * rule.hints.length)];
      const persona = PERSONAS[mascotId] ?? PERSONAS.lumo;
      return { hint, persona };
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════
   HINT UI
═══════════════════════════════════════════════ */

/**
 * Render a hint bubble below the terminal console.
 * Clears any existing hint first.
 */
export function showHint(results, consoleLogs, mascotId) {
  document.getElementById('jvds-hint-bubble')?.remove();

  const match = getHint(results, consoleLogs, mascotId);
  if (!match) return;

  const { hint, persona } = match;
  const bubble = document.createElement('div');
  bubble.id = 'jvds-hint-bubble';
  bubble.style.cssText = `
    margin-top:.75rem;padding:.75rem 1rem;
    background:#1e1e1e;border:1px solid ${persona.color};
    border-radius:8px;font-size:.82rem;line-height:1.6;
    color:#F0EAD6;display:flex;gap:.65rem;align-items:flex-start;
    animation:hintFadeIn .3s ease;
  `;
  bubble.innerHTML = `
    <span style="font-size:1.3rem;flex-shrink:0">${persona.avatar}</span>
    <div>
      <div style="font-size:.7rem;color:${persona.color};font-weight:700;margin-bottom:.2rem">
        ${persona.name} says:
      </div>
      <div>${escHtml(hint)}</div>
    </div>`;

  if (!document.getElementById('hint-keyframes')) {
    const s = document.createElement('style');
    s.id = 'hint-keyframes';
    s.textContent = `@keyframes hintFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`;
    document.head.appendChild(s);
  }

  // Append below the terminal console
  const terminal = document.getElementById('terminal-console');
  terminal?.parentNode?.appendChild(bubble);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════════
   OPTIONAL LOCAL LLM BRIDGE (Ollama / WebLLM)
   Player must explicitly opt in via Settings.
═══════════════════════════════════════════════ */

const LLM_SETTING_KEY = 'jvds_llm_enabled';
const OLLAMA_DEFAULT  = 'http://localhost:11434/api/generate';

export const LLMBridge = {
  isEnabled() {
    try { return localStorage.getItem(LLM_SETTING_KEY) === 'true'; } catch { return false; }
  },

  enable(endpoint = OLLAMA_DEFAULT) {
    try {
      localStorage.setItem(LLM_SETTING_KEY, 'true');
      localStorage.setItem('jvds_llm_endpoint', endpoint);
    } catch {}
  },

  disable() {
    try {
      localStorage.removeItem(LLM_SETTING_KEY);
      localStorage.removeItem('jvds_llm_endpoint');
    } catch {}
  },

  /**
   * Ask Ollama for a short hint. Falls back to rule-based hint on any error.
   * Never sends personal data — only the failing assertion description and error.
   */
  async askOllama(failedResult, mascotId = 'lumo') {
    const endpoint = localStorage.getItem('jvds_llm_endpoint') ?? OLLAMA_DEFAULT;
    const persona  = PERSONAS[mascotId] ?? PERSONAS.lumo;
    const prompt   = [
      `You are ${persona.name} (${persona.avatar}), a friendly game dev mascot in an RPG coding game.`,
      `A player's test failed: "${failedResult.description}".`,
      failedResult.error ? `Error: ${failedResult.error}` : '',
      'Give ONE short hint (1-2 sentences) that steers them toward the solution without revealing the answer.',
      'Speak as the mascot character, warmly and encouraging.',
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt, stream: false }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return { hint: data.response?.trim() ?? '', persona };
    } catch {
      // Silently fall back — player never sees network errors
      return getHint([failedResult], [], mascotId);
    }
  },
};
