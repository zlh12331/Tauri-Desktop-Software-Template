import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock React 的 createContext — 只为了捕获传入的默认值。
// (React 19 的 Context 类型不再公开 defaultValue 属性。)
// ---------------------------------------------------------------------------
const mockCreateContext = vi.fn(<T>(defaultValue: T) => ({
  Provider: {},
  Consumer: {},
  _defaultValue: defaultValue,
}))

vi.mock('react', () => ({
  createContext: mockCreateContext,
}))

const { ThemeProviderContext } = await import('./theme-context')

describe('theme-context — 上下文默认值', () => {
  // What this guards is one decision: the context must not ship a usable
  // default. It used to be seeded with `{ theme: 'system', setTheme: () => null }`,
  // which made `useTheme` look like it worked outside a ThemeProvider — the
  // theme read back plausible and every write vanished. Tests that asserted the
  // shape of that stub (setTheme returns null, accepts every theme) were pinning
  // the dead code; the behaviour itself is covered in use-theme.test.ts and
  // ThemeProvider.test.tsx, against a real React.
  it('createContext 只调用一次，且默认值是 null', () => {
    expect(mockCreateContext).toHaveBeenCalledTimes(1)
    expect(mockCreateContext.mock.calls[0]?.[0]).toBeNull()
  })

  it('导出的上下文对象不携带可用的默认状态', () => {
    expect(
      (ThemeProviderContext as unknown as { _defaultValue: unknown })
        ._defaultValue
    ).toBeNull()
  })
})
