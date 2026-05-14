#!/bin/bash

echo "🚀 开始打包发布版本..."

# 1. 执行构建
npm run build

# 2. 创建发布目录
rm -rf release
mkdir -p release

# 3. 拷贝核心运行产物
echo "📦 正在收集文件..."
cp -r .next/standalone/* release/
cp -r .next/standalone/.next release/ 2>/dev/null || true

# 4. 拷贝静态资源 (这些是 standalone 默认不带的)
mkdir -p release/.next/static
cp -r .next/static/* release/.next/static/
cp -r public release/

# 5. 拷贝初始化数据和环境配置
cp -r data release/
cp .env.local release/.env

echo "✅ 打包完成！"
echo "------------------------------------------------"
echo "📂 发布包位置: ./release"
echo "📝 如何运行:"
echo "   1. 将 release 文件夹上传到服务器"
echo "   2. 确保服务器安装了 Node.js"
echo "   3. 执行命令: node server.js"
echo "------------------------------------------------"
