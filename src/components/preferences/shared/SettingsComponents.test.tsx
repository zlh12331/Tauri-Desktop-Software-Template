import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsField, SettingsSection } from './SettingsComponents'

describe('SettingsField', () => {
  describe('正向用例', () => {
    it('渲染 label 文本', () => {
      render(
        <SettingsField label="我的字段">
          <input data-testid="child" />
        </SettingsField>
      )
      expect(screen.getByText('我的字段')).toBeInTheDocument()
    })

    it('渲染传入的 children', () => {
      render(
        <SettingsField label="我的字段">
          <input data-testid="child-input" />
        </SettingsField>
      )
      expect(screen.getByTestId('child-input')).toBeInTheDocument()
    })

    it('渲染 description 文本', () => {
      render(
        <SettingsField label="字段" description="字段说明">
          <span />
        </SettingsField>
      )
      expect(screen.getByText('字段说明')).toBeInTheDocument()
    })
  })

  describe('边界用例', () => {
    it('未传入 description 时不渲染描述段落', () => {
      render(
        <SettingsField label="字段">
          <span data-testid="child" />
        </SettingsField>
      )
      expect(screen.queryByText('字段说明')).not.toBeInTheDocument()
    })

    it('children 为空片段时仍能渲染 label', () => {
      render(
        <SettingsField label="空 children">
          <></>
        </SettingsField>
      )
      expect(screen.getByText('空 children')).toBeInTheDocument()
    })

    it('空字符串 label 仍能渲染 label 节点', () => {
      render(
        <SettingsField label="">
          <span />
        </SettingsField>
      )
      // label 节点存在但内容为空
      const labelNode = screen.getByText('', { selector: 'label' })
      expect(labelNode).toBeInTheDocument()
      expect(labelNode).toHaveTextContent('')
    })
  })
})

describe('SettingsSection', () => {
  describe('正向用例', () => {
    it('渲染 title 为 h3 标题', () => {
      render(
        <SettingsSection title="区块标题">
          <span data-testid="child" />
        </SettingsSection>
      )
      const heading = screen.getByRole('heading', {
        level: 3,
        name: '区块标题',
      })
      expect(heading).toBeInTheDocument()
    })

    it('渲染传入的 children', () => {
      render(
        <SettingsSection title="标题">
          <button data-testid="child-btn">按钮</button>
        </SettingsSection>
      )
      expect(screen.getByTestId('child-btn')).toBeInTheDocument()
    })

    it('渲染分隔符 (separator)', () => {
      const { container } = render(
        <SettingsSection title="标题">
          <span />
        </SettingsSection>
      )
      // Radix Separator renders with data-slot="separator" (decorative by default)
      const separator = container.querySelector('[data-slot="separator"]')
      expect(separator).toBeInTheDocument()
    })
  })

  describe('边界用例', () => {
    it('空字符串 title 仍能渲染 h3 节点', () => {
      render(
        <SettingsSection title="">
          <span />
        </SettingsSection>
      )
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent('')
    })

    it('多个 children 都能被渲染', () => {
      render(
        <SettingsSection title="标题">
          <div data-testid="child-1">1</div>
          <div data-testid="child-2">2</div>
          <div data-testid="child-3">3</div>
        </SettingsSection>
      )
      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
      expect(screen.getByTestId('child-3')).toBeInTheDocument()
    })
  })
})
