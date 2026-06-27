// Generates the web's typed especialidades list from the single source of truth
// (apps/api/app/core/especialidades.json). Run `npm run sync:especialidades`
// after editing the JSON; `npm run sync:especialidades:check` fails in CI if out
// of sync.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'apps/api/app/core/especialidades.json')
const DST = resolve(root, 'packages/types/src/especialidades.generated.ts')

const especialidades = JSON.parse(readFileSync(SRC, 'utf8'))
const entries = especialidades.map((e) => `  ${JSON.stringify(e)},`).join('\n')

const out = `// AUTO-GENERATED from apps/api/app/core/especialidades.json by \`npm run sync:especialidades\`.
// Do not edit by hand — edit the JSON (the single source of truth) and re-run.
export const ESPECIALIDADES = [
${entries}
] as const satisfies readonly string[]
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(DST, 'utf8')
  } catch {
    /* missing file → out of sync */
  }
  if (current !== out) {
    console.error('Especialidades list out of sync — run `npm run sync:especialidades`')
    process.exit(1)
  }
  console.log('Especialidades list in sync')
} else {
  writeFileSync(DST, out)
  console.log('Generated', DST)
}
