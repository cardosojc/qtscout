// Generates the web's typed OS catalog from the single source of truth
// (api/app/core/ordem_categories.json). Run `npm run sync:categories` after
// editing the JSON; `npm run sync:categories:check` fails in CI if out of sync.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'api/app/core/ordem_categories.json')
const DST = resolve(root, 'packages/types/src/ordem-categories.generated.ts')

const categories = JSON.parse(readFileSync(SRC, 'utf8'))
const entries = categories
  .map(
    (c) =>
      `  { key: ${JSON.stringify(c.key)}, label: ${JSON.stringify(c.label)}, ` +
      `shape: ${JSON.stringify(c.shape)}, scope: ${JSON.stringify(c.scope)} },`,
  )
  .join('\n')

const out = `// AUTO-GENERATED from api/app/core/ordem_categories.json by \`npm run sync:categories\`.
// Do not edit by hand — edit the JSON (the single source of truth) and re-run.
import type { CategorySpec } from './ordem-item'

export const ORDEM_CATEGORIES = [
${entries}
] as const satisfies readonly CategorySpec[]
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(DST, 'utf8')
  } catch {
    /* missing file → out of sync */
  }
  if (current !== out) {
    console.error('OS catalog out of sync — run `npm run sync:categories`')
    process.exit(1)
  }
  console.log('OS catalog in sync')
} else {
  writeFileSync(DST, out)
  console.log('Generated', DST)
}
