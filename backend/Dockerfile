# 微信云托管专用 Dockerfile (放在 backend/ 目录)
# 这样云托管目标目录 backend/ 自动能找到 Dockerfile

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data/uploads

EXPOSE 3456
ENV PORT=3456
ENV NODE_ENV=production

CMD ["node", "server.js"]
