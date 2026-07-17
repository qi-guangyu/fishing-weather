# 微信云托管部署指南（钓鱼天气后端）

## 一、部署前准备

1. 注册并登录 [微信云托管](https://cloud.weixin.qq.com/)
2. 已有微信小程序 AppID：`wxd3ab84cf4f40848b`
3. 代码已推送到 GitHub（或本地上传）
4. 已和风天气 Key：`195df4dbb8574d3dbbf024de1e1230b7`（已内置在后端）

## 二、云托管创建服务

### 方式 A：从 GitHub 仓库构建（推荐）

1. 进入微信云控制台 →「云托管」→ 创建环境
2. 创建服务：
   - **服务名称**：`fishing-weather-api`
   - **部署方式**：选择「代码库」→ GitHub 仓库
   - **分支**：`main`
   - **Dockerfile 路径**：`Dockerfile`（项目根目录，或 `backend/Dockerfile`）
   - **构建目录**：`./`（若用根目录 Dockerfile）或 `./backend`（若用 backend/Dockerfile）
   - **容器端口**：`3456`
   - **实例规格**：免费版 / 按量付费
3. 点击「开始部署」

### 方式 B：本地上传

1. 下载本仓库压缩包
2. 在云托管控制台选择「本地上传」
3. 上传根目录，Dockerfile 路径填 `Dockerfile`

## 三、环境变量配置

在「服务详情」→「配置」→「环境变量」中添加：

| Key | Value | 说明 |
|---|---|---|
| `WECHAT_APPID` | `wxd3ab84cf4f40848b` | 小程序 AppID |
| `WECHAT_SECRET` | `你的小程序 AppSecret` | 小程序密钥 |
| `JWT_SECRET` | 任意随机字符串 | JWT 签名密钥 |
| `NODE_ENV` | `production` | 已默认 |
| `PORT` | `3456` | 已默认 |
| `DB_PATH` | `/data/fishing.db` | 如需持久化，挂载「文件存储」后填写 |
| `UPLOAD_DIR` | `/data/uploads` | 图片上传目录 |

> 注意：若不设置 `DB_PATH`，数据库默认在容器内的 `/app/backend/data/fishing.db`，**容器重建后数据会丢失**。生产环境建议挂载云托管「文件存储」或「云数据库」。

## 四、持久化存储（重要）

### 使用云托管文件存储（CFS）

1. 在云托管控制台开通「文件存储」
2. 创建挂载卷，例如 `/data`
3. 在「服务配置」→「挂载」中挂载到容器路径 `/data`
4. 设置环境变量 `DB_PATH=/data/fishing.db`、`UPLOAD_DIR=/data/uploads`

## 五、域名与网络

1. 部署成功后，云托管会分配一个默认域名：`https://xxx-xxx.ap-shanghai.app.tcloudbase.com`
2. 在小程序后台「开发设置」→「服务器域名」→「request 合法域名」中添加该域名
3. 将 `miniprogram/app.js` 中的 `apiBase` 从 `http://localhost:3456` 改为该 HTTPS 域名

## 六、验证

部署完成后访问以下地址测试：

- 健康检查：`https://你的域名/health`
- 管理后台：`https://你的域名/admin/`
- 天气代理：`https://你的域名/api/weather/now?location=120.75,31.64`
- 公开公告：`https://你的域名/api/announcements`

## 七、常见问题

### 1. 构建失败提示找不到 Dockerfile

- 检查 Dockerfile 路径是否填错
- 若构建目录为 `./backend`，则 Dockerfile 路径填 `Dockerfile`（即 backend/Dockerfile）
- 若构建目录为 `./`，则 Dockerfile 路径填 `Dockerfile`（即根目录 Dockerfile）

### 2. 数据库数据丢失

- 默认情况下数据库在容器内，重建会丢失
- 生产环境必须挂载文件存储或改用云数据库

### 3. 天气接口返回 502

- 检查后端日志，看是否是和风 API 响应 gzip 解压问题（已修复）
- 检查 `QWEATHER_KEY` 是否有效

### 4. 小程序请求失败

- 确认已在小程序后台添加 request 合法域名
- 确认 `app.js` 的 `apiBase` 指向 HTTPS 域名
- 本地调试时可在开发者工具「详情」→「本地设置」勾选「不校验合法域名」

## 八、本地开发

本地开发时：

```bash
node backend/server.js
```

然后 `miniprogram/app.js` 的 `apiBase` 保持 `http://localhost:3456`，并在开发者工具中勾选「不校验合法域名」。
