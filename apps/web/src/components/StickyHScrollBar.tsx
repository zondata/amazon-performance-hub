'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type SyncSource = 'bar' | 'target' | null;

type BarFrame = {
  left: number;
  width: number;
};

const pickTarget = () => {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-aph-hscroll]'));
  for (const el of els) {
    const rect = el.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    if (visible && overflow) return el;
  }
  return els.find((el) => el.scrollWidth > el.clientWidth + 1) ?? null;
};

export default function StickyHScrollBar() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const fillerRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<SyncSource>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [barFrame, setBarFrame] = useState<BarFrame | null>(null);

  const measureTargetFrame = useCallback((active: HTMLElement | null) => {
    if (!active) {
      setBarFrame(null);
      return;
    }

    const rect = active.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    const width = Math.max(Math.min(rect.width, window.innerWidth - left), 0);
    if (width <= 0) {
      setBarFrame(null);
      return;
    }
    setBarFrame({ left, width });
  }, []);

  const syncDomFor = useCallback((active: HTMLElement | null) => {
    const bar = barRef.current;
    const filler = fillerRef.current;
    if (!active || !bar || !filler) return;

    filler.style.width = `${active.scrollWidth}px`;

    if (syncRef.current !== 'target') {
      syncRef.current = 'target';
      bar.scrollLeft = active.scrollLeft;
      requestAnimationFrame(() => {
        if (syncRef.current === 'target') syncRef.current = null;
      });
    }
  }, []);

  const refreshTarget = useCallback(() => {
    const next = pickTarget();
    setTarget((current) => (current === next ? current : next));
    measureTargetFrame(next);
    syncDomFor(next);
  }, [measureTargetFrame, syncDomFor]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      refreshTarget();
    });
    return () => cancelAnimationFrame(raf);
  }, [refreshTarget, pathname]);

  useEffect(() => {
    const onWindowScroll = () => refreshTarget();
    const onWindowResize = () => refreshTarget();
    const onSidebarToggle = () => refreshTarget();

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('aph:sidebar-toggle', onSidebarToggle as EventListener);

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('aph:sidebar-toggle', onSidebarToggle as EventListener);
    };
  }, [refreshTarget]);

  useEffect(() => {
    if (!target) return;
    const raf = requestAnimationFrame(() => {
      syncDomFor(target);
    });
    return () => cancelAnimationFrame(raf);
  }, [syncDomFor, target]);

  useEffect(() => {
    const active = target;
    if (!active) return;

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          measureTargetFrame(active);
          syncDomFor(active);
        });
    resizeObserver?.observe(active);

    const onTargetScroll = () => {
      const bar = barRef.current;
      if (!bar || syncRef.current === 'bar') return;
      syncRef.current = 'target';
      bar.scrollLeft = active.scrollLeft;
      requestAnimationFrame(() => {
        if (syncRef.current === 'target') syncRef.current = null;
      });
    };

    active.addEventListener('scroll', onTargetScroll, { passive: true });
    return () => {
      resizeObserver?.disconnect();
      active.removeEventListener('scroll', onTargetScroll);
    };
  }, [measureTargetFrame, syncDomFor, target]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const onBarScroll = () => {
      const active = target;
      if (!active || syncRef.current === 'target') return;
      syncRef.current = 'bar';
      active.scrollLeft = bar.scrollLeft;
      requestAnimationFrame(() => {
        if (syncRef.current === 'bar') syncRef.current = null;
      });
    };

    bar.addEventListener('scroll', onBarScroll, { passive: true });
    return () => bar.removeEventListener('scroll', onBarScroll);
  }, [target]);

  if (!target || !barFrame || target.scrollWidth <= target.clientWidth + 1) return null;

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="aph-sticky-xscroll"
      style={{
        position: 'fixed',
        bottom: 0,
        zIndex: 60,
        left: `${barFrame.left}px`,
        width: `${barFrame.width}px`,
      }}
    >
      <div ref={fillerRef} className="h-px" />
    </div>
  );
}
