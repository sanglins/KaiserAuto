# 阶段 1: 安装依赖
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# 生产环境安装
RUN npm ci

# 阶段 2: 构建应用
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 禁用 Next.js 遥测数据采集
ENV NEXT_TELEMETRY_DISABLED=1
# 必须设置此环境变量以确保 standalone 模式正常
RUN npm run build

# 阶段 3: 运行环境
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 预创建持久化目录
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 初始拷贝已有数据 (如果本地有初始配置)
COPY --from=builder /app/data ./data

# 统一授权
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
