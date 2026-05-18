/**
 * server/dev-all.js
 * Lanza el servidor web (puerto 3000) y el proxy IA (puerto 3002) en paralelo.
 * Funciona en Windows, Mac y Linux sin dependencias externas.
 * Uso: node server/dev-all.js
 */

import { spawn } from 'child_process';

const isWin = process.platform === 'win32';
const sh    = isWin ? 'cmd'  : 'sh';
const shArg = isWin ? '/c'   : '-c';

function run(label, color, cmd) {
  const colors = { yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
  const c = colors[color] ?? '';
  const r = colors.reset;

  const proc = spawn(sh, [shArg, cmd], { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l =>
      console.log(`${c}[${label}]${r} ${l}`)
    )
  );
  proc.stderr.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l =>
      console.error(`${c}[${label}]${r} ${l}`)
    )
  );
  proc.on('close', code => {
    if (code !== null) console.log(`${c}[${label}]${r} proceso terminado (código ${code})`);
  });

  return proc;
}

const web   = run('WEB', 'yellow', 'npx serve . --listen 3000');
const proxy = run('AI',  'cyan',   'node server/aiProxy.js');

// Ctrl+C cierra ambos
process.on('SIGINT',  () => { web.kill(); proxy.kill(); process.exit(0); });
process.on('SIGTERM', () => { web.kill(); proxy.kill(); process.exit(0); });

console.log('\x1b[32m[dev:all]\x1b[0m Arrancando WEB :3000  +  AI proxy :3002 …\n');
