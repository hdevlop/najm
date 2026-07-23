import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dir, '..');
const runtimeDir = resolve(root, '.runtime');
const logDir = resolve(root, '.logs');
const pidFile = resolve(runtimeDir, 'playground-next.pid');
const outLog = resolve(logDir, 'playground-next.out.log');
const errLog = resolve(logDir, 'playground-next.err.log');
const port = Number(process.env.PORT ?? 3000);

function ensureDirs() {
  mkdirSync(dirname(pidFile), { recursive: true });
  mkdirSync(logDir, { recursive: true });
}

function readPid(): number | null {
  if (!existsSync(pidFile)) return null;
  const value = Number(readFileSync(pidFile, 'utf8').trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findPidOnPort(targetPort: number): number | null {
  if (process.platform !== 'win32') return null;

  try {
    const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    const suffix = `:${targetPort}`;
    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const [proto, localAddress, , state, pid] = parts;
      if (proto !== 'TCP') continue;
      if (!localAddress.endsWith(suffix)) continue;
      if (state !== 'LISTENING') continue;
      const value = Number(pid);
      return Number.isInteger(value) && value > 0 ? value : null;
    }
  } catch {
    return null;
  }

  return null;
}

function stopPid(pid: number): void {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  process.kill(pid);
}

function start() {
  ensureDirs();

  const portPid = findPidOnPort(port);
  if (portPid) {
    console.log(`playground Next server already listening on port ${port} with PID ${portPid}`);
    console.log(`url: http://127.0.0.1:${port}`);
    writeFileSync(pidFile, String(portPid));
    return;
  }

  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`playground Next server already running with PID ${existingPid}`);
    return;
  }

  if (existingPid) {
    rmSync(pidFile, { force: true });
  }

  const stdout = openSync(outLog, 'a');
  const stderr = openSync(errLog, 'a');

  const child = spawn('bun', ['run', '--cwd', 'apps/playground', 'start:next'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', stdout, stderr],
    windowsHide: true,
  });

  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  writeFileSync(pidFile, String(child.pid));

  console.log(`started playground Next server with PID ${child.pid}`);
  console.log('url: http://127.0.0.1:3000');
  console.log(`stdout: ${outLog}`);
  console.log(`stderr: ${errLog}`);
}

function stop() {
  const pid = readPid();
  const portPid = findPidOnPort(port);

  if (!pid && !portPid) {
    console.log('playground Next server PID file not found');
    return;
  }

  const targetPid = portPid ?? pid;
  if (!targetPid || !isRunning(targetPid)) {
    rmSync(pidFile, { force: true });
    console.log(`playground Next server PID ${pid ?? portPid} is not running; removed stale PID file`);
    return;
  }

  stopPid(targetPid);
  rmSync(pidFile, { force: true });
  console.log(`stopped playground Next server with PID ${targetPid}`);
}

function status() {
  const pid = readPid();
  const portPid = findPidOnPort(port);
  if (portPid) {
    if (pid !== portPid) {
      ensureDirs();
      writeFileSync(pidFile, String(portPid));
    }
    console.log(`playground Next server is listening on port ${port} with PID ${portPid}`);
    console.log(`url: http://127.0.0.1:${port}`);
    return;
  }

  if (!pid) {
    console.log('playground Next server is not running');
    return;
  }

  if (isRunning(pid)) {
    console.log(`playground Next server is running with PID ${pid}`);
    console.log('url: http://127.0.0.1:3000');
    return;
  }

  rmSync(pidFile, { force: true });
  console.log(`playground Next server PID ${pid} is not running; removed stale PID file`);
}

const command = process.argv[2] ?? 'start';

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  default:
    console.error(`Unknown command "${command}". Use start, stop, or status.`);
    process.exit(1);
}
