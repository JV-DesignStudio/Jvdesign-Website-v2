/**
 * evaluator.js - Sandboxed code runner using a dynamically-created Web Worker.
 * No iframes; the Worker is created on the fly via createObjectURL.
 *
 * API: CodeEvaluator.run(userCode, testCases, timeoutMs?)
 *      -> Promise<{ logs: string[], results: Array<{ description, passed, error }> }>
 */

const WORKER_SRC = `
self.onmessage = function(e) {
  const { userCode, testCases } = e.data;
  const logs = [];

  const customConsole = {
    log:   (...a) => logs.push(a.map(String).join(' ')),
    warn:  (...a) => logs.push('[warn] ' + a.map(String).join(' ')),
    error: (...a) => logs.push('[error] ' + a.map(String).join(' ')),
  };

  // Execute user code first, capturing console output
  try {
    new Function('console', userCode)(customConsole);
  } catch (err) {
    logs.push('[error] ' + err.message);
  }

  // Run each test assertion
  const results = testCases.map(test => {
    try {
      const val = new Function(
        'userCode', 'console',
        userCode + '; return (' + test.assertion + ');'
      )(userCode, customConsole);
      return { description: test.description, passed: !!val, error: null };
    } catch (err) {
      return { description: test.description, passed: false, error: err.message };
    }
  });

  self.postMessage({ logs, results });
};
`;

export const CodeEvaluator = {
  /**
   * @param {string} userCode - The player's code string.
   * @param {Array<{description: string, assertion: string}>} testCases
   * @param {number} timeoutMs - Kill worker after this many ms (default 2000).
   * @returns {Promise<{logs: string[], results: Array<{description, passed, error}>}>}
   */
  run(userCode, testCases = [], timeoutMs = 2000) {
    return new Promise((resolve) => {
      let blob, url, worker;

      try {
        blob   = new Blob([WORKER_SRC], { type: 'application/javascript' });
        url    = URL.createObjectURL(blob);
        worker = new Worker(url);
      } catch (err) {
        // Worker not available (e.g. file:// protocol) - fall back to iframe eval
        return resolve(this._fallback(userCode, testCases));
      }

      const timer = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve({
          logs: ['[error] Execution timed out - possible infinite loop'],
          results: testCases.map(t => ({
            description: t.description,
            passed: false,
            error: 'Timed out',
          })),
        });
      }, timeoutMs);

      worker.onmessage = (e) => {
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(e.data);
      };

      worker.onerror = (err) => {
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve({
          logs: [`[error] Worker error: ${err.message}`],
          results: testCases.map(t => ({
            description: t.description,
            passed: false,
            error: err.message,
          })),
        });
      };

      worker.postMessage({ userCode, testCases });
    });
  },

  /** Fallback for file:// or sandboxed environments where Workers are blocked. */
  _fallback(userCode, testCases) {
    const logs = [];
    const customConsole = {
      log:   (...a) => logs.push(a.map(String).join(' ')),
      warn:  (...a) => logs.push('[warn] ' + a.map(String).join(' ')),
      error: (...a) => logs.push('[error] ' + a.map(String).join(' ')),
    };
    try { new Function('console', userCode)(customConsole); } catch (e) { logs.push('[error] ' + e.message); }
    const results = testCases.map(test => {
      try {
        const val = new Function('userCode', 'console', userCode + '; return (' + test.assertion + ');')(userCode, customConsole);
        return { description: test.description, passed: !!val, error: null };
      } catch (e) {
        return { description: test.description, passed: false, error: e.message };
      }
    });
    return { logs, results };
  },
};
