'use client';

type SidebarCollapseToggleProps = {
  className?: string;
};

export default function SidebarCollapseToggle({ className }: SidebarCollapseToggleProps) {
  const toggleSidebar = () => {
    const root = document.documentElement;
    const current = root.dataset.sidebar === 'collapsed' ? 'collapsed' : 'expanded';
    const next = current === 'collapsed' ? 'expanded' : 'collapsed';
    root.dataset.sidebar = next;
    localStorage.setItem('aph.sidebarCollapsed', next === 'collapsed' ? '1' : '0');
    window.dispatchEvent(new CustomEvent('aph:sidebar-toggle'));
  };

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title="Toggle sidebar"
      aria-label="Toggle sidebar"
      className={`flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${className ?? ''}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="aph-sidebar-toggle-icon h-4 w-4 transition-transform"
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
    </button>
  );
}
