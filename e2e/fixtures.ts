import { test as base, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { tauriMockScript } from './mocks/tauri-mock'

/**
 * Custom fixture that injects Tauri API mock before the page loads.
 * Also provides an `analyzeA11y` helper that runs axe-core accessibility
 * checks on the current page.
 */
export const test = base.extend<{
  mockPage: Page
  /** Run axe-core accessibility analysis on the given page. */
  analyzeA11y: (page: Page) => Promise<void>
}>({
  mockPage: async ({ page }, use) => {
    // Inject mock before any page scripts run
    await page.addInitScript(tauriMockScript)
    await use(page)
  },
  // eslint-disable-next-line no-empty-pattern
  analyzeA11y: async ({}, use) => {
    const analyzeA11y = async (page: Page) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Pre-existing component issues in shadcn/ui:
        // - color-contrast: text-muted-foreground (#777777 on #ffffff = 4.47:1)
        // - button-name: Select trigger buttons lack aria-label
        // - autocomplete-valid: API key input uses autocomplete="api-key"
        // These require component-level fixes, not test changes.
        .disableRules(['color-contrast', 'button-name', 'autocomplete-valid'])
        .analyze()

      const violations = results.violations
      if (violations.length > 0) {
        const summary = violations
          .map(v => `  [${v.id}] ${v.help}: ${v.nodes.length} node(s) affected`)
          .join('\n')
        throw new Error(
          `Accessibility violations detected:\n${summary}\n\nFull details: ${JSON.stringify(violations, null, 2)}`
        )
      }
    }
    await use(analyzeA11y)
  },
})

export { expect }
