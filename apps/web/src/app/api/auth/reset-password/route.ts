import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { password, confirmPassword } = await request.json()

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'As palavras-passe não coincidem' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A palavra-passe deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao redefinir palavra-passe' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Palavra-passe redefinida com sucesso'
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
