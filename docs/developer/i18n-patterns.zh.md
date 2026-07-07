# 国际化（i18n）

[English](i18n-patterns.en.md) | **[中文](i18n-patterns.zh.md)**

## 概述

本应用使用 [react-i18next](https://react.i18next.com/) 进行国际化。所有面向用户的字符串（包括原生菜单）都从 JSON 翻译文件中的单一数据源进行翻译。

### 关键设计决策

- **react-i18next**：行业标准 React i18n 库，具有出色的 TypeScript 支持
- **JSON 翻译文件**：简单、可移植的格式，存储在 `/locales/`
- **基于 JavaScript 的原生菜单**：菜单由 JavaScript 构建（而非 Rust），以使用相同的翻译系统
- **RTL 支持**：CSS 使用逻辑属性实现自动 RTL 布局

## 架构

```
/locales/
├── en.json              # 英文（默认）
├── zh.json              # 中文
└── [lang].json          # 其他语言

/src/i18n/
├── config.ts            # i18next 配置
├── i18n.d.ts            # TypeScript 类型定义
├── language-init.ts     # 系统区域设置检测
└── index.ts             # 导出
```

## 添加新的可翻译字符串

### 步骤 1：添加到翻译文件

将字符串添加到 `/locales/en.json`：

```json
{
  "myFeature.title": "My Feature",
  "myFeature.description": "This is my feature description",
  "myFeature.button.save": "Save Changes"
}
```

### 步骤 2：在 React 组件中使用

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.button.save')}</button>
    </div>
  )
}
```

### 步骤 3：添加到其他语言

将相同的键添加到所有其他语言文件（例如 `/locales/zh.json`）。

## 键命名约定

使用点表示法按功能/组件组织键：

| 模式                      | 示例                                    | 用例              |
| ------------------------- | --------------------------------------- | ----------------- |
| `feature.element`         | `preferences.title`                     | 简单功能字符串    |
| `feature.section.element` | `preferences.general.keyboardShortcuts` | 嵌套部分          |
| `feature.action.verb`     | `commands.openPreferences.label`        | 操作标签          |
| `common.word`             | `common.enabled`                        | 共享/可复用字符串 |
| `toast.type.key`          | `toast.success.preferencesSaved`        | Toast 通知        |
| `menu.item`               | `menu.quit`                             | 原生菜单项        |

### 命名规则

1. **多词片段使用 camelCase**：`keyboardShortcuts`，而非 `keyboard-shortcuts`
2. **要具体**：`preferences.appearance.colorTheme`，而非 `theme`
3. **分组相关字符串**：所有偏好设置字符串放在 `preferences.*` 下
4. **使用一致的后缀**：表单元素使用 `.label`、`.description`、`.placeholder`

## 插值

使用双花括号传递动态值：

### 翻译文件

```json
{
  "menu.about": "About {{appName}}",
  "toast.error.windowCloseFailed": "Failed to close window: {{message}}"
}
```

### 用法

```typescript
t('menu.about', { appName: 'My App' })
// 输出："About My App"

t('toast.error.windowCloseFailed', { message: 'Permission denied' })
// 输出："Failed to close window: Permission denied"
```

## 复数

i18next 通过 `_one`、`_other` 后缀支持复数：

### 翻译文件

```json
{
  "items.count_one": "{{count}} item",
  "items.count_other": "{{count}} items"
}
```

### 用法

```typescript
t('items.count', { count: 1 }) // "1 item"
t('items.count', { count: 5 }) // "5 items"
```

## 添加新语言

### 步骤 1：创建翻译文件

将 `/locales/en.json` 复制到 `/locales/[lang].json` 并翻译所有字符串。

### 步骤 2：在配置中注册

更新 `/src/i18n/config.ts`：

```typescript
import en from '../../locales/en.json'
import zh from '../../locales/zh.json'
import es from '../../locales/es.json' // 新增

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  es: { translation: es }, // 新增
}
```

### 步骤 3：添加 RTL 支持（如适用）

如果该语言是 RTL，将其添加到 `rtlLanguages` 数组：

```typescript
const rtlLanguages = ['ar', 'he', 'fa', 'ur'] // 添加你的 RTL 语言
```

## RTL 语言支持

### 自动方向切换

i18n 配置在语言变化时自动更新 `document.documentElement.dir`：

```typescript
// 在 /src/i18n/config.ts 中
i18n.on('languageChanged', lng => {
  const dir = rtlLanguages.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lng
})
```

### CSS 逻辑属性

使用 CSS 逻辑属性而非物理属性，以实现自动 RTL 支持：

| 物理（避免）    | 逻辑（使用）                          |
| --------------- | ------------------------------------- |
| `left`          | `start` 或 `inset-inline-start`       |
| `right`         | `end` 或 `inset-inline-end`           |
| `margin-left`   | `margin-inline-start` 或 `ms-*`       |
| `margin-right`  | `margin-inline-end` 或 `me-*`         |
| `padding-left`  | `padding-inline-start` 或 `ps-*`      |
| `padding-right` | `padding-inline-end` 或 `pe-*`        |
| `text-left`     | `text-start`                          |
| `text-right`    | `text-end`                            |
| `border-left`   | `border-s-*` 或 `border-inline-start` |
| `border-right`  | `border-e-*` 或 `border-inline-end`   |

### 示例

```tsx
// 错误：物理属性在 RTL 中会出问题
<div className="text-left pl-4 mr-2">

// 正确：逻辑属性在 LTR 和 RTL 中都能正常工作
<div className="text-start ps-4 me-2">
```

## 原生菜单

原生菜单由 JavaScript 构建，以使用与 React 组件相同的 i18n 系统。

### 菜单构建器位置

参见 `/src/lib/menu.ts` 中的菜单构建器实现。

### 添加菜单项

```typescript
import i18n from '@/i18n/config'

export async function buildAppMenu(): Promise<Menu> {
  const t = i18n.t.bind(i18n)

  const myItem = await MenuItem.new({
    id: 'my-action',
    text: t('menu.myAction'),
    action: handleMyAction,
  })

  // ... 添加到子菜单
}
```

### 自动菜单重建

语言变化时菜单会自动重建：

```typescript
// 在 /src/lib/menu.ts 中
export function setupMenuLanguageListener(): void {
  i18n.on('languageChanged', async () => {
    await buildAppMenu()
  })
}
```

## 系统区域设置检测

应用启动时，语言基于以下顺序初始化：

1. **用户保存的偏好设置**（如果在偏好设置中已设置）
2. **系统区域设置**（如果我们有对应的翻译）
3. **英文**（回退）

参见 `/src/i18n/language-init.ts` 中的实现。

## 语言选择器

偏好设置 > 外观中的语言选择器允许用户更改语言：

```typescript
import { availableLanguages } from '@/i18n/config'
import { useTranslation } from 'react-i18next'

function LanguageSelector() {
  const { i18n } = useTranslation()

  const handleChange = async (lang: string) => {
    await i18n.changeLanguage(lang)
    // 保存到偏好设置...
  }

  return (
    <Select value={i18n.language} onValueChange={handleChange}>
      {availableLanguages.map(lang => (
        <SelectItem key={lang} value={lang}>
          {lang.toUpperCase()}
        </SelectItem>
      ))}
    </Select>
  )
}
```

## TypeScript 支持

`i18n.d.ts` 文件提供类型安全的翻译键：

```typescript
// 如果键在 en.json 中不存在则类型错误
t('nonexistent.key') // TypeScript 错误

// 有效键支持自动补全
t('preferences.title') // 正常工作
```

## 在 React 之外使用翻译

对于非 React 上下文（如菜单构建），直接导入 i18n：

```typescript
import i18n from '@/i18n/config'

// 获取 t 函数
const t = i18n.t.bind(i18n)
const text = t('menu.about', { appName: 'My App' })

// 或直接使用 i18n
const currentLanguage = i18n.language
await i18n.changeLanguage('zh')
```

## RTL 测试

测试 RTL 布局：

1. 将 RTL 语言（如阿拉伯语）添加到 `supportedLanguages` 并创建其翻译文件
2. 将语言更改为 RTL 语言
3. 验证布局是否正确镜像
4. 检查所有文本对齐是否使用逻辑属性
