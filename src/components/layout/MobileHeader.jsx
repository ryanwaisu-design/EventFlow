import { useApp } from '../../context/AppContext';
import { NAV_ITEMS } from '../../data/constants';

export default function MobileHeader() {
  const { setSidebarOpen, currentPage, settings } = useApp();
  const page = NAV_ITEMS.find((n) => n.id === currentPage);

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-sidebar border-b border-border px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-2 rounded-lg hover:bg-card-hover text-primary"
        aria-label="開啟選單"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div>
        <p className="font-display font-semibold text-primary text-sm">{page?.label || 'EventFlow'}</p>
        <p className="text-xs text-muted">{settings.organizationName}</p>
      </div>
    </header>
  );
}
