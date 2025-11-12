import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductDisplay from './components/ProductDisplay/ProductDisplay';
import ProductDetail from './components/ProductDisplay/ProductDetail';

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
      </Routes>
    </Router>
  );
}

export default App;
