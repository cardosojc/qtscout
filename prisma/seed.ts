import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create meeting types
  const meetingTypes = await Promise.all([
    prisma.meetingType.upsert({
      where: { code: 'CA' },
      update: {},
      create: {
        code: 'CA',
        name: 'Conselho de Agrupamento',
        description: 'Reunião do conselho de agrupamento'
      }
    }),
    prisma.meetingType.upsert({
      where: { code: 'RD' },
      update: {},
      create: {
        code: 'RD',
        name: 'Reunião de Direção',
        description: 'Reunião da direção do agrupamento'
      }
    })
  ])

  console.log('Seeded meeting types:', meetingTypes)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })