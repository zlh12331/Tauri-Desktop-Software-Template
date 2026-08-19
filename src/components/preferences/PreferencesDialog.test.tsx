import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — UI primitives and sub-panes are stubbed so the test focuses on
// PreferencesDialog's own logic (pane state, navigation, dialog wiring).
// ---------------------------------------------------------------------------
const mockT = vi.fn((key: string) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}))

const mockDialogState = {
  preferencesOpen: true,
  setPreferencesOpen: vi.fn(),
}
vi.mock('@/store/dialog-store', () => ({
  useDialogStore: (selector: (state: typeof mockDialogState) => unknown) =>
    selector(mockDialogState),
}))

// motion/react — passthrough so children render normally
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
}))

// lucide-react — minimal icons
vi.mock('lucide-react', () => ({
  Settings: () => <span data-testid="icon-settings" />,
  Palette: () => <span data-testid="icon-palette" />,
  Zap: () => <span data-testid="icon-zap" />,
}))

// UI primitives
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid="dialog" data-open={open}>
      <button data-testid="dialog-close" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group-content">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu">{children}</div>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    isActive,
    children,
  }: {
    isActive?: boolean
    children: React.ReactNode
  }) => (
    <div data-testid="sidebar-menu-button" data-active={!!isActive}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
    <ol data-testid="breadcrumb-list">{children}</ol>
  ),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="breadcrumb-item">{children}</li>
  ),
  BreadcrumbLink: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="breadcrumb-link">{children}</span>
  ),
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="breadcrumb-page">{children}</span>
  ),
  BreadcrumbSeparator: () => <span data-testid="breadcrumb-sep">/</span>,
}))

// Sub-panes — stubs
vi.mock('./panes/GeneralPane', () => ({
  GeneralPane: () => <div data-testid="pane-general">General</div>,
}))
vi.mock('./panes/AppearancePane', () => ({
  AppearancePane: () => <div data-testid="pane-appearance">Appearance</div>,
}))
vi.mock('./panes/AdvancedPane', () => ({
  AdvancedPane: () => <div data-testid="pane-advanced">Advanced</div>,
}))

import { PreferencesDialog } from './PreferencesDialog'

describe('PreferencesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDialogState.preferencesOpen = true
    mockDialogState.setPreferencesOpen.mockClear()
    mockT.mockReset()
    mockT.mockImplementation((key: string) => key)
  })

  describe('正向用例 — 渲染', () => {
    it('preferencesOpen=true 时渲染打开的 dialog', () => {
      render(<PreferencesDialog />)
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
    })

    it('渲染 sr-only 标题与描述', () => {
      render(<PreferencesDialog />)
      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'preferences.title'
      )
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'preferences.description'
      )
    })

    it('渲染三个导航项（general/appearance/advanced）', () => {
      render(<PreferencesDialog />)
      const navButtons = screen.getAllByRole('button')
      // dialog-close + 3 nav buttons
      expect(navButtons.length).toBe(4)
      expect(
        screen.getAllByText('preferences.general').length
      ).toBeGreaterThanOrEqual(2) // nav item + breadcrumb title
      expect(screen.getAllByText('preferences.appearance').length).toBe(1)
      expect(screen.getAllByText('preferences.advanced').length).toBe(1)
      expect(screen.getByTestId('icon-settings')).toBeInTheDocument()
      expect(screen.getByTestId('icon-palette')).toBeInTheDocument()
      expect(screen.getByTestId('icon-zap')).toBeInTheDocument()
    })

    it('默认渲染 GeneralPane', () => {
      render(<PreferencesDialog />)
      expect(screen.getByTestId('pane-general')).toBeInTheDocument()
      expect(screen.queryByTestId('pane-appearance')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pane-advanced')).not.toBeInTheDocument()
    })
  })

  describe('正向用例 — 导航与切换', () => {
    it('默认 general 导航项标记为 active', () => {
      render(<PreferencesDialog />)
      const buttons = screen.getAllByTestId('sidebar-menu-button')
      expect(buttons[0]).toHaveAttribute('data-active', 'true')
      expect(buttons[1]).toHaveAttribute('data-active', 'false')
      expect(buttons[2]).toHaveAttribute('data-active', 'false')
    })

    it('点击 appearance 切换到 AppearancePane 并标记 active', () => {
      render(<PreferencesDialog />)
      fireEvent.click(screen.getByText('preferences.appearance'))

      expect(screen.getByTestId('pane-appearance')).toBeInTheDocument()
      expect(screen.queryByTestId('pane-general')).not.toBeInTheDocument()
      const buttons = screen.getAllByTestId('sidebar-menu-button')
      expect(buttons[0]).toHaveAttribute('data-active', 'false')
      expect(buttons[1]).toHaveAttribute('data-active', 'true')
    })

    it('点击 advanced 切换到 AdvancedPane', () => {
      render(<PreferencesDialog />)
      fireEvent.click(screen.getByText('preferences.advanced'))

      expect(screen.getByTestId('pane-advanced')).toBeInTheDocument()
      expect(screen.queryByTestId('pane-general')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pane-appearance')).not.toBeInTheDocument()
    })

    it('切换后可以再切回 general', () => {
      render(<PreferencesDialog />)
      fireEvent.click(screen.getByText('preferences.advanced'))
      expect(screen.getByTestId('pane-advanced')).toBeInTheDocument()

      fireEvent.click(screen.getByText('preferences.general'))
      expect(screen.getByTestId('pane-general')).toBeInTheDocument()
      expect(screen.queryByTestId('pane-advanced')).not.toBeInTheDocument()
    })
  })

  describe('正向用例 — 面包屑标题', () => {
    it('初始显示 general 面包屑标题', () => {
      render(<PreferencesDialog />)
      expect(screen.getByTestId('breadcrumb-page')).toHaveTextContent(
        'preferences.general'
      )
    })

    it('切换 pane 后面包屑标题更新', () => {
      render(<PreferencesDialog />)
      fireEvent.click(screen.getByText('preferences.appearance'))
      expect(screen.getByTestId('breadcrumb-page')).toHaveTextContent(
        'preferences.appearance'
      )
    })
  })

  describe('边界用例 — 关闭', () => {
    it('preferencesOpen=false 时 dialog 关闭', () => {
      mockDialogState.preferencesOpen = false
      render(<PreferencesDialog />)
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false')
    })

    it('onOpenChange(false) 调用 setPreferencesOpen(false)', () => {
      render(<PreferencesDialog />)
      fireEvent.click(screen.getByTestId('dialog-close'))
      expect(mockDialogState.setPreferencesOpen).toHaveBeenCalledWith(false)
    })
  })
})
