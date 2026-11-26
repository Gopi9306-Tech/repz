import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  GraduationCap,
  Info,
  Loader2,
  Lock,
  Moon,
  ShieldAlert,
  Sun,
  Users2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    loginWithGoogle,
    authError,
    clearAuthError,
    isConfigured,
    classProfile,
    simulateRepLogin,
  } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // If already authenticated, redirect to Dashboard
  if (isAuthenticated && !isLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleLogin = async () => {
    setActionError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      // Google OAuth will redirect to Google login, then back to /dashboard
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google OAuth sign-in failed.';
      setActionError(msg);
      setIsSubmitting(false);
    }
  };

  const handleSimulateRepLogin = async (email: string) => {
    setActionError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await simulateRepLogin(email);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authorization check failed.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorizedReps = classProfile.representatives;

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#F3F6FA] px-4 py-8 text-slate-900 dark:bg-[#0B111A] dark:text-slate-100">
      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:text-[#0878D1] dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-300 cursor-pointer"
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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Assigned Class Attendance Management System
          </p>
        </div>

        {/* Main Sign-In Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-[#111B27]">
          <div className="mb-5 text-center">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Representative Authentication
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sign in with your official college Google account
            </p>
          </div>

          {/* Authorization or Action Error Display */}
          {(authError || actionError) && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200/90 bg-red-50/90 p-3.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/70 dark:text-red-200">
              <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Access Denied</p>
                <p className="mt-0.5 leading-relaxed">{authError || actionError}</p>
              </div>
            </div>
          )}

          {/* Primary Google Login Button */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={isSubmitting || isLoading}
              onClick={handleGoogleLogin}
              className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-xs transition-all duration-150 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 dark:border-slate-700 dark:bg-[#172434] dark:text-slate-100 dark:hover:bg-[#1E2E42] cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#0878D1]" />
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isSubmitting ? 'Authenticating with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-center justify-center text-[11px] text-slate-500 dark:text-slate-400">
              <Lock className="h-3 w-3 text-slate-400" />
              <span>Google OAuth Session • Only authorized representative emails allowed</span>
            </div>
          </div>

          {/* Shared Class Assignment Info */}
          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#0E1621] dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Assigned Class: {classProfile.classCode}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#0878D1] dark:text-[#7CC4FA]">
                <Users2 className="h-3.5 w-3.5" />2 Representatives
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Both authorized representatives share identical real-time access to{' '}
              {classProfile.classCode}. No admin, faculty, teacher or student logins exist.
            </p>
          </div>

          {/* Representative Email Validation & Testing Suite */}
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Authorized Class Representatives
              </span>
              <Badge variant="primary">Access Whitelist</Badge>
            </div>

            <div className="space-y-2">
              {authorizedReps.map((rep) => (
                <div
                  key={rep.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-slate-800 dark:bg-[#111B27]"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {rep.fullName} ({rep.slot})
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {rep.email}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSimulateRepLogin(rep.email)}
                    disabled={isSubmitting}
                  >
                    Test Log In
                  </Button>
                </div>
              ))}
            </div>

            {/* Test Unauthorized Email Attempt */}
            <div className="mt-3.5 rounded-2xl border border-dashed border-slate-200 p-3 dark:border-slate-800">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Test unauthorized email rejection:
              </p>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="email"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="student@college.edu"
                  className="h-8 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-200"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleSimulateRepLogin(testEmailInput || 'unauthorized.student@college.edu')
                  }
                >
                  Test Reject
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Supabase Status Footer */}
        <div className="mt-4 flex flex-col items-center justify-center gap-1 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            {isConfigured ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Info className="h-3.5 w-3.5 text-[#0878D1]" />
            )}
            <span>
              {isConfigured
                ? 'Supabase Auth Ready (Google OAuth Live)'
                : 'Supabase Schema Created • Awaiting Live API keys in .env'}
            </span>
          </div>
          <span className="text-[11px] opacity-75">
            SQL migration with RLS available in /supabase/migrations
          </span>
        </div>
      </div>
    </div>
  );
};
