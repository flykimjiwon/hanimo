import { useState, useCallback, useRef } from 'react';

interface UseStreamReturn {
  text: string;
  append: (chunk: string) => void;
  reset: () => void;
}

export function useStream(): UseStreamReturn {
  const [text, setText] = useState('');
  const bufferRef = useRef('');

  const append = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    setText(bufferRef.current);
  }, []);

  const reset = useCallback(() => {
    bufferRef.current = '';
    setText('');
  }, []);

  return { text, append, reset };
}
