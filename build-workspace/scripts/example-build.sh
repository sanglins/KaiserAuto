#!/bin/bash
echo "正在开始构建镜像..."
sleep 2
echo "Docker build -t my-app:latest ."
sleep 1
echo "Docker push my-repo/my-app:latest"
echo "构建完成！"