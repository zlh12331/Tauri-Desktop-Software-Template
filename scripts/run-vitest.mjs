#!/usr/bin/env node
/**
 * Vitest launcher with Windows drive-letter casing normalization.
 *
 * WHY: vitest 4.1.10 (and vite 8) has a Windows bug (vitest issue #10812,
 * angular-cli#33559): if the process cwd uses a lowercase drive letter
 * (e.g. `cd /d f:\project`), Node's ESM cache keyed by URL treats
 * `file:///f:/...` and `file:///F:/...` as different modules, loading vitest
 * twice. The second copy has no runner state and every test file fails with
 * "Vitest failed to find the runner" / "Cannot read properties of undefined
 * (reading 'config')".
 *
 * FIX: normalize cwd via `fs.realpathSync.native()` before spawning vitest,
 * so the drive-letter casing always matches the on-disk canonical form
 * regardless of how the shell entered the directory.
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = realpathSync(join(scriptDir, '..'))
const vitestBin = join(root, 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(
  process.execPath,
  [vitestBin, ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  }
)

process.exit(result.status ?? 1)
