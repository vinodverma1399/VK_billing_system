import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../utils/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login', 'forgot', 'reset'
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem('userInfo', JSON.stringify(data));
      // Navigate based on role immediately — no render delay
      if (data.role === 'Staff') {
        navigate('/invoices');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter your email address');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await axios.post(`${API}/auth/forgot-password`, { email });
      setSuccessMsg(data.message);
      setMode('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) return setError('Please enter OTP and new password');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await axios.post(`${API}/auth/reset-password`, { email, otp, newPassword });
      setSuccessMsg(data.message);
      setMode('login');
      setPassword('');
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full overflow-hidden bg-gray-50 absolute inset-0 z-50">
      
      {/* Left Panel - Branding & Animation */}
      <div className="hidden lg:flex w-[45%] bg-primary relative flex-col justify-center items-center overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Abstract Shapes */}
        <div className="absolute w-full h-full opacity-10">
          <svg className="absolute top-20 left-20" width="100" height="100" viewBox="0 0 100 100" fill="none">
            <rect x="20" y="20" width="60" height="60" stroke="white" strokeWidth="4" transform="rotate(45 50 50)"/>
          </svg>
          <svg className="absolute bottom-40 right-20" width="120" height="120" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="4" strokeDasharray="10 10"/>
          </svg>
        </div>

        <div className="relative z-10 text-center px-12 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-500 to-purple-500 mb-8 shadow-2xl shadow-blue-500/30">
            <span className="text-white text-3xl font-black">VK</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-6 tracking-tight leading-tight">
            Enterprise <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Billing Platform</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-sm mx-auto font-medium">
            Manage your inventory, generate GST invoices, and track your cashflow in real-time.
          </p>
          
          <div className="mt-16 p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-4 mb-4">
               <div className="flex -space-x-4">
                  <img className="w-10 h-10 rounded-full border-2 border-primary" src="https://i.pravatar.cc/100?img=33" alt="user" />
                  <img className="w-10 h-10 rounded-full border-2 border-primary" src="https://i.pravatar.cc/100?img=47" alt="user" />
                  <img className="w-10 h-10 rounded-full border-2 border-primary" src="https://i.pravatar.cc/100?img=12" alt="user" />
               </div>
               <p className="text-white font-bold text-sm">Trusted by 10k+<br/><span className="text-gray-400 font-normal">retail stores</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white/50 backdrop-blur-2xl">
        <div className="w-full max-w-md animate-slide-up">
          
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 mb-4 shadow-xl">
              <span className="text-white text-2xl font-black">VK</span>
            </div>
            <h1 className="text-3xl font-black text-gray-900">Welcome Back</h1>
          </div>

          <div className="hidden lg:block mb-10">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
              {mode === 'login' ? 'Sign In' : mode === 'forgot' ? 'Reset Password' : 'Enter OTP'}
            </h2>
            <p className="text-gray-500 font-medium mt-2">
              {mode === 'login' ? 'Securely access your business dashboard.' : 
               mode === 'forgot' ? 'Enter your email to receive a password reset OTP.' : 
               'Enter the 6-digit OTP sent to your email.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-red-100 flex items-center gap-3 animate-shake">
              <span className="text-xl">⚠️</span> {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-emerald-100 flex items-center gap-3">
              <span className="text-xl">✅</span> {successMsg}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2 relative group">
                <div className="flex justify-between items-end ml-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Password</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition">Forgot?</button>
                </div>
                <input
                  type="password"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gray-900 text-white font-black py-4 rounded-2xl hover:shadow-2xl hover:shadow-gray-900/20 active:scale-95 transition-all disabled:opacity-70 mt-4"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                  {!loading && <span className="group-hover:translate-x-1 transition-transform">→</span>}
                </span>
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2 relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gray-900 text-white font-black py-4 rounded-2xl hover:shadow-2xl hover:shadow-gray-900/20 active:scale-95 transition-all disabled:opacity-70 mt-4"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? 'Sending OTP...' : 'Send Reset OTP'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                className="w-full text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                ← Back to Login
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2 relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">6-Digit OTP</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-900 tracking-widest text-center"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="------"
                  maxLength="6"
                  required
                />
              </div>
              <div className="space-y-2 relative group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">New Password</label>
                <input
                  type="password"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-900"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-emerald-600 text-white font-black py-4 rounded-2xl hover:shadow-2xl hover:shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-70 mt-4"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? 'Resetting...' : 'Set New Password'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                className="w-full text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                ← Cancel
              </button>
            </form>
          )}

          <p className="mt-10 text-center text-sm font-medium text-gray-500">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-blue-600 font-bold hover:text-purple-600 transition-colors">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
