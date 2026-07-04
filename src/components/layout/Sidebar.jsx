import { NAV_ITEMS } from '../../data/constants';
import { useApp } from '../../context/AppContext';

export default function Sidebar() {
  const { currentPage, navigate, sidebarOpen, setSidebarOpen, settings } = useApp();

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-border shadow-sm z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-display font-bold text-lg">EF</div>
            <div>
              <h1 className="font-display font-bold text-primary text-lg leading-tight">{settings.systemName || 'EventFlow'}</h1>
              <p className="text-xs text-muted">公關活動管理系統</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-1 ${
                currentPage === item.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-secondary hover:bg-card-hover hover:text-primary'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-muted">{settings.organizationName}</p>
        </div>
      </aside>
    </>
  );
}
