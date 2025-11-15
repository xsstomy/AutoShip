import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProductDisplay from "./components/ProductDisplay/ProductDisplay";
import ProductDetail from "./components/ProductDisplay/ProductDetail";
import CheckoutPage from "./components/Checkout/CheckoutPage";
import PaymentPage from "./components/Payment/PaymentPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProductManagement from "./pages/AdminProductManagement";
import AdminInventoryManagement from "./pages/AdminInventoryManagement";
import OrderAdmin from "./pages/admin/OrderAdmin";
import AdminRoute from "./components/AdminRoute";

/**
 * 主应用组件
 */
function App() {
    return (
        <Router>
            <Routes>
                {/* 用户端页面 - 不需要认证 */}
                <Route path="/" element={<ProductDisplay />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/payment/:orderId" element={<PaymentPage />} />
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />

                {/* 管理员相关页面 - 需要 AuthProvider */}
                <Route path="/admin/*" element={
                    <AuthProvider>
                        <Routes>
                            <Route path="login" element={<AdminLogin />} />
                            <Route
                                path="dashboard"
                                element={
                                    <AdminRoute>
                                        <AdminDashboard />
                                    </AdminRoute>
                                }
                            />
                            <Route
                                path="products"
                                element={
                                    <AdminRoute>
                                        <AdminProductManagement />
                                    </AdminRoute>
                                }
                            />
                            <Route
                                path="inventory"
                                element={
                                    <AdminRoute>
                                        <AdminInventoryManagement />
                                    </AdminRoute>
                                }
                            />
                            <Route
                                path="orders"
                                element={
                                    <AdminRoute>
                                        <OrderAdmin />
                                    </AdminRoute>
                                }
                            />
                        </Routes>
                    </AuthProvider>
                } />
            </Routes>
        </Router>
    );
}

export default App;
