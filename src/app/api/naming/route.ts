import { NextResponse } from 'next/server';
import { saveAlias } from '@/lib/naming-utils';

export async function POST(request: Request) {
  try {
    const { serverId, type, realName, alias } = await request.json();
    if (!serverId || !type || !realName || !alias) {
      return NextResponse.json({ error: '参数不足' }, { status: 400 });
    }
    
    saveAlias(serverId, type, realName, alias);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
