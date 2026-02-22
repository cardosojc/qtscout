import { flag } from '@vercel/flags/next'

export const oficioEnabled = flag<boolean>({
  key: 'oficio-enabled',
  defaultValue: true,
  decide: () => true,
  description: 'Enable/disable the Ofício document type',
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ],
})

export const circularEnabled = flag<boolean>({
  key: 'circular-enabled',
  defaultValue: true,
  decide: () => true,
  description: 'Enable/disable the Circular document type',
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ],
})

export const ordemServicoEnabled = flag<boolean>({
  key: 'ordem-servico-enabled',
  defaultValue: true,
  decide: () => true,
  description: 'Enable/disable the Ordem de Serviço document type',
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ],
})
