// A2072c: one standalone HTML document from a title, body, script and config.
// No network references are added; the caller owns the game source.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function standaloneDocument({ title = 'My Game', body = '', script = '', config = null } = {}) {
  const configJson = JSON.stringify(config || {}).replace(/</g, '\\u003c');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(title) + '</title>\n</head>\n<body>\n' + body + '\n<script>window.__exportMode=true;var _c=' + configJson + ';</script>\n<script>\n' + script + '\n</' + 'script>\n</body>\n</html>';
}

export function fileName(title, ext = 'html') {
  const base = String(title || 'my-game').replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'my-game';
  return base + '.' + ext;
}

export const SingleFileExporter = { standaloneDocument, fileName };
export default SingleFileExporter;
