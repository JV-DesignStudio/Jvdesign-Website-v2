/* JVDS Code Snippet Generator - Web Worker highlight offload (A2776)
   Tokenizes large scripts away from the main thread and posts the lines back. */
importScripts('csg-tokenizer.js');

self.onmessage = function (event) {
  var data = event.data || {};
  if (data.type !== 'highlight') return;
  try {
    var lines = (self.CSGHighlight && self.CSGHighlight.lines)
      ? self.CSGHighlight.lines(data.code, data.lang)
      : String(data.code || '').split('\n');
    self.postMessage({ id: data.id, lines: lines });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err && err.message ? err.message : err) });
  }
};
