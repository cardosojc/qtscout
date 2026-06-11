/**
 * Regenerates docs/ordem-categories.md from the ORDEM_CATEGORIES catalog and
 * the case bodies of ordem-assembler.ts. Run with `npm run docs:sync`.
 *
 * Use `--check` to fail with exit 1 when the generated file would change
 * (CI / pre-commit). Use without flags to write the new file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORDEM_CATEGORIES } from '@qtscout/types/ordem-item'

const __filename = fileURLToPath(import.meta.url)
const REPO = path.resolve(path.dirname(__filename), '..')
const ASSEMBLER_PATH = path.join(REPO, 'api/app/core/ordem_assembler.py')
const OUTPUT_PATH = path.join(REPO, 'docs/ordem-categories.md')

/**
 * Parse `if/elif category == "KEY":` branches out of the Python assembler and
 * collect every `data[...]` access in the (more-indented) branch body.
 */
function parseAssemblerMapping(): Map<string, string[]> {
  const src = fs.readFileSync(ASSEMBLER_PATH, 'utf8')
  const lines = src.split('\n')
  const map = new Map<string, string[]>()
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:el)?if category == "([A-Z_]+)":\s*$/)
    if (!m) continue
    const indent = m[1].length
    const key = m[2]
    const targets = new Set<string>()
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (line.trim() === '') continue
      const lineIndent = line.match(/^(\s*)/)![1].length
      if (lineIndent <= indent) break // dedent → next branch / end of the loop
      for (const match of line.matchAll(/\bdata(?:\[(?:"[^"]+"|[a-zA-Z_]\w*)\])+/g)) {
        targets.add(match[0])
      }
    }
    map.set(key, [...targets])
  }
  return map
}

function render(): string {
  const mapping = parseAssemblerMapping()
  const lines: string[] = []
  lines.push('# Ordem de Serviço — category catalog')
  lines.push('')
  lines.push(
    'Generated from `api/app/core/ordem_categories.json` and ' +
      '`api/app/core/ordem_assembler.py`.',
  )
  lines.push('Do not edit by hand — run `npm run docs:sync`.')
  lines.push('')
  lines.push('| Category | Shape | Scope | Snapshot bucket |')
  lines.push('|---|---|---|---|')
  for (const cat of ORDEM_CATEGORIES) {
    const buckets = mapping.get(cat.key) ?? []
    const bucket = buckets.length === 0 ? '—' : buckets.map((b) => `\`${b}\``).join(' / ')
    lines.push(`| \`${cat.key}\` | ${cat.shape} | ${cat.scope} | ${bucket} |`)
  }
  lines.push('')
  lines.push('Also folded in at generation time (not a manual category):')
  lines.push('')
  lines.push(
    '- `Scout.joinedAt in OS period` → `data["efetivo"]["admissao"][section]` ' +
      '(see `api/app/routers/ordens_servico.py`)',
  )
  lines.push('')
  lines.push('## Unmapped categories')
  lines.push('')
  const unmapped = ORDEM_CATEGORIES.filter((c) => !mapping.has(c.key))
  if (unmapped.length === 0) {
    lines.push('_None — every catalog entry has at least one branch in the assembler._')
  } else {
    for (const c of unmapped) {
      lines.push(`- \`${c.key}\` has no branch in \`ordem_assembler.py\``)
    }
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  const generated = render()
  const isCheck = process.argv.includes('--check')

  let existing = ''
  try {
    existing = fs.readFileSync(OUTPUT_PATH, 'utf8')
  } catch {
    // file may not exist yet
  }

  if (existing === generated) {
    if (!isCheck) process.stdout.write(`${OUTPUT_PATH} is up to date.\n`)
    return
  }

  if (isCheck) {
    process.stderr.write(
      `${OUTPUT_PATH} is out of date. Run \`npm run docs:sync\` and commit.\n`,
    )
    process.exit(1)
  }

  fs.writeFileSync(OUTPUT_PATH, generated)
  process.stdout.write(`${OUTPUT_PATH} updated.\n`)
}

main()
