import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProductList } from './pages/ProductList';
import { ProductDetail } from './pages/ProductDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1 className="logo">PromoAtlas</h1>
            <nav className="main-nav">
              <a href="https://promovere-atlas-pim.vercel.app/" className="nav-link">Products</a>
            </nav>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/products" replace />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/:id" element={<ProductDetail />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <p>&copy; 2025 PromoAtlas PIM. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
