import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductDisplay from './components/ProductDisplay/ProductDisplay';
import ProductDetail from './components/ProductDisplay/ProductDetail';
import CheckoutPage from './components/Checkout/CheckoutPage';

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
      </Routes>
    </Router>
  );
}

export default App;
