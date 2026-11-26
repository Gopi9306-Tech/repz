import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  User,
  Users2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export const LoginPage: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    loginWithUsername,
    requestPasswordReset,
    authError,
    clearAuthError,
    isConfigured,
    classProfile,
    simulateRepLogin,
  } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Form State
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('repz_remembered_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(localStorage.getItem('repz_remembered_username'));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // If already authenticated, redirect to Dashboard
  if (isAuthenticated && !isLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    clearAuthError();

    if (!username.trim()) {
      setActionError('Please enter your representative username.');
      return;
    }

    if (!password) {
      setActionError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithUsername(username.trim(), password, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid representative username or password.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (repUsername: string) => {
    setActionError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await simulateRepLogin(repUsername);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authorization check failed.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (!recoveryInput.trim()) {
      setRecoveryError('Please enter your representative username or email.');
      return;
    }

    setIsSendingRecovery(true);
    try {
      const res = await requestPasswordReset(recoveryInput.trim());
      setRecoverySuccess(
        `A password recovery link has been dispatched to your registered email (${res.maskedEmail}). Please check your inbox to reset your password.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send password recovery email.';
      setRecoveryError(msg);
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const authorizedReps = classProfile.representatives;

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#F3F6FA] px-4 py-8 text-slate-900 dark:bg-[#0B111A] dark:text-slate-100">
      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:text-[#0878D1] dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-300 cursor-pointer"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </button>

      <div className="mx-auto w-full max-w-md animate-page-in">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0878D1] text-white shadow-md shadow-[#0878D1]/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Repz
            </h1>
            <Badge variant="primary">Class Rep Portal</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Assigned Class Attendance Management System
          </p>
        </div>

        {/* Login Surface Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-[#111B27]">
          {/* Error Banner */}
          {(actionError || authError) && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-semibold">Authentication Notice</p>
                <p className="mt-0.5 leading-relaxed">{actionError || authError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4.5">
            {/* 1. Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Representative Username
              </label>
              <div className="relative mt-1.5 flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aarav.rep or priya.rep"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 py-2.5 pr-3 pl-10 text-sm text-slate-900 transition-all focus:border-[#0878D1] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-[#172434]/60 dark:text-white dark:focus:bg-[#172434]"
                />
              </div>
            </div>

            {/* 2. Password Input with Show/Hide */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <div className="relative mt-1.5 flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your representative password"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 py-2.5 pr-11 pl-10 text-sm text-slate-900 transition-all focus:border-[#0878D1] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-[#172434]/60 dark:text-white dark:focus:bg-[#172434]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 3. Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#0878D1] focus:ring-[#0878D1] dark:border-slate-700 dark:bg-[#172434]"
                />
                <span className="text-slate-600 dark:text-slate-400">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(true);
                  setRecoveryInput(username);
                  setRecoverySuccess(null);
                  setRecoveryError(null);
                }}
                className="font-semibold text-[#0878D1] hover:text-[#005A9E] hover:underline cursor-pointer dark:text-[#66B8FA]"
              >
                Forgot password?
              </button>
            </div>

            {/* 4. Login Button */}
            <Button
              type="submit"
              className="w-full justify-center py-2.5 text-sm font-bold shadow-md shadow-[#0878D1]/20 cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating Representative...' : 'Sign In as Representative'}
            </Button>
          </form>

          {/* Security & Access Restriction Notice */}
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-[#0E1621]">
            <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0878D1]" />
              <p>
                <strong className="font-semibold text-slate-700 dark:text-slate-300">
                  Controlled Portal:
                </strong>{' '}
                Self-registration is disabled. Only the 2 designated representatives provisioned by the department can access this portal.
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Class & Demo Representatives Info */}
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xs dark:border-slate-800 dark:bg-[#111B27]/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-[#0878D1]" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Assigned Class: {classProfile.classCode}
                </span>
              </div>
              <Badge variant="primary">{classProfile.department.split('&')[0].trim()}</Badge>
            </div>

            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Both appointed representatives below access the exact same class records:
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {authorizedReps.map((rep, idx) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => {
                    const uname = rep.username || (idx === 0 ? 'aarav.rep' : 'priya.rep');
                    setUsername(uname);
                    handleQuickDemoLogin(uname);
                  }}
                  className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-left transition-colors hover:border-[#0878D1] hover:bg-[#EAF4FC]/50 cursor-pointer dark:border-slate-700 dark:bg-[#172434] dark:hover:border-[#0878D1]"
                  title="Click to sign in as this representative"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {rep.fullName}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      @{rep.username || (idx === 0 ? 'aarav.rep' : 'priya.rep')} • {rep.slot}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#0878D1] dark:text-[#66B8FA]">
                    Sign In →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                isConfigured ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
            <span>
              {isConfigured
                ? 'Supabase Authentication & RLS Live'
                : 'Local Preview Mode Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        open={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Reset Representative Password"
        subtitle="Password recovery instructions will be sent to your registered college email."
        maxWidthClass="max-w-md"
      >
        {recoverySuccess ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-sm">Recovery Link Sent</p>
                <p className="mt-1">{recoverySuccess}</p>
              </div>
            </div>

            <Button
              className="w-full justify-center"
              onClick={() => setForgotModalOpen(false)}
            >
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            {recoveryError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <p>{recoveryError}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="recoveryInput"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Representative Username or Email
              </label>
              <div className="relative mt-1.5 flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="recoveryInput"
                  type="text"
                  required
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="e.g. aarav.rep or aarav.menon@college.edu"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 py-2.5 pr-3 pl-10 text-sm text-slate-900 focus:border-[#0878D1] focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-[#172434]/60 dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                A verification link will be sent to the official recovery email linked with this username.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForgotModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSendingRecovery}
                leftIcon={<KeyRound className="h-4 w-4" />}
              >
                {isSendingRecovery ? 'Sending...' : 'Send Recovery Link'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
