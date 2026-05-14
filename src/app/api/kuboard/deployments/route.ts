import { NextResponse } from 'next/server';
import { k8sNativeClient } from '@/lib/k8s-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get('namespace') || 'default';

  try {
    // 切换为 K8s 原生 API 获取列表
    const data = await k8sNativeClient.getDeployments(namespace);
    return NextResponse.json(data.items || []);
  } catch (error: any) {
    console.error('Failed to fetch K8s deployments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
