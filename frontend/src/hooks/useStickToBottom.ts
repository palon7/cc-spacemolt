import { useRef, useState, useCallback } from 'react';

const THRESHOLD = 48;

export function useStickToBottom() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStuckRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const checkBottom = useCallback(() => {
    // Skip scroll events caused by programmatic scrolling to prevent
    // race condition where checkBottom incorrectly sets isStuckRef = false
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const atBot = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
    isStuckRef.current = atBot;
    setIsAtBottom(atBot);
    if (atBot) setNewCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
    isStuckRef.current = true;
    setIsAtBottom(true);
    setNewCount(0);
  }, []);

  const onContentGrew = useCallback((messageCount: number) => {
    const el = scrollRef.current;
    if (!el) return;
    if (isStuckRef.current) {
      isProgrammaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (messageCount > 0) {
      setNewCount((c) => c + messageCount);
    }
  }, []);

  return { scrollRef, isAtBottom, newCount, checkBottom, scrollToBottom, onContentGrew };
}
