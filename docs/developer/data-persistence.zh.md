# 数据持久化

[English](data-persistence.en.md) | **[中文](data-persistence.zh.md)**

将数据保存到磁盘和从磁盘加载的模式。

## 选择存储方式

| 需求          | 解决方案         | 使用场景                                                              |
| ------------- | ---------------- | --------------------------------------------------------------------- |
| 应用偏好设置  | Preferences 系统 | 强类型设置（主题、快捷键）                                            |
| 紧急恢复      | 恢复系统         | 崩溃恢复、危险操作前备份                                              |
| 关系型数据    | SQLite           | 需要查询和关系的用户数据                                              |
| 外部 API 数据 | TanStack Query   | 带缓存的远程数据（参见 [external-apis.zh.md](./external-apis.zh.md)） |

```
需要持久化数据？
├─ 应用设置？ → Preferences（Rust 结构体 + TanStack Query）
├─ 需要查询/关系的用户数据？ → SQLite（见下文）
├─ 远程 API 数据？ → external-apis.zh.md
└─ 紧急/崩溃恢复？ → 恢复系统
```

所有数据都通过 Rust 处理，以确保类型安全和安全性。前端使用 TanStack Query 处理加载状态和缓存失效。

## 文件位置

```
~/Library/Application Support/com.myapp.app/  (macOS)
├── preferences.json                          # 应用偏好设置
└── recovery/                                 # 紧急数据
    └── *.json
```

## 原子写入模式（关键）

所有文件写入使用原子操作以防止损坏：

```rust
// 先写入临时文件，然后重命名（原子操作）
let temp_path = file_path.with_extension("tmp");
std::fs::write(&temp_path, content)?;
std::fs::rename(&temp_path, &file_path)?;
```

**原因**：如果应用在写入时崩溃，你要么有旧文件，要么有新文件 - 永远不会有损坏的部分文件。

## Preferences 系统

### Rust 端

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    pub theme: String,
    // 在此处添加新的偏好设置
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
        }
    }
}
```

### React 端

```typescript
// src/queries/preferences.ts
export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: async () => unwrapResult(await commands.loadPreferences()),
  })
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (preferences: AppPreferences) =>
      commands.savePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })
}
```

## 紧急恢复系统

用于在崩溃或危险操作前保存数据：

```typescript
// 保存紧急数据
await commands.saveEmergencyData({
  filename: 'unsaved-work',
  data: { content: userContent, timestamp: Date.now() },
})

// 启动时加载
const recoveryData = await commands.loadEmergencyData({
  filename: 'unsaved-work',
})
if (recoveryData.status === 'ok' && recoveryData.data) {
  // 显示恢复对话框
}
```

恢复文件通过 `cleanupOldRecoveryFiles` 在 7 天后自动清理。

## 添加新的持久化数据

### 1. 定义 Rust 结构体

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyData {
    pub field: String,
}

impl Default for MyData {
    fn default() -> Self {
        Self { field: "default".to_string() }
    }
}
```

### 2. 添加 Tauri 命令

遵循 `src-tauri/src/commands/preferences.rs` 中的模式：

- `load_*` 命令带 Default 回退
- `save_*` 命令带原子写入

### 3. 注册命令

添加到 `src-tauri/src/bindings.rs` 并重新生成绑定：

```bash
npm run rust:bindings
```

### 4. 创建 React Hook

```typescript
export function useMyData() {
  return useQuery({
    queryKey: ['my-data'],
    queryFn: async () => unwrapResult(await commands.loadMyData()),
  })
}
```

## 安全性

### 文件名验证

始终验证文件名以防止路径遍历：

```rust
if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
    return Err("Invalid filename".to_string());
}
```

### 目录权限

使用 Tauri 的 `app_data_dir()` 获取安全的存储位置 - 永远不要写入任意路径。

## SQLite 数据库（需要时使用）

> **注意**：本应用未安装 SQLite。当应用需要带查询的关系型数据时再添加。

### 何时使用 SQLite

| 用例                       | 推荐             |
| -------------------------- | ---------------- |
| 简单键值设置               | Preferences 系统 |
| 带关系的用户数据           | SQLite           |
| 需要复杂查询的数据         | SQLite           |
| 大型数据集（1000+ 条记录） | SQLite           |
| 需要原子事务的数据         | SQLite           |

### 方案选择

| 方案       | 使用场景                            |
| ---------- | ----------------------------------- |
| `rusqlite` | 更简单的设置、同步查询、小型应用    |
| `sqlx`     | 异步查询、编译时 SQL 检查、大型应用 |

两者都与 Tauri 命令和 tauri-specta 集成以实现类型安全。

### 设置（rusqlite）

```bash
cd src-tauri && cargo add rusqlite --features bundled
```

### 架构模式

Tauri 命令包装数据库操作，TanStack Query 提供前端缓存。

```
React 组件 → TanStack Query → Tauri 命令（rusqlite）→ SQLite
```

```rust
use rusqlite::{Connection, params};
use std::sync::Mutex;
use tauri::State;

// 数据库连接作为 Tauri 状态管理
pub struct DbConnection(pub Mutex<Connection>);

#[tauri::command]
#[specta::specta]
pub fn get_items(db: State<DbConnection>) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM items ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}
```

在 `src-tauri/src/lib.rs` 中初始化：

```rust
let db_path = app.path().app_data_dir()?.join("app.db");
let conn = Connection::open(&db_path)?;

// 运行迁移
conn.execute(
    "CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )",
    [],
)?;

app.manage(DbConnection(Mutex::new(conn)));
```

```typescript
// 前端：TanStack Query 用于缓存和加载状态
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => unwrapResult(await commands.getItems()),
  })
}

export function useAddItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: CreateItem) => commands.addItem(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}
```

### 迁移规则

- 在管理数据库状态之前，于应用启动时运行迁移
- 使用 `IF NOT EXISTS` / `IF EXISTS` 实现幂等迁移
- 对于复杂应用，考虑使用版本表来跟踪已应用的迁移
