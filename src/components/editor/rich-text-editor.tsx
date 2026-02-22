'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, useRef, useEffect } from 'react'

interface RichTextEditorProps {
  content?: string
  onChange?: (content: string) => void
  placeholder?: string
}

type AiMode = 'polish' | 'formal'

const AI_MODES: { mode: AiMode; label: string; description: string }[] = [
  { mode: 'polish', label: 'Melhorar texto', description: 'Corrige gramática e clareza' },
  { mode: 'formal', label: 'Tornar formal', description: 'Conciso e adequado para atas' },
]

export function RichTextEditor({ content = '', onChange, placeholder = 'Escreva aqui...' }: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPreview, setAiPreview] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none p-4 focus:outline-none min-h-[200px]',
      },
    },
  })

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAiDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAiRewrite = async (mode: AiMode) => {
    if (!editor) return
    setAiDropdownOpen(false)
    setAiLoading(true)
    setAiPreview(null)

    try {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getHTML(), mode }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response')
      }

      // Read the stream and accumulate
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      // Strip markdown code fences if the model wraps in ```html ... ```
      const cleaned = accumulated
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()

      setAiPreview(cleaned)
    } catch (error) {
      console.error('AI rewrite error:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const acceptPreview = () => {
    if (!editor || !aiPreview) return
    editor.commands.setContent(aiPreview)
    onChange?.(aiPreview)
    setAiPreview(null)
  }

  const cancelPreview = () => {
    setAiPreview(null)
  }

  if (!editor) {
    return <div>Carregando editor...</div>
  }

  const btnBase = 'px-3 py-1 rounded text-sm font-medium transition-colors'
  const btnInactive = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
  const btnActive = 'bg-blue-600 dark:bg-blue-500 text-white'

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 transition-colors">
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-600">
        {/* Formatting row */}
        <div className="flex items-center">
        <div className="flex-1 min-w-0 px-2 py-2 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`${btnBase} ${editor.isActive('bold') ? btnActive : btnInactive}`}
          >
            Negrito
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`${btnBase} ${editor.isActive('italic') ? btnActive : btnInactive}`}
          >
            Itálico
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={`${btnBase} ${editor.isActive('strike') ? btnActive : btnInactive}`}
          >
            Riscado
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`${btnBase} ${editor.isActive('heading', { level: 1 }) ? btnActive : btnInactive}`}
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`${btnBase} ${editor.isActive('heading', { level: 2 }) ? btnActive : btnInactive}`}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`${btnBase} ${editor.isActive('heading', { level: 3 }) ? btnActive : btnInactive}`}
          >
            H3
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : btnInactive}`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista Numerada"
            className={`${btnBase} ${editor.isActive('orderedList') ? btnActive : btnInactive}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6" />
              <line x1="10" y1="12" x2="21" y2="12" />
              <line x1="10" y1="18" x2="21" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`${btnBase} ${editor.isActive('blockquote') ? btnActive : btnInactive}`}
          >
            Citação
          </button>
        </div>
        {/* AI button — sibling of overflow container so dropdown isn't clipped */}
        <div className="flex-shrink-0 px-2 py-2 border-l border-gray-200 dark:border-gray-600 relative" ref={dropdownRef}>
            {aiLoading ? (
              <div className={`${btnBase} ${btnInactive} flex items-center gap-1.5 cursor-default opacity-70`}>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                A reescrever...
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAiDropdownOpen(o => !o)}
                disabled={editor.isEmpty}
                className={`${btnBase} ${btnInactive} flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span>✦ IA</span>
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 8L1 3h10L6 8z" />
                </svg>
              </button>
            )}

            {aiDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
                {AI_MODES.map(({ mode, label, description }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleAiRewrite(mode)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className={`relative ${isFocused ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-opacity-50' : ''}`}>
        <EditorContent editor={editor} />
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-gray-400 dark:text-gray-500 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* AI Preview Panel */}
      {aiPreview !== null && (
        <div className="border-t border-gray-200 dark:border-gray-600">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 flex items-center justify-between">
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <span>✦</span> Sugestão da IA
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelPreview}
                className="px-3 py-1.5 text-sm rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={acceptPreview}
                className="px-3 py-1.5 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              >
                Aceitar
              </button>
            </div>
          </div>
          <div
            className="prose max-w-none p-4 text-gray-900 dark:text-gray-100 bg-purple-50/50 dark:bg-purple-950/10"
            dangerouslySetInnerHTML={{ __html: aiPreview }}
          />
        </div>
      )}
    </div>
  )
}
