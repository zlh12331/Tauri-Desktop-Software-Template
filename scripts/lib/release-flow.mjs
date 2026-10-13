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

/** Branch name for the release pull request, e.g. `release/v0.2.0`. */
export function releaseBranch(version) {
  const tag = version.startsWith('v') ? version : `v${version}`
  return `release/${tag}`
}
