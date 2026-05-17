import { posterUrl } from '../lib/tmdb';

interface PosterCardProps {
  posterPath: string | null;
  title?: string;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
  showTitle?: boolean;
}

export default function PosterCard({ posterPath, title, onClick, className = '', aspectRatio = '2/3', showTitle = false }: PosterCardProps) {
  const url = posterUrl(posterPath);

  return (
    <div
      className={`poster-card ${className}`}
      style={{ aspectRatio }}
      onClick={onClick}
    >
      {url ? (
        <img
          src={url}
          alt={title || ''}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-grey-700">
          <span className="text-grey-400 text-xs text-center px-2">{title || 'No Image'}</span>
        </div>
      )}
      {showTitle && title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
          <p className="text-white text-xs font-medium truncate">{title}</p>
        </div>
      )}
    </div>
  );
}
