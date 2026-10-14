/**
 * Pure tests for the code-signing wiring: what gets applied, and what must stop the
 * release instead of quietly shipping an unsigned bundle.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applySigningText, resolveSigning } from './code-signing.mjs'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

const CONFIG = `{
  "bundle": {
    "createUpdaterArtifacts": true,
    "macOS": { "signingIdentity": "-", "minimumSystemVersion": "10.15" },
    "windows": { "certificateThumbprint": null, "digestAlgorithm": "sha256" }
  }
}`

test('nothing is configured, so nothing is claimed', () => {
  const r = resolveSigning({})
  assert.equal(r.identity, null)
  assert.equal(r.thumbprint, null)
  assert.deepEqual(r.problems, [])
})

test('a certificate secret with no usable identity stops the release', () => {
  // This is the silent failure being removed: the operator paid for a certificate,
  // the import step ran, and the bundle would still ship ad-hoc with green checks.
  const apple = resolveSigning({ appleSecret: true })
  assert.equal(apple.problems.length, 1)
  assert.match(
    apple.problems[0],
    /APPLE_CERTIFICATE is set but no codesigning identity/
  )

  const windows = resolveSigning({ windowsSecret: true })
  assert.equal(windows.problems.length, 1)
  assert.match(
    windows.problems[0],
    /WINDOWS_CERTIFICATE is set but no certificate/
  )

  const both = resolveSigning({ appleSecret: true, windowsSecret: true })
  assert.equal(both.problems.length, 2)
})

test('an identity or thumbprint that did arrive is carried through', () => {
  const r = resolveSigning({
    appleSecret: true,
    windowsSecret: true,
    identity: 'Developer ID Application: Example Ltd (ABCDE12345)',
    thumbprint: 'AABBCCDD',
  })
  assert.deepEqual(r.problems, [])
  assert.equal(r.identity, 'Developer ID Application: Example Ltd (ABCDE12345)')
  assert.equal(r.thumbprint, 'AABBCCDD')
})

test('the config edit touches one value per platform and reports both moves', () => {
  const { text, changed, problems } = applySigningText(CONFIG, {
    identity: 'Developer ID Application: Example Ltd (ABCDE12345)',
    thumbprint: 'AABBCCDD',
  })
  assert.deepEqual(problems, [])
  assert.equal(changed.length, 2)
  assert.match(
    changed[0],
    /bundle\.macOS\.signingIdentity: "-" → "Developer ID/
  )
  assert.match(
    changed[1],
    /bundle\.windows\.certificateThumbprint: null → "AABBCCDD"/
  )

  const parsed = JSON.parse(text)
  assert.equal(
    parsed.bundle.macOS.signingIdentity,
    'Developer ID Application: Example Ltd (ABCDE12345)'
  )
  assert.equal(parsed.bundle.windows.certificateThumbprint, 'AABBCCDD')
  // Neighbours must survive: the bundle block also carries updater and runtime keys.
  assert.equal(parsed.bundle.createUpdaterArtifacts, true)
  assert.equal(parsed.bundle.macOS.minimumSystemVersion, '10.15')
  assert.equal(parsed.bundle.windows.digestAlgorithm, 'sha256')
})

test('no identity means the config comes back byte-for-byte unchanged', () => {
  const { text, changed, problems } = applySigningText(CONFIG, {
    identity: null,
    thumbprint: null,
  })
  assert.equal(text, CONFIG)
  assert.deepEqual(changed, [])
  assert.deepEqual(problems, [])
})

test('a config missing the field is a refusal, not a no-op', () => {
  const sparse = '{ "bundle": { "macOS": {}, "windows": {} } }'
  const { changed, problems } = applySigningText(sparse, {
    identity: 'Developer ID Application: Example Ltd (ABCDE12345)',
    thumbprint: 'AABBCCDD',
  })
  assert.deepEqual(changed, [])
  assert.equal(problems.length, 2)
  assert.match(problems.join(), /refusing to guess where it belongs/)
})

test('the shipped config still holds the defaults this wiring assumes', () => {
  // release-v2.yml's posture text and this module both assume the template ships
  // unsigned on purpose. If that changes here, the assumption changes there too.
  const config = JSON.parse(
    readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')
  )
  assert.equal(config.bundle.macOS.signingIdentity, '-')
  assert.equal(config.bundle.windows.certificateThumbprint, null)
})
