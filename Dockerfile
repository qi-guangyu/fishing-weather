# 微信云托管专用 Dockerfile
# 解决 backend/ 子目录构建问题

FROM node:20-alpine

# 1. 先装 backend 依赖（这一层会被缓存）
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# 2. 复制 backend 源码
COPY backend/ ./

# 3. 创建数据目录
RUN mkdir -p /app/backend/data/uploads

# 4. 暴露端口 + 启动
EXPOSE 3456
ENV PORT=3456
ENV NODE_ENV=production

CMD ["node", "server.js"]
