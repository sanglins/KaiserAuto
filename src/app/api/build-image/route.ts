import { NextResponse } from 'next/server';
import { SSHClient } from '@/lib/ssh-client';
import { getServerConfig } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const { scriptName, serverId } = await request.json();
    if (!scriptName || !serverId) return NextResponse.json({ error: '参数缺失' }, { status: 400 });

    const config = getServerConfig(serverId);
    if (!config) return NextResponse.json({ error: '服务器不存在' }, { status: 404 });

    const ssh = new SSHClient(config);
    const scriptsDir = config.path + '/scripts';
    const workDir = config.path;
    
    const command = `cd "${workDir}" && bash "${scriptsDir}/${scriptName}"`;
    console.log('Executing Remote Command:', command);
    
    const { stdout, stderr } = await ssh.exec(command);

    return NextResponse.json({ 
      success: true, 
      output: stdout,
      errorOutput: stderr 
    });
  } catch (error: any) {
    console.error('Remote Build Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      output: error.stdout 
    }, { status: 500 });
  }
}
