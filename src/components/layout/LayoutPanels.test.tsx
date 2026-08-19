import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeftSideBar } from './LeftSideBar'
import { RightSideBar } from './RightSideBar'
import { MainWindowContent } from './MainWindowContent'
import { useUIStore } from '@/store/ui-store'

describe('LeftSideBar', () => {
  it('正向：渲染容器并合并 className', () => {
    const { container } = render(<LeftSideBar className="custom-left" />)
    const div = container.firstChild as HTMLElement
    expect(div).toBeInTheDocument()
    expect(div.className).toContain('border-r')
    expect(div.className).toContain('custom-left')
  })

  it('边界：渲染 children', () => {
    render(
      <LeftSideBar>
        <span>nav</span>
      </LeftSideBar>
    )
    expect(screen.getByText('nav')).toBeInTheDocument()
  })

  it('边界：无 className 时不包含 undefined', () => {
    const { container } = render(<LeftSideBar />)
    const div = container.firstChild as HTMLElement
    expect(div.className).not.toContain('undefined')
  })
})

describe('RightSideBar', () => {
  it('正向：渲染容器并合并 className', () => {
    const { container } = render(<RightSideBar className="custom-right" />)
    const div = container.firstChild as HTMLElement
    expect(div).toBeInTheDocument()
    expect(div.className).toContain('border-l')
    expect(div.className).toContain('custom-right')
  })

  it('边界：渲染 children', () => {
    render(
      <RightSideBar>
        <span>inspector</span>
      </RightSideBar>
    )
    expect(screen.getByText('inspector')).toBeInTheDocument()
  })
})

describe('MainWindowContent', () => {
  beforeEach(() => {
    useUIStore.setState({ lastQuickPaneEntry: null })
  })

  it('正向：无 lastQuickPaneEntry 时显示 Hello World', () => {
    useUIStore.setState({ lastQuickPaneEntry: null })
    render(<MainWindowContent />)
    expect(
      screen.getByRole('heading', { name: /hello world/i })
    ).toBeInTheDocument()
  })

  it('正向：有 lastQuickPaneEntry 时显示条目', () => {
    useUIStore.setState({ lastQuickPaneEntry: 'note: buy milk' })
    render(<MainWindowContent />)
    expect(
      screen.getByRole('heading', { name: /last entry: note: buy milk/i })
    ).toBeInTheDocument()
  })

  it('边界：children 存在时优先渲染 children', () => {
    useUIStore.setState({ lastQuickPaneEntry: 'should be ignored' })
    render(
      <MainWindowContent>
        <div>custom content</div>
      </MainWindowContent>
    )
    expect(screen.getByText('custom content')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /hello world/i })
    ).not.toBeInTheDocument()
  })

  it('边界：空字符串 lastQuickPaneEntry 视为 falsy 显示 Hello World', () => {
    useUIStore.setState({ lastQuickPaneEntry: '' })
    render(<MainWindowContent />)
    expect(
      screen.getByRole('heading', { name: /hello world/i })
    ).toBeInTheDocument()
  })

  it('边界：合并 className', () => {
    const { container } = render(<MainWindowContent className="extra" />)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('extra')
  })
})
