# 开发者文档

[English](README.en.md) | **[中文](README.zh.md)**

用于构建和扩展本应用的技术文档。这些文档描述了既定的模式，面向人类开发者和 AI 编程助手。

## 架构与模式

| 文档                                   | 描述                                      |
| -------------------------------------- | ----------------------------------------- |
| [架构指南](./architecture-guide.zh.md) | 高层概览、心智模型、系统架构              |
| [Rust 架构](./rust-architecture.zh.md) | Rust 模块组织与模式                       |
| [状态管理](./state-management.zh.md)   | 三层状态洋葱模型、Zustand、TanStack Query |
| [错误处理](./error-handling.zh.md)     | 错误传播、用户反馈、重试模式              |

## 核心系统

| 文档                                     | 描述                                            |
| ---------------------------------------- | ----------------------------------------------- |
| [命令系统](./command-system.zh.md)       | 统一动作分发、命令注册                          |
| [键盘快捷键](./keyboard-shortcuts.zh.md) | 全局快捷键处理、平台修饰键                      |
| [菜单](./menus.zh.md)                    | 使用 i18n 构建原生菜单                          |
| [快速面板](./quick-panes.zh.md)          | 多窗口快速入口模式                              |
| [Tauri 命令](./tauri-commands.zh.md)     | 类型安全的 Rust-TypeScript 桥接（tauri-specta） |
| [Tauri 插件](./tauri-plugins.zh.md)      | 插件使用与配置                                  |

## UI 与 UX

| 文档                             | 描述                           |
| -------------------------------- | ------------------------------ |
| [UI 模式](./ui-patterns.zh.md)   | CSS 架构、shadcn/ui 组件       |
| [国际化](./i18n-patterns.zh.md)  | 翻译系统、RTL 支持             |
| [通知](./notifications.zh.md)    | Toast 和原生通知               |
| [跨平台](./cross-platform.zh.md) | 平台检测、特定于操作系统的适配 |

## 数据与存储

| 文档                                   | 描述                           |
| -------------------------------------- | ------------------------------ |
| [数据持久化](./data-persistence.zh.md) | 文件存储模式、原子写入、SQLite |
| [外部 API](./external-apis.zh.md)      | HTTP API 调用、身份验证、缓存  |

## 质量与工具

| 文档                                                 | 描述                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| [静态分析](./static-analysis.zh.md)                  | ESLint、Prettier、ast-grep、knip、jscpd、React Compiler |
| [编写 ast-grep 规则](./writing-ast-grep-rules.zh.md) | AI 创建自定义规则的参考                                 |
| [测试](./testing.zh.md)                              | 测试模式、Tauri 模拟                                    |
| [包体积优化](./bundle-optimization.zh.md)            | 包体积管理                                              |
| [日志](./logging.zh.md)                              | Rust 和 TypeScript 日志                                 |
| [可观测性](./observability.zh.md)                    | Sentry 集成、同意门控、扩展点                           |
| [编写文档](./writing-docs.zh.md)                     | 创建和维护这些文档的指南                                |

## 发布与分发

| 文档                     | 描述                     |
| ------------------------ | ------------------------ |
| [发布](./releases.zh.md) | 发布流程、签名、自动更新 |

---

**更新这些文档：** 添加新模式或系统时，请更新相关的文档文件；如果创建了新文档，请在此处添加链接。
