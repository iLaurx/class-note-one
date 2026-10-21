import { useEffect, useRef, useState } from 'react';
import bee from './bee-tulip.png';
import fox from './sleeping-fox.png';

/** Decorations use existing blank space and never participate in the page layout. */
export function PanelDecoration({ section }: { section: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const main = layer.current?.parentElement;
    if (!main) return;
    let frame = 0;
    const measure = () => {
      const bounds = main.getBoundingClientRect();
      const register = main.querySelector<HTMLElement>('.student-register');
      const children = Array.from(main.children).filter((child) => child !== layer.current);
      const anchor = register ?? children.at(-1);
      if (!anchor || window.innerWidth < 1100) {
        setPosition(null);
        return;
      }
      resize.observe(anchor);
      const rect = anchor.getBoundingClientRect();
      const width = 190;
      const height = 145;
      const top = rect.bottom + 20;
      const right = register ? rect.right : bounds.right - 32;
      const left = register ? rect.left + (rect.width - width) / 2 : right - width;
      const bottom = Math.min(bounds.bottom, window.innerHeight) - 24;
      const fits = top + height <= bottom && left >= bounds.left + 24;
      setPosition(fits ? { left: left - bounds.left, top: top - bounds.top } : null);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(main);
    const mutations = new MutationObserver(schedule);
    mutations.observe(main, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [section]);

  return (
    <div className="panel-decoration-layer" ref={layer} aria-hidden="true">
      {position && (
        <img
          className="panel-decoration"
          src={['students', 'assignments', 'attendance'].includes(section) ? bee : fox}
          alt=""
          width="190"
          height="145"
          style={position}
          draggable={false}
        />
      )}
    </div>
  );
}
