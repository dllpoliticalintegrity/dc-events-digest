import { Header } from '@/components/layout/Header'
import { Link } from 'react-router-dom'
import { SOURCES } from '@/lib/sources'

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Header />
      <Link to="/" className="font-mono text-xs underline">← back</Link>
      <h1 className="font-serif text-3xl font-bold text-ink mt-4">About</h1>
      <p className="font-serif text-base mt-3 leading-relaxed">
        DC Events Digest is a curated weekly calendar of things happening in DC — civic, community, cultural.
        Events are pulled daily from local sources, filtered for quality, and shown in a single weekly view.
      </p>
      <h2 className="font-serif text-xl font-semibold mt-6">Sources</h2>
      <ul className="font-mono text-sm mt-2 space-y-1">
        {SOURCES.map(s => (
          <li key={s.key}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
