import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardsPage } from './pages/LeaderboardsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
