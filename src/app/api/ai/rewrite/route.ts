import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { createMistral } from '@ai-sdk/mistral'
import { streamText } from 'ai'

const PROMPTS = {
  polish: `És um assistente que melhora atas de reuniões de uma organização de escuteiros portuguesa.
Reescreve o seguinte texto para corrigir a gramática, melhorar a clareza e torná-lo mais profissional.
Mantém o mesmo idioma (Português de Portugal), preserva toda a informação e devolve apenas HTML válido,
usando as mesmas tags do input (p, strong, em, ul, ol, li, h1, h2, h3, blockquote).
Não incluas explicações, markdown ou blocos de código — devolve apenas o HTML.`,

  formal: `És um assistente que melhora atas de reuniões de uma organização de escuteiros portuguesa.
Reescreve o seguinte texto para o tornar mais conciso e formal, adequado para atas oficiais.
Mantém o mesmo idioma (Português de Portugal), preserva a informação essencial e devolve apenas HTML válido,
usando as mesmas tags do input (p, strong, em, ul, ol, li, h1, h2, h3, blockquote).
Não incluas explicações, markdown ou blocos de código — devolve apenas o HTML.`,
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const content: string = body.content
    const mode: string = body.mode

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    if (mode !== 'polish' && mode !== 'formal') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    const validMode = mode as 'polish' | 'formal'

    const mistral = createMistral({
      apiKey: process.env.MISTRAL_API_KEY,
    })

    const result = streamText({
      model: mistral('mistral-small-latest'),
      messages: [
        {
          role: 'user',
          content: `${PROMPTS[validMode]}\n\nTexto:\n${content}`,
        },
      ],
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('AI rewrite error:', error)
    return NextResponse.json({ error: 'Failed to rewrite content' }, { status: 500 })
  }
}
