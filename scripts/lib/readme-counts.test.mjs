import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  astRules,
  capabilityFiles,
  developerDocs,
  docsMarkdownFiles,
  measureCounts,
  qualityGates,
  registryCommands,
  rustIntegrationTests,
} from './readme-counts.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'readme-counts-'))
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return root
}

test('developerDocs counts one file per bilingual pair', () => {
  const root = fixture({
    'docs/developer/testing.en.md': '# t',
    'docs/developer/testing.zh.md': '# t',
    'docs/developer/README.en.md': '# r',
    'docs/developer/index.txt': 'ignored',
  })
  assert.equal(developerDocs(root), 2)
})

test('docsMarkdownFiles counts both languages and nested directories', () => {
  const root = fixture({
    'docs/developer/testing.en.md': '# t',
    'docs/developer/testing.zh.md': '# t',
    'docs/adr/0001-x.md': '# a',
    'docs/tasks-todo/.gitkeep': '',
    'notes.txt': 'ignored',
  })
  assert.equal(docsMarkdownFiles(root), 3)
})

test('astRules counts rule files at any depth', () => {
  const root = fixture({
    '.ast-grep/rules/zustand/no-destructure.yml': 'rule:',
    '.ast-grep/rules/console/no-console.yml': 'rule:',
    '.ast-grep/rules/zustand/README.md': '# not a rule',
  })
  assert.equal(astRules(root), 2)
})

test('registryCommands counts ids declared by registry modules only', () => {
  const root = fixture({
    'src/lib/commands/navigation-commands.ts':
      "export const a = [\n  { id: 'one', run },\n  { id: 'two', run },\n]",
    'src/lib/commands/window-commands.ts': "export const b = [{ id: 'three' }]",
    // Test files assert ids too; counting them would double the claimed number.
    'src/lib/commands/window-commands.test.ts': "it('x', () => { id: 'nope' })",
    'src/lib/commands/registry.ts': "const notADeclaration = { id: 'nope' }",
  })
  assert.equal(registryCommands(root), 3)
})

test('qualityGates counts the steps chained by check:all', () => {
  const root = fixture({
    'package.json': JSON.stringify({
      scripts: { 'check:all': 'npm run a && npm run b && npm run c' },
    }),
  })
  assert.equal(qualityGates(root), 3)
})

test('rustIntegrationTests counts integration files only', () => {
  const root = fixture({
    'src-tauri/tests/preferences_integration.rs': 'fn x() {}',
    'src-tauri/tests/tray_integration.rs': 'fn x() {}',
    'src-tauri/tests/helpers.rs': 'not an integration suite',
  })
  assert.equal(rustIntegrationTests(root), 2)
})

test('capabilityFiles counts the declared permission surface', () => {
  const root = fixture({
    'src-tauri/capabilities/default.json': '{}',
    'src-tauri/capabilities/quick-pane.json': '{}',
    'src-tauri/capabilities/README.md': '# not a capability',
  })
  assert.equal(capabilityFiles(root), 2)
})

test('measureCounts returns every measured number under one key each', () => {
  const root = fixture({
    'docs/developer/testing.en.md': '# t',
    'docs/developer/testing.zh.md': '# t',
    '.ast-grep/rules/zustand/no-destructure.yml': 'rule:',
    'src/lib/commands/app-commands.ts': "[{ id: 'one' }, { id: 'two' }]",
    'src-tauri/tests/tray_integration.rs': 'fn x() {}',
    'src-tauri/capabilities/default.json': '{}',
    'package.json': JSON.stringify({
      scripts: { 'check:all': 'npm run a && npm run b' },
    }),
  })
  assert.deepEqual(measureCounts(root), {
    developerDocs: 1,
    docsMarkdownFiles: 2,
    astRules: 1,
    registryCommands: 2,
    qualityGates: 2,
    rustIntegrationTests: 1,
    capabilityFiles: 1,
  })
})

test('the real repository measures without throwing', () => {
  // A fixture proves the functions read what they claim; this proves the paths
  // still exist, so a moved directory fails the gate instead of returning zero.
  const root = join(import.meta.dirname, '..', '..')
  const counts = measureCounts(root)
  for (const [name, value] of Object.entries(counts)) {
    assert.ok(
      value > 0,
      `${name} measured ${value} — the path it reads is gone`
    )
  }
})
