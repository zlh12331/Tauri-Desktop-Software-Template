# Task Management

**[English](tasks.en.md)** | [中文](tasks.zh.md)

## Overview

- **Uncompleted tasks** are in `docs/tasks-todo/`
  - Named `task-NUMBER-name.md` where NUMBER indicates priority order
  - The lowest number is the current task
  - If NUMBER is x, the task has not been prioritized yet
- **Completed tasks** are in `docs/tasks-done/`
  - Named `task-YYYY-MM-DD-name.md` with completion date

Both directories ship empty, holding only a `.gitkeep`. The workflow is a
convention the template supports, not a queue it presets for you.

## Completing Tasks

When you finish a task, use the completion script.

Usage: `npm run task:complete TASK_NAME_OR_NUMBER`

Examples:

- `npm run task:complete frontend-performance`
- `npm run task:complete 2`
- `npm run task:complete awesome-feature`

The script will:

1. Find the matching task in `docs/tasks-todo/`
2. Strip the `task-NUMBER-` prefix
3. Add today's date prefix: `task-YYYY-MM-DD-`
4. Move it to `docs/tasks-done/`

Example transformation:

```
docs/tasks-todo/task-2-frontend-performance-optimization.md
becomes
docs/tasks-done/task-2025-11-01-frontend-performance-optimization.md
```

### Renaming Existing Completed Tasks

If you have existing completed tasks without dates, rename them using their last modified date:

Usage: `npm run task:rename-done`
