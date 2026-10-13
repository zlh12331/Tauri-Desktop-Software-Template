/**
 * Decisions for the "tag the release after it merged" step, kept free of git so
 * they can be tested. `tag-release.js` is the CLI wrapper.
 *
 * Why the tag is a separate step: the version bump used to be committed and
 * pushed straight to `main` together with the tag. `main` is now protected by a
 * ruleset that requires a pull request and six status checks, so that push is
 * refused — and a refused push *after* the tag was created leaves a tag pointing
 * at a commit that is not on `main`, which is the `v0.1.2` stranding this
 * repository already has. Splitting the release into "PR, then tag the merge"
 * makes both failure modes impossible: nothing is pushed to `main` directly, and
 * a tag can only ever name a commit that is already on `main`.
 */

/**
 * @param target        the version being tagged, without a leading `v`
 * @param manifests     version readings taken from the merged `main`
 * @param tags          tags already present on the remote
 * @returns `{ ok, reason }` — never `{ ok: true }` on an unreadable input
 */
export function decideTag({ target, manifests, tags }) {
  if (typeof target !== 'string' || !/^\d+\.\d+\.\d+$/.test(target)) {
    return {
      ok: false,
      reason: `target version '${target}' is not a plain X.Y.Z`,
    }
  }

  const entries = Object.entries(manifests ?? {})
  if (entries.length === 0) {
    return {
      ok: false,
      reason:
        'no version could be read from the merged commit — refusing to tag something we cannot verify',
    }
  }

  const offTarget = entries.filter(([, value]) => value !== target)
  if (offTarget.length > 0) {
    return {
      ok: false,
      reason: `main does not carry v${target} yet: ${offTarget
        .map(([label, value]) => `${label}=${value ?? 'missing'}`)
        .join(', ')}. Was the release pull request merged?`,
    }
  }

  const normalized = new Set(tags.map(tag => tag.replace(/^v/, '')))
  if (normalized.has(target)) {
    return {
      ok: false,
      reason: `v${target} already exists on the remote; tagging again would overwrite a release`,
    }
  }

  return { ok: true, reason: `v${target} is on main and not yet released` }
}

/**
 * Arguments for regenerating CHANGELOG.md as if `tagVersion` were already the
 * newest tag.
 *
 * git-cliff labels the top section from the tags it can see, so a release
 * prepared before tagging carries `## [Unreleased]`. The release workflow then
 * regenerates the file from the tag and compares the two
 * (`git diff --exit-code -- CHANGELOG.md`), which differ by exactly that heading
 * — and `publish-tauri` needs that job, so the release builds never start.
 * Naming the tag at generation time makes the two runs byte-identical, and it is
 * what puts a `## [<version>]` section in the file for the release body to
 * extract; without it the published notes carry no changelog text at all.
 */
export function changelogArgs(tagVersion) {
  if (!/^v\d+\.\d+\.\d+$/.test(tagVersion ?? '')) {
    throw new Error(
      `the changelog needs the v-prefixed release version, got '${tagVersion}'`
    )
  }

  return ['run', 'changelog', '--', '--tag', tagVersion]
}

/** Branch name for the release pull request, e.g. `release/v0.2.0`. */
export function releaseBranch(version) {
  const tag = version.startsWith('v') ? version : `v${version}`
  return `release/${tag}`
}

/**
 * Rewrite the copy of the app version that `package-lock.json` keeps, and return
 * the new file text.
 *
 * This is not `npm install`: npm exports the ambient config as `npm_config_*`
 * environment variables, so a user-level `allow-scripts=…` reaches the nested npm
 * as if it were a command-line flag, and npm 12 refuses a command-line
 * `--allow-scripts` for a project-scoped install (EALLOWSCRIPTS). A release step
 * that dies on the maintainer's unrelated npm config is not a release step.
 *
 * A lock that does not already hold `currentVersion` is a refusal rather than a
 * rewrite: silently setting the new version would hide the drift that means
 * someone edited a manifest by hand, and the next `npm install` would undo it.
 */
export function bumpLockfileVersions(
  lockText,
  { currentVersion, nextVersion }
) {
  let lock
  try {
    lock = JSON.parse(lockText)
  } catch (error) {
    return {
      ok: false,
      reason: `package-lock.json is not valid JSON: ${error.message}`,
    }
  }

  const fields = []
  if ('version' in lock) fields.push(['top-level "version"', lock.version])
  const root = lock.packages?.['']
  if (root && 'version' in root) {
    fields.push(['packages[""].version', root.version])
  }

  if (fields.length === 0) {
    return {
      ok: false,
      reason:
        'package-lock.json holds no version field at all — this is not a lockfile this script knows how to update',
    }
  }

  const drifted = fields.filter(([, value]) => value !== currentVersion)
  if (drifted.length > 0) {
    return {
      ok: false,
      reason: `package-lock.json does not hold ${currentVersion}: ${drifted
        .map(([label, value]) => `${label}=${value ?? 'missing'}`)
        .join(', ')}. Run \`npm install\` to resync it before releasing.`,
    }
  }

  if ('version' in lock) lock.version = nextVersion
  if (root && 'version' in root) root.version = nextVersion

  return {
    ok: true,
    text: JSON.stringify(lock, null, 2) + '\n',
    updated: fields.map(([label]) => label),
  }
}
