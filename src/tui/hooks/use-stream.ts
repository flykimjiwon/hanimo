import { useState, useCallback, useRef, useEffect } from 'react';

interface UseStreamReturn {
  text: string;
  append: (chunk: string) => void;
  reset: () => void;
}

// 16ms batch flush — prevents re-render storm during fast streaming
// Buffer accumulates chunks, setState fires at ~60fps max
const FLUSH_INTERVAL_MS = 80;

export function useStream(): UseStreamReturn {
  const [text, setText] = useState('');
  const bufferRef = useRef('');
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (dirtyRef.current) {
        setText(bufferRef.current);
        dirtyRef.current = false;
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const append = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    dirtyRef.current = true;
  }, []);

  const reset = useCallback(() => {
    bufferRef.current = '';
    dirtyRef.current = false;
    setText('');
  }, []);

  return { text, append, reset };
}
