# 安全策略

[English](SECURITY.en.md) | **[中文](SECURITY.zh.md)**

## 受支持的版本

| 版本   | 是否支持 |
| ------ | -------- |
| 最新版 | ✅       |
| < 1.0  | ❌       |

## 报告漏洞

请勿通过公开的 GitHub Issue 报告安全漏洞。

**联系方式**：参见仓库根目录的 `SECURITY.md`，或在 GitHub 上创建私有安全公告

请包含以下信息：

- 漏洞描述
- 复现步骤
- 潜在影响
- 建议的修复方案（如有）

### 响应时间线

- **初步响应**：48 小时内
- **评估**：7 天内
- **修复**：时间取决于严重程度
- **披露**：修复可用之后

## 安全措施

本应用采用 Tauri 的安全模型：

- **权限**：通过 `capabilities/` 配置最小系统权限
- **IPC**：通过 tauri-specta 实现类型安全的命令
- **文件访问**：默认限制在应用目录范围内
- **CSP**：在 `src-tauri/tauri.conf.json` 中配置

## 开发者须知

### 文件操作

```rust
// ✅ Validate paths - prevent traversal attacks
if filename.contains("..") {
    return Err("Invalid filename".into());
}

// ❌ Never trust raw user input for paths
std::fs::write(user_input, data)
```

### 密钥

- 切勿将密钥提交到版本控制系统
- 使用 `.env.local`（已 gitignore）存储本地密钥
- 使用 GitHub Secrets 存储 CI/CD 密钥

### 依赖审计

```bash
npm audit
cargo audit
```

## 参考资源

- [Tauri 安全指南](https://tauri.app/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
