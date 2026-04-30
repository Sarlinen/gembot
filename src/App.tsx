import { useStore } from './store';
import { Header } from './components/Header';
import { TradeUrlInput } from './components/TradeUrlInput';
import { CategorySelector } from './components/CategorySelector';
import { TradingPanel } from './components/TradingPanel';
import { TradeResultModal } from './components/TradeResultModal';
import { Footer } from './components/Footer';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { HowToTrade } from './components/HowToTrade';
import { ServerErrorBanner, useAppBootstrap } from './modules/app';

export default function App() {
  const { showAdmin, isAdminLoggedIn } = useStore();
  const { checking, serverError, retryServerConnection } = useAppBootstrap();

  if (showAdmin && !isAdminLoggedIn) {
    return <AdminLogin />;
  }

  if (showAdmin && isAdminLoggedIn) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ServerErrorBanner
        checking={checking}
        serverError={serverError}
        onRetry={retryServerConnection}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-6">
        <TradeUrlInput />
        <HowToTrade />
        <CategorySelector />
        <TradingPanel />
        <TradeResultModal />
      </main>
      <Footer />
    </div>
  );
}
