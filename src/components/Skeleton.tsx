export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded ${className}`} />;
}

export function PosterSkeleton() {
  return <div className="shimmer rounded-lg" style={{ aspectRatio: '2/3' }} />;
}
