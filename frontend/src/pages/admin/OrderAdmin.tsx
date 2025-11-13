import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { OrderFilters } from '../../components/OrderAdmin/OrderFilters';
import { OrderList } from '../../components/OrderAdmin/OrderList';
import { OrderDetail } from '../../components/OrderAdmin/OrderDetail';
import { ConfirmDialog } from '../../components/OrderAdmin/ConfirmDialog';
import { orderAdminApi } from '../../services/orderAdminApi';
import type { Order, OrderFilters as OrderFiltersType, FilterOptions } from '../../types/orderAdmin';

export function OrderAdmin() {
  const { admin, token } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState<OrderFiltersType>({
    page: 1,
    limit: 20,
    status: '',
    gateway: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'resend' | 'refund' | null;
    order: Order | null;
  }>({
    isOpen: false,
    type: null,
    order: null,
  });

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
      return;
    }
  }, [admin, navigate]);

  // 加载订单列表
  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await orderAdminApi.getOrders(filters);
      setOrders(response.orders);
      setPagination(response.pagination);
    } catch (error) {
      console.error('加载订单列表失败:', error);
      alert('加载订单列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载筛选选项
  const loadFilterOptions = async () => {
    try {
      const options = await orderAdminApi.getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [filters]);

  // 应用筛选
  const handleApplyFilters = (newFilters: Partial<OrderFiltersType>) => {
    setFilters({ ...filters, ...newFilters, page: 1 });
  };

  // 重置筛选
  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      status: '',
      gateway: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  // 分页
  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
  };

  // 打开确认对话框
  const handleOpenConfirm = (type: 'resend' | 'refund', order: Order) => {
    setConfirmDialog({ isOpen: true, type, order });
  };

  // 关闭确认对话框
  const handleCloseConfirm = () => {
    setConfirmDialog({ isOpen: false, type: null, order: null });
  };

  // 执行邮件重发
  const handleResendEmail = async () => {
    if (!confirmDialog.order) return;

    try {
      await orderAdminApi.resendEmail(confirmDialog.order.id);
      alert('邮件重发成功');
      handleCloseConfirm();
      loadOrders();
    } catch (error) {
      console.error('邮件重发失败:', error);
      alert('邮件重发失败，请重试');
    }
  };

  // 执行退款
  const handleRefund = async (reason?: string) => {
    if (!confirmDialog.order) return;

    try {
      const refundReason = reason || '管理员手动退款';
      await orderAdminApi.refundOrder(confirmDialog.order.id, refundReason);
      alert('退款操作成功');
      handleCloseConfirm();
      loadOrders();
    } catch (error) {
      console.error('退款失败:', error);
      alert('退款失败，请重试');
    }
  };

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="text-blue-600 hover:text-blue-800 mr-4"
              >
                ← 返回
              </button>
              <h1 className="text-xl font-semibold">订单管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {admin.username}
              </span>
              <button
                onClick={() => navigate('/admin/login')}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 text-sm"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">订单管理</h1>
            <p className="mt-2 text-gray-600">查看、筛选和管理所有订单</p>
          </div>

          {/* 筛选器 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <OrderFilters
              filters={filters}
              filterOptions={filterOptions}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
              onSearch={(search) => handleApplyFilters({ search })}
            />
          </div>

          {/* 订单列表 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                订单列表 ({pagination.total} 条记录)
              </h2>
              <button
                onClick={loadOrders}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                刷新
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-gray-500">加载中...</div>
              </div>
            ) : (
              <OrderList
                orders={orders}
                pagination={pagination}
                onPageChange={handlePageChange}
                onViewDetails={(order) => setSelectedOrder(order)}
                onResendEmail={(order) => handleOpenConfirm('resend', order)}
                onRefund={(order) => handleOpenConfirm('refund', order)}
              />
            )}
          </div>
        </div>
      </main>

      {/* 订单详情模态框 */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <OrderDetail
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
            />
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog.isOpen && (
        <ConfirmDialog
          type={confirmDialog.type!}
          order={confirmDialog.order!}
          onConfirm={confirmDialog.type === 'resend' ? handleResendEmail : handleRefund}
          onCancel={handleCloseConfirm}
        />
      )}
    </div>
  );
}

export default OrderAdmin;
