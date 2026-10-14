/**
 * Integration tests for the code-signing CLI.
 *
 * The pure module is tested in `lib/code-signing.test.mjs`, but the bug this file
 * exists to catch lives in the wiring between halves: the CLI once read only the
 * config-side problems and dropped the environment-side ones, so a certificate that
 * produced no identity exited 0 and left a half-signed release looking fine. Unit
 * tests on the module could not see that; running the script can.
 */
import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const script = join(root, 'scripts', 'configure-code-signing.mjs')
const work = join(root, 'node_modules', '.cache', 'configure-code-signing')
const target = join(work, 'tauri.conf.json')

const SOURCE = `{
  "bundle": {
    "createUpdaterArtifacts": true,
    "macOS": { "signingIdentity": "-", "minimumSystemVersion": "10.15" },
    "windows": { "certificateThumbprint": null, "digestAlgorithm": "sha256" }
  }
}`

// Every case states all four inputs: an unset key here would inherit the developer's
// own environment and make the verdict depend on the machine.
function run(env) {
  const result = spawnSync(process.execPath, [script, '--config', target], {
    encoding: 'utf8',
    cwd: root,
    env: {
      APPLE_CERTIFICATE: '',
      WINDOWS_CERTIFICATE: '',
      TAURI_MACOS_SIGNING_IDENTITY: '',
      WINDOWS_CERTIFICATE_THUMBPRINT: '',
      ...env,
    },
  })
  return {
    status: result.status,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    config: JSON.parse(readFileSync(target, 'utf8')),
  }
}

const APPLE = 'Developer ID Application: Example Ltd (ABCDE12345)'

before(() => {
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
})

test('nothing configured exits green and leaves the defaults alone', () => {
  writeFileSync(target, SOURCE)
  const r = run({})
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /no certificate configured/)
  assert.equal(r.config.bundle.macOS.signingIdentity, '-')
  assert.equal(r.config.bundle.windows.certificateThumbprint, null)
})

test('a certificate with no identity exits 1 and writes nothing', () => {
  // The regression this line guards: the environment-side refusal must reach the
  // exit code, not just the module that produced it.
  writeFileSync(target, SOURCE)
  const r = run({ APPLE_CERTIFICATE: 'ZWNmZA==' })
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /APPLE_CERTIFICATE is set but no codesigning identity/)
  assert.match(r.out, /must not go out half-signed/)
  assert.equal(
    readFileSync(target, 'utf8'),
    SOURCE,
    'a refusal must leave the config untouched'
  )
})

test('a certificate with no thumbprint exits 1', () => {
  writeFileSync(target, SOURCE)
  const r = run({ WINDOWS_CERTIFICATE: 'ZWNmZA==' })
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /WINDOWS_CERTIFICATE is set but no certificate/)
})

test('both halves wired writes both fields and reports the two moves', () => {
  writeFileSync(target, SOURCE)
  const r = run({
    APPLE_CERTIFICATE: 'ZWNmZA==',
    TAURI_MACOS_SIGNING_IDENTITY: APPLE,
    WINDOWS_CERTIFICATE: 'ZWNmZA==',
    WINDOWS_CERTIFICATE_THUMBPRINT: 'AABBCCDD',
  })
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /signingIdentity: "-" →/)
  assert.match(r.out, /certificateThumbprint: null →/)
  assert.equal(r.config.bundle.macOS.signingIdentity, APPLE)
  assert.equal(r.config.bundle.windows.certificateThumbprint, 'AABBCCDD')
  // Neighbours survive the text surgery, including the updater artifacts switch.
  assert.equal(r.config.bundle.createUpdaterArtifacts, true)
  assert.equal(r.config.bundle.macOS.minimumSystemVersion, '10.15')
})

test('an identity alone wires only macOS, so a Windows build is not implied', () => {
  writeFileSync(target, SOURCE)
  const r = run({ TAURI_MACOS_SIGNING_IDENTITY: APPLE })
  assert.equal(r.status, 0, r.out)
  assert.equal(r.config.bundle.macOS.signingIdentity, APPLE)
  assert.equal(r.config.bundle.windows.certificateThumbprint, null)
})
