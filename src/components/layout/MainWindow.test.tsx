import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSidebarStore } from '@/store/sidebar-store'

// ---------------------------------------------------------------------------
// Mocks — external UI primitives stubbed so MainWindow's layout dispatch logic
// (sidebar visibility, theme, global dialog mounting) is the test focus.
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({
    defaultSize,
    className,
    children,
  }: {
    defaultSize?: number
    className?: string
    children: React.ReactNode
  }) => (
    <div data-testid="panel" data-size={defaultSize} className={className}>
      {children}
    </div>
  ),
  ResizableHandle: ({ className }: { className?: string }) => (
    <div data-testid="panel-handle" className={className} />
  ),
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
}))

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

vi.mock('@/hooks/useMainWindowEventListeners', () => ({
  useMainWindowEventListeners: vi.fn(),
}))

vi.mock('@/components/titlebar/TitleBar', () => ({
  TitleBar: () => <div data-testid="titlebar" />,
}))

vi.mock('./LeftSideBar', () => ({
  LeftSideBar: () => <div data-testid="left-sidebar" />,
}))
vi.mock('./RightSideBar', () => ({
  RightSideBar: () => <div data-testid="right-sidebar" />,
}))
vi.mock('./MainWindowContent', () => ({
  MainWindowContent: () => <div data-testid="main-content" />,
}))

vi.mock('@/components/command-palette/CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}))
vi.mock('@/components/preferences/PreferencesDialog', () => ({
  PreferencesDialog: () => <div data-testid="preferences-dialog" />,
}))
vi.mock('@/components/crash-report/CrashReportDialog', () => ({
  CrashReportDialog: () => <div data-testid="crash-dialog" />,
}))

vi.mock('sonner', () => ({
  Toaster: (props: { theme?: string }) => (
    <div data-testid="toaster" data-theme={props.theme} />
  ),
}))

import { MainWindow } from './MainWindow'

describe('MainWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染标题栏、侧边栏与主内容', () => {
      render(<MainWindow />)
      expect(screen.getByTestId('titlebar')).toBeInTheDocument()
      expect(screen.getByTestId('left-sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('right-sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('main-content')).toBeInTheDocument()
    })

    it('挂载全局对话框组件', () => {
      render(<MainWindow />)
      expect(screen.getByTestId('command-palette')).toBeInTheDocument()
      expect(screen.getByTestId('preferences-dialog')).toBeInTheDocument()
      expect(screen.getByTestId('crash-dialog')).toBeInTheDocument()
    })

    it('Toaster 使用主题值', () => {
      render(<MainWindow />)
      expect(screen.getByTestId('toaster')).toHaveAttribute(
        'data-theme',
        'dark'
      )
    })
  })

  describe('边界用例 — 侧边栏可见性', () => {
    it('左侧栏可见时 panel 不含 hidden 类', () => {
      useSidebarStore.setState({ leftSidebarVisible: true })
      render(<MainWindow />)
      const leftPanel = screen.getAllByTestId('panel')[0] as HTMLElement
      expect(leftPanel.className).not.toContain('hidden')
    })

    it('左侧栏隐藏时左侧 panel 含 hidden 类', () => {
      useSidebarStore.setState({ leftSidebarVisible: false })
      render(<MainWindow />)
      const leftPanel = screen.getAllByTestId('panel')[0] as HTMLElement
      expect(leftPanel.className).toContain('hidden')
      // 隐藏时 handle 也隐藏
      const leftHandle = screen.getAllByTestId('panel-handle')[0] as HTMLElement
      expect(leftHandle.className).toContain('hidden')
    })

    it('右侧栏隐藏时右侧 panel 含 hidden 类', () => {
      useSidebarStore.setState({ rightSidebarVisible: false })
      render(<MainWindow />)
      const rightPanel = screen.getAllByTestId('panel')[2] as HTMLElement
      expect(rightPanel.className).toContain('hidden')
    })

    it('两侧栏均可见时无 hidden 类', () => {
      useSidebarStore.setState({
        leftSidebarVisible: true,
        rightSidebarVisible: true,
      })
      render(<MainWindow />)
      const panels = screen.getAllByTestId('panel')
      for (const p of panels) {
        expect(p.className).not.toContain('hidden')
      }
    })
  })

  describe('边界用例 — 面板尺寸配置', () => {
    it('左右侧栏默认 20%，主内容为 60%', () => {
      render(<MainWindow />)
      const sizes = screen
        .getAllByTestId('panel')
        .map(p => p.getAttribute('data-size'))
      expect(sizes).toEqual(['20', '60', '20'])
    })
  })
})
