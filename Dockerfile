# 构建阶段
FROM node:18.18-alpine AS builder

WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装所有依赖（包括 devDependencies）
RUN yarn install

# 复制源代码
COPY . .

# 构建应用
RUN yarn build

# 运行阶段
FROM node:18.18-alpine

ENV NODE_ENV production
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 只安装生产环境依赖
RUN yarn install --production --frozen-lockfile && yarn cache clean

# 从构建阶段复制 Nuxt.js 构建产物
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public

# 创建启动脚本
RUN echo '#!/bin/sh\nexport NITRO_HOST=0.0.0.0\nexport NITRO_PORT=3000\nnode .output/server/index.mjs' > /app/start.sh && \
    chmod +x /app/start.sh

# 暴露端口
EXPOSE 3000

ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["/app/start.sh"] 