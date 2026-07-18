# 钓鱼天气小程序 · 后端部署指南（微信云托管）

本指南说明如何把 `backend/` 部署到**微信云托管**，让小程序在真机 / 体验版能连上后端 API。

---

## 1. 前置条件

- 已在 [微信公众平台](https://mp.weixin.qq.com) 注册并认证小程序
- 已开通**云开发 / 云托管**（需一个云开发环境，按量计费）
- 本地代码已就绪（`backend/` 目录含 `Dockerfile`）

> 前端（小程序代码）仍走 **GitHub Pages / 微信开发者工具上传**，不经过云托管；
> 云托管只承载后端 API + 上传文件。

---

## 2. 在云托管创建服务

1. 进入 **云托管控制台 → 服务管理 → 新建服务**，服务类型选「后端服务」。
2. 代码来源选「本地代码」或「代码仓库」，上传 / 关联 **`backend/` 整个目录**
   （确保 `Dockerfile` 在根，平台会自动识别）。
3. 平台按 `Dockerfile` 构建镜像并部署。
4. **服务端口**：填 `80`（或自定义，如 `3456`）。平台会把该端口注入容器环境变量 `PORT`，
   `server.js` 已 `process.env.PORT || 3456` 监听，无需改代码。

---

## 3. 配置环境变量（建议）

在云托管服务「环境变量」中设置：

| 变量 | 建议值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | 一段随机字符串 | **务必改**，否则 token 可被伪造。默认硬编码值仅用于本地。 |
| `WECHAT_APPID` | 小程序 AppID | 用于 `wx.login` code 换 openid（可选，不配则 openid 为空，静默登录仍可用） |
| `WECHAT_SECRET` | 小程序 AppSecret | 配合上面使用（可选） |
| `DB_PATH` | `/app/data/fishing.db` | 默认即可，配合文件存储挂载 |
| `UPLOAD_DIR` | `/app/data/uploads` | 默认即可，配合文件存储挂载 |

---

## 4. 挂载文件存储（重要 ‼️）

云托管容器**本身无状态**：重启、版本发布、扩缩容都会重置本地文件系统。
若不挂载，数据库和上传图片会丢失。

操作：
- 云托管控制台 → **文件存储** → 创建存储桶
- 在**服务**中把该存储挂载到容器路径 **`/app/data`**
- 这样 `fishing.db` 与 `uploads/` 持久化，重启不丢

---

## 5. 获取服务地址

服务部署成功后，在「服务详情」中复制 **公网访问地址**，形如：

```
https://xxxxxxxx.ap-shanghai.run.tcloudbase.com
```

这就是小程序的 `API_BASE`。

---

## 6. 改小程序前端指向该域名

打开 `miniprogram/config.js`，把占位改成上面的地址（**不含末尾斜杠**）：

```js
module.exports = {
  API_BASE: 'https://xxxxxxxx.ap-shanghai.run.tcloudbase.com'
};
```

然后在**微信开发者工具**中「上传」代码，生成体验版 / 提交审核。
仅此一处改动，无需碰其他代码。

---

## 7. 小程序后台配置合法域名

微信要求生产环境 request / uploadFile 必须走**已备案 HTTPS 合法域名**。

进入 **微信公众平台 → 开发管理 → 开发设置 → 服务器域名**：

- **request 合法域名**：`https://你的云托管域名`
- **uploadFile 合法域名**：`https://你的云托管域名`

> 开发版 / 体验版可临时在开发者工具勾选「不校验合法域名」跳过此限制，但正式版必须配置。

---

## 8. 数据与演示内容

- **首次启动自动 seed**：`backend/seed.js` 在数据库为空时自动灌入 8 个常熟 demo 钓点
  （来自 `initDatabase()` 末的 `seedDemoSpots(dbWrap)`），保证线上钓点列表非空。
- **默认管理员**：`admin / admin123`。**上线前请在 web-admin 修改密码**，或直接在库里改。
- 用户产生的收藏 / 渔获 / 评论 / 投稿需在 App 里登录后自行产生（不随种子数据预置）。

---

## 9. web-admin 运营后台（可选）

当前部署物（build context = `backend/`）**不含 `web-admin/`**，因此云托管上 `/admin` 不可用。

如需上线运营后台，二选一：
- **方案 A（推荐）**：把云托管构建上下文改为**项目根目录**，Dockerfile 中增加
  `COPY web-admin/ ./web-admin/`，并保持 `app.use('/admin', express.static(...))` 原有逻辑。
- **方案 B**：把 web-admin 单独部署到 GitHub Pages / 其他静态托管，通过 `API_BASE` 访问后端。

> 注意：本项目已移除「把项目根目录挂为静态资源」的代码（`server.js` 原 `express.static(path.join(__dirname,'..'))`），
> 避免容器文件系统通过 HTTP 暴露的安全风险。

---

## 10. 本地调试

- 本地开发：保持 `miniprogram/config.js` 的 `API_BASE` 为 `http://localhost:3456`（或电脑局域网 IP），
  开发者工具勾选「不校验合法域名」，后端 `node server.js` 本地跑即可。
- 本地 `backend/` 已含完整 `Dockerfile`，也可用 `docker build -t fishing-backend ./ && docker run -p 3456:3456 fishing-backend` 验证镜像。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 小程序请求一直失败 / 超时 | 合法域名未配置 或 `API_BASE` 仍是占位 | 检查第 6、7 步 |
| 钓点列表为空 | 文件存储未挂载，容器重启后库被重置且 seed 未跑 | 确认 `seed.js` 日志 `[DB] 已 seed 演示钓点` |
| 上传图片 404 | `UPLOAD_DIR` 未持久化 | 确认 `/app/data` 已挂载文件存储 |
| 登录后无头像昵称 | `WECHAT_APPID/SECRET` 未配（仅影响 openid） | 不影响基本功能，按需配置 |
