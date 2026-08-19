import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — platform hook is injectable so all three platform layouts can be
// exercised; child components are stubbed to focus on TitleBar's dispatch logic.
// ---------------------------------------------------------------------------
const mockUsePlatform = vi.fn<() => 'macos' | 'windows' | 'linux'>(
  () => 'macos'
)
vi.mock('@/hooks/use-platform', () => ({
  usePlatform: () => mockUsePlatform(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: (string | false | undefined | null)[]) =>
    inputs.filter(Boolean).join(' '),
}))

vi.mock('./MacOSWindowControls', () => ({
  MacOSWindowControls: () => <div data-testid="mac-controls" />,
}))
vi.mock('./WindowsWindowControls', () => ({
  WindowsWindowControls: () => <div data-testid="win-controls" />,
}))
vi.mock('./LinuxTitleBar', () => ({
  LinuxTitleBar: (props: { className?: string; title?: string }) => (
    <div data-testid="linux-titlebar" data-title={props.title}>
      {props.className}
    </div>
  ),
}))
vi.mock('./TitleBarContent', () => ({
  TitleBarLeftActions: () => <div data-testid="left-actions" />,
  TitleBarRightActions: () => <div data-testid="right-actions" />,
  TitleBarTitle: (props: { title: string }) => (
    <div data-testid="title">{props.title}</div>
  ),
}))

import { TitleBar } from './TitleBar'

describe('TitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePlatform.mockReturnValue('macos')
  })

  describe('正向用例 — 平台分发', () => {
    it('macos 平台渲染 mac 布局（窗口控件 + 左右 actions + 标题）', () => {
      mockUsePlatform.mockReturnValue('macos')
      render(<TitleBar />)
      expect(screen.getByTestId('mac-controls')).toBeInTheDocument()
      expect(screen.getByTestId('left-actions')).toBeInTheDocument()
      expect(screen.getByTestId('right-actions')).toBeInTheDocument()
      expect(screen.getByTestId('title')).toBeInTheDocument()
      expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('linux-titlebar')).not.toBeInTheDocument()
    })

    it('windows 平台渲染 windows 布局（窗口控件在右侧）', () => {
      mockUsePlatform.mockReturnValue('windows')
      render(<TitleBar />)
      expect(screen.getByTestId('win-controls')).toBeInTheDocument()
      expect(screen.getByTestId('left-actions')).toBeInTheDocument()
      expect(screen.getByTestId('right-actions')).toBeInTheDocument()
      expect(screen.queryByTestId('mac-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('linux-titlebar')).not.toBeInTheDocument()
    })

    it('linux 平台仅渲染 LinuxTitleBar（原生装饰）', () => {
      mockUsePlatform.mockReturnValue('linux')
      render(<TitleBar />)
      expect(screen.getByTestId('linux-titlebar')).toBeInTheDocument()
      expect(screen.queryByTestId('mac-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument()
      expect(screen.queryByTestId('title')).not.toBeInTheDocument()
    })
  })

  describe('正向用例 — 标题', () => {
    it('未传 title 时使用翻译 key 默认值', () => {
      render(<TitleBar />)
      expect(screen.getByTestId('title')).toHaveTextContent('titlebar.default')
    })

    it('传入 title 时显示传入值', () => {
      render(<TitleBar title="My App" />)
      expect(screen.getByTestId('title')).toHaveTextContent('My App')
    })

    it('title 传给 LinuxTitleBar', () => {
      mockUsePlatform.mockReturnValue('linux')
      render(<TitleBar title="Linux App" />)
      expect(screen.getByTestId('linux-titlebar')).toHaveAttribute(
        'data-title',
        'Linux App'
      )
    })
  })

  describe('边界用例 — forcePlatform（开发模式）', () => {
    it('DEV 模式下 forcePlatform=linux 覆盖检测到的平台', () => {
      mockUsePlatform.mockReturnValue('macos')
      render(<TitleBar forcePlatform="linux" />)
      expect(screen.getByTestId('linux-titlebar')).toBeInTheDocument()
    })

    it('DEV 模式下 forcePlatform=windows 覆盖检测到的平台', () => {
      mockUsePlatform.mockReturnValue('macos')
      render(<TitleBar forcePlatform="windows" />)
      expect(screen.getByTestId('win-controls')).toBeInTheDocument()
    })

    it('非 DEV 模式下 forcePlatform 被忽略', () => {
      const originalDev = import.meta.env.DEV
      ;(import.meta.env as { DEV: boolean }).DEV = false
      try {
        mockUsePlatform.mockReturnValue('macos')
        render(<TitleBar forcePlatform="linux" />)
        expect(screen.getByTestId('mac-controls')).toBeInTheDocument()
        expect(screen.queryByTestId('linux-titlebar')).not.toBeInTheDocument()
      } finally {
        ;(import.meta.env as { DEV: boolean }).DEV = originalDev
      }
    })
  })

  describe('边界用例 — className', () => {
    it('macos/windows 容器接收 className', () => {
      render(<TitleBar className="custom-bar" />)
      const dragRegion = document.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toHaveClass('custom-bar')
    })

    it('linux 布局将 className 传给 LinuxTitleBar', () => {
      mockUsePlatform.mockReturnValue('linux')
      render(<TitleBar className="linux-bar" />)
      expect(screen.getByTestId('linux-titlebar')).toHaveTextContent(
        'linux-bar'
      )
    })
  })
})
