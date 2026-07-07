import { describe, it, expect } from 'vitest'
import {
  getPlatformStrings,
  formatShortcut,
  type PlatformStrings,
} from './platform-strings'
import type { AppPlatform } from '@/hooks/use-platform'

describe('getPlatformStrings', () => {
  describe('正向用例 — returns correct strings for each platform', () => {
    it('returns macOS strings for "macos"', () => {
      const strings = getPlatformStrings('macos')
      expect(strings.revealInFileManager).toBe('Reveal in Finder')
      expect(strings.fileManagerName).toBe('Finder')
      expect(strings.modifierKey).toBe('Cmd')
      expect(strings.modifierKeySymbol).toBe('⌘')
      expect(strings.optionKey).toBe('Option')
      expect(strings.optionKeySymbol).toBe('⌥')
      expect(strings.preferencesLabel).toBe('Preferences')
      expect(strings.quitLabel).toBe('Quit')
      expect(strings.trashName).toBe('Trash')
    })

    it('returns Windows strings for "windows"', () => {
      const strings = getPlatformStrings('windows')
      expect(strings.revealInFileManager).toBe('Show in Explorer')
      expect(strings.fileManagerName).toBe('Explorer')
      expect(strings.modifierKey).toBe('Ctrl')
      expect(strings.modifierKeySymbol).toBe('Ctrl')
      expect(strings.optionKey).toBe('Alt')
      expect(strings.optionKeySymbol).toBe('Alt')
      expect(strings.preferencesLabel).toBe('Settings')
      expect(strings.quitLabel).toBe('Exit')
      expect(strings.trashName).toBe('Recycle Bin')
    })

    it('returns Linux strings for "linux"', () => {
      const strings = getPlatformStrings('linux')
      expect(strings.revealInFileManager).toBe('Show in Files')
      expect(strings.fileManagerName).toBe('Files')
      expect(strings.modifierKey).toBe('Ctrl')
      expect(strings.modifierKeySymbol).toBe('Ctrl')
      expect(strings.optionKey).toBe('Alt')
      expect(strings.optionKeySymbol).toBe('Alt')
      expect(strings.preferencesLabel).toBe('Preferences')
      expect(strings.quitLabel).toBe('Quit')
      expect(strings.trashName).toBe('Trash')
    })
  })

  describe('边界用例 — defaults to macOS for undefined/unknown platform', () => {
    it('returns macOS strings when platform is undefined', () => {
      const strings = getPlatformStrings(undefined)
      expect(strings.revealInFileManager).toBe('Reveal in Finder')
      expect(strings.modifierKeySymbol).toBe('⌘')
    })

    it('returns macOS strings for unknown platform value', () => {
      // The switch default falls through to macOS
      const strings = getPlatformStrings('freebsd' as AppPlatform)
      expect(strings.revealInFileManager).toBe('Reveal in Finder')
    })
  })

  describe('结构完整性 — all platforms expose the same keys', () => {
    const platforms: AppPlatform[] = ['macos', 'windows', 'linux']

    platforms.forEach(platform => {
      it(`${platform} strings have all required fields non-empty`, () => {
        const strings: PlatformStrings = getPlatformStrings(platform)
        Object.entries(strings).forEach(([key, value]) => {
          expect(value, `${platform}.${key} should be non-empty`).toBeTruthy()
          expect(typeof value).toBe('string')
        })
      })
    })
  })
})

describe('formatShortcut', () => {
  describe('正向用例 — macOS', () => {
    it('formats Cmd+K by default', () => {
      expect(formatShortcut('macos', 'K')).toBe('⌘K')
    })

    it('formats Shift+Cmd+K', () => {
      expect(formatShortcut('macos', 'K', ['shift', 'mod'])).toBe('⇧⌘K')
    })

    it('formats Alt+Cmd+K', () => {
      expect(formatShortcut('macos', 'K', ['alt', 'mod'])).toBe('⌥⌘K')
    })

    it('formats Shift+Alt+Cmd+K', () => {
      expect(formatShortcut('macos', 'K', ['shift', 'alt', 'mod'])).toBe('⇧⌥⌘K')
    })

    it('formats key without modifiers', () => {
      expect(formatShortcut('macos', 'F1', [])).toBe('F1')
    })

    it('formats Escape with no modifier', () => {
      expect(formatShortcut('macos', 'Escape', [])).toBe('Escape')
    })
  })

  describe('正向用例 — Windows', () => {
    it('formats Ctrl+K by default', () => {
      expect(formatShortcut('windows', 'K')).toBe('Ctrl+K')
    })

    it('formats Shift+Ctrl+K', () => {
      expect(formatShortcut('windows', 'K', ['shift', 'mod'])).toBe(
        'Shift+Ctrl+K'
      )
    })

    it('formats Alt+Ctrl+K', () => {
      expect(formatShortcut('windows', 'K', ['alt', 'mod'])).toBe('Alt+Ctrl+K')
    })

    it('formats key without modifiers', () => {
      expect(formatShortcut('windows', 'F1', [])).toBe('F1')
    })
  })

  describe('正向用例 — Linux', () => {
    it('formats Ctrl+K by default', () => {
      expect(formatShortcut('linux', 'K')).toBe('Ctrl+K')
    })

    it('formats Shift+Ctrl+S', () => {
      expect(formatShortcut('linux', 'S', ['shift', 'mod'])).toBe(
        'Shift+Ctrl+K'.replace('K', 'S')
      )
    })
  })

  describe('边界用例 — undefined platform', () => {
    it('defaults to macOS when platform is undefined', () => {
      expect(formatShortcut(undefined, 'K')).toBe('⌘K')
    })

    it('defaults to macOS with no modifiers when platform is undefined', () => {
      expect(formatShortcut(undefined, 'Enter', [])).toBe('Enter')
    })
  })

  describe('边界用例 — empty modifiers array', () => {
    it('returns just the key on macOS', () => {
      expect(formatShortcut('macos', 'S', [])).toBe('S')
    })

    it('returns just the key on Windows', () => {
      expect(formatShortcut('windows', 'S', [])).toBe('S')
    })
  })
})
