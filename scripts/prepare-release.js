#!/usr/bin/env node

import fs from 'fs'
import { spawnSync } from 'child_process'
import readline from 'readline'
import { releaseBranch } from './lib/release-flow.mjs'

/**
 * Resolve the npm CLI entry point. When a script runs under `npm run`, npm
 * exposes its own JS entry via the npm_execpath env var. Spawning that file
 * with the current Node binary is shell-free and behaves identically on
 * Windows, macOS, and Linux — no npm.cmd / .cmd shim involved.
 */
function npmArgs(args) {
  const npmCli = process.env.npm_execpath
  if (!npmCli) {
    throw new Error(
      'npm_execpath is not set — run this script via `npm run release:prepare`'
    )
  }
  return [process.execPath, npmCli, ...args]
}

/**
 * Run a command as [cmd, ...args] via spawnSync. Arrays bypass the shell
 * entirely, so interpolated values can never be interpreted by a shell —
 * there is no command-line injection surface.
 */
function exec(command, options = {}) {
  try {
    const result = spawnSync(command[0], command.slice(1), {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
    if (result.status !== 0) {
      const detail = result.stderr?.trim()
      throw new Error(detail || `exited with code ${result.status}`)
    }
    return result.stdout ?? ''
  } catch (error) {
    throw new Error(`Command failed: ${command.join(' ')}\n${error.message}`)
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function prepareRelease() {
  // --non-interactive: skip the git y/N prompt and commit/tag/push directly.
  // Used by CI / release automation. Local default stays interactive.
  const nonInteractive = process.argv.includes('--non-interactive')
  const version = process.argv.find(
    a => !a.startsWith('-') && /^v?\d+\.\d+\.\d+$/.test(a)
  )

  if (!version) {
    console.error(
      '❌ Usage: npm run release:prepare -- v1.0.0 [--non-interactive]'
    )
    console.error(
      '   or: node scripts/prepare-release.js v1.0.0 [--non-interactive]'
    )
    process.exit(1)
  }

  const cleanVersion = version.replace('v', '')
  const tagVersion = version.startsWith('v') ? version : `v${version}`

  console.log(`🚀 Preparing release ${tagVersion}...\n`)

  try {
    // Check git status
    console.log('🔍 Checking git status...')
    const gitStatus = exec(['git', 'status', '--porcelain'], { silent: true })
    if (gitStatus.trim()) {
      console.error(
        '❌ Working directory is not clean. Please commit or stash changes first.'
      )
      console.log('Uncommitted changes:')
      console.log(gitStatus)
      process.exit(1)
    }
    console.log('✅ Working directory is clean')

    // Pre-flight on the version before anything expensive runs. Two failure
    // modes are worth catching in the first second rather than after the full
    // suite: the four version fields disagreeing (the release script rewrites
    // them with regex substitutions, so a missed one ships a bundle whose
    // manifest, installer metadata and updater metadata disagree), and the
    // target version already existing as a tag — re-cutting a released version
    // leaves the older artifacts unreachable because the updater resolves
    // /releases/latest/download/latest.json against the newest tag.
    console.log('\n🔍 Checking version parity and release order...')
    exec(['node', 'scripts/check-version.mjs', '--pre-release', tagVersion])
    console.log(
      '✅ Version fields agree and the target advances the release line'
    )

    // Run all checks first
    console.log('\n🔍 Running pre-release checks...')
    exec(npmArgs(['run', 'check:all']))
    console.log('✅ All checks passed')

    // Update package.json
    console.log('\n📝 Updating package.json...')
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const oldPkgVersion = pkg.version
    pkg.version = cleanVersion
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
    console.log(`   ${oldPkgVersion} → ${cleanVersion}`)

    // Update Cargo.toml
    console.log('📝 Updating Cargo.toml...')
    const cargoPath = 'src-tauri/Cargo.toml'
    const cargoToml = fs.readFileSync(cargoPath, 'utf8')
    const oldCargoVersion = cargoToml.match(/version = "([^"]*)"/)
    const updatedCargo = cargoToml.replace(
      /version = "[^"]*"/,
      `version = "${cleanVersion}"`
    )
    fs.writeFileSync(cargoPath, updatedCargo)
    console.log(
      `   ${oldCargoVersion ? oldCargoVersion[1] : 'unknown'} → ${cleanVersion}`
    )

    // Update tauri.conf.json
    console.log('📝 Updating tauri.conf.json...')
    const tauriConfigPath = 'src-tauri/tauri.conf.json'
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'))
    const oldTauriVersion = tauriConfig.version
    tauriConfig.version = cleanVersion
    fs.writeFileSync(
      tauriConfigPath,
      JSON.stringify(tauriConfig, null, 2) + '\n'
    )
    console.log(`   ${oldTauriVersion} → ${cleanVersion}`)

    // Run npm install to update lock files
    console.log('\n📦 Updating lock files...')
    exec(npmArgs(['install']), { silent: true })
    console.log('✅ Lock files updated')

    // Generate CHANGELOG for this release (git-cliff, based on commits since
    // the previous tag). Committed together with the version bump below.
    console.log('\n📝 Generating CHANGELOG...')
    exec(npmArgs(['run', 'changelog']), { silent: true })
    console.log('✅ CHANGELOG updated')

    // Verify configurations
    console.log('\n🔍 Verifying configurations...')

    if (!tauriConfig.bundle?.createUpdaterArtifacts) {
      console.warn(
        '⚠️  Warning: createUpdaterArtifacts not enabled in tauri.conf.json'
      )
    } else {
      console.log('✅ Updater artifacts enabled')
    }

    if (!tauriConfig.plugins?.updater?.pubkey) {
      console.warn('⚠️  Warning: Updater public key not configured')
    } else {
      console.log('✅ Updater public key configured')
    }

    // Final check that Rust code compiles (cross-platform: no `source`, which
    // only exists in bash and would fail on Windows cmd/PowerShell).
    console.log('\n🔍 Running final compilation check...')
    exec(['cargo', 'check', '--manifest-path', 'src-tauri/Cargo.toml'])
    console.log('✅ Rust compilation check passed')

    console.log(`\n🎉 Successfully prepared release ${tagVersion}!`)

    // The bump no longer goes to `main` by hand. `main` is protected by a ruleset
    // that requires a pull request plus status checks, so `git push origin main`
    // is refused — and a refusal that lands *after* `git tag` leaves a tag naming
    // a commit `main` never had. That is precisely how v0.1.2 got stranded in this
    // repository. The release is therefore split: commit on `release/vX`, open the
    // pull request, and tag the merge afterwards with `npm run release:tag`.
    const baseBranch =
      exec(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { silent: true })
        .trim()
        .replace(/^HEAD$/, 'main') || 'main'
    const branch = releaseBranch(tagVersion)

    console.log('\n📋 Git commands to execute:')
    console.log(`   git checkout -b ${branch}`)
    console.log('   git add .')
    console.log(`   git commit -m "chore: release ${tagVersion}"`)
    console.log(`   git push -u origin ${branch}`)
    console.log(
      `   gh pr create --base ${baseBranch} --head ${branch} --title "chore: release ${tagVersion}"`
    )

    console.log('\n🚀 After the pull request merges:')
    console.log(`   npm run release:tag -- ${tagVersion}`)
    console.log('   • the tag push is what triggers the release build')
    console.log('   • a draft release is created, and you publish it by hand')
    console.log('   • users then receive auto-update notifications')

    // Interactive execution option (auto-proceed in --non-interactive mode)
    const answer = nonInteractive
      ? 'y'
      : await askQuestion(
          '\n❓ Would you like me to execute these git commands? (y/N): '
        )

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('\n⚡ Executing git commands...')

      console.log(`🌿 Creating and switching to ${branch}...`)
      exec(['git', 'checkout', '-b', branch])

      console.log('📝 Adding changes...')
      exec(['git', 'add', '.'])

      console.log('💾 Creating commit...')
      exec(['git', 'commit', '-m', `chore: release ${tagVersion}`])

      console.log('📤 Pushing the release branch...')
      exec(['git', 'push', '-u', 'origin', branch])

      // The pull request is opened through gh when it is available; without it the
      // branch is still pushed, so the fallback is a URL rather than a dead end.
      const prBody = [
        `Release ${tagVersion}.`,
        '',
        'Bumps `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and',
        '`src-tauri/tauri.conf.json` together with the generated CHANGELOG.',
        '',
        `Once merged, run \`npm run release:tag -- ${tagVersion}\` to tag the merge`,
        'and start the release build.',
      ].join('\n')
      const pr = spawnSync(
        'gh',
        [
          'pr',
          'create',
          '--base',
          baseBranch,
          '--head',
          branch,
          '--title',
          `chore: release ${tagVersion}`,
          '--body',
          prBody,
        ],
        { encoding: 'utf8' }
      )
      if (pr.status === 0) {
        console.log(`🔗 Pull request opened: ${pr.stdout?.trim()}`)
      } else {
        console.warn(
          `⚠️  Could not open the pull request automatically (${pr.stderr?.trim() || 'gh unavailable'}).`
        )
        console.warn(
          `   Open it by hand: ${baseBranch} ← ${branch}, title "chore: release ${tagVersion}"`
        )
      }

      console.log(
        `\n🎊 Release ${tagVersion} is on ${branch}, waiting for merge.`
      )
      console.log(`   After it merges: npm run release:tag -- ${tagVersion}`)
    } else {
      console.log('\n📝 Git commands saved for manual execution.')
      console.log("   Run them when you're ready to release.")
    }
  } catch (error) {
    console.error('\n❌ Pre-release preparation failed:', error.message)
    process.exit(1)
  }
}

// Run if this is the main module
prepareRelease()
