'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useRouter, useParams } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import type { Meeting, MeetingType, AgendaItem, ActionItem } from '@/types/meeting'

interface ExtendedMeetingType extends MeetingType {
  description: string
}

function AgendaActionItems({ agendaId, actions, onAdd, onRemove }: {
  agendaId: string
  actions: ActionItem[]
  onAdd: (agendaId: string, description: string, responsible: string, dueDate: string) => void
  onRemove: (agendaId: string, actionId: string) => void
}) {
  const [desc, setDesc] = useState('')
  const [resp, setResp] = useState('')
  const [due, setDue] = useState('')

  const handleAdd = () => {
    if (desc.trim()) {
      onAdd(agendaId, desc.trim(), resp.trim(), due)
      setDesc('')
      setResp('')
      setDue('')
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição da ação"
          className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          placeholder="Responsável"
          className="w-36 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-36 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          Adicionar
        </button>
      </div>
      {actions.map((action) => (
        <div key={action.id} className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-1">
          <div className="flex-1 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">{action.description}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-2">
              {action.responsible && `· ${action.responsible}`}
              {action.dueDate && ` · ${new Date(action.dueDate).toLocaleDateString('pt-PT')}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(agendaId, action.id)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default function EditMeetingPage() {
  const { user: session } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const params = useParams()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [meetingTypes, setMeetingTypes] = useState<ExtendedMeetingType[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Form state
  const [selectedMeetingType, setSelectedMeetingType] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [newAttendee, setNewAttendee] = useState('')
  const [chefeAgrupamento, setChefeAgrupamento] = useState('')
  const [secretario, setSecretario] = useState('')

  // Agenda items
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [newAgendaTitle, setNewAgendaTitle] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const fetchMeeting = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`)
      if (response.ok) {
        const meetingData = await response.json()
        setMeeting(meetingData)

        // Populate form with existing data
        setSelectedMeetingType(meetingData.meetingTypeId)
        setDate(new Date(meetingData.date).toISOString().split('T')[0])
        setStartTime(meetingData.startTime || '')
        setEndTime(meetingData.endTime || '')
        setLocation(meetingData.location || '')

        // Extract agenda items and attendee data from meeting agenda
        const agendaObj = meetingData.agenda as { items?: AgendaItem[], attendeeNames?: string[], chefeAgrupamento?: string, secretario?: string } | AgendaItem[]

        // Check if agenda is an array (old format) or object (new format with attendees)
        let loadedItems: AgendaItem[] = []
        if (Array.isArray(agendaObj)) {
          // Old format - agenda is just an array of items
          loadedItems = agendaObj
          setAttendees([])
          setChefeAgrupamento('')
          setSecretario('')
        } else {
          // New format - agenda is an object containing items and attendee data
          loadedItems = agendaObj?.items || []
          const attendeeNames = agendaObj?.attendeeNames || []
          setAttendees(attendeeNames)
          setChefeAgrupamento(agendaObj?.chefeAgrupamento || '')
          setSecretario(agendaObj?.secretario || '')
        }
        setAgendaItems(loadedItems)
      } else {
        router.push('/meetings')
      }
    } catch (error) {
      console.error('Error fetching meeting:', error)
      router.push('/meetings')
    } finally {
      setInitialLoading(false)
    }
  }, [meetingId, router])

  useEffect(() => {
    if (meetingId) {
      fetchMeeting()
      fetchMeetingTypes()
    }
  }, [meetingId, fetchMeeting])

  const fetchMeetingTypes = async () => {
    try {
      const response = await fetch('/api/meeting-types')
      if (response.ok) {
        const types = await response.json()
        setMeetingTypes(types)
      }
    } catch (error) {
      console.error('Error fetching meeting types:', error)
    }
  }

  const addAttendee = () => {
    if (newAttendee.trim() && !attendees.includes(newAttendee.trim())) {
      setAttendees([...attendees, newAttendee.trim()])
      setNewAttendee('')
    }
  }

  const removeAttendee = (attendee: string) => {
    setAttendees(attendees.filter(a => a !== attendee))
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateAgendaItemContent = (id: string, content: string) => {
    setAgendaItems(prev => prev.map(item =>
      item.id === id ? { ...item, content } : item
    ))
  }

  const addAgendaItem = () => {
    if (newAgendaTitle.trim()) {
      const newItem: AgendaItem = {
        id: Date.now().toString(),
        title: newAgendaTitle.trim(),
        description: '',
        content: '',
        actionItems: []
      }
      setAgendaItems([...agendaItems, newItem])
      setExpandedItems(prev => new Set(prev).add(newItem.id))
      setNewAgendaTitle('')
    }
  }

  const removeAgendaItem = (id: string) => {
    setAgendaItems(agendaItems.filter(item => item.id !== id))
  }

  const addActionToAgendaItem = (agendaId: string, description: string, responsible: string, dueDate: string) => {
    setAgendaItems(prev => prev.map(item =>
      item.id === agendaId
        ? { ...item, actionItems: [...(item.actionItems || []), { id: Date.now().toString(), description, responsible, dueDate }] }
        : item
    ))
  }

  const removeActionFromAgendaItem = (agendaId: string, actionId: string) => {
    setAgendaItems(prev => prev.map(item =>
      item.id === agendaId
        ? { ...item, actionItems: (item.actionItems || []).filter(a => a.id !== actionId) }
        : item
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !selectedMeetingType || !date) return

    setLoading(true)
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingTypeId: selectedMeetingType,
          date,
          startTime,
          endTime,
          location,
          agenda: agendaItems,
          content: '',
          actionItems: [],
          attendees,
          chefeAgrupamento,
          secretario
        }),
      })

      if (response.ok) {
        showToast('Reunião atualizada com sucesso', 'success')
        router.push(`/meetings/${meetingId}`)
      } else {
        showToast('Erro ao atualizar reunião', 'error')
      }
    } catch (error) {
      console.error('Error updating meeting:', error)
      showToast('Erro ao atualizar reunião', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Precisa fazer login para editar reuniões.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Reunião não encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Editar Reunião</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Meeting Type and Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Reunião *
                </label>
                <select
                  value={selectedMeetingType}
                  onChange={(e) => setSelectedMeetingType(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="">Selecione o tipo</option>
                  {meetingTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hora de Início
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hora de Fim
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Local
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Local da reunião"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Participantes
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAttendee}
                  onChange={(e) => setNewAttendee(e.target.value)}
                  placeholder="Nome do participante"
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                />
                <button
                  type="button"
                  onClick={addAttendee}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Adicionar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {attendees.map((attendee) => (
                  <span
                    key={attendee}
                    className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm"
                  >
                    {attendee}
                    <button
                      type="button"
                      onClick={() => removeAttendee(attendee)}
                      className="ml-2 text-gray-500 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Special roles for Conselho de Agrupamento */}
            {selectedMeetingType && meetingTypes.find(type => type.id === selectedMeetingType)?.code === 'CA' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Chefe de Agrupamento
                  </label>
                  <input
                    type="text"
                    value={chefeAgrupamento}
                    onChange={(e) => setChefeAgrupamento(e.target.value)}
                    placeholder="Nome do Chefe de Agrupamento"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secretário
                  </label>
                  <input
                    type="text"
                    value={secretario}
                    onChange={(e) => setSecretario(e.target.value)}
                    placeholder="Nome do Secretário"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
              </>
            )}

            {/* Agenda Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pontos da Agenda
              </label>

              <input
                type="text"
                value={newAgendaTitle}
                onChange={(e) => setNewAgendaTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAgendaItem() } }}
                placeholder="Escreva o ponto e pressione Enter"
                className="w-full p-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />

              <div className="space-y-3">
                {agendaItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700">
                      <span className="font-medium text-gray-600 dark:text-gray-300">{index + 1}.</span>
                      <h4 className="flex-1 font-medium text-gray-900 dark:text-white">{item.title}</h4>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className="text-sm px-3 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                      >
                        {expandedItems.has(item.id) ? 'Recolher' : 'Escrever'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAgendaItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                    {expandedItems.has(item.id) && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
                        <RichTextEditor
                          content={item.content || ''}
                          onChange={(c) => updateAgendaItemContent(item.id, c)}
                          placeholder={`Conteúdo para "${item.title}"...`}
                        />

                        {/* Per-item Action Items */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Ações a Tomar
                          </label>
                          <AgendaActionItems
                            agendaId={item.id}
                            actions={item.actionItems || []}
                            onAdd={addActionToAgendaItem}
                            onRemove={removeActionFromAgendaItem}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !selectedMeetingType || !date}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Atualizando...' : 'Atualizar Reunião'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/meetings/${meetingId}`)}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}