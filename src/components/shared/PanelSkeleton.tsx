export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-1" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 animate-pulse rounded bg-[#252528]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg bg-[#252528]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div
      className="flex h-full items-center gap-3 overflow-hidden px-4"
      aria-busy="true"
      aria-label="Loading timeline"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[72px] w-36 shrink-0 animate-pulse rounded-lg bg-[#252528]"
        />
      ))}
    </div>
  );
}
