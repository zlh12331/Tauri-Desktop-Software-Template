#!/usr/bin/env node
/**
 * Point the bundler at the certificate this release imported.
 *
 * Reads the two secrets' presence plus the identity/thumbprint the import steps
 * exported, and edits `src-tauri/tauri.conf.json` so `tauri build` actually signs.
 * With no certificate configured it changes nothing at all — that is the template's
 * honest default, and the release notes say so.
 *
 * Reached from `release-v2.yml` between the certificate import and the build. Add
 * `--check` to report the decision without writing the file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applySigningText, resolveSigning } from './lib/code-signing.mjs'

const root = process.cwd()
const checkOnly = process.argv.includes('--check')
const configArg = process.argv.indexOf('--config')
const configPath =
  configArg === -1
    ? join(root, 'src-tauri', 'tauri.conf.json')
    : process.argv[configArg + 1]

const resolved = resolveSigning({
  appleSecret: Boolean(process.env.APPLE_CERTIFICATE),
  windowsSecret: Boolean(process.env.WINDOWS_CERTIFICATE),
  identity: (process.env.TAURI_MACOS_SIGNING_IDENTITY ?? '').trim(),
  thumbprint: (process.env.WINDOWS_CERTIFICATE_THUMBPRINT ?? '').trim(),
})

const source = readFileSync(configPath, 'utf8')
const {
  text,
  changed,
  problems: fieldProblems,
} = applySigningText(source, resolved)
// Both halves can refuse: the environment (a certificate that yielded nothing
// usable) and the config (a field that is not where this wiring expects it). Reading
// only one of them is how a fail-closed script ends up green on a half-signed release.
const problems = [...resolved.problems, ...fieldProblems]

for (const line of changed) console.log(`✔ code signing: ${line}`)
if (changed.length === 0 && problems.length === 0) {
  console.log(
    '✔ code signing: no certificate configured, tauri.conf.json left at its defaults'
  )
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`✖ ${problem}`)
  console.error(
    '✖ tauri.conf.json left unchanged; the release must not go out half-signed'
  )
  process.exit(1)
}

if (!checkOnly && changed.length > 0) {
  writeFileSync(configPath, text)
  console.log(`✔ wrote ${configPath.replace(`${root}/`, '')}`)
}
