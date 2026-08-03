# FluxBlog Project 管理功能设计

## 概述

为 FluxBlog 增加"项目"（Project）概念，作为文章的更高层分类。Studio 写作后台增加 ChatGPT 风格的左侧栏，支持拖拽管理文章归属；公开站点在导航中增加 Projects 入口。

## 核心约束

- 单作者博客，project 是个人分类工具，不涉及多用户协作
- 一篇文章只属于一个 project（互斥归属），允许无归属
- 公开站点不做独立子站，project 作为可见的分类维度
- 拖拽交互仅限 Studio 写作后台，公开站点保持现有结构

---

## 1. 数据模型

### 1.1 新增表 `blog_projects`

```sql
CREATE TABLE blog_projects (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES blog_users(id),
    name       TEXT NOT NULL,
    intro      TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,   -- 手动拖拽排序，数值越小越靠前
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);
```

### 1.2 修改表 `blog_drafts`

```sql
ALTER TABLE blog_drafts ADD COLUMN project_id BIGINT REFERENCES blog_projects(id);
```

- `project_id` 可为 NULL，表示无归属
- 切换 project 时无需乐观锁冲突检测（project_id 不参与 version 比较）

### 1.3 Go 模型

```go
type Project struct {
    ID        int64     `json:"id"`
    UserID    int64     `json:"userId"`
    Name      string    `json:"name"`
    Intro     string    `json:"intro"`
    SortOrder int       `json:"sortOrder"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
```

Draft/DraftSummary 增加字段：
```go
ProjectID   *int64  `json:"projectId,omitempty"`
ProjectName *string `json:"projectName,omitempty"` // JOIN 填充，仅列表场景
```

---

## 2. API 设计

### 2.1 Project CRUD

全部写在 `internal/blog/handler.go`，注册在 `/api/v1/blog/projects`（需 blogAuth）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects` | 列出所有 project（含文章数量），按 `sort_order` 升序 |
| POST | `/projects` | 新建 project `{name, intro?}` |
| PATCH | `/projects/:id` | 更新 `{name?, intro?, sortOrder?}` |
| DELETE | `/projects/:id` | 删除 project（其下文章 project_id 置 NULL） |
| PUT | `/projects/sort` | 批量更新排序 `[{id, sortOrder}]` |

### 2.2 Draft 接口变更

- `GET /drafts` — 返回列表增加 `projectId` + `projectName`
- `POST /drafts` — 创建时可选 `projectId`
- `PATCH /drafts/:id` — 更新时可选 `projectId`（切换归属）
- `PUT /drafts/:id/project` — 单独切换文章归属（拖拽用）`{projectId: number | null}`

### 2.3 公开读接口变更

- `GET /posts` — 增加可选参数 `?projectId=` 过滤
- `GET /posts/search` — 增加可选参数 `?projectId=` 过滤
- `GET /posts/:slug` — 返回增加 `projectId` + `projectName`

### 2.4 公开 projects 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/public` | 列出所有 project（仅含 id/name/intro + 文章数），无需鉴权 |

---

## 3. 前端：公开站点

### 3.1 导航

Header 导航中增加 "Projects" 入口，与 Posts / Tags / Archives 平级。

### 3.2 Projects 页面 (`/blog/projects`)

列出所有 project，每个 project 显示名称、简介、文章数量。点击进入单个 project 的文章列表。

### 3.3 Project 详情页 (`/blog/projects/[id]`)

URL 使用 project ID（数字），名称允许中文和随时修改。该 project 下所有公开文章，按时间倒序，分页。与 `/posts` 页面结构一致。

### 3.4 文章卡片 & 详情

- 文章卡片（Card.astro）增加 project 标签（小 badge，可点击跳转到 project 详情页）
- 文章详情页标题下方增加 project 标识

---

## 4. 前端：Studio 写作后台

### 4.1 左侧栏布局

Studio 页面改为双栏布局：

```
┌──────────┬──────────────────────────────────────┐
│ 左侧栏    │  右侧内容区                            │
│ 220px    │                                       │
│          │  ┌─ 草稿列表 / 编辑器 ───────────────┐ │
│ Projects │  │                                    │ │
│ ──────── │  │  （保持现有 UI 不变）               │ │
│ · 项目A  │  │                                    │ │
│   · 文章1│  │                                    │ │
│   · 文章2│  │                                    │ │
│ · 项目B  │  │                                    │ │
│   · 文章3│  │                                    │ │
│ ──────── │  │                                    │ │
│ 未分类   │  │                                    │ │
│   · 文章4│  │                                    │ │
│   · 文章5│  │                                    │ │
└──────────┴──────────────────────────────────────┘
```

### 4.2 左侧栏交互

**Project 区域：**
- 显示所有 project 列表，手动拖拽排序（拖拽 project 条目本身）
- 每个 project 可展开/折叠，展开后显示该项目下文章列表
- 右键或点击 `...` 菜单：重命名、编辑简介、删除
- 底部 "+ 新建项目" 按钮

**文章区域：**
- 每个 project 展开后，其下文章按更新时间倒序排列
- 底部"未分类"区域，显示未归属 project 的文章
- **拖拽文章**：拖动文章条目到任意 project 上，切换归属（调 `PUT /drafts/:id/project`）
- 拖拽到"未分类"区域，清除 project 归属
- 点击文章条目 → 右侧打开编辑器（保持现有行为）

**Project 拖拽排序：**
- 拖动 project 条目本身调整顺序，松手后调 `PUT /projects/sort`
- 排序即时生效，无需保存按钮

### 4.3 编辑器改动

在现有 meta 表单中增加一个 project 下拉选择器：

```
[标题] [slug] [标签] [摘要] [封面] [可见性] [Project ▼]
```

选择器列出所有 project + "无归属" 选项。与左侧栏拖拽双向同步——拖拽后下拉自动更新，下拉选择后侧栏自动更新。

### 4.4 新建文章

新建文章时，如果在左侧栏选中了某个 project，自动填入该 project；否则默认无归属。

---

## 5. 技术实现要点

### 5.1 拖拽库选择

使用原生 HTML5 Drag and Drop API（不引入额外依赖）。理由：
- 交互简单（列表内拖拽），不需要复杂动画
- 避免增加 bundle 体积
- 移动端不需要拖拽支持（移动端使用下拉选择器）

### 5.2 左栏状态持久化

- Project 展开/折叠状态存 `localStorage`，刷新后恢复
- 选中状态存当前页内存（不持久化）

### 5.3 乐观更新

拖拽文章到新 project 后：
1. 立即更新左侧栏 UI（乐观移动）
2. 发 `PUT /drafts/:id/project` 
3. 失败时回滚 UI + 提示

### 5.4 排序

- `sort_order` 使用整数，间隔 1000（1000, 2000, 3000...），插入时取中间值，减少批量更新频率
- 拖拽排序后全量更新 `PUT /projects/sort` 传入 `[{id, sortOrder}]`

---

## 6. 迁移与兼容

- 现有文章 `project_id` 默认为 NULL（无归属），无需迁移脚本
- 现有 API 响应增加字段，使用 `omitempty` 确保旧前端不报错
- 公开站点 project 过滤使用可选查询参数，不带参数时保持现有行为（返回全部文章）

---

## 7. 不在本次范围

- 不做 project 级别的独立 RSS/sitemap
- 不做 project 权限控制（单作者无意义）
- 不做嵌套子 project
- 不做 project 模板或默认配置
- 不做公开站点 project 侧栏（用户确认导航加入口即可，不需要侧栏）
- 不做 project 内的文章排序（保持更新时间倒序）
- 不做 project 的 slug（URL 使用 project ID，名称允许中文、可随时修改）