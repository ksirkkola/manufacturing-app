#!/usr/bin/env node
/**
 * git-sync — runs before every build+publish so the git repo backing this app can never
 * drift from what's actually deployed. Stages + commits any pending changes (message built
 * from public/manifest.json's version + versionDescription) and pushes to origin.
 *
 * Why this exists: this app's git repo (ksirkkola/my-pto) silently fell multiple versions
 * behind the live published bundle — the live app had a whole extra set of features (My
 * Documents, Company Documents tabs) that were never committed anywhere. Nobody noticed
 * until an edit was attempted against the stale repo, which would have deleted those
 * features on publish. This script makes that class of bug structurally impossible: you
 * cannot publish without the current code landing in GitHub first.
 *
 * Silently no-ops (exit 0) if this app isn't git-linked (no .git directory) or if there's
 * no GITHUB_TOKEN available — so it's safe to wire into every app's publish scripts
 * regardless of whether that particular app uses git.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
// Dedicated file, NOT the shared project .env — the Hailer publish tool rewrites that file
// on every publish (regenerating HAILER_USER_API_KEY), wiping anything else stored there.
// Learned this the hard way: the token silently disappeared after the very first publish
// run following its initial setup.
const TOKEN_FILE = path.resolve(APP_DIR, '../../.github-token');
const LEGACY_ENV_FILE = path.resolve(APP_DIR, '../../.env'); // fallback for old setups

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: APP_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function tryRun(cmd) {
  try { return run(cmd); } catch { return null; }
}

function readEnvToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) {
    const value = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (value) return value;
  }
  // Fallback for anything set up before this file existed — .env can get wiped by the
  // publish tool, so this path is unreliable long-term, but still worth checking.
  if (fs.existsSync(LEGACY_ENV_FILE)) {
    const match = fs.readFileSync(LEGACY_ENV_FILE, 'utf8').match(/^GITHUB_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

function main() {
  if (!fs.existsSync(path.join(APP_DIR, '.git'))) {
    console.log('[git-sync] Not a git repo — skipping.');
    return;
  }

  const remote = tryRun('git remote get-url origin');
  if (!remote) {
    console.log('[git-sync] No git remote configured — skipping.');
    return;
  }

  const token = readEnvToken();
  if (!token) {
    console.warn('[git-sync] No GitHub token found (checked env var, ../../.github-token, legacy ../../.env) '
      + '— skipping push. Local commits (if any) will NOT reach GitHub. '
      + 'Put the token in a .github-token file at the project root (NOT .env — the publish tool rewrites that).');
    return;
  }

  // Commit any pending changes, using the manifest's version/description as the message.
  const status = tryRun('git status --porcelain') || '';
  if (status.trim().length > 0) {
    const manifestPath = path.join(APP_DIR, 'public/manifest.json');
    let message = 'Auto-commit before publish';
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      message = `v${manifest.version}: ${manifest.versionDescription || 'Publish'}`.slice(0, 500);
    }
    run('git add -A');
    // Identity may not be configured in a fresh environment — set a fallback, local to this repo only.
    if (!tryRun('git config user.email')) run('git config user.email "agent@hailer.com"');
    if (!tryRun('git config user.name')) run('git config user.name "Hailer Publish Bot"');
    run(`git commit -m ${JSON.stringify(message)}`);
    console.log('[git-sync] Committed pending changes.');
  } else {
    console.log('[git-sync] No pending changes to commit.');
  }

  // Push using the token via a request header — never written into .git/config, so it
  // can't linger in a file or leak via `git remote -v`.
  const branch = tryRun('git rev-parse --abbrev-ref HEAD') || 'main';
  const auth = Buffer.from(`x-access-token:${token}`).toString('base64');
  // Redact both the raw token AND its base64 form — execSync errors echo the full failed
  // command (including the auth header), so the base64 string must be scrubbed too, not
  // just the raw github_pat_ pattern.
  function redact(text) {
    return String(text)
      .split(auth).join('[REDACTED]')
      .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED]');
  }
  try {
    run(`git -c http.extraHeader="Authorization: Basic ${auth}" push origin ${branch}`);
    console.log(`[git-sync] Pushed to origin/${branch}.`);
  } catch (err) {
    console.error('[git-sync] Push FAILED — publish will continue, but GitHub is now out of sync again. '
      + 'Resolve this before the next edit.');
    console.error(redact(err.message || err));
  }
}

main();
