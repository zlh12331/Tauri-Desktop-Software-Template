# Developer Documentation

**[English](README.en.md)** | [中文](README.zh.md)

用于构建和扩展本应用的技术文档。这些文档描述既定模式，面向人类开发者和 AI 编码智能体。

## 核心

| 文档                                   | 描述                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| [架构指南](./architecture-guide.zh.md) | 高层概览、心智模型、系统架构                            |
| [状态管理](./state-management.zh.md)   | 三层状态洋葱模型、Zustand、TanStack Query               |
| [错误处理](./error-handling.zh.md)     | 错误传播、用户反馈、重试模式                            |
| [Tauri 命令](./tauri-commands.zh.md)   | 类型安全的 Rust-TypeScript 桥接（tauri-specta）         |
| [国际化](./i18n-patterns.zh.md)        | 翻译系统、RTL 支持                                      |
| [静态分析](./static-analysis.zh.md)    | ESLint、Prettier、ast-grep、knip、jscpd、React Compiler |
| [发布](./releases.zh.md)               | 发布流程、签名、自动更新                                |

---

**更新这些文档：** 添加新模式或系统时，更新相应文档；若新建文档，请在此处添加链接。
保持文档数量小而精，优先把演化中的模式直接固化到代码注释中，而不是扩充独立的专题指南。
