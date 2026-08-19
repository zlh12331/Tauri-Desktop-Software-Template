# Internationalization (i18n)

**[English](i18n-patterns.en.md)** | [中文](i18n-patterns.zh.md)

## Overview

This app uses [react-i18next](https://react.i18next.com/) for internationalization. All user-facing strings, including native menus, are translated from a single source of truth in JSON translation files.

### Key Design Decisions

- **react-i18next**: Industry-standard React i18n library with excellent TypeScript support
- **JSON translation files**: Simple, portable format stored in `/locales/`
- **JavaScript-based native menus**: Menus are built from JavaScript (not Rust) to use the same translation system
- **RTL support**: CSS uses logical properties for automatic RTL layout

## Architecture

```
/locales/
├── en.json              # English (default)
├── zh.json              # Chinese
└── [lang].json          # Additional languages

/src/i18n/
├── config.ts            # i18next configuration
├── i18n.d.ts            # TypeScript type definitions
├── language-init.ts     # System locale detection
└── index.ts             # Exports
```

## Adding New Translatable Strings

### Step 1: Add to Translation File

Add your string to `/locales/en.json`:

```json
{
  "myFeature.title": "My Feature",
  "myFeature.description": "This is my feature description",
  "myFeature.button.save": "Save Changes"
}
```

### Step 2: Use in React Components

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.button.save')}</button>
    </div>
  )
}
```

### Step 3: Add to Other Languages

Add the same keys to all other language files (e.g., `/locales/zh.json`).

## Key Naming Conventions

Use dot notation to organize keys by feature/component:

| Pattern                   | Example                                 | Use Case                |
| ------------------------- | --------------------------------------- | ----------------------- |
| `feature.element`         | `preferences.title`                     | Simple feature strings  |
| `feature.section.element` | `preferences.general.keyboardShortcuts` | Nested sections         |
| `feature.action.verb`     | `commands.openPreferences.label`        | Action labels           |
| `common.word`             | `common.enabled`                        | Shared/reusable strings |
| `toast.type.key`          | `toast.success.preferencesSaved`        | Toast notifications     |
| `menu.item`               | `menu.quit`                             | Native menu items       |

### Naming Rules

1. **Use camelCase** for multi-word segments: `keyboardShortcuts`, not `keyboard-shortcuts`
2. **Be specific**: `preferences.appearance.colorTheme`, not `theme`
3. **Group related strings**: All preference strings under `preferences.*`
4. **Use consistent suffixes**: `.label`, `.description`, `.placeholder` for form elements

## Interpolation

Pass dynamic values using double curly braces:

### Translation File

```json
{
  "menu.about": "About {{appName}}",
  "toast.error.windowCloseFailed": "Failed to close window: {{message}}"
}
```

### Usage

```typescript
t('menu.about', { appName: 'My App' })
// Output: "About My App"

t('toast.error.windowCloseFailed', { message: 'Permission denied' })
// Output: "Failed to close window: Permission denied"
```

## Pluralization

i18next supports pluralization with `_one`, `_other` suffixes:

### Translation File

```json
{
  "items.count_one": "{{count}} item",
  "items.count_other": "{{count}} items"
}
```

### Usage

```typescript
t('items.count', { count: 1 }) // "1 item"
t('items.count', { count: 5 }) // "5 items"
```

## Adding a New Language

### Step 1: Create Translation File

Copy `/locales/en.json` to `/locales/[lang].json` and translate all strings.

### Step 2: Register in Config

Update `/src/i18n/config.ts`:

```typescript
import en from '../../locales/en.json'
import zh from '../../locales/zh.json'
import es from '../../locales/es.json' // NEW

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  es: { translation: es }, // NEW
}
```

### Step 3: Add RTL Support (if applicable)

If the language is RTL, add it to the `rtlLanguages` array:

```typescript
const rtlLanguages = ['ar', 'he', 'fa', 'ur'] // Add your RTL language
```

## RTL Language Support

### Automatic Direction Switching

The i18n config automatically updates `document.documentElement.dir` when the language changes:

```typescript
// In /src/i18n/config.ts
i18n.on('languageChanged', lng => {
  const dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lng
})
```

### CSS Logical Properties

Use CSS logical properties instead of physical properties for automatic RTL support:

| Physical (avoid) | Logical (use)                         |
| ---------------- | ------------------------------------- |
| `left`           | `start` or `inset-inline-start`       |
| `right`          | `end` or `inset-inline-end`           |
| `margin-left`    | `margin-inline-start` or `ms-*`       |
| `margin-right`   | `margin-inline-end` or `me-*`         |
| `padding-left`   | `padding-inline-start` or `ps-*`      |
| `padding-right`  | `padding-inline-end` or `pe-*`        |
| `text-left`      | `text-start`                          |
| `text-right`     | `text-end`                            |
| `border-left`    | `border-s-*` or `border-inline-start` |
| `border-right`   | `border-e-*` or `border-inline-end`   |

### Example

```tsx
// ❌ BAD: Physical properties break in RTL
<div className="text-left pl-4 mr-2">

// ✅ GOOD: Logical properties work in both LTR and RTL
<div className="text-start ps-4 me-2">
```

## Native Menus

Native menus are built from JavaScript to use the same i18n system as React components.

### Menu Builder Location

See `/src/lib/menu.ts` for the menu builder implementation.

### Adding Menu Items

```typescript
import i18n from '@/i18n/config'

export async function buildAppMenu(): Promise<Menu> {
  const t = i18n.t.bind(i18n)

  const myItem = await MenuItem.new({
    id: 'my-action',
    text: t('menu.myAction'),
    action: handleMyAction,
  })

  // ... add to submenu
}
```

### Automatic Menu Rebuild

Menus are automatically rebuilt when the language changes:

```typescript
// In /src/lib/menu.ts
export function setupMenuLanguageListener(): void {
  i18n.on('languageChanged', async () => {
    await buildAppMenu()
  })
}
```

## System Locale Detection

On app startup, the language is initialized based on:

1. **User's saved preference** (if set in preferences)
2. **System locale** (if we have translations for it)
3. **English** (fallback)

See `/src/i18n/language-init.ts` for the implementation.

## Language Selector

The language selector in Preferences > Appearance allows users to change the language:

```typescript
import { availableLanguages } from '@/i18n/config'
import { useTranslation } from 'react-i18next'

function LanguageSelector() {
  const { i18n } = useTranslation()

  const handleChange = async (lang: string) => {
    await i18n.changeLanguage(lang)
    // Save to preferences...
  }

  return (
    <Select value={i18n.language} onValueChange={handleChange}>
      {availableLanguages.map(lang => (
        <SelectItem key={lang} value={lang}>
          {lang.toUpperCase()}
        </SelectItem>
      ))}
    </Select>
  )
}
```

## TypeScript Support

The `i18n.d.ts` file provides type-safe translation keys:

```typescript
// Type errors if key doesn't exist in en.json
t('nonexistent.key') // TypeScript error

// Autocomplete works for valid keys
t('preferences.title') // ✅ Works
```

## Automatic Validation (Hard Constraint)

Four layers enforce i18n consistency programmatically — AI-generated changes
cannot silently drift. Each layer owns a distinct concern; nothing overlaps.

| Layer                   | Concern                              | Implementation                                                              |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| 1. Compile-time types   | key typos are TS errors              | `src/i18n/i18n.d.ts` (`typeof en`) + `AppCommand.labelKey: keyof typeof en` |
| 2. Extraction sync      | catalogs stay in sync with source    | i18next-cli `extract` / `extract --ci`                                      |
| 3. Translation status   | missing translations + dangling refs | i18next-cli `status`                                                        |
| 4. Fallback blind spots | what the tool cannot see             | `scripts/check-i18n.mjs`                                                    |
| 5. No hardcoded JSX     | all visible text via `t()`           | ESLint `i18next/no-literal-string`                                          |

**Layer 1 — Type-safe keys** (compile time): `i18n.d.ts` types `t()` from
`en.json`, so a missing key is a TypeScript error. Data-driven key fields are
typed too — `AppCommand.labelKey: keyof typeof en` (see
`src/lib/commands/types.ts`), so a typo in a `commands.*` key fails the build
even though the UI reads it via `t(command.labelKey)`. Hand-written because
i18next-cli `types` generates `{ en: {...} }`-shaped resources that mismatch
this project's `{ translation: {...} }` namespace layout (verified: `t()`
becomes `never`).

**Layer 2 — Extraction drift guard** (CI, `npm run i18n:extract:check` →
`i18next-cli extract --ci`): fails if running `extract` would change any
catalog. Add a `t('key')` → this guard forces you to run `npm run i18n:extract`
to sync catalogs. Safe because `preservePatterns: ['commands.*']` +
`removeUnusedKeys: false` protect the dynamically-referenced `commands.*`
keys — without them extract DELETES those keys. Never remove those settings.

**Layer 3 — Translation status** (CI, `npm run i18n:status` → `i18next-cli
status`): fails when a locale is missing a translation for a code-referenced
key, or a `t('key')` does not resolve in `en.json`.

**Layer 4 — Fallback blind spots** (CI, `npm run i18n:fallback` →
`scripts/check-i18n.mjs`): i18next-cli only sees STATICALLY referenced keys and
never inspects translated VALUES, so it misses:

- **full key-set parity** incl. dynamic keys (`t(command.labelKey)`). Verified:
  removing `commands.*` from `zh.json` passes both `extract --ci` AND `status`,
  but breaks the UI at runtime.
- **`{{var}}` placeholder alignment** across locale values (e.g. en `{{message}}`
  vs zh `{message}`).

Run locally: `npm run i18n:check` (= `i18n:extract:check` + `i18n:status` +
`i18n:fallback`, included in `check:all` and CI).

On-demand: `npm run i18n:extract` (add new keys), `npm run i18n:rename -- <old>
<new>` (rename a key everywhere). Not used: `sync` (fills empty zh values with
English), `lint` (overlaps ESLint), `instrument`/`localize`/`locize-*` (bulk
rewrites / cloud).

## Using Translations Outside React

For non-React contexts (like menu building), import i18n directly:

```typescript
import i18n from '@/i18n/config'

// Get the t function
const t = i18n.t.bind(i18n)
const text = t('menu.about', { appName: 'My App' })

// Or use i18n directly
const currentLanguage = i18n.language
await i18n.changeLanguage('zh')
```

## Testing with RTL

To test RTL layout:

1. Add an RTL language (e.g., Arabic) to `supportedLanguages` and create its translation file
2. Change language to the RTL language
3. Verify layout mirrors correctly
4. Check all text alignment uses logical properties
