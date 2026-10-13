/**
 * Version-parity rules, kept free of file and git access so they can be tested.
 * `check-version.mjs` is the CLI wrapper.
 *
 * The release script writes four places — `package.json`, `src-tauri/Cargo.toml`,
 * `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json` — with regex
 * substitutions. Nothing verified that they still agreed afterwards, so a
 * half-applied bump (a missed regex, a lockfile not refreshed) ships a bundle
 * whose updater metadata, installer metadata and app manifest disagree — and the
 * mismatch is only discovered by a user whose app cannot update.
 */

/**
 * The `version = "x"` line inside Cargo.toml's `[package]` table only. Scanning
 * the whole file would match dependency pins, which also carry `version =`.
 *
 * Line-based on purpose: a single regex over the file either stops at the first
 * line end (multiline `$` matches every line break) or swallows later sections.
 */
export function extractCargoVersion(text) {
  let inPackage = false
  for (const line of text.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]/.exec(line)
    if (section) {
      inPackage = section[1].trim() === 'package'
      continue
    }
    if (!inPackage) continue
    const found = /^\s*version\s*=\s*"([^"]+)"/.exec(line)
    if (found) return found[1]
  }
  return null
}

/** The lockfile's own entry for this package, not any dependency's. */
export function extractLockedVersion(text, packageName) {
  const entry = new RegExp(
    `name\\s*=\\s*"${packageName}"\\nversion\\s*=\\s*"([^"]+)"`
  ).exec(text)
  return entry?.[1] ?? null
}

/**
 * @param versions `{ [label]: versionOrNull }`
 * @returns labels whose value differs from the first distinct version found;
 *          a missing (null) reading is always a mismatch
 */
export function findMismatches(versions) {
  const present = Object.entries(versions).filter(([, v]) => v !== null)
  if (present.length === 0) return Object.keys(versions)
  const baseline = present[0][1]
  return Object.entries(versions)
    .filter(([, v]) => v !== baseline)
    .map(([label, v]) => `${label} (${v ?? 'not found'}) vs ${baseline}`)
}

/**
 * Re-publishing a version that already has a tag is how a release gets stranded:
 * the updater endpoint resolves `/releases/latest/download/latest.json`, which
 * follows the *newest tag*, so a second `v0.1.2` either overwrites the first or
 * leaves the newer artifacts unreachable.
 */
export function isDuplicateOfTag(version, tags) {
  const normalized = version.replace(/^v/, '')
  return tags.some(tag => tag.replace(/^v/, '') === normalized)
}

/** True when `candidate` is strictly newer than `reference` (semver, numeric). */
export function isGreater(candidate, reference) {
  if (reference === null || reference === undefined) return false
  const a = candidate.replace(/^v/, '').split('.').map(Number)
  const b = reference.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (Number.isNaN(x) || Number.isNaN(y)) return false
    if (x !== y) return x > y
  }
  return false
}

/**
 * The highest version among `tags`, ignoring the leading `v` and any tag that is
 * not a plain triple.
 *
 * `isGreater(x, null)` is deliberately false, so this cannot be a `reduce`
 * seeded with null — that version of the function returned null for every real
 * tag list, which made the pre-release guard report "no tags yet" and accept a
 * re-cut of an already released version. Seed with the first candidate instead.
 */
export function highestTag(tags) {
  const versions = tags
    .map(tag => tag.replace(/^v/, ''))
    .filter(v => /^\d+(\.\d+){0,2}$/.test(v))
  return versions.reduce(
    (max, v) => (max === null || isGreater(v, max) ? v : max),
    null
  )
}
