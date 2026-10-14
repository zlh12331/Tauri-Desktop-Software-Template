import { describe, it, expect } from 'vitest'
import { preferencePatches } from '@/lib/preference-patches'

// These shapes are the wire contract with `PreferencePatch` in
// src-tauri/src/types.rs: an externally-tagged enum whose variant names are
// PascalCase and whose payload key is `value`. A typo here compiles, ships, and
// is rejected by Rust's deserializer at runtime — nothing else catches it.
describe('preferencePatches', () => {
  describe('正向用例 — 线格式', () => {
    it('theme builds the Theme variant', () => {
      expect(preferencePatches.theme('dark')).toEqual({
        Theme: { value: 'dark' },
      })
    })

    it('quickPaneShortcut builds the QuickPaneShortcut variant', () => {
      expect(
        preferencePatches.quickPaneShortcut('CommandOrControl+Shift+.')
      ).toEqual({
        QuickPaneShortcut: { value: 'CommandOrControl+Shift+.' },
      })
    })

    it('crashReportingConsent builds the CrashReportingConsent variant', () => {
      expect(preferencePatches.crashReportingConsent(true)).toEqual({
        CrashReportingConsent: { value: true },
      })
    })
  })

  describe('边界用例 — null 是被执行的指令', () => {
    it('language(null) keeps the key with a null value', () => {
      const patch = preferencePatches.language(null)
      expect(patch).toEqual({ Language: { value: null } })
      expect(patch).toHaveProperty(['Language', 'value'], null)
    })

    it('clearing the shortcut and never sending it are different patches', () => {
      expect(preferencePatches.quickPaneShortcut(null)).toEqual({
        QuickPaneShortcut: { value: null },
      })
      expect(Object.keys(preferencePatches.quickPaneShortcut(null))).toEqual([
        'QuickPaneShortcut',
      ])
    })

    it('consent has three states: granted, denied, not asked yet', () => {
      expect(preferencePatches.crashReportingConsent(false)).toEqual({
        CrashReportingConsent: { value: false },
      })
      expect(preferencePatches.crashReportingConsent(null)).toEqual({
        CrashReportingConsent: { value: null },
      })
    })
  })

  describe('边界用例 — 每个补丁只点名一个字段', () => {
    it('each builder produces exactly one variant key', () => {
      const patches = [
        preferencePatches.theme('system'),
        preferencePatches.language('zh'),
        preferencePatches.quickPaneShortcut(null),
        preferencePatches.crashReportingConsent(null),
      ]

      for (const patch of patches) {
        expect(Object.keys(patch)).toHaveLength(1)
      }
    })

    it('a batch keeps the patches as separate entries', () => {
      expect([
        preferencePatches.theme('light'),
        preferencePatches.language('en'),
      ]).toEqual([{ Theme: { value: 'light' } }, { Language: { value: 'en' } }])
    })
  })
})
