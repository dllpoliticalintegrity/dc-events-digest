// @ts-expect-error — yaml plugin transforms the import to JSON at build time
import sources from '../../scripts/sources.yaml'

export type SourceMeta = {
  key: string
  name: string
  url: string
  schedule: string
  module: string
  enabled: boolean
}

export const SOURCES: SourceMeta[] = (sources as SourceMeta[]).filter(s => s.enabled)
