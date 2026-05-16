import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 14, md: 18, lg: 24 };

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const px = SIZE_MAP[size];
  const display = hover || value;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled     = display >= star;
        const halfFilled = display >= star - 0.5 && display < star;
        return (
          <button
            key={star}
            type="button"
            className="star-btn"
            disabled={readonly}
            onMouseMove={(e) => {
              if (readonly) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(e.clientX - rect.left < rect.width / 2 ? star - 0.5 : star);
            }}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={(e) => {
              if (readonly || !onChange) return;
              const rect = e.currentTarget.getBoundingClientRect();
              onChange(e.clientX - rect.left < rect.width / 2 ? star - 0.5 : star);
            }}
          >
            <div style={{ position: 'relative', width: px, height: px }}>
              <Star size={px} style={{ color: '#3a3a3a', position: 'absolute', inset: 0 }} fill="currentColor" />
              {(filled || halfFilled) && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: halfFilled ? '50%' : '100%' }}>
                  <Star size={px} style={{ color: '#fbbf24', position: 'absolute', inset: 0 }} fill="currentColor" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
