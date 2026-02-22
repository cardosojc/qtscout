import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { decrypt } from '@vercel/flags'
import * as flags from './flags'

export async function middleware(request: NextRequest) {
  // 1. Session refresh
  const sessionResponse = await updateSession(request)

  // 2. Gate /documents routes by document type flag
  const { pathname, searchParams } = request.nextUrl
  if (pathname.startsWith('/documents') || pathname.startsWith('/api/documents')) {
    // Read Vercel Toolbar flag overrides from cookie (if present)
    const overridesCookie = request.cookies.get('vercel-flag-overrides')?.value
    const overrides = overridesCookie
      ? ((await decrypt<Record<string, boolean>>(overridesCookie)) ?? {})
      : {}

    const oficio = overrides['oficio-enabled'] ?? (flags.oficioEnabled.defaultValue as boolean)
    const circular = overrides['circular-enabled'] ?? (flags.circularEnabled.defaultValue as boolean)
    const ordem = overrides['ordem-servico-enabled'] ?? (flags.ordemServicoEnabled.defaultValue as boolean)

    const typeParam = searchParams.get('type')
    const disabledMap: Record<string, boolean> = {
      OFICIO: !oficio,
      CIRCULAR: !circular,
      ORDEM_SERVICO: !ordem,
    }
    const firstEnabled = oficio ? 'OFICIO' : circular ? 'CIRCULAR' : ordem ? 'ORDEM_SERVICO' : null

    if (typeParam && disabledMap[typeParam]) {
      const url = request.nextUrl.clone()
      if (firstEnabled) {
        url.searchParams.set('type', firstEnabled)
      } else {
        url.pathname = '/'
        url.search = ''
      }
      return NextResponse.redirect(url)
    }
  }

  return sessionResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
