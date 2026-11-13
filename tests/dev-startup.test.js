import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  cpSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, basename, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ensureDevBuild } from '../scripts/dev-server.js';

test(
  'fresh local startup builds missing bundles, loads .env.local, and also starts without it',
  { timeout: 60000 },
  async () => {
    const temporaryRoot = resolve(tmpdir());
    const directory = mkdtempSync(join(temporaryRoot, 'prospecto-dev-'));
    const bundles = [
      'bootstrap.js',
      'auth-page.js',
      'platform.js',
      'workspace.js',
      'intelligence.js',
    ];
    let child;
    async function start() {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !/^(SUPABASE_|NEXT_PUBLIC_|AI_GATEWAY_|VERCEL_|VERCEL$|PORT$|NODE_ENV$|BLOB_READ_WRITE_TOKEN$|CRON_SECRET$)/.test(
              key,
            ),
        ),
      );
      const [command, ...args] = JSON.parse(
        readFileSync(join(directory, 'package.json'), 'utf8'),
      ).scripts.dev.split(' ');
      assert.equal(command, 'node');
      child = spawn(process.execPath, args, {
        cwd: directory,
        env: { ...env, PORT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      return new Promise((resolveReady, reject) => {
        const timer = setTimeout(
          () => reject(Error('Local startup did not become ready: ' + output)),
          25000,
        );
        child.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once('exit', () => {
          clearTimeout(timer);
          reject(Error('Local startup exited: ' + output));
        });
        child.stderr.on('data', (chunk) => {
          output = (output + chunk).slice(-6000);
        });
        child.stdout.on('data', (chunk) => {
          output = (output + chunk).slice(-6000);
          const match = output.match(
            /ProspectoAI: (http:\/\/127\.0\.0\.1:\d+)/,
          );
          if (match) {
            clearTimeout(timer);
            resolveReady(match[1]);
          }
        });
      });
    }
    async function stop() {
      if (child && child.exitCode === null) {
        const closed = once(child, 'exit');
        child.kill();
        await closed;
      }
      child = null;
    }
    try {
      for (const path of [
        'api',
        'lib',
        'data',
        'src',
        'scripts',
        'package.json',
      ])
        cpSync(resolve(path), join(directory, path), { recursive: true });
      cpSync(resolve('dist'), join(directory, 'dist'), {
        recursive: true,
        filter: (path) => !bundles.includes(basename(path)),
      });
      symlinkSync(
        resolve('node_modules'),
        join(directory, 'node_modules'),
        'junction',
      );
      writeFileSync(
        join(directory, '.env.local'),
        'SUPABASE_URL=https://example.supabase.co\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_local_test\nSUPABASE_SECRET_KEY=private-local-test\nAI_GATEWAY_API_KEY=private-gateway-test\n',
      );
      let base = await start();
      let config = await fetch(base + '/api/config');
      assert.equal(config.status, 200);
      const body = await config.json();
      assert.equal(body.supabaseKey, 'sb_publishable_local_test');
      assert(!JSON.stringify(body).includes('private-'));
      for (const bundle of bundles) {
        assert(statSync(join(directory, 'dist', bundle)).size > 100);
        assert.equal((await fetch(base + '/' + bundle)).status, 200);
      }
      assert.equal((await fetch(base + '/login')).status, 200);
      assert.equal((await fetch(base + '/.env.local')).status, 404);
      assert.equal(ensureDevBuild(directory), false);
      await stop();
      rmSync(join(directory, '.env.local'));
      base = await start();
      config = await fetch(base + '/api/config');
      assert.equal(config.status, 503);
      assert.equal((await config.json()).code, 'auth_not_configured');
      assert.equal((await fetch(base + '/login')).status, 200);
    } finally {
      await stop();
      // Only the uniquely created fixture beneath the OS temporary directory is removed.
      assert.equal(dirname(resolve(directory)), temporaryRoot);
      assert(basename(directory).startsWith('prospecto-dev-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
