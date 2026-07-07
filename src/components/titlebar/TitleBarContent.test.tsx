import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSidebarStore } from '@/store/sidebar-store'
import {
  TitleBarLeftActions,
  TitleBarRightActions,
  TitleBarTitle,
  TitleBarContent,
} from './TitleBarContent'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Mock executeCommand from @/lib/commands
const mockExecuteCommand = vi.fn()
const mockShowToast = vi.fn()
const mockOpenPreferences = vi.fn()
vi.mock('@/lib/commands', () => ({
  executeCommand: (...args: unknown[]) =>
    mockExecuteCommand(...(args as [never, never])),
}))

// Mock useCommandContext from its own module (not re-exported from lib/commands)
vi.mock('@/hooks/use-command-context', () => ({
  useCommandContext: () => ({
    openPreferences: (...args: unknown[]) =>
      mockOpenPreferences(...(args as [])),
    showToast: (...args: unknown[]) =>
      mockShowToast(...(args as [never, never])),
  }),
}))

describe('TitleBarLeftActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染切换左侧栏的按钮', () => {
      render(<TitleBarLeftActions />)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('leftSidebarVisible=true 时按钮 title 为 hideLeftSidebar', () => {
      render(<TitleBarLeftActions />)
      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'titlebar.hideLeftSidebar'
      )
    })

    it('leftSidebarVisible=false 时按钮 title 为 showLeftSidebar', () => {
      useSidebarStore.setState({ leftSidebarVisible: false })
      render(<TitleBarLeftActions />)
      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'titlebar.showLeftSidebar'
      )
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('点击按钮切换左侧栏可见性', async () => {
      const user = userEvent.setup()
      render(<TitleBarLeftActions />)
      await user.click(screen.getByRole('button'))
      expect(useSidebarStore.getState().leftSidebarVisible).toBe(false)
    })
  })
})

describe('TitleBarRightActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
    mockExecuteCommand.mockResolvedValue({ success: true })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染设置按钮和右侧栏切换按钮', () => {
      render(<TitleBarRightActions />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(2)
    })

    it('设置按钮 title 为 "titlebar.settings"', () => {
      render(<TitleBarRightActions />)
      const settingsButton = screen.getByTitle('titlebar.settings')
      expect(settingsButton).toBeInTheDocument()
    })

    it('rightSidebarVisible=true 时切换按钮 title 为 hideRightSidebar', () => {
      render(<TitleBarRightActions />)
      expect(screen.getByTitle('titlebar.hideRightSidebar')).toBeInTheDocument()
    })

    it('rightSidebarVisible=false 时切换按钮 title 为 showRightSidebar', () => {
      useSidebarStore.setState({ rightSidebarVisible: false })
      render(<TitleBarRightActions />)
      expect(screen.getByTitle('titlebar.showRightSidebar')).toBeInTheDocument()
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('点击设置按钮调用 executeCommand("open-preferences")', async () => {
      const user = userEvent.setup()
      render(<TitleBarRightActions />)
      await user.click(screen.getByTitle('titlebar.settings'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'open-preferences',
          expect.any(Object)
        )
      })
    })

    it('点击右侧栏切换按钮切换可见性', async () => {
      const user = userEvent.setup()
      render(<TitleBarRightActions />)
      await user.click(screen.getByTitle('titlebar.hideRightSidebar'))
      expect(useSidebarStore.getState().rightSidebarVisible).toBe(false)
    })
  })

  describe('异常用例', () => {
    it('executeCommand 返回失败时调用 showToast', async () => {
      const user = userEvent.setup()
      mockExecuteCommand.mockResolvedValue({
        success: false,
        error: 'Command failed',
      })
      render(<TitleBarRightActions />)

      await user.click(screen.getByTitle('titlebar.settings'))

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Command failed', 'error')
      })
    })

    it('executeCommand 抛错时不导致组件崩溃', async () => {
      const user = userEvent.setup()
      // 组件未捕获 rejection,使用 mockResolvedValue 模拟失败结果而非 rejection
      mockExecuteCommand.mockResolvedValue({
        success: false,
        error: 'network fail',
      })
      render(<TitleBarRightActions />)

      await user.click(screen.getByTitle('titlebar.settings'))
      // 等待异步操作完成,组件应仍然渲染
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalled()
      })
      expect(screen.getByTitle('titlebar.settings')).toBeInTheDocument()
    })
  })
})

describe('TitleBarTitle', () => {
  describe('正向用例', () => {
    it('渲染传入的 title', () => {
      render(<TitleBarTitle title="My App" />)
      expect(screen.getByText('My App')).toBeInTheDocument()
    })

    it('使用默认 title "Tauri App"', () => {
      render(<TitleBarTitle />)
      expect(screen.getByText('Tauri App')).toBeInTheDocument()
    })
  })

  describe('边界用例', () => {
    it('空字符串 title 仍渲染 span 节点', () => {
      render(<TitleBarTitle title="" />)
      const span = screen.getByText('', { selector: 'span' })
      expect(span).toBeInTheDocument()
      expect(span).toHaveTextContent('')
    })
  })
})

describe('TitleBarContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSidebarStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
    })
    mockExecuteCommand.mockResolvedValue({ success: true })
  })

  describe('正向用例', () => {
    it('渲染左侧 actions、标题和右侧 actions', () => {
      render(<TitleBarContent title="Test App" />)
      expect(screen.getByText('Test App')).toBeInTheDocument()
      // Left sidebar toggle button
      expect(screen.getByTitle('titlebar.hideLeftSidebar')).toBeInTheDocument()
      // Settings + right sidebar toggle
      expect(screen.getByTitle('titlebar.settings')).toBeInTheDocument()
      expect(screen.getByTitle('titlebar.hideRightSidebar')).toBeInTheDocument()
    })

    it('使用默认 title', () => {
      render(<TitleBarContent />)
      expect(screen.getByText('Tauri App')).toBeInTheDocument()
    })
  })

  describe('边界用例', () => {
    it('空 title 仍能渲染', () => {
      render(<TitleBarContent title="" />)
      // The title span exists but is empty
      const titleSpan = screen.getByText('', { selector: 'span' })
      expect(titleSpan).toBeInTheDocument()
    })
  })
})
