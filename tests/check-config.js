// Greps src/game and src/scenes for suspicious hard-coded gameplay numbers.
// Allowed: small structural literals (0, 1, 2, 0.5, -1, 3, 4, 10, 100, 1000, 0.001 epsilon).
const fs = require('fs'), path = require('path');
const ALLOWED = new Set(['0', '1', '2', '0.5', '-1', '3', '4', '10', '100', '1000', '0.001']);
const root = path.join(__dirname, '..');
const hits = [];
for (const sub of ['src/game', 'src/scenes']) {
  const d = path.join(root, sub);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((f) => f.endsWith('.js'))) {
    fs.readFileSync(path.join(d, f), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\*|\/\*|\/\/)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"/g, '""');
      for (const m of code.matchAll(/(?<![\w.])-?\d+\.?\d*(?!\w)/g))
        if (!ALLOWED.has(m[0])) hits.push(sub + '/' + f + ':' + (i + 1) + ': ' + m[0] + '   ' + line.trim());
    });
  }
}
if (hits.length) { console.error('FAIL check-config: suspicious numbers\n' + hits.join('\n')); process.exit(1); }
console.log('PASS check-config');
