import { useApp } from './context/AppContext';
import Sidebar from './components/layout/Sidebar';
import MobileHeader from './components/layout/MobileHeader';
import ToastContainer from './components/ui/ToastContainer';
import Dashboard from './pages/Dashboard';
import Guests from './pages/Guests';
import Events from './pages/Events';
import Invitations from './pages/Invitations';
import Seating from './pages/Seating';
import CheckIn from './pages/CheckIn';
import Recognition from './pages/Recognition';
import ExportCenter from './pages/ExportCenter';
import Settings from './pages/Settings';

const PAGES = {
  dashboard: Dashboard,
  guests: Guests,
  events: Events,
  invitations: Invitations,
  seating: Seating,
  checkin: CheckIn,
  recognition: Recognition,
  export: ExportCenter,
  settings: Settings,
};

export default function App() {
  const { currentPage, toasts } = useApp();
  const Page = PAGES[currentPage] || Dashboard;

  return (
    <div className="min-h-screen bg-bg text-primary">
      <Sidebar />
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <MobileHeader />
        <main className="flex-1">
          <Page />
        </main>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
