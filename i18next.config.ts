import { defineConfig } from 'i18next-cli'

/**
 * i18next-cli configuration — the PRIMARY i18n tool.
 *
 * The project stores translations as FLAT key-value JSON per locale
 * (locales/en.json, locales/zh.json), NOT nested objects. `keySeparator:
 * false` must match the runtime i18next setup (src/i18n/config.ts).
 *
 * What i18next-cli covers:
 *   - `extract`        — add new `t()` keys to en/zh catalogs automatically.
 *   - `extract --ci`   — CI drift guard: fails when catalogs are out of sync.
 *   - `status`         — missing translations + dangling `t()` references.
 *   - `rename-key`     — on-demand batch key rename (manual, not in CI).
 *
 * What i18next-cli CANNOT cover (handled by scripts/check-i18n.mjs):
 *   - dynamic keys (`t(command.labelKey)`) — statically invisible, so both
 *     extract and status ignore them; the fallback compares FULL key sets.
 *   - `{{var}}` placeholder alignment across locale VALUES.
 *
 * Why NOT used:
 *   - `types` — generates `{ en: {...} }`-shaped resources, which mismatches
 *     this project's `{ translation: {...} }` runtime namespace layout and
 *     makes `t()` return `never`. The hand-written `src/i18n/i18n.d.ts`
 *     (`typeof en`) is exact and needs no tooling.
 *   - `sync` — fills empty zh values with English, clobbering human work.
 *   - `lint` — hardcoded-string check overlaps eslint-plugin-i18next.
 *   - `instrument`/`localize`/`locize-*` — bulk rewrites / cloud services.
 *
 * The two `extract` guards below are load-bearing: `commands.*` is only
 * reachable via `t(command.labelKey)` and would be treated as unused (and
 * DELETED) without `preservePatterns`. Never remove them.
 */
export default defineConfig({
  locales: ['en', 'zh'],
  extract: {
    input: ['src/**/*.{ts,tsx,js,jsx}'],
    output: 'locales/{{language}}.json',
    // Flat keys — matches src/i18n/config.ts runtime behavior
    keySeparator: false,
    nsSeparator: false,
    sort: true,
    // Protect dynamically-referenced keys (see header — load-bearing!)
    preservePatterns: ['commands.*'],
    removeUnusedKeys: false,
  },
  status: {},
  lint: {
    // Interpolation params on the CODE call-site. Does NOT compare
    // placeholders across locale VALUES — that's the fallback script's job.
    checkInterpolationParams: true,
  },
})
