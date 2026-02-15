import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(session.user)
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
