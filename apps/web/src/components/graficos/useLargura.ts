import { useEffect, useRef, useState } from 'react';

/** Largura do elemento em pixels (o gráfico se redesenha ao redimensionar). */
export function useLargura(padrao = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => {
      if (e) setLargura(Math.max(280, Math.floor(e.contentRect.width)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}
