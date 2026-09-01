const fs = require('fs');
const html = fs.readFileSync('tools/story-player.html', 'utf8');
const start = html.indexOf('<script>\n// ');
const end = html.indexOf('</script>', start);
const code = html.substring(start + 8, end);
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '<' && j+1 < line.length && /[a-zA-Z]/.test(line[j+1])) {
      const before = line.substring(Math.max(0, j-40), j);
      const after = line.substring(j, Math.min(line.length, j+40));
      console.log('Line', i+1, 'col', j, '  before:', JSON.stringify(before), '  after:', JSON.stringify(after));
    }
  }
}
