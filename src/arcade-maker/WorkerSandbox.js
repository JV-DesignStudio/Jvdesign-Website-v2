// A2072a: run learner code away from the page in a short-lived Web Worker.
// The sandbox can only post a result back; it cannot touch the editor DOM.

export function run(code, input = {}, timeout = 2000) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      reject(new Error('This browser has no Worker sandbox'));
      return;
    }
    const body = String(code || '');
    // The learner's code becomes the worker function body, so the sandbox does
    // not need eval/new Function (which the site CSP blocks).
    const source = 'self.onmessage=function(e){try{var out=(function(input){\n' + body + '\n})(e.data);self.postMessage({ok:true,out:out});}catch(err){self.postMessage({ok:false,error:String((err&&err.message)||err)});}};';
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const timer = setTimeout(() => {
      try { worker.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      reject(new Error('Sandbox timed out'));
    }, timeout);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      try { worker.terminate(); } catch (err) {}
      URL.revokeObjectURL(url);
      if (e.data && e.data.ok) resolve(e.data.out);
      else reject(new Error((e.data && e.data.error) || 'Sandbox failed'));
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      try { worker.terminate(); } catch (err) {}
      URL.revokeObjectURL(url);
      reject(new Error((e && e.message) || 'Worker error'));
    };
    worker.postMessage(input);
  });
}

export const WorkerSandbox = { run };
export default WorkerSandbox;
