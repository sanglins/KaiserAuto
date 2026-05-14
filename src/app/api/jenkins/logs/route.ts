import { NextResponse } from 'next/server';
import { jenkinsClient } from '@/lib/api-clients';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobName = searchParams.get('jobName');

  if (!jobName) {
    return NextResponse.json({ error: 'Job name is required' }, { status: 400 });
  }

  try {
    const logs = await jenkinsClient.getBuildLogs(jobName);
    return new Response(logs, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Failed to fetch Jenkins logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
