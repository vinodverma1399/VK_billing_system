import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Invoices from './pages/Invoices'
import CreateInvoice from './pages/CreateInvoice'
import EditInvoice from './pages/EditInvoice'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import StockEntry from './pages/StockEntry'
import Reports from './pages/Reports'
import Returns from './pages/Returns'
import Expenses from './pages/Expenses'
import ProfileSettings from './pages/ProfileSettings'
import Staff from './pages/Staff'
import AuditLog from './pages/AuditLog'

const Layout = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  // Read synchronously — no useEffect delay, sidebar renders correctly on first paint
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('userInfo') || 'null'); }
    catch { return null; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    window.location.href = '/login';
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊', adminOnly: true },
    { name: 'Invoices', path: '/invoices', icon: '🧾' },
    { name: 'Inventory', path: '/products', icon: '📦' },
    { name: 'Customers', path: '/customers', icon: '👥' },
    { name: 'Vendors', path: '/vendors', icon: '🏢', adminOnly: true },
    { name: 'Stock Entry', path: '/purchases', icon: '📥' },
    { name: 'Returns', path: '/returns', icon: '↩️' },
    { name: 'Expenses', path: '/expenses', icon: '💸', adminOnly: true },
    { name: 'Reports', path: '/reports', icon: '📈', adminOnly: true },
    { name: 'Staff', path: '/staff', icon: '👨‍💼', adminOnly: true },
    { name: 'Audit Log', path: '/audit', icon: '🕵️‍♂️', adminOnly: true },
    { name: 'Shop Profile', path: '/profile', icon: '⚙️' },
  ].filter(item => {
    if (user?.role === 'Staff' && item.adminOnly) return false;
    return true;
  });

  if (isAuthPage) return <div className="min-h-screen bg-background">{children}</div>;

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex font-sans relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full mix-blend-multiply filter blur-[120px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-primary/95 backdrop-blur-md z-50 px-4 py-3 flex justify-between items-center shadow-lg border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="font-black text-white text-xs">VK</span>
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">VK BILLING</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white p-2 focus:outline-none"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Floating Glass Sidebar */}
      <aside className={`w-72 bg-primary/95 backdrop-blur-3xl border-r border-white/10 text-white flex flex-col fixed h-[calc(100vh-2rem)] m-4 rounded-[2.5rem] z-50 shadow-2xl shadow-blue-900/20 transition-all duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0'} top-16 lg:top-0 h-[calc(100vh-6rem)] lg:h-[calc(100vh-2rem)]`}>
        <div className="p-8 pb-4 hidden lg:block">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-blue-500/30 flex items-center justify-center">
              <span className="font-black text-white text-lg">VK</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">VK BILLING</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-blue-400 font-black">Enterprise</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white font-medium'
                  }`}
              >
                {isActive && <div className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"></div>}
                <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                <span className="text-sm tracking-wide">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-5 border-t border-white/10 mt-auto">
          {user && (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-600 flex items-center justify-center font-black text-xl text-white shadow-inner">
                  {user.name[0]}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-black text-white truncate">{user.name}</p>
                  <p className="text-[10px] font-medium text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10"
              >
                Secure Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[21rem] w-full p-4 lg:p-8 min-h-screen relative z-10 pt-24 lg:pt-8 transition-all duration-300">
        <div className="max-w-6xl mx-auto animate-slide-up pb-20">
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? children : <Navigate to="/login" />;
};

// Blocks Staff from Admin-only pages
const AdminRoute = ({ children }) => {
  try {
    const user = JSON.parse(localStorage.getItem('userInfo') || 'null');
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'Staff') return <Navigate to="/invoices" replace />;
    return children;
  } catch { return <Navigate to="/login" />; }
};

const RootRedirect = () => {
  const userInfo = localStorage.getItem('userInfo');
  if (!userInfo) return <Navigate to="/login" />;
  try {
    const user = JSON.parse(userInfo);
    if (user.role === 'Staff') return <Navigate to="/invoices" />;
  } catch (e) {}
  return <Navigate to="/dashboard" />;
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
          <Route path="/invoices/:id/edit" element={<ProtectedRoute><EditInvoice /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><StockEntry /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
          <Route path="/staff" element={<AdminRoute><Staff /></AdminRoute>} />
          <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
