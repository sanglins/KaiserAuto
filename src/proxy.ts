import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 排除登录页和静态资源
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token');

  // 如果没有 token，且不在登录页，重定向到登录
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// 配置拦截范围：所有页面
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * 1. /api/auth (鉴权 API)
     * 2. /_next/static (静态资源)
     * 3. /_next/image (图片优化)
     * 4. /favicon.ico (图标)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
