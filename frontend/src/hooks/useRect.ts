import { useEffect, useState } from "react";

export interface Rect { x: number; y: number; width: number; height: number; }

export function useRect<T extends HTMLElement>(ref: React.RefObject<T>) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    });
    ro.observe(el);

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [ref]);

  return rect;
}
