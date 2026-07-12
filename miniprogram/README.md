# 钓鱼气象小程序 - 注册与上线指南

## 一、注册微信小程序账号

### 1. 注册步骤
1. 打开 https://mp.weixin.qq.com/
2. 点击「立即注册」
3. 选择「小程序」类型
4. 用邮箱注册（每个邮箱只能注册一种类型的账号）
5. 完成邮箱激活和主体信息填写

> **个人主体免费注册**，不需要企业资质。个人小程序可以使用大部分功能（登录、定位、天气API等）。

### 2. 获取 AppID
1. 注册完成后，登录小程序后台
2. 左侧菜单 → 「开发」→「开发管理」→「开发设置」
3. 复制 **AppID**（小程序ID），形如 `wx1234567890abcdef`
4. AppSecret 点「生成」获取，**妥善保存**

### 3. 填入配置
1. 打开 `miniprogram/project.config.json`
2. 将 `"appid": "请替换为你的AppID"` 改为你的真实 AppID
3. 打开 `miniprogram/app.js`
4. 将 `apiBase` 改为你的后端地址（部署后获取）

---

## 二、配置服务器域名

小程序要求所有网络请求必须走HTTPS，且域名要在后台白名单里。

### 1. 和风天气API域名
在「开发设置」→「服务器域名」中添加：

| 类型 | 域名 |
|---|---|
| request合法域名 | `https://ma6x8a83gy.re.qweatherapi.com` |
| request合法域名 | `https://你的后端地址.onrender.com` |

### 2. 如果后端也部署了
同样添加到 request 合法域名列表中。

---

## 三、下载微信开发者工具

1. 打开 https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 下载 **稳定版（Stable Build）** Windows 64位版本
3. 安装后打开，用微信扫码登录

---

## 四、导入项目

1. 在开发者工具中点击「导入项目」
2. 项目目录选择：`E:\工作区\2026-06-29-06-13-29\miniprogram`
3. AppID 填入你的真实 AppID
4. 点击「导入」

### 预览和调试
- 左侧模拟器可以实时预览效果
- 点击「真机调试」→ 扫码 → 手机上查看真实效果
- 顶部菜单「编译」刷新代码

---

## 五、后端部署（Render.com 免费方案）

### 1. 准备工作
1. 注册 https://render.com（用GitHub账号登录）
2. 确保你的后端代码已推送到GitHub

### 2. 创建Web Service
1. Render Dashboard → 「New」→「Web Service」
2. 连接你的GitHub仓库
3. 配置：
   - **Name**: `fishing-weather-api`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node server.js`
   - **Plan**: `Free`

### 3. 设置环境变量
在 Render 的「Environment」标签中添加：
| Key | Value |
|---|---|
| `WECHAT_APPID` | 你的小程序AppID |
| `WECHAT_SECRET` | 你的小程序AppSecret |
| `JWT_SECRET` | 任意随机字符串 |

### 4. 获取URL
部署完成后，Render会给你一个URL，形如：
`https://fishing-weather-api.onrender.com`

把这个URL填入 `miniprogram/app.js` 的 `apiBase`。

---

## 六、提交审核上线

### 1. 上传代码
1. 在开发者工具中点击右上角「上传」
2. 填写版本号（如 `1.0.0`）和备注
3. 点击「确定」

### 2. 提交审核
1. 登录 mp.weixin.qq.com
2. 「管理」→「版本管理」→ 找到刚上传的版本
3. 点击「提交审核」
4. 填写功能页面信息（截图、描述等）

### 3. 审核通过后发布
- 审核通常需要 1-7 天
- 通过后在版本管理中点「发布」
- 小程序就正式上线了！

---

## 七、常见问题

### Q: 个人小程序可以用微信登录吗？
A: 可以。`wx.login()` 不需要额外资质，个人小程序即可使用。

### Q: 和风天气API需要域名备案吗？
A: 不需要。小程序的域名白名单不要求备案，但需要HTTPS。

### Q: 免费后端会休眠吗？
A: Render免费方案15分钟无请求会休眠，首次请求需等待30秒左右冷启动。对于个人使用够用了。

### Q: 审核会被拒吗？
A: 个人小程序常见拒绝原因：
- 天气类需要提供数据来源说明（在审核备注里写"数据来源：和风天气API"）
- 不能有虚拟支付功能
- 不能有用户生成内容（UGC）如果没有审核机制
