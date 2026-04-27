export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block border-4 border-stamp text-stamp font-mono text-2xl tracking-widest px-6 py-3 -rotate-3">
        {message}
      </div>
      {hint && <div className="font-mono text-xs text-muted mt-4">{hint}</div>}
    </div>
  )
}
