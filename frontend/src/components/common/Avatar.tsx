import { useState, useEffect } from 'react';

interface AvatarProps {
  // URL of the avatar image. Falls back to initial circle when undefined or on load error.
  url?: string;
  // Fallback letter shown in the circle when no image is available.
  initial: string;
  // Tailwind gradient classes for the fallback circle
  gradientClasses: string;
  // Size of the avatar
  size?: number;
}

export function Avatar({ url, initial, gradientClasses, size = 16 }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeStyle = { width: `${size}px`, height: `${size}px` };

  useEffect(() => {
    setImgError(url ? false : true);
  }, [url]);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={sizeStyle}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${gradientClasses} flex items-center justify-center shrink-0`}
      style={sizeStyle}
    >
      <span className="text-2xs font-bold text-white">{initial}</span>
    </div>
  );
}
