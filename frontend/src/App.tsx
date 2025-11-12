import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductDisplay from './components/ProductDisplay/ProductDisplay';
import ProductDetail from './components/ProductDisplay/ProductDetail';
import CheckoutPage from './components/Checkout/CheckoutPage';
import PaymentPage from './components/Payment/PaymentPage';

/**
 * 主应用组件
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* 商品列表页 */}
        <Route path="/" element={<ProductDisplay />} />
        {/* 商品详情页 */}
        <Route path="/product/:id" element={<ProductDetail />} />
        {/* 下单流程页 */}
        <Route path="/checkout" element={<CheckoutPage />} />
        {/* 支付页面 */}
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </Router>
  );
}

export default App;
