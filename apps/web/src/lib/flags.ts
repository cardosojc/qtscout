import { getCloudflareContext } from '@opennextjs/cloudflare'

// Hand-declared rather than generated via `wrangler types --include-runtime`:
// that flag also redeclares global Body/Response/Request to match the Workers
// runtime, which collides with Next.js's DOM lib types and breaks `res.json()`
// inference (defaults to `unknown`) project-wide. This is the only binding
// method this app actually calls, so it's cheaper to hand-type it.
declare global {
  interface CloudflareEnv {
    FLAGS?: {
      getBooleanValue(
        flagKey: string,
        defaultValue: boolean,
        context?: Record<string, string | number | boolean>
      ): Promise<boolean>
    }
  }
}

export type FeatureFlags = { oficio: boolean; circular: boolean; ordem: boolean }

const DEFAULTS: FeatureFlags = { oficio: true, circular: true, ordem: true }

// Reads flags from the Cloudflare Flagship binding (edge-native, no HTTP round-trip).
// Fails open (all enabled) if the binding is unavailable or evaluation errors.
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const flags = env.FLAGS
    if (!flags) return DEFAULTS

    const [oficio, circular, ordem] = await Promise.all([
      flags.getBooleanValue('oficio-enabled', true),
      flags.getBooleanValue('circular-enabled', true),
      flags.getBooleanValue('ordem-servico-enabled', true),
    ])
    return { oficio, circular, ordem }
  } catch {
    return DEFAULTS
  }
}
