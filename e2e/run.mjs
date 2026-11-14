// One-command e2e: build web (pointing at the test server), start the server in mock-DM mode
// and a static web host on free ports, run Playwright, shut everything down.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { createReadStream, existsSync, mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const mobile = join(root, 'apps/mobile');
const dist = join(mobile, 'dist');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function isFree(port) {
  return new Promise((res) => {
    const s = netServer();
    s.once('error', () => res(false));
    s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
  });
}
async function freePort(preferred) {
  if (preferred && (await isFree(preferred))) return preferred;
  return new Promise((res) => {
    const s = netServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}
async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout waiting for ${url}`);
}

const serverPort = await freePort(Number(process.env.E2E_SERVER_PORT) || 4108);
const webPort = await freePort(Number(process.env.E2E_WEB_PORT) || 8108);
const apiUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const dataDir = mkdtempSync(join(tmpdir(), 'dmai-e2e-'));
const children = [];
let webHost;

function cleanup() {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM'); // whole process group: pnpm -> tsx -> node
    } catch {}
  }
  webHost?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
process.on('SIGINT', () => (cleanup(), process.exit(130)));
process.on('SIGTERM', () => (cleanup(), process.exit(143)));

let code = 1;
try {
  if (!process.env.E2E_SKIP_BUILD || !existsSync(join(dist, 'index.html'))) {
    console.log(`[e2e] building web app (API ${apiUrl})`);
    const b = spawnSync(pnpm, ['--filter', '@dmai/mobile', 'export:web'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl, CI: '1' },
    });
    if (b.status !== 0) throw new Error('web build failed');
  }

  const server = spawn(pnpm, ['--filter', '@dmai/server', 'start'], {
    cwd: root,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, PORT: String(serverPort), DM_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', DATABASE_PATH: join(dataDir, 'e2e.db'), CORS_ORIGIN: '*' },
  });
  children.push(server);

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
  webHost = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, webUrl).pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(dist, p);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  }).listen(webPort, '127.0.0.1');

  await waitFor(`${apiUrl}/health`).catch(() => waitFor(apiUrl));
  await waitFor(webUrl);
  console.log(`[e2e] server ${apiUrl}, web ${webUrl}`);

  const pw = spawn(pnpm, ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.ts', '--trace', 'off', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, E2E_BASE_URL: webUrl, E2E_API_URL: apiUrl },
  });
  children.push(pw);
  code = await new Promise((res) => pw.on('exit', (c) => res(c ?? 1)));
} catch (e) {
  console.error('[e2e]', e.message);
} finally {
  cleanup();
}
process.exit(code);
