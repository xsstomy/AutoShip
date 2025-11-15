import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">AutoShip 管理后台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                欢迎, {admin?.username} ({admin?.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">商品管理</h3>
              <p className="text-gray-600 mb-4">管理商品信息和价格</p>
              <button
                onClick={() => navigate('/admin/products')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                进入管理
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">库存管理</h3>
              <p className="text-gray-600 mb-4">管理卡密和文本库存</p>
              <button
                onClick={() => navigate('/admin/inventory')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                进入管理
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">订单管理</h3>
              <p className="text-gray-600 mb-4">查看和管理订单</p>
              <button
                onClick={() => navigate('/admin/orders')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                进入管理
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
