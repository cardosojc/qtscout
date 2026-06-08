import { verifyAccess } from '@vercel/flags'
import { getProviderData } from '@flags-sdk/vercel'
import { NextResponse } from 'next/server'
import * as flags from '@/flags'

export async function GET(request: Request) {
  const access = await verifyAccess(request.headers.get('Authorization'))
  if (!access) return NextResponse.json(null, { status: 401 })

  return NextResponse.json(await getProviderData(flags))
}
