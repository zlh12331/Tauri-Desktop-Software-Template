import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as React from 'react'
import { ErrorBoundary } from './ErrorBoundary'

// Mock saveCrashState
const mockSaveCrashState = vi.fn()
vi.mock('@/lib/recovery', () => ({
  saveCrashState: (...args: unknown[]) =>
    mockSaveCrashState(...(args as [never, never])),
}))

// Mock sentry captureException
const mockCaptureException = vi.fn()
vi.mock('@/lib/sentry', () => ({
  captureException: (...args: unknown[]) =>
    mockCaptureException(...(args as [never])),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

// Component that throws on render
function ThrowOnRender({ message }: { message: string }): React.ReactElement {
  throw new Error(message)
}

// Component that throws on update
class ThrowOnUpdate extends React.Component<
  { shouldThrow: boolean; message: string },
  Record<string, never>
> {
  override render(): React.ReactElement {
    if (this.props.shouldThrow) {
      throw new Error(this.props.message)
    }
    return <span data-testid="healthy-child">healthy</span>
  }
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveCrashState.mockResolvedValue(undefined)
    // Suppress React's console.error noise for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  describe('正向用例 — 正常渲染', () => {
    it('无错误时渲染 children', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Hello</div>
        </ErrorBoundary>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Hello')).toBeInTheDocument()
    })

    it('渲染多个 children', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child-1">1</div>
          <div data-testid="child-2">2</div>
        </ErrorBoundary>
      )
      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
    })
  })

  describe('异常用例 — 错误捕获', () => {
    it('子组件抛错时渲染错误回退 UI', () => {
      render(
        <ErrorBoundary>
          <ThrowOnRender message="test crash" />
        </ErrorBoundary>
      )
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(
        screen.getByText(/The application encountered an unexpected error/i)
      ).toBeInTheDocument()
    })

    it('捕获错误时调用 captureException', () => {
      render(
        <ErrorBoundary>
          <ThrowOnRender message="captured error" />
        </ErrorBoundary>
      )
      expect(mockCaptureException).toHaveBeenCalledTimes(1)
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'captured error' })
      )
    })

    it('捕获错误时调用 saveCrashState 保存崩溃状态', async () => {
      render(
        <ErrorBoundary>
          <ThrowOnRender message="save crash" />
        </ErrorBoundary>
      )
      // saveCrashState is called asynchronously in componentDidCatch
      await vi.waitFor(() => {
        expect(mockSaveCrashState).toHaveBeenCalledTimes(1)
      })
      const [stateArg, crashInfoArg] = mockSaveCrashState.mock.calls[0] ?? []
      expect(stateArg).toHaveProperty('url')
      expect(stateArg).toHaveProperty('userAgent')
      expect(stateArg).toHaveProperty('timestamp')
      expect(crashInfoArg).toHaveProperty('error', 'save crash')
      expect(crashInfoArg).toHaveProperty('stack')
    })

    it('saveCrashState 失败时不会向上抛错', async () => {
      mockSaveCrashState.mockRejectedValue(new Error('save failed'))

      // Should not throw — error boundary swallows save errors
      expect(() =>
        render(
          <ErrorBoundary>
            <ThrowOnRender message="swallow save error" />
          </ErrorBoundary>
        )
      ).not.toThrow()

      // Error UI is still shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('正向用例 — 错误恢复交互', () => {
    it('点击 "Try Again" 重置错误状态', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowOnUpdate shouldThrow={true} message="first error" />
        </ErrorBoundary>
      )
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Click "Try Again"
      const tryAgainButton = screen.getByText('Try Again')
      tryAgainButton.click()

      // Rerender with shouldThrow=false so the child renders successfully
      rerender(
        <ErrorBoundary>
          <ThrowOnUpdate shouldThrow={false} message="no error" />
        </ErrorBoundary>
      )
      expect(screen.getByTestId('healthy-child')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    it('点击 "Reload Application" 调用 window.location.reload', () => {
      const reloadSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      })

      render(
        <ErrorBoundary>
          <ThrowOnRender message="reload test" />
        </ErrorBoundary>
      )
      screen.getByText('Reload Application').click()
      expect(reloadSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('边界用例', () => {
    it('错误堆栈包含错误名称和消息', () => {
      render(
        <ErrorBoundary>
          <ThrowOnRender message="detailed message" />
        </ErrorBoundary>
      )
      // captureException should have been called with an Error
      const errorArg = mockCaptureException.mock.calls[0]?.[0] as Error
      expect(errorArg).toBeInstanceOf(Error)
      expect(errorArg.message).toBe('detailed message')
    })

    it('连续抛错仍能保持错误 UI', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowOnRender message="error 1" />
        </ErrorBoundary>
      )
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Rerender with another throwing component — should stay in error state
      rerender(
        <ErrorBoundary>
          <ThrowOnRender message="error 2" />
        </ErrorBoundary>
      )
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })
})
