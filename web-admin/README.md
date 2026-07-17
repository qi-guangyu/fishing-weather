# 钓鱼天气 · Web 管理后台

独立的运营后台，供管理员在浏览器中审核内容、管理用户、查看数据与运营公告。
前端为纯 HTML/CSS/JS（无框架、无构建步骤），后端复用 `backend/server.js` 的 `/api/admin/*` 接口。

## 访问方式

### 1. 同源部署（云托管 / 自有服务器，推荐）
后端 `server.js` 已通过 `app.use('/admin', express.static(...))` 同源托管本目录。
部署后端后直接访问：`https://你的后端域名/admin/`
> 无需额外配置 CORS，因为后台与 API 同源。

### 2. 本地开发
```bash
cd backend && node server.js
# 浏览器打开
http://localhost:3456/admin/
```

### 3. 独立静态部署（GitHub Pages / Nginx 等，与后端不同源）
在 `index.html` 的 `<head>` 顶部（其他脚本之前）添加后端地址：
```html
<script>window.API_BASE = 'https://你的后端域名';</script>
```
后端已开启 CORS（`app.use(cors())`），跨域调用即可生效。

## 默认管理员账号
- 账号：`admin` ｜ 密码：`admin123` ｜ 角色：超级管理员（super_admin）
- 该账号在数据库初始化时自动创建，首次登录后建议修改密码。

## 功能模块
| 模块 | 说明 |
|------|------|
| 统计看板 | 数据概览卡片、近 7 天新增趋势、热门排行（收藏/渔获/评论）、地区分布、最近操作日志、气象缓存刷新 |
| 钓点管理 | 钓点增删改查、状态切换（上架/下架/草稿/删除）、批量操作、CSV 导出 |
| 投稿审核 | 用户提交的钓点投稿：通过 / 驳回（含理由） |
| 内容审核 | 评论审核 / 渔获审核 / 举报处理 三个 Tab |
| 用户管理 | 用户列表查看；仅超级管理员可修改角色与状态 |
| 页面管理 | 运营公告 / Banner 的增删改查；启用后在小程序首页展示 |

## 目录结构
```
web-admin/
├── index.html            # SPA 入口（登录 + 主框架）
├── css/style.css         # 暗色主题样式
└── js/
    ├── api.js            # 请求封装（token 注入 / FormData 支持 / 同源或跨域）
    ├── auth.js           # 登录态管理（localStorage）
    ├── ui.js             # Toast / Modal / 确认框 / 状态徽章 / 分页
    ├── router.js         # hash 路由 + 未登录守卫
    ├── app.js            # 启动、登录页、侧边栏、顶栏
    └── views/            # 各功能视图
        ├── dashboard.js  # 统计看板
        ├── spots.js      # 钓点管理
        ├── submissions.js# 投稿审核
        ├── content.js    # 内容审核（评论/渔获/举报）
        ├── users.js      # 用户管理
        └── pages.js      # 页面管理（运营公告）
```

## 技术说明
- **无框架**：保持与原项目前端一致（纯原生 JS）。
- **登录态**：JWT 存于 `localStorage`，`router.js` 拦截未登录访问，自动跳登录页。
- **路由**：hash 路由（`#/dashboard` 等），刷新页面不丢失当前模块。
- **权限**：`super_admin` 可见「用户管理-编辑」与「钓点批量删除」；普通 `admin` 具备其余管理操作。
