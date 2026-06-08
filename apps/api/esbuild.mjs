import { build } from 'esbuild'

// Bundle the Hono app (and the raw-TS @qtscout/* workspace packages) into a
// single CommonJS file. @vercel/node only transpiles the function entry file
// by itself, so without this the local/workspace imports are not resolvable at
// runtime. CJS keeps Prisma's CommonJS interop straightforward.
//
// Truly-native deps stay external so Vercel's file tracer (nft) ships them and
// their binaries: Prisma's query engine and the serverless Chromium download.
await build({
  entryPoints: ['src/server-vercel.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: 'dist/index.cjs',
  external: [
    '@prisma/client',
    '.prisma/client',
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium-min',
  ],
  logLevel: 'info',
})
