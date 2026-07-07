import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MacOSIcons, WindowsIcons } from './WindowControlIcons'

describe('MacOSIcons', () => {
  describe('正向用例', () => {
    it('close 图标渲染为 svg', () => {
      const { container } = render(<MacOSIcons.close />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 16 18')
    })

    it('minimize 图标渲染为 svg', () => {
      const { container } = render(<MacOSIcons.minimize />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 17 6')
    })

    it('fullscreen 图标渲染为 svg', () => {
      const { container } = render(<MacOSIcons.fullscreen />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 15 15')
    })

    it('maximize 图标渲染为 svg', () => {
      const { container } = render(<MacOSIcons.maximize />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 17 16')
    })
  })

  describe('边界用例', () => {
    it('close 接受额外的 SVG props 并传递到 svg 元素', () => {
      const { container } = render(
        <MacOSIcons.close className="custom-class" data-testid="icon" />
      )
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('custom-class')
      expect(svg).toHaveAttribute('data-testid', 'icon')
    })

    it('minimize 接受 className 并合并到 svg', () => {
      const { container } = render(<MacOSIcons.minimize className="my-min" />)
      expect(container.querySelector('svg')).toHaveClass('my-min')
    })

    it('所有 MacOSIcons 都是函数组件', () => {
      expect(typeof MacOSIcons.close).toBe('function')
      expect(typeof MacOSIcons.minimize).toBe('function')
      expect(typeof MacOSIcons.fullscreen).toBe('function')
      expect(typeof MacOSIcons.maximize).toBe('function')
    })
  })
})

describe('WindowsIcons', () => {
  describe('正向用例', () => {
    it('minimize 图标渲染为 svg', () => {
      const { container } = render(<WindowsIcons.minimize />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 10 1')
    })

    it('maximize 图标渲染为 svg', () => {
      const { container } = render(<WindowsIcons.maximize />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 10 10')
    })

    it('restore 图标渲染为 svg', () => {
      const { container } = render(<WindowsIcons.restore />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 10 10')
    })

    it('close 图标渲染为 svg', () => {
      const { container } = render(<WindowsIcons.close />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 10 10')
    })
  })

  describe('边界用例', () => {
    it('minimize 接受额外 props', () => {
      const { container } = render(
        <WindowsIcons.minimize className="min-class" aria-label="min" />
      )
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('min-class')
      expect(svg).toHaveAttribute('aria-label', 'min')
    })

    it('maximize 接受额外 props', () => {
      const { container } = render(<WindowsIcons.maximize data-foo="bar" />)
      expect(container.querySelector('svg')).toHaveAttribute('data-foo', 'bar')
    })

    it('所有 WindowsIcons 都是函数组件', () => {
      expect(typeof WindowsIcons.minimize).toBe('function')
      expect(typeof WindowsIcons.maximize).toBe('function')
      expect(typeof WindowsIcons.restore).toBe('function')
      expect(typeof WindowsIcons.close).toBe('function')
    })
  })
})
