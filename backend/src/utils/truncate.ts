export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function truncateLines(
  text: string,
  maxLines: number,
): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { text, truncated: false };
  return { text: lines.slice(0, maxLines).join('\n'), truncated: true };
}
