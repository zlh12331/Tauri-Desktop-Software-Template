import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSidebarStore } from '@/store/sidebar-store'
import { LinuxTitleBar } from './LinuxTitleBar'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock executeCommand from @/lib/commands
const mockExecuteCommand = vi.fn()
vi.mock('@/lib/commands', () => ({
  executeCommand: (...args: unknown[]) =>
    mockExecuteCommand(...(args as [never, never])),
}))

// Mock useCommandContext from its own module
vi.mock('@/hooks/use-command-context', () => ({
  useCommandContext: () => ({
    openPreferences: vi.fn(),
    showToast: vi.fn(),
  }),
}))

describe('LinuxTitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
    mockExecuteCommand.mockResolvedValue({ success: true })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染传入的 title', () => {
      render(<LinuxTitleBar title="My App" />)
      expect(screen.getByText('My App')).toBeInTheDocument()
    })

    it('未传 title 时不渲染 title 文本', () => {
      render(<LinuxTitleBar />)
      // We just verify it doesn't crash and renders toolbar buttons
      expect(screen.getByTitle('titlebar.settings')).toBeInTheDocument()
    })

    it('渲染左侧栏切换按钮', () => {
      render(<LinuxTitleBar title="Test" />)
      expect(screen.getByTitle('titlebar.hideLeftSidebar')).toBeInTheDocument()
    })

    it('渲染设置按钮', () => {
      render(<LinuxTitleBar title="Test" />)
      expect(screen.getByTitle('titlebar.settings')).toBeInTheDocument()
    })

    it('渲染右侧栏切换按钮', () => {
      render(<LinuxTitleBar title="Test" />)
      expect(screen.getByTitle('titlebar.hideRightSidebar')).toBeInTheDocument()
    })

    it('应用额外的 className', () => {
      const { container } = render(
        <LinuxTitleBar title="Test" className="custom-class" />
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('边界用例', () => {
    it('空字符串 title 仍能渲染', () => {
      render(<LinuxTitleBar title="" />)
      // Should not crash; toolbar still renders
      expect(screen.getByTitle('titlebar.settings')).toBeInTheDocument()
    })

    it('leftSidebarVisible=false 时按钮 title 为 showLeftSidebar', () => {
      useSidebarStore.setState({ leftSidebarVisible: false })
      render(<LinuxTitleBar title="Test" />)
      expect(screen.getByTitle('titlebar.showLeftSidebar')).toBeInTheDocument()
    })

    it('rightSidebarVisible=false 时按钮 title 为 showRightSidebar', () => {
      useSidebarStore.setState({ rightSidebarVisible: false })
      render(<LinuxTitleBar title="Test" />)
      expect(screen.getByTitle('titlebar.showRightSidebar')).toBeInTheDocument()
    })
  })
})
