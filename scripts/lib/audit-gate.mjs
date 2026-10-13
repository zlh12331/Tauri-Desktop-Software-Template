/**
 * Decision logic for the npm audit gate, kept free of `npm` invocation so it can
 * be tested without a registry round trip. `check-audit.mjs` is the CLI wrapper.
 *
 * The reason this file exists at all: an early version of the gate compared a
 * severity against `RANK['none']`, which was undefined. Every `severity > worst`
 * test then evaluated false, so no package ever registered as vulnerable and the
 * gate exited 0 forever. Only a written-down negative test proves the gate bites;
 * the tests live next to this module.
 */

export const RANK = {
  none: 0,
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

export const DEFAULT_THRESHOLD = 'high'

/** `https://github.com/advisories/GHSA-x` -> `GHSA-x` */
const ghsaOf = url => (url ?? '').split('/').pop()

/**
 * Severity of `pkg` after exempted advisories are removed.
 *
 * A package that only reached `high` because of an exempted leaf falls back to
 * the severity of whatever caused remain — it is not dropped from the report.
 * `seen` guards the cycle a dependency chain can form (npm's `via` edges are not
 * a tree).
 */
export function effectiveSeverity(
  pkg,
  vulns,
  ignoredAdvisories,
  seen = new Set()
) {
  if (seen.has(pkg) || !(pkg in vulns)) return 'none'
  seen.add(pkg)
  let worst = 'none'
  for (const via of vulns[pkg].via ?? []) {
    const severity =
      typeof via === 'string'
        ? effectiveSeverity(via, vulns, ignoredAdvisories, seen)
        : ignoredAdvisories.has(ghsaOf(via.url))
          ? 'none'
          : via.severity
    if (RANK[severity] > RANK[worst]) worst = severity
  }
  seen.delete(pkg)
  return worst
}

/**
 * @param vulns `vulnerabilities` map from `npm audit --json`
 * @param ignoredList exemptions, each `{ ghsa, pkg }`
 * @param threshold severity that trips the gate
 * @returns outstanding packages, human-readable exemption labels, stale ghsas
 */
export function evaluate(vulns, ignoredList, threshold = DEFAULT_THRESHOLD) {
  // An unknown threshold would make `RANK[threshold]` undefined and every
  // comparison below false — the same failure mode the RANK fix above prevents.
  if (!(threshold in RANK)) {
    throw new Error(
      `unknown threshold '${threshold}', expected one of ${Object.keys(RANK).join(', ')}`
    )
  }
  const ignoredAdvisories = new Map(ignoredList.map(e => [e.ghsa, e]))
  const outstanding = []
  const exempted = new Set()
  // Effective severity per package, so a report can show what the gate actually
  // measured rather than npm's headline severity for the whole chain.
  const severityOf = new Map()

  for (const pkg of Object.keys(vulns)) {
    const severity = effectiveSeverity(pkg, vulns, ignoredAdvisories)
    severityOf.set(pkg, severity)
    if (RANK[severity] >= RANK[threshold]) {
      outstanding.push(pkg)
    }
    for (const via of vulns[pkg].via ?? []) {
      const entry = ignoredAdvisories.get(
        ghsaOf(typeof via === 'string' ? '' : via.url)
      )
      if (entry) exempted.add(`${entry.pkg}@${vulns[entry.pkg]?.range ?? '?'}`)
    }
  }

  // An exemption whose package no longer appears is debt, not protection: it
  // means upstream shipped the fix and the entry should be deleted.
  const stale = ignoredList
    .filter(entry => !(entry.pkg in vulns))
    .map(entry => entry.ghsa)

  return { outstanding, exempted, stale, severityOf }
}

/**
 * Passthrough args (`--registry=...`) reach the gate from the command line, so
 * they are checked against a boring charset before they can reach a shell.
 * Returns the args it accepted; throws on anything else.
 */
export function validatePassthrough(extra) {
  for (const arg of extra) {
    if (!/^--[\w.-]+=[\w.:/@-]+$/.test(arg)) {
      throw new Error(`refusing unexpected argument: ${arg}`)
    }
  }
  return extra
}

/**
 * Build the `npm audit --json` invocation.
 *
 * Preferring `npm_execpath` (set whenever this runs under an npm script) means
 * Node spawns its own executable with a JS entry point instead of a `.cmd`
 * shim: no shell, no DEP0190 warning about unescaped arguments, and no way for
 * an argument to be re-interpreted by cmd.exe. Only when that variable is absent
 * does the gate fall back to the `npm` shim, which on Windows needs a shell
 * because modern Node refuses to spawn `.cmd`/`.bat` directly.
 *
 * The environment is taken as one object rather than per-key with a default
 * value: `npmExecPath = process.env.npm_execpath` re-reads the real environment
 * whenever a caller passes `undefined` on purpose, so a test that means "no
 * npm_execpath" would silently get whatever the surrounding `npm run` exported.
 * That is exactly how the fallback case passed under `node --test` and failed in
 * pre-push.
 */
export function buildAuditCommand({
  extra = [],
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  const npmExecPath = env['npm_execpath']
  const args = ['audit', '--json', ...extra]
  if (npmExecPath && /\.[cm]?js$/i.test(npmExecPath)) {
    return { command: execPath, args: [npmExecPath, ...args], shell: false }
  }
  return { command: 'npm', args, shell: platform === 'win32' }
}
