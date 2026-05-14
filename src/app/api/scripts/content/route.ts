import { NextResponse } from 'next/server';
import { SSHClient } from '@/lib/ssh-client';
import { getServerConfig } from '@/lib/server-utils';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const serverId = searchParams.get('serverId');
  
  if (!name || !serverId) return NextResponse.json({ error: '参数不足' }, { status: 400 });
  const config = getServerConfig(serverId);
  if (!config) return NextResponse.json({ error: '服务器配置不存在' }, { status: 404 });

  const ssh = new SSHClient(config);
  try {
    const scriptPath = path.join(config.path, 'scripts', name);
    const content = await ssh.readFile(scriptPath);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, content, serverId } = await request.json();
    if (!name || content === undefined || !serverId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const config = getServerConfig(serverId);
    if (!config) return NextResponse.json({ error: '服务器不存在' }, { status: 404 });

    const ssh = new SSHClient(config);
    const scriptPath = path.join(config.path, 'scripts', name);
    
    await ssh.writeFile(scriptPath, content);
    return NextResponse.json({ message: '脚本已同步到远程服务器' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
