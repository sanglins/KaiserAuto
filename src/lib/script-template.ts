export function generateK8sDeployScript(config: any) {
  const { imageName, k8s } = config;
  const { masterHost, masterPassword, deployments, deployment, namespace, container, workDir, pushRegistry } = k8s || {};

  // 支持单个部署或多个部署
  const targetDeployments = deployments && deployments.length > 0 
    ? deployments 
    : [{ name: deployment, namespace: namespace, container: container }];

  let pushStep = "";
  if (pushRegistry === true) {
    pushStep = `
# 4. 推送镜像到仓库
info "正在推送镜像到远程仓库..."
docker push "\$FULL_IMAGE"
success "镜像推送完成"
`;
  } else {
    pushStep = `
# 4. 跳过推送步骤
info "根据配置，跳过镜像推送步骤 (仅使用本地镜像)"
`;
  }

  let deploySteps = "";
  targetDeployments.forEach((dep: any, idx: number) => {
    if (!dep.name) return;
    deploySteps += `
  echo ">>> [${idx + 1}] 执行 kubectl 滚动更新: ${dep.namespace}/${dep.name} (${dep.container})..."
  kubectl set image deployment/"${dep.name}" "${dep.container}"="\$FULL_IMAGE" -n "${dep.namespace}"
  kubectl rollout status deployment/"${dep.name}" -n "${dep.namespace}"
`;
  });

  return `#!/bin/bash
set -e

# 颜色输出
BLUE='\\033[0;34m'
GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m'

info() { echo -e "\${BLUE}[INFO]\${NC} \$1"; }
success() { echo -e "\${GREEN}[SUCCESS]\${NC} \$1"; }
error() { echo -e "\${RED}[ERROR]\${NC} \$1"; }

info "========== 开始 K8s 容器化自动化部署 =========="

# 1. 准备工作目录
info "初始化工作目录: ${workDir}"
mkdir -p "${workDir}"
cd "${workDir}"

# 2. 处理产物包 (支持解压)
LATEST_ZIP=$(ls -t *.zip *.tar.gz *.tgz 2>/dev/null | head -n 1)
if [ -n "$LATEST_ZIP" ]; then
    info "检测到新产物包: \$LATEST_ZIP，正在解压覆盖..."
    if [[ \$LATEST_ZIP == *.zip ]]; then
        unzip -o "\$LATEST_ZIP" > /dev/null
    else
        tar -xzf "\$LATEST_ZIP"
    fi
    # 尝试识别嵌套层级
    SUB_ITEMS=$(ls -1 . | grep -v "__MACOSX" | grep -v "\$LATEST_ZIP" | wc -l)
    if [ "$SUB_ITEMS" -eq 1 ]; then
        SUB_NAME=$(ls -1 . | grep -v "__MACOSX" | grep -v "\$LATEST_ZIP")
        if [ -d "\$SUB_NAME" ]; then
            info "检测到嵌套目录 [\$SUB_NAME]，正在提取文件..."
            cp -a "\$SUB_NAME"/. .
            rm -rf "\$SUB_NAME"
        fi
    fi
fi

# 3. 构建镜像
IMAGE_TAG=$(date +%Y%m%d_%H%M%S)
FULL_IMAGE="${imageName}:\$IMAGE_TAG"
info "正在构建 Docker 镜像: \$FULL_IMAGE"

if [ ! -f "Dockerfile" ]; then
    error "在目录 ${workDir} 中未找到 Dockerfile，请检查上传内容。"
    exit 1
fi

docker build -t "\$FULL_IMAGE" .

${pushStep}

# 5. 远程更新 K8s 集群
info "正在连接 Master 节点 (${masterHost}) 执行滚动更新..."
if ! command -v sshpass >/dev/null 2>&1; then
    info "未检测到 sshpass，正在尝试自动安装..."
    if command -v yum >/dev/null 2>&1; then
        yum install -y sshpass || sudo yum install -y sshpass
    elif command -v apt-get >/dev/null 2>&1; then
        apt-get update && apt-get install -y sshpass || (sudo apt-get update && sudo apt-get install -y sshpass)
    else
        error "无法识别的包管理器，请手动安装 sshpass (用于跨节点指令)"
        exit 1
    fi
fi

sshpass -p "${masterPassword}" ssh -o StrictHostKeyChecking=no root@"${masterHost}" << EOF
${deploySteps}
EOF

success "========== ✅ K8s 集群多节点部署成功！镜像版本: \$IMAGE_TAG =========="
`;
}

export function generateLinuxDeployScript(config: any) {
  const { sourceDir, targetDir, backupDir, syncEnabled, linuxConfig } = config;
  const syncNodes = linuxConfig?.syncNodes || config.syncNodes || [];

  let syncScript = "";
  if (syncEnabled && syncNodes.length > 0) {
    syncScript = `
# 5. 跨节点集群同步 (分发源 -> 目标集群)
info "检测到同步任务，开始分发至集群节点..."
if ! command -v sshpass >/dev/null 2>&1; then
    info "未检测到 sshpass，正在尝试自动安装..."
    if command -v yum >/dev/null 2>&1; then
        yum install -y sshpass || sudo yum install -y sshpass
    elif command -v apt-get >/dev/null 2>&1; then
        apt-get update && apt-get install -y sshpass || (sudo apt-get update && sudo apt-get install -y sshpass)
    else
        error "无法识别的包管理器，请手动安装 sshpass (用于跨节点同步)"
        exit 1
    fi
fi
`;
    syncNodes.forEach((node: any, idx: number) => {
      const port = node.port || 22;
      syncScript += `
info "正在同步至节点 #${idx + 1} (${node.host}:${port})..."
sshpass -p "${node.pass}" ssh -p ${port} -o StrictHostKeyChecking=no ${node.user}@${node.host} "mkdir -p $(dirname "${targetDir}") && rm -rf ${targetDir} && mkdir -p ${targetDir}"
sshpass -p "${node.pass}" scp -P ${port} -r "${targetDir}" ${node.user}@${node.host}:$(dirname "${targetDir}")/
success "节点 #${idx + 1} (${node.host}) 同步完成"
`;
    });
  }

  return `#!/bin/bash
# 自动化部署脚本：解压 -> 智能剥离层级 -> 备份 -> 集群分发

set -e

# 颜色输出
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m'

info() { echo -e "\${BLUE}[INFO]\${NC} \$1"; }
success() { echo -e "\${GREEN}[SUCCESS]\${NC} \$1"; }
error() { echo -e "\${RED}[ERROR]\${NC} \$1"; }

info "========== 开始 Linux 自动化部署 =========="

# 1. 检查环境
cd ${sourceDir}
mkdir -p ${backupDir}

# 2. 识别并解压最新的压缩包
LATEST_ZIP=$(ls -t *.zip *.tar.gz *.tgz 2>/dev/null | head -n 1)
if [ -z "$LATEST_ZIP" ]; then
    error "未找到压缩包，请先上传文件。"
    exit 1
fi

info "正在处理压缩包: $LATEST_ZIP"
rm -rf ./tmp_extract && mkdir -p ./tmp_extract

if [[ $LATEST_ZIP == *.zip ]]; then
    unzip -o "$LATEST_ZIP" -d ./tmp_extract > /dev/null
else
    tar -xzf "$LATEST_ZIP" -C ./tmp_extract
fi

# 【智能识别内容根目录】
CONTENT_ROOT="./tmp_extract"
SUB_ITEMS=$(ls -1 \$CONTENT_ROOT | grep -v "__MACOSX" | wc -l)
if [ "$SUB_ITEMS" -eq 1 ]; then
    SUB_NAME=$(ls -1 \$CONTENT_ROOT | grep -v "__MACOSX")
    if [ -d "\$CONTENT_ROOT/\$SUB_NAME" ]; then
        info "检测到内容位于子目录 [\$SUB_NAME]，已自动剥离层级"
        CONTENT_ROOT="./tmp_extract/\$SUB_NAME"
    fi
fi

# 3. 备份当前目标目录
if [ -d "${targetDir}" ]; then
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    info "正在创建备份: \$BACKUP_NAME"
    tar -czf "${backupDir}/\$BACKUP_NAME" -C "${targetDir}" .
    echo "\$BACKUP_NAME" >> "${backupDir}/backup_index.txt"
fi

# 4. 在分发源节点执行部署
info "正在部署至本地目标目录: ${targetDir}"
mkdir -p "${targetDir}"
rm -rf "${targetDir}"/*
cp -a "\$CONTENT_ROOT"/. "${targetDir}/"

${syncScript}

# 清理临时文件
rm -rf ./tmp_extract
success "========== ✅ 集群部署流程全部完成 =========="
`;
}
