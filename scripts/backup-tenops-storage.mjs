/** Opaque, download-only Storage snapshot using the supported Supabase CLI.
 * Run against an owner-managed encrypted backup volume, never the repository.
 * No remote delete, upload, restore, schedule, or credential creation exists here.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT = 'vxdxjhazkqhpkwdqtobp';
export const BUCKETS = Object.freeze([
  'job-attachments', 'project-task-attachments', 'purchase-order-documents',
  'job-transmittal-documents', 'receiving-documents', 'proposal-documents',
  'my-work-attachments', 'bid-files', 'sample-documents',
  'my-work-inbox-attachments', 'historical-samples', 'invoice-receival-originals',
]);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contains = (parent, child) => { const r = relative(parent, child); return !r || (!r.startsWith('..') && !isAbsolute(r)); };

export async function inventory(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Symlinks are not allowed in a snapshot');
    if (entry.isDirectory()) files.push(...await inventory(path, root));
    else {
      assert(entry.isFile(), 'Only regular files are allowed in a snapshot');
      const hash = createHash('sha256'); let bytes = 0;
      for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
      files.push({ path: relative(root, path), bytes, sha256: hash.digest('hex') });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function backup(destination, { encryptedDestination = false, cli = process.env.TENOPS_SUPABASE_CLI || 'supabase', run = spawnSync } = {}) {
  assert(encryptedDestination, 'Confirm an owner-managed encrypted destination with --encrypted-destination');
  assert(isAbsolute(destination), 'An absolute destination is required');
  const parent = await realpath(dirname(destination));
  const output = join(parent, destination.split('/').at(-1));
  assert(!contains(await realpath(repository), output), 'Backups must remain outside the repository');
  const parentStat = await lstat(parent);
  assert(parentStat.isDirectory() && parentStat.uid === process.getuid?.() && (parentStat.mode & 0o077) === 0, 'Destination parent must be owner-only (0700)');
  assert.equal((await readFile(join(repository, 'supabase/.temp/project-ref'), 'utf8')).trim(), PROJECT, 'Linked project must be tenartenDB');
  process.umask(0o077);
  await mkdir(output, { mode: 0o700 }); // Exclusive new snapshot; never overwrite or mirror-delete.
  const startedAt = new Date().toISOString();
  await writeFile(join(output, 'status.json'), JSON.stringify({ project: PROJECT, startedAt, complete: false }) + '\n', { mode: 0o600 });
  for (const bucket of BUCKETS) {
    const target = join(output, bucket);
    await mkdir(target, { mode: 0o700 });
    const result = run(cli, ['storage', 'cp', `ss://${bucket}/`, target, '--recursive', '--linked', '--experimental'], {
      cwd: repository, encoding: 'utf8', timeout: 600_000, maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // CLI output can contain private object paths; retain it only beside the backup.
    await writeFile(join(output, `${bucket}.log`), String(result.stdout ?? '') + String(result.stderr ?? ''), { mode: 0o600 });
    assert(result.status === 0 && !result.error, `Storage copy failed for ${bucket}; snapshot remains incomplete`);
  }
  const files = [];
  for (const bucket of BUCKETS) for (const file of await inventory(join(output, bucket))) files.push({ bucket, ...file });
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ project: PROJECT, startedAt, completedAt: new Date().toISOString(), consistency: 'Non-transactional Storage copy; pair with a database recovery point and validate references during recovery.', files }, null, 2) + '\n', { mode: 0o600 });
  await writeFile(join(output, 'status.json'), JSON.stringify({ project: PROJECT, startedAt, complete: true, objects: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }) + '\n', { mode: 0o600 });
  return { complete: true, objects: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--encrypted-destination') {
    console.error('Usage: node scripts/backup-tenops-storage.mjs --encrypted-destination /absolute/private/backup-volume/new-snapshot');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await backup(args[1], { encryptedDestination: true }))); }
    catch (error) { console.error(error instanceof assert.AssertionError ? error.message : 'Backup failed; check the private destination and installed Supabase CLI.'); process.exitCode = 1; }
  }
}
