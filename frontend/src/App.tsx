import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardsPage } from './pages/LeaderboardsPage';
import { AnalyticsDashboard } from './pages/analytics/AnalyticsDashboard';
import { MarketExplorer } from './pages/analytics/MarketExplorer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="market/:marketId" element={<MarketExplorer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
