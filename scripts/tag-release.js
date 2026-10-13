#!/usr/bin/env node
/**
 * Tag a release from the merged `main`, the second half of `release:prepare`.
 *
 *   node scripts/tag-release.js v0.2.0
 *
 * `prepare-release` bumps the versions on a `release/vX` branch and opens a pull
 * request; this script runs after that pull request merges. Splitting it this way
 * removes two ways to strand a release: pushing straight to `main` is refused by
 * the branch ruleset (and a refusal that happens after `git tag` leaves a tag on
 * a commit `main` never had), and tagging before the merge would publish a version
 * whose code is not on the trunk.
 *
 * Nothing is pushed without a `y` answer unless `--yes` is given.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { decideTag } from './lib/release-flow.mjs'
import {
  extractCargoVersion,
  extractLockedVersion,
} from './lib/version-parity.mjs'

const argv = process.argv.slice(2)
const autoYes = argv.includes('--yes')
const versionArg = argv.find(a => /^v?\d+\.\d+\.\d+$/.test(a))
const refName = process.env.RELEASE_REF ?? 'origin/main'

if (!versionArg) {
  console.error('❌ Usage: node scripts/tag-release.js v0.2.0 [--yes]')
  process.exit(1)
}

const target = versionArg.replace(/^v/, '')
const tagVersion = `v${target}`

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')}: ${result.stderr?.trim() ?? 'failed'}`
    )
  }
  return result.stdout ?? ''
}

// Fetch first: a stale `origin/main` would report "the release is not on main
// yet" for a pull request that merged five minutes ago.
git(['fetch', '--quiet', 'origin', refName.replace(/^origin\//, '')])

const read = path => {
  try {
    return git(['show', `${refName}:${path}`])
  } catch {
    return null
  }
}

const parseJson = text => {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const pkg = parseJson(read('package.json'))
const conf = parseJson(read('src-tauri/tauri.conf.json'))
const cargoToml = read('src-tauri/Cargo.toml')
const cargoLock = read('src-tauri/Cargo.lock')

const manifests = {
  'package.json': pkg?.version ?? null,
  'tauri.conf.json': conf?.version ?? null,
  'Cargo.toml': extractCargoVersion(cargoToml ?? ''),
  'Cargo.lock': extractLockedVersion(
    cargoLock ?? '',
    pkg?.name ?? 'tauri-desktop-software-template'
  ),
}

const tags = git(['ls-remote', '--tags', 'origin'])
  .split('\n')
  .filter(Boolean)
  .map(line => (line.split('\t')[1] ?? '').replace('refs/tags/', ''))
  .filter(tag => tag !== '' && !tag.endsWith('^{}'))

const decision = decideTag({ target, manifests, tags })

console.log(`Tagging ${tagVersion} from ${refName}`)
for (const [label, value] of Object.entries(manifests)) {
  console.log(`  ${label.padEnd(18)} ${value ?? 'NOT FOUND'}`)
}

if (!decision.ok) {
  console.error(`\n❌ ${decision.reason}`)
  process.exit(1)
}

console.log(`\n✅ ${decision.reason}`)
console.log(`   git tag -a ${tagVersion} ${refName} -m "Release ${tagVersion}"`)
console.log(`   git push origin ${tagVersion}`)

if (!autoYes) {
  // `rl.question()` reports through a callback; awaiting its return value yields
  // undefined, which read as a crash here before it could tag anything.
  const answer = await new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question('\n❓ Execute these two commands now? (y/N): ', value => {
      rl.close()
      resolve(value.trim().toLowerCase())
    })
  })
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n📝 Nothing pushed. Re-run when ready.')
    process.exit(0)
  }
}

git(['tag', '-a', tagVersion, refName, '-m', `Release ${tagVersion}`])
git(['push', 'origin', tagVersion])

console.log(`\n🎊 ${tagVersion} tagged on ${refName} and pushed.`)
console.log('   • The tag push triggers Release (push: tags v*)')
console.log(`   • Draft release: gh release view ${tagVersion} --web`)
console.log('   • Publish the draft by hand when the assets look right.')
