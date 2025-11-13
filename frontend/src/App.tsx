import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductDisplay from './components/ProductDisplay/ProductDisplay';
import ProductDetail from './components/ProductDisplay/ProductDetail';
import CheckoutPage from './components/Checkout/CheckoutPage';
import PaymentPage from './components/Payment/PaymentPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProductManagement from './pages/AdminProductManagement';
import AdminInventoryManagement from './pages/AdminInventoryManagement';

/**
 * 主应用组件
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* 用户端页面 */}
        <Route path="/" element={<ProductDisplay />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />

        {/* 管理员页面 */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<AdminProductManagement />} />
        <Route path="/admin/inventory" element={<AdminInventoryManagement />} />
      </Routes>
    </Router>
  );
}

export default App;
