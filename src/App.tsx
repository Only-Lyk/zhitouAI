import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import StockPage from './pages/StockPage';
import AIPage from './pages/AIPage';
import ChatPage from './pages/ChatPage';
import WatchlistPage from './pages/WatchlistPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stock/:code" element={<StockPage />} />
          <Route path="/ai" element={<AIPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
