# 微信云托管专用 Dockerfile
# 构建上下文（build context）为 backend/ 目录，平台会自动找到本文件。

FROM node:20-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package*.json ./
RUN npm install --omit=dev

# 复制应用代码
COPY . .

# 运行时数据目录
# ⚠️ 请在小程序云托管控制台将「文件存储」挂载到 /app/data，
#    否则容器重启 / 扩缩容会丢失数据库(fishing.db)与上传的图片。
RUN mkdir -p /app/data/uploads

# 端口：云托管平台默认也会注入 PORT 环境变量，本地运行时默认 3456。
# 不要在 Dockerfile 里写死 PORT，否则云托管注入的变量被覆盖，端口不匹配网关会返回 404。
# server.js 已写 `process.env.PORT || 3456`，本地跑时回落 3456，云托管用平台注入的端口。
ENV NODE_ENV=production

# 安全建议：通过云托管「环境变量」配置 JWT_SECRET 为随机串，避免硬编码默认值。
# ENV JWT_SECRET=change-me-to-random-secret

EXPOSE 3456
CMD ["node", "server.js"]
