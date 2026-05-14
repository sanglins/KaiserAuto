import { NextResponse } from 'next/server';
import { SSHClient } from '@/lib/ssh-client';
import { getServerConfig } from '@/lib/server-utils';
import { getAliases } from '@/lib/naming-utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get('serverId');
  
  if (!serverId) return NextResponse.json({ error: '请选择服务器' }, { status: 400 });
  const config = getServerConfig(serverId);
  if (!config) return NextResponse.json({ error: '服务器配置不存在' }, { status: 404 });

  const ssh = new SSHClient(config);
  try {
    const scriptsDir = config.path + '/scripts';
    await ssh.exec(`mkdir -p "${scriptsDir}"`);
    const list = await ssh.readdir(scriptsDir);
    const scripts = list.filter(f => f.endsWith('.sh'));
    
    // 获取脚本别名
    const { scripts: scriptAliases } = getAliases(serverId);

    return NextResponse.json({
      realNames: scripts,
      aliases: scriptAliases
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
