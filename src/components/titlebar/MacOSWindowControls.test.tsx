import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MacOSWindowControls } from './MacOSWindowControls'

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

// Mock @tauri-apps/api/window
const mockIsFullscreen = vi.fn()
const mockOnFocusChanged = vi.fn()
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isFullscreen: (...args: unknown[]) => mockIsFullscreen(...(args as [])),
    onFocusChanged: (...args: unknown[]) =>
      mockOnFocusChanged(...(args as [never])),
  }),
}))

// Mock cn for class assertions
vi.mock('@/lib/utils', () => ({
  cn: (...inputs: (string | false | undefined | null)[]) =>
    inputs.filter(Boolean).join(' '),
}))

describe('MacOSWindowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFullscreen.mockResolvedValue(false)
    mockOnFocusChanged.mockResolvedValue(vi.fn())
    mockExecuteCommand.mockResolvedValue({ success: true })
  })

  describe('正向用例 — 渲染', () => {
    it('渲染三个 traffic light 按钮', () => {
      render(<MacOSWindowControls />)
      expect(screen.getByLabelText('Close window')).toBeInTheDocument()
      expect(screen.getByLabelText('Minimize window')).toBeInTheDocument()
      // Default (no Alt) shows "Enter fullscreen"
      expect(screen.getByLabelText('Enter fullscreen')).toBeInTheDocument()
    })

    it('挂载时订阅 onFocusChanged 事件', async () => {
      render(<MacOSWindowControls />)
      await waitFor(() => {
        expect(mockOnFocusChanged).toHaveBeenCalledTimes(1)
      })
    })

    it('应用额外的 className', () => {
      const { container } = render(<MacOSWindowControls className="custom" />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom')
    })
  })

  describe('正向用例 — 用户交互', () => {
    it('点击 close 按钮调用 executeCommand("window-close")', async () => {
      const user = userEvent.setup()
      render(<MacOSWindowControls />)
      await user.click(screen.getByLabelText('Close window'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-close',
          expect.any(Object)
        )
      })
    })

    it('点击 minimize 按钮调用 executeCommand("window-minimize")', async () => {
      const user = userEvent.setup()
      render(<MacOSWindowControls />)
      await user.click(screen.getByLabelText('Minimize window'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-minimize',
          expect.any(Object)
        )
      })
    })

    it('未按 Alt 时点击绿色按钮调用 executeCommand("window-fullscreen")', async () => {
      const user = userEvent.setup()
      mockIsFullscreen.mockResolvedValue(false)
      render(<MacOSWindowControls />)
      await user.click(screen.getByLabelText('Enter fullscreen'))
      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-fullscreen',
          expect.any(Object)
        )
      })
    })

    it('按住 Alt 时点击绿色按钮调用 executeCommand("window-toggle-maximize")', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      mockIsFullscreen.mockResolvedValue(false)
      render(<MacOSWindowControls />)

      // Simulate Alt key being pressed
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }))
      })

      // aria-label should now be "Maximize window"
      await waitFor(() => {
        expect(screen.getByLabelText('Maximize window')).toBeInTheDocument()
      })

      await user.click(screen.getByLabelText('Maximize window'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-toggle-maximize',
          expect.any(Object)
        )
      })

      // Release Alt key
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))
      })
      await waitFor(() => {
        expect(screen.getByLabelText('Enter fullscreen')).toBeInTheDocument()
      })
    })

    it('已全屏时点击绿色按钮调用 executeCommand("window-exit-fullscreen")', async () => {
      const user = userEvent.setup()
      mockIsFullscreen.mockResolvedValue(true)
      render(<MacOSWindowControls />)

      // Even with Alt pressed, fullscreen state should exit fullscreen
      await user.click(screen.getByLabelText('Enter fullscreen'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-exit-fullscreen',
          expect.any(Object)
        )
      })
    })
  })

  describe('边界用例', () => {
    it('鼠标 hover 时显示 close 图标', async () => {
      const user = userEvent.setup()
      const { container } = render(<MacOSWindowControls />)
      const wrapper = container.firstChild as HTMLElement

      await user.hover(wrapper)

      // SVGs should be rendered inside buttons on hover
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })

    it('鼠标离开时隐藏图标', async () => {
      const user = userEvent.setup()
      const { container } = render(<MacOSWindowControls />)
      const wrapper = container.firstChild as HTMLElement

      await user.hover(wrapper)
      await user.unhover(wrapper)

      // No SVGs should be visible after unhover
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBe(0)
    })

    it('onFocusChanged 抛错时不崩溃', async () => {
      mockOnFocusChanged.mockRejectedValue(new Error('event fail'))
      expect(() => render(<MacOSWindowControls />)).not.toThrow()
    })

    it('接受额外的 HTML div props', () => {
      render(
        <MacOSWindowControls data-testid="mac-controls" aria-label="window" />
      )
      expect(screen.getByTestId('mac-controls')).toHaveAttribute(
        'aria-label',
        'window'
      )
    })
  })

  describe('异常用例', () => {
    it('isFullscreen 抛错时回退到 window-fullscreen 命令', async () => {
      const user = userEvent.setup()
      mockIsFullscreen.mockRejectedValue(new Error('fullscreen check fail'))
      render(<MacOSWindowControls />)

      await user.click(screen.getByLabelText('Enter fullscreen'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-fullscreen',
          expect.any(Object)
        )
      })
    })

    it('isFullscreen 抛错且按住 Alt 时回退到 window-toggle-maximize', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      mockIsFullscreen.mockRejectedValue(new Error('fail'))
      render(<MacOSWindowControls />)

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }))
      })
      await waitFor(() => {
        expect(screen.getByLabelText('Maximize window')).toBeInTheDocument()
      })

      await user.click(screen.getByLabelText('Maximize window'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'window-toggle-maximize',
          expect.any(Object)
        )
      })

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))
      })
    })
  })
})
