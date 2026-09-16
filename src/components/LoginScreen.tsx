import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, ShieldCheck } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  onBackToIntro?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin(username || 'Inspector');
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen w-full bg-[#f7f9fc] flex flex-col items-center justify-center p-4 font-poppins relative">
      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px] bg-white rounded-[22px] p-7 sm:p-9 shadow-[0_10px_30px_rgba(149,157,165,0.15)] border border-slate-100"
      >
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-[#1a1d20] text-2xl sm:text-[26px] font-semibold tracking-tight">
            Welcome Back
          </h2>
          <p className="text-[#8c93a0] text-sm mt-1">
            Log in to your account
          </p>
        </div>

        <form id="loginForm" onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#4a5568] mb-2">
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="off"
                className="w-full h-[52px] px-4 pl-11 rounded-xl border-[1.5px] border-[#e2e8f0] text-[15px] text-[#1a202c] bg-[#f8fafc] focus:bg-white focus:border-[#4f46e5] focus:ring-3 focus:ring-indigo-500/15 outline-none transition-all"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#4a5568] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full h-[52px] px-4 pl-11 rounded-xl border-[1.5px] border-[#e2e8f0] text-[15px] text-[#1a202c] bg-[#f8fafc] focus:bg-white focus:border-[#4f46e5] focus:ring-3 focus:ring-indigo-500/15 outline-none transition-all"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => onLogin('Quick Access User')}
              className="text-xs sm:text-sm font-medium text-[#4f46e5] hover:text-[#4338ca] hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="w-full h-[52px] bg-[#4f46e5] hover:bg-[#4338ca] text-white text-base font-semibold rounded-xl shadow-[0_4px_14px_rgba(79,70,229,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Log In</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Secure offline-capable inspection portal by <span className="font-medium text-slate-600">Erudites</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
