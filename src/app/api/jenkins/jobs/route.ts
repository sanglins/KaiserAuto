import { NextResponse } from 'next/server';
import { jenkinsClient } from '@/lib/api-clients';

export async function GET() {
  try {
    const data = await jenkinsClient.getJobs();
    return NextResponse.json(data.jobs || []);
  } catch (error: any) {
    console.error('Failed to fetch Jenkins jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
