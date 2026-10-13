/**
 * Contracts for the ast-grep architecture rules.
 *
 * `ast-grep scan` being green proves only that no violation exists in the tree —
 * never that a rule can still see one. A rule that stops matching (a CLI upgrade,
 * an edited pattern, a `files:` glob that no longer covers the directory it
 * guards) looks exactly like clean code. This module pairs every rule with a
 * snippet that must fire and one that must not, so the emptiness is checked
 * against the detector instead of against the repo.
 *
 * Kept free of fs/process so the completeness and parsing rules are testable on
 * their own; `scripts/ast-grep-contracts.test.mjs` runs the scan.
 */

/** One contract per rule id, as declared under `.ast-grep/rules/**`. */
export const CONTRACTS = [
  {
    rule: 'hooks-in-hooks-dir',
    // The rule's whole subject is the directory, so the snippet is identical on
    // both sides: only `src/lib/**` may not export a hook.
    dimension: 'path',
    bad: {
      path: 'src/lib/contract-hook.ts',
      code: 'export function usePlantedHook() {\n  return 1\n}\n',
    },
    good: {
      path: 'src/hooks/contract-ok.ts',
      code: 'export function usePlantedHook() {\n  return 1\n}\n',
    },
  },
  {
    rule: 'no-console',
    // Same code on both sides: this pair tests that `ignores:` still exempts the
    // logging infrastructure, which is a path property, not a syntax one.
    dimension: 'path',
    bad: {
      path: 'src/lib/contract-console.ts',
      code: "export function plantLog(value: number) {\n  console.log('planted', value)\n}\n",
    },
    good: {
      path: 'src/lib/logger.ts',
      code: "export function plantLog(value: number) {\n  console.log('planted', value)\n}\n",
    },
  },
  {
    rule: 'no-direct-invoke',
    // `bindings.ts` is the one file allowed to import raw invoke.
    dimension: 'path',
    bad: {
      path: 'src/lib/contract-invoke.ts',
      code: "import { invoke } from '@tauri-apps/api/core'\n\nexport async function plantInvoke() {\n  return await invoke('planted_command')\n}\n",
    },
    good: {
      path: 'src/lib/bindings.ts',
      code: "import { invoke } from '@tauri-apps/api/core'\n\nexport async function plantInvoke() {\n  return await invoke('planted_command')\n}\n",
    },
  },
  {
    rule: 'no-store-subscription-in-lib',
    // `dialog` and not `UI`: the first version of this rule hardcoded useUIStore,
    // so three of the four stores were unguarded while the docs promised all four.
    // Both files stay in src/lib, so only the syntax can be the difference.
    dimension: 'code',
    bad: {
      path: 'src/lib/contract-store.ts',
      code: 'export function plantRead() {\n  return useDialogStore(state => state.open)\n}\n',
    },
    good: {
      path: 'src/lib/contract-store-ok.ts',
      code: 'export function plantRead() {\n  return useDialogStore.getState().open\n}\n',
    },
  },
  {
    rule: 'no-ts-ignore',
    dimension: 'code',
    bad: {
      path: 'src/lib/contract-ignore.ts',
      code: "// @ts-ignore\nexport const plantSuppressed = 'x'\n",
    },
    good: {
      path: 'src/lib/contract-expect.ts',
      code: "// @ts-expect-error planted for the contract\nexport const plantSuppressed = 'x'\n",
    },
  },
  {
    rule: 'no-destructure-zustand',
    dimension: 'code',
    bad: {
      path: 'src/components/contract-destructure.tsx',
      code: 'export function Plant() {\n  const { leftSidebarVisible } = useUIStore()\n  return <div>{String(leftSidebarVisible)}</div>\n}\n',
    },
    good: {
      path: 'src/components/contract-selector.tsx',
      code: 'export function Plant() {\n  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)\n  return <div>{String(leftSidebarVisible)}</div>\n}\n',
    },
  },
]

/** Every rule must fire exactly once against the violating tree. */
export const EXPECTED_BAD_COUNT = 1

/** The compliant tree must be clean for every rule, including its neighbours. */
export const EXPECTED_GOOD_COUNT = 0

/**
 * Rule ids found in `ast-grep --report-style short` output.
 *
 * Messages are multi-line, so this counts the `error[<id>]:` markers rather than
 * splitting lines — one marker per match, regardless of how the message wraps.
 */
export function countFindings(output) {
  const counts = new Map()
  for (const match of output.matchAll(/error\[([a-z0-9-]+)\]/g)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1)
  }
  return counts
}

/**
 * Compare an observed count map against the expected one.
 *
 * `missing` is the silent-failure case (a rule that saw nothing), `extra` is the
 * over-match case (a rule firing on code it should not touch), and `wrongCount`
 * catches a fixture being matched twice, which would mean the rule is also
 * catching its own compliant twin.
 */
export function diffCounts(actual, expected) {
  const missing = []
  const extra = []
  const wrongCount = []
  for (const [rule, want] of Object.entries(expected)) {
    const got = actual.get(rule) ?? 0
    if (want === 0) {
      if (got > 0)
        extra.push(`${rule} fired ${got}x on compliant code, expected 0`)
    } else if (got === 0) {
      missing.push(`${rule} did not fire, expected ${want}`)
    } else if (got !== want) {
      wrongCount.push(`${rule} fired ${got}x, expected ${want}`)
    }
  }
  for (const [rule, got] of actual) {
    if (!(rule in expected) && got > 0) {
      extra.push(`${rule} fired ${got}x but has no contract in this suite`)
    }
  }
  return { missing, extra, wrongCount }
}

/** Map the contracts to the count table the two scans should produce. */
export function expectedCounts(kind) {
  const want = kind === 'bad' ? EXPECTED_BAD_COUNT : EXPECTED_GOOD_COUNT
  return Object.fromEntries(CONTRACTS.map(c => [c.rule, want]))
}

/**
 * The completeness check: a rule that exists in `.ast-grep/rules/**` but has no
 * contract is unprotected, and that must be an error rather than a smaller suite.
 * Without this, adding a seventh rule would quietly shrink what the gate proves.
 */
export function contractGaps(ruleIds) {
  const covered = new Set(CONTRACTS.map(c => c.rule))
  const known = new Set(ruleIds)
  return {
    uncontracted: ruleIds.filter(id => !covered.has(id)),
    staleRules: [...covered].filter(id => !known.has(id)),
  }
}
