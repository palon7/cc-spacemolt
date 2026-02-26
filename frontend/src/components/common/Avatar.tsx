import { useState, useEffect } from 'react';

interface AvatarProps {
  /** URL of the avatar image. Falls back to initial circle when undefined or on load error. */
  url?: string;
  /** Fallback letter shown in the circle when no image is available. */
  initial: string;
  /** Tailwind gradient classes for the fallback circle (e.g. "from-orange-400 to-amber-600"). */
  gradientClasses: string;
}

export function Avatar({ url, initial, gradientClasses }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [url]);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt=""
        className="w-3 h-3 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`w-3 h-3 rounded-full bg-gradient-to-br ${gradientClasses} flex items-center justify-center shrink-0`}
    >
      <span className="text-2xs font-bold text-white">{initial}</span>
    </div>
  );
}
