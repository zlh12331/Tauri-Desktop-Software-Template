# 任务管理

[English](tasks.en.md) | **[中文](tasks.zh.md)**

## 概述

- **未完成的任务**位于 tasks-todo/
  - 命名格式为 task-NUMBER-name.md，其中 NUMBER 表示优先级顺序
  - 数字最小的为当前任务
  - 如果 NUMBER 为 x，则该任务尚未确定优先级
- **已完成的任务**位于 tasks-done/
  - 命名格式为 task-YYYY-MM-DD-name.md，包含完成日期

## 完成任务

完成任务后，请使用完成脚本。

用法：npm task:complete TASK_NAME_OR_NUMBER

示例：
npm task:complete frontend-performance
npm task:complete 2
npm task:complete awesome-feature

脚本将执行以下操作：

1. 在 tasks-todo/ 中查找匹配的任务
2. 去除 task-NUMBER- 前缀
3. 添加今天的日期前缀：task-YYYY-MM-DD-
4. 将其移动到 tasks-done/

转换示例：
tasks-todo/task-2-frontend-performance-optimization.md
变为
tasks-done/task-2025-11-01-frontend-performance-optimization.md

### 重命名已有的已完成任务

如果您有未包含日期的已完成任务，请使用其最后修改日期进行重命名：

用法：npm task:rename-done
