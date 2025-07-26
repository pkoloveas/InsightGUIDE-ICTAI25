import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  
  const isPasswordProtectionEnabled = process.env.ENABLE_PASSWORD_PROTECTION === 'true'
  
  if (!isPasswordProtectionEnabled) {
    return NextResponse.next()
  }

  const correctPassword = process.env.PASSWORD
  const correctUsername = process.env.USERNAME
  
  if (!correctPassword || !correctUsername) {
    return new NextResponse('Server configuration error', {
      status: 500,
    })
  }
  
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Scientific Paper Insights"',
      },
    })
  }

  const base64Credentials = authHeader.substring(6)
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
  const [username, password] = credentials.split(':')

  if (username !== correctUsername || password !== correctPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Scientific Paper Insights"',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
