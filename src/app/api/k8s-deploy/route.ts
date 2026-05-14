import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { k8sNativeClient } from '@/lib/k8s-client';

const dataPath = path.join(process.cwd(), 'projects.json');

export async function POST(request: Request) {
  try {
    const { projectId, version, targetDeployment } = await request.json();
    
    // 1. 获取项目配置
    const projects = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const project = projects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. 构造原生 K8s 镜像信息
    const registry = process.env.DOCKER_REGISTRY || 'registry.local';
    const baseImage = `${registry}/projects/${project.jenkinsJob}`;
    const fullImage = `${baseImage}:${version}`;
    const namespace = project.kuboardNamespace || 'default';
    const deploymentName = targetDeployment || project.kubernetesDeployment || project.jenkinsJob;
    
    // 假设容器名与部署名一致，或者从配置中读取
    const containerName = project.kubernetesContainer || deploymentName;

    console.log(`Native K8s Update: Updating ${deploymentName} in ${namespace} to ${fullImage}...`);

    // 3. 调用 K8s 原生 API 执行 Patch
    await k8sNativeClient.updateImage(namespace, deploymentName, containerName, fullImage);

    return NextResponse.json({ 
      message: 'K8s Deployment updated successfully via native API',
      image: fullImage
    });
  } catch (error: any) {
    console.error('K8s Native update failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
