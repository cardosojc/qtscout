import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import fs from 'fs'
import path from 'path'
import type { Meeting } from '@/types/meeting'
import { pdfConfig } from '@/lib/pdf-config'

interface PdfAgendaActionItem {
  description?: string
  responsible?: string
  dueDate?: string
}

interface PdfAgendaItem {
  title: string
  description?: string
  content?: string
  actionItems?: PdfAgendaActionItem[]
}

export async function generateMeetingPDF(meeting: Meeting): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
    ),
    headless: true,
  })

  try {
    const page = await browser.newPage()

    const leftImageBase64 = loadImageBase64(pdfConfig.header.leftImage)
    const rightImageBase64 = loadImageBase64(pdfConfig.header.rightImage)

    const html = await generateMeetingHTML(meeting, leftImageBase64, rightImageBase64)

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '1cm',
        right: '2cm',
        bottom: '2.5cm',
        left: '2cm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: generateFooter(),
      printBackground: true
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

function loadImageBase64(relativePath: string): string {
  try {
    const imagePath = path.join(process.cwd(), relativePath)
    const imageBuffer = fs.readFileSync(imagePath)
    const ext = path.extname(relativePath).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${imageBuffer.toString('base64')}`
  } catch (error) {
    console.error(`Error loading image ${relativePath}:`, error)
    return ''
  }
}

function generateFooter(): string {
  return `
    <div style="font-size: 8px; width: 100%; text-align: center; margin-bottom: 10px; color: #666;">
      <div style="margin-top: 5px;">
        CNE - instituição de utilidade pública
      </div>
    </div>
  `
}

async function generateMeetingHTML(meeting: Meeting, leftImageDataUri: string, rightImageDataUri: string): Promise<string> {
  const formatDate = (dateInput: string) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.slice(0, 5)
  }

  // Handle both old and new agenda format
  let agendaItems: PdfAgendaItem[] = []
  let attendeeNames: string[] = []
  let chefeAgrupamento = ''
  let secretario = ''

  if (Array.isArray(meeting.agenda)) {
    // Old format - just agenda items
    agendaItems = meeting.agenda
  } else {
    // New format - object with items and attendee data
    const agendaObj = meeting.agenda as { items?: PdfAgendaItem[], attendeeNames?: string[], chefeAgrupamento?: string, secretario?: string }
    agendaItems = agendaObj?.items || []
    attendeeNames = agendaObj?.attendeeNames || []
    chefeAgrupamento = agendaObj?.chefeAgrupamento || ''
    secretario = agendaObj?.secretario || ''
  }

  return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ata de Reunião - ${meeting.identifier}</title>
      <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4;
          margin: 0;
        }

        body {
          font-family: 'Lato', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0 40px;
          background: white;
          min-height: 100vh;
        }

        .page-table {
          width: 100%;
          border-collapse: collapse;
        }

        .page-table thead td {
          padding: 0;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 0;
          margin-bottom: 20px;
        }

        .header-left, .header-right {
          width: 70px;
          height: 70px;
          flex-shrink: 0;
        }

        .header-left img, .header-right img {
          width: 70px;
          height: 70px;
          object-fit: contain;
        }

        .header-center {
          flex: 1;
          text-align: center;
        }

        .header-center strong {
          font-size: 16px;
          color: #1e40af;
        }

        .header-center span {
          font-size: 12px;
          color: #555;
        }

        .content {
          padding: 30px;
        }
        
        h1 {
          color: #1e40af;
          text-align: center;
          margin-bottom: 30px;
          font-size: 24px;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 10px;
        }
        
        h2 {
          color: #1e40af;
          margin-top: 30px;
          margin-bottom: 15px;
          font-size: 18px;
          border-left: 4px solid #1e40af;
          padding-left: 10px;
        }
        
        h3 {
          color: #374151;
          margin-top: 20px;
          margin-bottom: 10px;
          font-size: 16px;
        }
        
        .meeting-info {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 25px;
          border-left: 4px solid #1e40af;
        }
        
        .meeting-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        
        .info-item {
          margin-bottom: 8px;
        }
        
        .info-label {
          font-weight: bold;
          color: #374151;
        }
        
        .agenda-item {
          background: #f0f9ff;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 6px;
          border-left: 4px solid #3b82f6;
          break-inside: avoid;
        }
        
        .agenda-item h4 {
          margin: 0 0 5px 0;
          color: #1e40af;
        }
        
        .agenda-item > p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }
        
        .action-item {
          background: #fff7ed;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 6px;
          border-left: 4px solid #f59e0b;
        }
        
        .action-item h4 {
          margin: 0 0 5px 0;
          color: #d97706;
        }
        
        .action-details {
          font-size: 12px;
          color: #6b7280;
          margin-top: 5px;
        }
        
        .attendees {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .attendee-tag {
          background: #e5e7eb;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          color: #374151;
        }
        
        .content-section {
          background: white;
          padding: 20px;
          margin: 15px 0;
        }
        
        .content-section p {
          margin: 10px 0;
        }
        
        .content-section ul, .content-section ol {
          margin: 10px 0;
          padding-left: 25px;
        }
        
        .content-section li {
          margin: 5px 0;
        }
        
        .page-break {
          page-break-before: always;
        }
        
        .content table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }

        .content th, .content td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }

        .content th {
          background: #f8fafc;
          font-weight: bold;
          color: #374151;
        }
      </style>
    </head>
    <body>
      <table class="page-table">
        <thead>
          <tr>
            <td>
              <div class="page-header">
                <div class="header-left">
                  ${leftImageDataUri ? `<img src="${leftImageDataUri}" />` : ''}
                </div>
                <div class="header-center">
                  <strong>${pdfConfig.header.line1}</strong><br>
                  <span>${pdfConfig.header.line2}</span>
                </div>
                <div class="header-right">
                  ${rightImageDataUri ? `<img src="${rightImageDataUri}" />` : ''}
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
      <div class="content">
        <div class="meeting-info">
          <div class="meeting-info-grid">
            <div>
              <div class="info-item">
                <span class="info-label">Identificador:</span> ${meeting.identifier}
              </div>
              <div class="info-item">
                <span class="info-label">Tipo:</span> ${meeting.meetingType.name}
              </div>
              <div class="info-item">
                <span class="info-label">Data:</span> ${formatDate(meeting.date)}
              </div>
              ${meeting.startTime || meeting.endTime ? `
                <div class="info-item">
                  <span class="info-label">Horário:</span> 
                  ${meeting.startTime ? formatTime(meeting.startTime) : ''}
                  ${meeting.startTime && meeting.endTime ? ' - ' : ''}
                  ${meeting.endTime ? formatTime(meeting.endTime) : ''}
                </div>
              ` : ''}
            </div>
            <div>
              ${meeting.location ? `
                <div class="info-item">
                  <span class="info-label">Local:</span> ${meeting.location}
                </div>
              ` : ''}
              <div class="info-item">
                <span class="info-label">Criado por:</span> ${meeting.createdBy.name || meeting.createdBy.email}
              </div>
            </div>
          </div>
        </div>
        
        ${(attendeeNames.length > 0 || chefeAgrupamento || secretario) ? `
          <h2>Participantes</h2>
          <div class="attendees">
            ${chefeAgrupamento ? `<span class="attendee-tag" style="background: #1e40af; color: white; font-weight: 600;">${chefeAgrupamento} (Chefe de Agrupamento)</span>` : ''}
            ${secretario ? `<span class="attendee-tag" style="background: #059669; color: white; font-weight: 600;">${secretario} (Secretário)</span>` : ''}
            ${attendeeNames.map((name: string) => `<span class="attendee-tag">${name}</span>`).join('')}
          </div>
        ` : ''}
        
        ${agendaItems.length > 0 ? `
          <h2>Ordem de Trabalhos</h2>
          ${agendaItems.map((item: PdfAgendaItem, index: number) => `
            <div class="agenda-item">
              <h4>${index + 1}. ${item.title}</h4>
              ${item.description ? `<p>${item.description}</p>` : ''}
              ${item.content && item.content.trim() !== '' ? `
                <div class="content-section" style="margin-top: 10px; margin-left: 15px;">
                  ${item.content}
                </div>
              ` : ''}
              ${item.actionItems && item.actionItems.length > 0 ? `
                <div style="margin-top: 10px;">
                  <p style="font-size: 12px; font-weight: bold; color: #d97706; margin-bottom: 5px;">Ações a Tomar:</p>
                  ${item.actionItems.map(action => `
                    <div class="action-item">
                      <h4>${action.description || ''}</h4>
                      <div class="action-details">
                        ${action.responsible ? `<strong>Responsável:</strong> ${action.responsible}` : ''}
                        ${action.responsible && action.dueDate ? ' | ' : ''}
                        ${action.dueDate ? `<strong>Prazo:</strong> ${new Date(action.dueDate).toLocaleDateString('pt-PT')}` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        ` : ''}

        ${meeting.meetingType.code === 'CA' ? generateSignaturePage(attendeeNames, chefeAgrupamento, secretario) : ''}
      </div>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `
}

function generateSignaturePage(attendeeNames: string[], chefeAgrupamento: string, secretario: string): string {
  return `
    <div class="page-break">
      <div style="margin: 40px 0; text-align: center;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 30px;">
          <strong>Conselho de Agrupamento</strong><br>
          Agrupamento 61 - Santa Maria dos Olivais
        </p>
      </div>

      <div style="margin: 40px 0;">
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 30px;">
          Os abaixo assinados, membros do Conselho de Agrupamento, declaram ter participado na reunião
          e concordam com o conteúdo da presente ata.
        </p>
      </div>

      <div style="margin-top: 50px;">
        ${generateSignatureLines(attendeeNames, chefeAgrupamento, secretario)}
      </div>

      <div style="margin-top: 60px; text-align: center;">
        <div style="border-top: 2px solid #374151; width: 200px; margin: 0 auto; padding-top: 10px;">
          <p style="font-size: 12px; color: #6b7280; margin: 0;">
            Data: _____ / _____ / _________
          </p>
        </div>
      </div>
    </div>
  `
}

function generateSignatureLines(attendeeNames: string[], chefeAgrupamento: string, secretario: string): string {
  const signatureRows = []

  // Prepare all people to sign: special roles first, then participants
  const allSignatories = []

  // Add special roles first
  if (chefeAgrupamento) {
    allSignatories.push({ name: chefeAgrupamento, role: 'Chefe de Agrupamento' })
  }
  if (secretario) {
    allSignatories.push({ name: secretario, role: 'Secretário' })
  }

  // Add regular participants
  attendeeNames.forEach(name => {
    allSignatories.push({ name, role: '' })
  })

  // Generate signature lines in pairs
  for (let i = 0; i < allSignatories.length; i += 2) {
    const leftPerson = allSignatories[i]
    const rightPerson = allSignatories[i + 1]

    signatureRows.push(`
      <div style="display: flex; justify-content: space-between; margin-bottom: 60px;">
        <div style="width: 45%;">
          <div style="border-bottom: 1px solid #374151; height: 40px; margin-bottom: 5px;"></div>
          <p style="font-size: 12px; color: #374151; margin: 0; text-align: center; font-weight: 500;">
            ${leftPerson.name}
          </p>
          ${leftPerson.role ? `
            <p style="font-size: 10px; color: #1e40af; margin: 2px 0 0 0; text-align: center; font-weight: 600;">
              ${leftPerson.role}
            </p>
          ` : ''}
          <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0; text-align: center;">
            Assinatura
          </p>
        </div>
        ${rightPerson ? `
          <div style="width: 45%;">
            <div style="border-bottom: 1px solid #374151; height: 40px; margin-bottom: 5px;"></div>
            <p style="font-size: 12px; color: #374151; margin: 0; text-align: center; font-weight: 500;">
              ${rightPerson.name}
            </p>
            ${rightPerson.role ? `
              <p style="font-size: 10px; color: #1e40af; margin: 2px 0 0 0; text-align: center; font-weight: 600;">
                ${rightPerson.role}
              </p>
            ` : ''}
            <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0; text-align: center;">
              Assinatura
            </p>
          </div>
        ` : '<div style="width: 45%;"></div>'}
      </div>
    `)
  }

  return signatureRows.join('')
}

