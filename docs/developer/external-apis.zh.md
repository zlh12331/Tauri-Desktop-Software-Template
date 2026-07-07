# 外部 API

[English](external-apis.en.md) | **[中文](external-apis.zh.md)**

从 Tauri 应用调用外部 HTTP API 的模式。

> **注意**：已安装 `tauri-plugin-http` 用于从前端发起无 CORS 的 HTTP 请求。如需在 Rust 端进行 API 调用并安全存储令牌，请安装 `reqwest`（Rust）和 `keyring`（OS 钥匙串）。参见下表了解各方案的使用场景。

## Rust vs 前端：何时使用哪种

**默认推荐：使用 Rust 后端（reqwest）**

| 方案            | 优点                              | 缺点                |
| --------------- | --------------------------------- | ------------------- |
| Rust（reqwest） | 绕过 CORS、安全令牌存储、类型安全 | 每个端点代码更多    |
| 前端（fetch）   | 更少样板代码、熟悉的 API          | CORS 限制、密钥暴露 |

### 使用 Rust 后端（reqwest）的场景

- 所有需要认证的 API 调用（将令牌保持在 WebView 之外）
- 需要安全令牌存储的调用（keyring）
- 需要将响应缓存到本地存储的调用
- 生产应用

### 使用前端（tauri-plugin-http）的场景

- 无需认证的公共 API（绕过 CORS）
- 迁移到 Rust 之前的快速原型
- 前端已有数据格式的 API

`tauri-plugin-http` 已安装并配置。从前端使用：

```typescript
import { fetch } from '@tauri-apps/plugin-http'

const response = await fetch('https://api.example.com/data')
const data = await response.json()
```

Rust 端调用，安装 `reqwest`：

```bash
cd src-tauri && cargo add reqwest --features json,rustls-tls
```

## 设置

```bash
# Rust HTTP 客户端
cd src-tauri && cargo add reqwest --features json,rustls-tls
```

安全令牌存储请参见下文的认证部分。

## 架构模式

遵循与本地数据相同的模式：Tauri 命令包装 API 调用，TanStack Query 提供缓存。

```
React 组件 → TanStack Query → Tauri 命令（reqwest）→ 外部 API
```

### Rust 命令

```rust
use reqwest;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub email: String,
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_user(user_id: u32) -> Result<User, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("https://api.example.com/users/{user_id}"))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    response.json::<User>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

### React 服务

```typescript
// src/queries/users.ts
export const userQueryKeys = {
  all: ['users'] as const,
  user: (id: number) => [...userQueryKeys.all, id] as const,
}

export function useUser(userId: number) {
  return useQuery({
    queryKey: userQueryKeys.user(userId),
    queryFn: async () => unwrapResult(await commands.fetchUser(userId)),
    staleTime: 1000 * 60 * 5, // 缓存 5 分钟
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: number
      data: Partial<User>
    }) => {
      const result = await commands.updateUser(userId, data)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.user(userId) })
    },
  })
}
```

## 认证

### 令牌存储选项

| 选项                      | 安全性           | 使用场景           |
| ------------------------- | ---------------- | ------------------ |
| `keyring` crate           | 高（OS 钥匙串）  | API 令牌、凭证     |
| `tauri-plugin-stronghold` | 高（加密数据库） | 多个密钥、加密密钥 |
| `tauri-plugin-store`      | 低（明文 JSON）  | 仅限非敏感数据     |

OS 钥匙串访问，直接使用 `keyring` crate：

```bash
cd src-tauri && cargo add keyring
```

```rust
use keyring::Entry;

#[tauri::command]
#[specta::specta]
pub fn save_auth_token(token: String) -> Result<(), String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    entry.set_password(&token)
        .map_err(|e| format!("Failed to save token: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn get_auth_token() -> Result<Option<String>, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get token: {e}")),
    }
}
```

### 认证请求

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_protected_data() -> Result<Data, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    let token = entry.get_password()
        .map_err(|_| "Not authenticated")?;

    let client = reqwest::Client::new();
    client
        .get("https://api.example.com/protected")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?
        .json::<Data>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

## 错误处理

参见 [error-handling.zh.md](./error-handling.zh.md) 了解完整模式。API 调用的关键点：

```typescript
// 为网络错误配置重试，而非验证错误
const { data } = useQuery({
  queryKey: ['api-data'],
  queryFn: fetchData,
  retry: (failureCount, error) => {
    if (error.message.includes('validation')) return false
    return failureCount < 3
  },
})
```

## 离线处理

对于需要离线工作的应用，将 API 响应缓存到 SQLite：

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_with_cache(app: tauri::AppHandle, id: u32) -> Result<Data, String> {
    // 优先尝试网络
    match fetch_from_api(id).await {
        Ok(data) => {
            cache_to_db(&app, &data)?;  // 缓存以供离线使用
            Ok(data)
        }
        Err(_) => {
            // 网络错误时回退到缓存
            load_from_cache(&app, id)
        }
    }
}
```

参见 [data-persistence.zh.md](./data-persistence.zh.md) 了解 SQLite 设置。

## 快速参考

| 任务          | 模式                                   |
| ------------- | -------------------------------------- |
| 基本 API 调用 | 使用 reqwest 的 Rust 命令              |
| 缓存          | TanStack Query（前端）或 SQLite        |
| 令牌存储      | `keyring` crate（OS 钥匙串）           |
| 类型安全      | tauri-specta（与本地命令相同）         |
| 错误处理      | Result 类型，参见 error-handling.zh.md |
| 离线支持      | 缓存到 SQLite，网络错误时回退          |
