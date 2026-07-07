import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WindowsWindowControls } from './WindowsWindowControls'

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

// Mock @tauri-apps/api/window — getCurrentWindow returns an object with methods
const mockIsMaximized = vi.fn()
const mockOnResized = vi.fn()
const mockMaximize = vi.fn()
const mockUnmaximize = vi.fn()
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isMaximized: (...args: unknown[]) => mockIsMaximized(...(args as [])),
    onResized: (...args: unknown[]) => mockOnResized(...(args as [never])),
    maximize: (...args: unknown[]) => mockMaximize(...(args as [])),
    unmaximize: (...args: unknown[]) => mockUnmaximize(...(args as [])),
  }),
}))

describe('WindowsWindowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMaximized.mockResolvedValue(false)
    mockOnResized.mockResolvedValue(vi.fn()) // returns unlisten function
    mockMaximize.mockResolvedValue(undefined)
    mockUnmaximize.mockResolvedValue(undefined)
    mockExecuteCommand.mockResolvedValue({ success: true })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染三个窗口控制按钮', () => {
      render(<WindowsWindowControls />)
      expect(screen.getByLabelText('Minimize window')).toBeInTheDocument()
      expect(screen.getByLabelText('Maximize window')).toBeInTheDocument()
      expect(screen.getByLabelText('Close window')).toBeInTheDocument()
    })

    it('挂载时查询初始 maximized 状态', async () => {
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(mockIsMaximized).toHaveBeenCalledTimes(1)
      })
    })

    it('挂载时订阅 onResized 事件', async () => {
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(mockOnResized).toHaveBeenCalledTimes(1)
      })
    })

    it('未最大化时按钮 title 为 "Maximize"', async () => {
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(screen.getByLabelText('Maximize window')).toHaveAttribute(
          'title',
          'Maximize'
        )
      })
    })

    it('最大化时按钮 title 为 "Restore"', async () => {
      mockIsMaximized.mockResolvedValue(true)
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(screen.getByLabelText('Restore window')).toHaveAttribute(
          'title',
          'Restore'
        )
      })
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('点击 minimize 按钮调用 executeCommand("window-minimize")', async () => {
      const user = userEvent.setup()
      render(<WindowsWindowControls />)
      await user.click(screen.getByLabelText('Minimize window'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-minimize',
          expect.any(Object)
        )
      })
    })

    it('点击 close 按钮调用 executeCommand("window-close")', async () => {
      const user = userEvent.setup()
      render(<WindowsWindowControls />)
      await user.click(screen.getByLabelText('Close window'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-close',
          expect.any(Object)
        )
      })
    })

    it('未最大化时点击 maximize 按钮调用 maximize()', async () => {
      const user = userEvent.setup()
      mockIsMaximized.mockResolvedValue(false)
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(mockIsMaximized).toHaveBeenCalled()
      })

      await user.click(screen.getByLabelText('Maximize window'))

      await waitFor(() => {
        expect(mockMaximize).toHaveBeenCalledTimes(1)
      })
    })

    it('最大化时点击 restore 按钮调用 unmaximize()', async () => {
      const user = userEvent.setup()
      mockIsMaximized.mockResolvedValue(true)
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(screen.getByLabelText('Restore window')).toBeInTheDocument()
      })

      await user.click(screen.getByLabelText('Restore window'))

      await waitFor(() => {
        expect(mockUnmaximize).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('边界用例', () => {
    it('isMaximized 查询失败时不抛错', async () => {
      mockIsMaximized.mockRejectedValue(new Error('window not ready'))
      // Should not throw during render
      expect(() => render(<WindowsWindowControls />)).not.toThrow()
      // 等待异步操作完成,避免未处理的 rejection
      await waitFor(() => {
        expect(mockIsMaximized).toHaveBeenCalled()
      })
    })

    it('onResized 返回 null 时不抛错', async () => {
      mockOnResized.mockResolvedValue(null)
      expect(() => render(<WindowsWindowControls />)).not.toThrow()
      await waitFor(() => {
        expect(mockOnResized).toHaveBeenCalled()
      })
    })
  })

  describe('异常用例', () => {
    it('maximize() 抛错时回退到 executeCommand("window-toggle-maximize")', async () => {
      const user = userEvent.setup()
      mockIsMaximized.mockResolvedValue(false)
      mockMaximize.mockRejectedValue(new Error('maximize failed'))
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(mockIsMaximized).toHaveBeenCalled()
      })

      await user.click(screen.getByLabelText('Maximize window'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-toggle-maximize',
          expect.any(Object)
        )
      })
    })

    it('unmaximize() 抛错时回退到 executeCommand("window-toggle-maximize")', async () => {
      const user = userEvent.setup()
      mockIsMaximized.mockResolvedValue(true)
      mockUnmaximize.mockRejectedValue(new Error('unmaximize failed'))
      render(<WindowsWindowControls />)
      await waitFor(() => {
        expect(screen.getByLabelText('Restore window')).toBeInTheDocument()
      })

      await user.click(screen.getByLabelText('Restore window'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-toggle-maximize',
          expect.any(Object)
        )
      })
    })
  })
})
