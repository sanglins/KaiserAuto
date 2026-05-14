import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin123';
    const opUser = process.env.OPERATOR_USER || 'user';
    const opPass = process.env.OPERATOR_PASS || 'user123';

    let role = '';
    if (username === adminUser && password === adminPass) {
      role = 'admin';
    } else if (username === opUser && password === opPass) {
      role = 'operator';
    }

    if (role) {
      const cookieStore = await cookies();
      // 存储认证令牌
      cookieStore.set('auth_token', 'cicd_authenticated_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
      // 存储角色信息 (非 HttpOnly 方便前端读取，或者通过 API 返回)
      cookieStore.set('user_role', role, {
        maxAge: 60 * 60 * 24,
        path: '/',
      });

      return NextResponse.json({ success: true, role });
    }

    return NextResponse.json({ success: false, message: '账号或密码错误' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: '登录失败' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  cookieStore.delete('user_role');
  return NextResponse.json({ success: true });
}
