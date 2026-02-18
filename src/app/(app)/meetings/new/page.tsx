'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { MeetingForm, type MeetingFormData } from '@/components/meetings/meeting-form'

export default function NewMeetingPage() {
  const { user: session } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  const handleSubmit = async (data: MeetingFormData) => {
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTypeId: data.meetingTypeId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location,
          agenda: data.agendaItems,
          content: '',
          actionItems: [],
          attendees: data.attendees,
          chefeAgrupamento: data.chefeAgrupamento,
          secretario: data.secretario,
        }),
      })

      if (response.ok) {
        const meeting = await response.json()
        showToast('Reunião criada com sucesso', 'success')
        router.push(`/meetings/${meeting.id}`)
      } else {
        showToast('Erro ao criar reunião', 'error')
      }
    } catch (error) {
      console.error('Error creating meeting:', error)
      showToast('Erro ao criar reunião', 'error')
    }
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p>Precisa fazer login para criar reuniões.</p>
        </div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Reuniões', href: '/meetings' },
        { label: 'Nova Reunião' },
      ]} />
      <MeetingForm
        title="Nova Reunião"
        submitLabel="Criar Reunião"
        submittingLabel="Criando..."
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </main>
  )
}
