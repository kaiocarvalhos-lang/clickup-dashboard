import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;
  
  // Allow static assets, images, and API routes to bypass auth
  if (url.pathname.startsWith('/_next') || url.pathname.startsWith('/api') || url.pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Default credentials if environment variables are not set
    const validUser = process.env.DASHBOARD_USER || 'admin';
    const validPwd = process.env.DASHBOARD_PASSWORD || 'clickup123';

    if (user === validUser && pwd === validPwd) {
      return NextResponse.next();
    }
  }

  url.pathname = '/api/auth';
  
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
