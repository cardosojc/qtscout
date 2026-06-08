import type { Context } from 'hono'
import type { AppEnv } from '../types'

/** Return a Buffer as a binary PDF response with the right headers. */
export function pdfResponse(
  c: Context<AppEnv>,
  pdf: Buffer,
  filename: string,
  disposition: 'inline' | 'attachment',
) {
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
  return c.body(body, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${filename}"`,
    'Content-Length': String(pdf.byteLength),
  })
}
