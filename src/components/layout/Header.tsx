import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="border-b border-gray-300 mb-4 pb-2 flex items-baseline justify-between">
      <Link to="/" className="font-serif text-2xl font-bold text-ink">DC Events Digest</Link>
      <Link to="/about" className="font-mono text-xs text-muted hover:text-ink">[About]</Link>
    </header>
  )
}
