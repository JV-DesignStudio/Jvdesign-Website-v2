/**
 * evaluator.js — Sandboxed JS/pseudo-code evaluation + test runner.
 * Runs student code in a Worker-isolated iframe to prevent page escapes.
 */

export class Evaluator {
  constructor() {
    this._iframe = null;
    this._pending = new Map();
    this._msgId = 0;
  }

  /* Lazy-create a sandboxed iframe for execution */
  _getFrame() {
    if (this._iframe) return this._iframe;

    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.style.display = 'none';
    frame.srcdoc = `<!DOCTYPE html><html><head></head><body><script>
      const logs = [];
      const origLog = console.log;
      console.log = (...args) => {
        logs.push(args.map(String).join(' '));
        origLog(...args);
      };
      window.addEventListener('message', (e) => {
        logs.length = 0;
        let error = null, result = undefined;
        try {
          result = (new Function(e.data.code))();
        } catch (err) {
          error = err.message;
        }
        parent.postMessage({ id: e.data.id, logs: [...logs], error, result: String(result ?? '') }, '*');
      });
    <\/script></body></html>`;

    document.body.appendChild(frame);
    this._iframe = frame;

    window.addEventListener('message', (e) => {
      if (e.source !== frame.contentWindow) return;
      const cb = this._pending.get(e.data.id);
      if (cb) { cb(e.data); this._pending.delete(e.data.id); }
    });

    return frame;
  }

  /**
   * Run code and return { logs, error, result }.
   * Timeout after 4 s to catch infinite loops.
   */
  run(code, timeout = 4000) {
    return new Promise((resolve) => {
      const id = ++this._msgId;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        // Recreate frame to kill any runaway loop
        if (this._iframe) { this._iframe.remove(); this._iframe = null; }
        resolve({ logs: [], error: 'Execution timed out (possible infinite loop)', result: '' });
      }, timeout);

      this._pending.set(id, (data) => {
        clearTimeout(timer);
        resolve(data);
      });

      this._getFrame().contentWindow.postMessage({ id, code }, '*');
    });
  }

  /**
   * Run tests against student code.
   * tests: Array<{ description, code, expect }>
   *   code is appended after student code and must produce a value.
   *   expect is compared with String(result).
   */
  async runTests(studentCode, tests) {
    const results = [];
    for (const test of tests) {
      const combined = `${studentCode}\n;(function(){ return (${test.code}); })()`;
      const { result, error } = await this.run(combined);
      const pass = !error && String(result).trim() === String(test.expect).trim();
      results.push({ description: test.description, pass, error });
    }
    return results;
  }
}
