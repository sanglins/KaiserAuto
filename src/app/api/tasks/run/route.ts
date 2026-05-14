import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const TASKS_FILE = path.join(process.cwd(), 'data/tasks.json');

export async function POST(request: Request) {
  const { taskId } = await request.json();
  
  if (!fs.existsSync(TASKS_FILE)) return NextResponse.json({ error: 'Tasks file not found' }, { status: 404 });
  const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  const task = tasks.find((t: any) => t.id === taskId);
  
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const scriptTemplate = `#!/bin/bash
# 使用当前时间作为版本号创建Docker镜像，并自动更新K8s Deployment

set -e  # 遇到错误自动退出

# ============ 镜像配置 ============
IMAGE_NAME="${task.imageName}"

# ============ 项目配置 ============
TARGET_DIR="${task.targetDir}"

# ============ K8s配置 ============
K8S_MASTER_HOST="${task.k8sHost}"
K8S_MASTER_USER="${task.k8sUser}"
K8S_MASTER_PASSWORD="${task.k8sPassword}"

K8S_NAMESPACE="${task.k8sNamespace}"
K8S_DEPLOYMENT="${task.k8sDeployment}"
K8S_CONTAINER="${task.k8sContainer}"

# ===================================

# 获取当前时间戳作为版本号
current_datetime=$(date +'%Y%m%d%H%M')
IMAGE_TAG="v$current_datetime"
FULL_IMAGE="$IMAGE_NAME:$IMAGE_TAG"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 判断目标目录
if [ -z "$TARGET_DIR" ] || [ "$TARGET_DIR" = "/path/to/your/project" ]; then
    WORK_DIR="$SCRIPT_DIR"
    echo "使用脚本所在目录: $WORK_DIR"
else
    WORK_DIR="$TARGET_DIR"
    echo "使用自定义目录: $WORK_DIR"
fi

# 切换到目标目录
echo "切换到项目目录: $WORK_DIR"
cd "$WORK_DIR" || { echo "错误：无法切换到目录 $WORK_DIR"; exit 1; }

# ============ 新增：解压 zip 压缩包 ============
echo "========================================="
echo "检查并解压 zip 压缩包..."

# 查找当前目录下所有的 .zip 文件（排除隐藏文件）
zip_files=$(find . -maxdepth 1 -type f -name "*.zip" ! -name ".*" 2>/dev/null || true)

# 统计 zip 文件数量
zip_count=$(echo "$zip_files" | grep -c "\.zip$" 2>/dev/null || echo "0")

if [ "$zip_count" -eq 0 ]; then
    echo "未找到任何 zip 压缩包，跳过解压步骤"
elif [ "$zip_count" -eq 1 ]; then
    zip_file=$(echo "$zip_files" | head -1)
    echo "找到单个压缩包: $zip_file"
    echo "开始解压..."
    
    # 检查是否安装 unzip
    if ! command -v unzip >/dev/null 2>&1; then
        echo "错误：未安装 unzip 命令"
        echo "安装命令：yum install -y unzip 或 apt install -y unzip"
        exit 1
    fi
    
    # 解压到当前目录（覆盖已存在文件）
    unzip -o "$zip_file"
    
    echo "✅ 压缩包解压完成"
else
    echo "找到多个 zip 压缩包，将逐个解压："
    echo "$zip_files"
    echo ""
    
    # 检查是否安装 unzip
    if ! command -v unzip >/dev/null 2>&1; then
        echo "错误：未安装 unzip 命令"
        exit 1
    fi
    
    # 逐个解压
    while IFS= read -r zip_file; do
        [ -z "$zip_file" ] && continue
        echo "正在解压: $zip_file"
        unzip -o "$zip_file"
    done <<< "$zip_files"
    
    echo "✅ 所有压缩包解压完成"
fi

echo "========================================="
# ============ 解压功能结束 ============

# 检查Dockerfile是否存在
if [ ! -f "Dockerfile" ]; then
    echo "错误：当前目录下未找到 Dockerfile"
    echo "当前目录: $(pwd)"
    echo "目录内容:"
    ls -la
    exit 1
fi

# 检查 sshpass 是否存在
if ! command -v sshpass >/dev/null 2>&1; then
    echo "错误：当前服务器未安装 sshpass，无法在没有免密登录的情况下自动SSH"
    exit 1
fi

echo "开始构建 Docker 镜像..."
echo "镜像名称: $FULL_IMAGE"
echo "构建路径: $(pwd)"

# 构建Docker镜像
docker build -t "$FULL_IMAGE" .

sleep 0.5

# 推送Docker镜像
docker push "$FULL_IMAGE"

echo "✅ Docker镜像 $FULL_IMAGE 已创建并推送。"
echo "✅ Docker镜像版本为: $IMAGE_TAG"

sleep 0.5

echo "开始通过 SSH 更新 K8s Deployment..."
echo "K8s Master: $K8S_MASTER_HOST"
echo "命名空间: $K8S_NAMESPACE"
echo "Deployment: $K8S_DEPLOYMENT"
echo "容器名: $K8S_CONTAINER"
echo "新镜像: $FULL_IMAGE"

sshpass -p "$K8S_MASTER_PASSWORD" ssh -o StrictHostKeyChecking=no "$K8S_MASTER_USER@$K8S_MASTER_HOST" "
set -e

echo '查看更新前镜像：'
kubectl -n $K8S_NAMESPACE get deployment $K8S_DEPLOYMENT -o=jsonpath='{.spec.template.spec.containers[*].image}{\"\\\\n\"}'

echo '开始更新 Deployment 镜像...'
kubectl -n $K8S_NAMESPACE set image deployment/$K8S_DEPLOYMENT $K8S_CONTAINER=$FULL_IMAGE

echo '等待滚动更新完成...'
kubectl -n $K8S_NAMESPACE rollout status deployment/$K8S_DEPLOYMENT

echo '查看更新后镜像：'
kubectl -n $K8S_NAMESPACE get deployment $K8S_DEPLOYMENT -o=jsonpath='{.spec.template.spec.containers[*].image}{\"\\\\n\"}'

echo '查看Pod状态：'
kubectl -n $K8S_NAMESPACE get pod | grep $K8S_DEPLOYMENT || true
"

echo "✅ K8s Deployment 镜像更新完成。"
echo "✅ 当前部署镜像: $FULL_IMAGE"
`;

  // Create a temporary script file
  const tempDir = path.join(process.cwd(), 'temp-tasks');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const scriptPath = path.join(tempDir, `task_${taskId}.sh`);
  fs.writeFileSync(scriptPath, scriptTemplate, { mode: 0o755 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const child = spawn('bash', [scriptPath]);

      child.stdout.on('data', (data) => {
        controller.enqueue(encoder.encode(data.toString()));
      });

      child.stderr.on('data', (data) => {
        controller.enqueue(encoder.encode(data.toString()));
      });

      child.on('close', (code) => {
        controller.enqueue(encoder.encode(`\n>>> 任务结束，退出码: ${code}\n`));
        controller.close();
        // fs.unlinkSync(scriptPath); // Keep it for debugging if needed, or delete it
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
