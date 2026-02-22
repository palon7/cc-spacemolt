const RAW_LOGO = `
                                                         _ _
   ___ ___      ___ _ __   __ _  ___ ___ _ __ ___   ___ | | |_
  / __/ __|____/ __| '_ \\ / _\` |/ __/ _ \\ '_ \` _ \\ / _ \\| | __|
 | (_| (_|_____\\__ \\ |_) | (_| | (_|  __/ | | | | | (_) | | |_
  \\___\\___|    |___/ .__/ \\__,_|\\___\\___|_| |_| |_|\\___/|_|\\__|
                   |_|`;

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Apply a diagonal gradient to ASCII art text.
// startHex and endHex are hex color strings (e.g. '#00C8FF').
export function applyGradient(text: string, startHex: string, endHex: string): string {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map((l) => l.length));
  const height = lines.length;

  return lines
    .map((line, y) => {
      const colored = line
        .split('')
        .map((char, x) => {
          if (char === ' ') return char;
          const t = Math.min(1, (x / maxWidth) * 0.6 + (y / height) * 0.4);
          const r = Math.round(start.r + (end.r - start.r) * t);
          const g = Math.round(start.g + (end.g - start.g) * t);
          const b = Math.round(start.b + (end.b - start.b) * t);
          return `\x1b[38;2;${r};${g};${b}m${char}`;
        })
        .join('');
      return colored + '\x1b[0m';
    })
    .join('\n');
}

// Default: cyan → purple (space theme)
export const bigLogoText = applyGradient(RAW_LOGO, '#00C8FF', '#9000FF');
