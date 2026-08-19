import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AppCommand, CommandContext } from '@/lib/commands/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// react-i18next — t returns the key unless overridden per test
const mockT = vi.fn((key: string) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}))

// Dialog store — selector-style mock
const mockDialogState = {
  commandPaletteOpen: false,
  setCommandPaletteOpen: vi.fn(),
}
vi.mock('@/store/dialog-store', () => ({
  useDialogStore: (selector: (state: typeof mockDialogState) => unknown) =>
    selector(mockDialogState),
}))

// Command context hook
const mockContext: CommandContext = {
  openPreferences: vi.fn(),
  showToast: vi.fn(),
}
vi.mock('@/hooks/use-command-context', () => ({
  useCommandContext: () => mockContext,
}))

// Command system — getAllCommands / executeCommand are injected fakes
const mockGetAllCommands = vi.fn<
  (context: CommandContext, search: string, t: unknown) => AppCommand[]
>(() => [])
const mockExecuteCommand =
  vi.fn<
    (
      id: string,
      context: CommandContext
    ) => Promise<{ success: boolean; error?: string }>
  >()
vi.mock('@/lib/commands', () => ({
  getAllCommands: (...args: unknown[]) =>
    mockGetAllCommands(...(args as [CommandContext, string, unknown])),
  executeCommand: (...args: unknown[]) =>
    mockExecuteCommand(...(args as [string, CommandContext])),
}))

// UI primitives — lightweight fakes that capture props and expose callbacks
import type { LucideIcon } from 'lucide-react'
const FakeIcon = (() => (
  <span data-testid="fake-icon" />
)) as unknown as LucideIcon
vi.mock('@/components/ui/command', () => ({
  CommandDialog: ({
    open,
    onOpenChange,
    title,
    description,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    children: React.ReactNode
  }) => (
    <div
      data-testid="command-dialog"
      data-open={open}
      data-title={title}
      data-description={description}
    >
      <button data-testid="dialog-toggle" onClick={() => onOpenChange(!open)} />
      {children}
    </div>
  ),
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value: string
    onValueChange: (value: string) => void
    placeholder: string
  }) => (
    <input
      data-testid="command-input"
      value={value}
      placeholder={placeholder}
      onChange={e => onValueChange(e.target.value)}
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-list">{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({
    heading,
    children,
  }: {
    heading: string
    children: React.ReactNode
  }) => (
    <div data-testid="command-group" data-heading={heading}>
      {children}
    </div>
  ),
  CommandItem: ({
    value,
    onSelect,
    children,
  }: {
    value: string
    onSelect?: (value: string) => void
    children: React.ReactNode
  }) => (
    <button
      data-testid={`command-item-${value}`}
      data-item-value={value}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </button>
  ),
  CommandShortcut: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="command-shortcut">{children}</span>
  ),
}))

import { CommandPalette } from './CommandPalette'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
// Test fixture: fake translation keys (not in en.json) on purpose — they
// exercise generic rendering, not real i18n. Cast because labelKey is typed
// against en.json (compile-time key check).
const fakeLabelKey = (k: string) => k as AppCommand['labelKey']

const makeCommand = (overrides: Partial<AppCommand> = {}): AppCommand => ({
  id: 'cmd-1',
  labelKey: fakeLabelKey('commands.cmd1.label'),
  execute: vi.fn(),
  ...overrides,
})

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDialogState.commandPaletteOpen = false
    mockDialogState.setCommandPaletteOpen.mockClear()
    mockGetAllCommands.mockReset()
    mockExecuteCommand.mockReset()
    mockT.mockReset()
    mockT.mockImplementation((key: string) => key)
    // Keep showToast mock spy-like so assertions work after clearAllMocks
    ;(mockContext.showToast as Mock).mockClear()
  })

  describe('正向用例 — 渲染与分组', () => {
    it('renders the dialog open with title and description when palette is open', () => {
      mockDialogState.commandPaletteOpen = true
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      const dialog = screen.getByTestId('command-dialog')
      expect(dialog).toHaveAttribute('data-open', 'true')
      expect(dialog).toHaveAttribute('data-title', 'commandPalette.title')
      expect(dialog).toHaveAttribute(
        'data-description',
        'commandPalette.placeholder'
      )
    })

    it('renders the dialog closed when palette is closed', () => {
      mockDialogState.commandPaletteOpen = false

      render(<CommandPalette />)

      expect(screen.getByTestId('command-dialog')).toHaveAttribute(
        'data-open',
        'false'
      )
    })

    it('calls getAllCommands with context, current search and t', () => {
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      expect(mockGetAllCommands).toHaveBeenCalledWith(mockContext, '', mockT)
    })

    it('groups commands by their group name and renders group headings', () => {
      mockGetAllCommands.mockReturnValue([
        makeCommand({ id: 'nav-a', group: 'navigation' }),
        makeCommand({ id: 'nav-b', group: 'navigation' }),
        makeCommand({ id: 'gen-a', group: 'general' }),
      ])

      render(<CommandPalette />)

      const groups = screen.getAllByTestId('command-group')
      expect(groups).toHaveLength(2)
      const headings = groups.map(g => g.getAttribute('data-heading'))
      expect(headings).toEqual(
        expect.arrayContaining(['Navigation', 'General'])
      )
      expect(screen.getByTestId('command-item-nav-a')).toBeInTheDocument()
      expect(screen.getByTestId('command-item-nav-b')).toBeInTheDocument()
      expect(screen.getByTestId('command-item-gen-a')).toBeInTheDocument()
    })

    it('uses the "other" group for commands without a group', () => {
      mockGetAllCommands.mockReturnValue([makeCommand({ id: 'ungrouped' })])

      render(<CommandPalette />)

      expect(screen.getByTestId('command-group')).toHaveAttribute(
        'data-heading',
        'Other'
      )
    })

    it('renders group label from translation when it exists', () => {
      mockGetAllCommands.mockReturnValue([
        makeCommand({ id: 'nav-a', group: 'navigation' }),
      ])
      mockT.mockImplementation((key: string) =>
        key === 'commands.group.navigation' ? 'Navigation' : key
      )

      render(<CommandPalette />)

      expect(screen.getByTestId('command-group')).toHaveAttribute(
        'data-heading',
        'Navigation'
      )
    })

    it('capitalizes the group name when no translation exists', () => {
      mockGetAllCommands.mockReturnValue([
        makeCommand({ id: 'ungrouped', group: 'window' }),
      ])

      render(<CommandPalette />)

      expect(screen.getByTestId('command-group')).toHaveAttribute(
        'data-heading',
        'Window'
      )
    })

    it('renders label, description, icon and shortcut for rich commands', () => {
      mockGetAllCommands.mockReturnValue([
        makeCommand({
          id: 'rich',
          labelKey: fakeLabelKey('commands.rich.label'),
          descriptionKey: fakeLabelKey('commands.rich.desc'),
          icon: FakeIcon,
          shortcut: '⌘R',
        }),
      ])
      mockT.mockImplementation((key: string) => `tr:${key}`)

      render(<CommandPalette />)

      const item = screen.getByTestId('command-item-rich')
      expect(item).toHaveTextContent('tr:commands.rich.label')
      expect(item).toHaveTextContent('tr:commands.rich.desc')
      expect(screen.getByTestId('fake-icon')).toBeInTheDocument()
      expect(screen.getByTestId('command-shortcut')).toHaveTextContent('⌘R')
    })

    it('renders only the label for minimal commands', () => {
      mockGetAllCommands.mockReturnValue([makeCommand({ id: 'minimal' })])

      render(<CommandPalette />)

      const item = screen.getByTestId('command-item-minimal')
      expect(item).toHaveTextContent('commands.cmd1.label')
      expect(screen.queryByTestId('fake-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('command-shortcut')).not.toBeInTheDocument()
    })
  })

  describe('边界用例 — 搜索与清空', () => {
    it('passes the current search value to the input and updates it', () => {
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      const input = screen.getByTestId('command-input')
      expect(input).toHaveValue('')
      fireEvent.change(input, { target: { value: 'show' } })
      expect(input).toHaveValue('show')
      // Search is forwarded to getAllCommands on re-render
      expect(mockGetAllCommands).toHaveBeenLastCalledWith(
        mockContext,
        'show',
        mockT
      )
    })

    it('shows the empty state placeholder', () => {
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      expect(screen.getByTestId('command-empty')).toHaveTextContent(
        'commandPalette.noResults'
      )
    })
  })

  describe('正向用例 — 打开/关闭', () => {
    it('opens the palette via onOpenChange(true)', () => {
      mockDialogState.commandPaletteOpen = false
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      fireEvent.click(screen.getByTestId('dialog-toggle'))

      expect(mockDialogState.setCommandPaletteOpen).toHaveBeenCalledWith(true)
    })

    it('closes the palette and clears search via onOpenChange(false)', () => {
      mockDialogState.commandPaletteOpen = true
      mockGetAllCommands.mockReturnValue([])

      render(<CommandPalette />)

      const input = screen.getByTestId('command-input')
      fireEvent.change(input, { target: { value: 'abc' } })
      expect(input).toHaveValue('abc')

      fireEvent.click(screen.getByTestId('dialog-toggle')) // -> onOpenChange(false)

      expect(mockDialogState.setCommandPaletteOpen).toHaveBeenCalledWith(false)
      expect(input).toHaveValue('')
    })
  })

  describe('正向用例 — 命令选择执行', () => {
    it('executes a command and closes + clears search on success', async () => {
      mockDialogState.commandPaletteOpen = true
      mockGetAllCommands.mockReturnValue([makeCommand({ id: 'run-me' })])
      mockExecuteCommand.mockResolvedValue({ success: true })

      render(<CommandPalette />)

      fireEvent.click(screen.getByTestId('command-item-run-me'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith('run-me', mockContext)
      })
      expect(mockDialogState.setCommandPaletteOpen).toHaveBeenCalledWith(false)
      expect(screen.getByTestId('command-input')).toHaveValue('')
      expect(mockContext.showToast).not.toHaveBeenCalled()
    })

    it('shows an error toast when execution reports an error', async () => {
      mockDialogState.commandPaletteOpen = true
      mockGetAllCommands.mockReturnValue([makeCommand({ id: 'failing' })])
      mockExecuteCommand.mockResolvedValue({
        success: false,
        error: 'boom',
      })

      render(<CommandPalette />)

      fireEvent.click(screen.getByTestId('command-item-failing'))

      await waitFor(() => {
        expect(mockContext.showToast).toHaveBeenCalledWith('boom', 'error')
      })
      expect(mockDialogState.setCommandPaletteOpen).toHaveBeenCalledWith(false)
      expect(screen.getByTestId('command-input')).toHaveValue('')
    })

    it('does not toast when execution fails without an error message', async () => {
      mockDialogState.commandPaletteOpen = true
      mockGetAllCommands.mockReturnValue([makeCommand({ id: 'silent-fail' })])
      mockExecuteCommand.mockResolvedValue({ success: false })

      render(<CommandPalette />)

      fireEvent.click(screen.getByTestId('command-item-silent-fail'))

      await waitFor(() => {
        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'silent-fail',
          mockContext
        )
      })
      expect(mockContext.showToast).not.toHaveBeenCalled()
    })
  })
})
