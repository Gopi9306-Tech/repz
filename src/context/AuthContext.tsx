import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchRepresentativeClassData,
  requestPasswordReset as apiRequestPasswordReset,
  signInWithUsername,
  signOutFromSupabase,
} from '../services/authService';
import { CLASS_PROFILE } from '../data/mockData';
import { ClassProfile, Representative } from '../types';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  activeRep: Representative;
  coRep: Representative;
  classProfile: ClassProfile;
  user: User | null;
  authError: string | null;
  isConfigured: boolean;
  loginWithUsername: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  requestPasswordReset: (usernameOrEmail: string) => Promise<{ success: boolean; maskedEmail: string }>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  // Fallback demo simulator for development/testing environments
  simulateRepLogin: (usernameOrEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_SESSION_KEY = 'repz_local_session';
const REMEMBERED_USERNAME_KEY = 'repz_remembered_username';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [_session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeRep, setActiveRep] = useState<Representative>(CLASS_PROFILE.representatives[0]);
  const [coRep, setCoRep] = useState<Representative>(CLASS_PROFILE.representatives[1]);
  const [classProfile, setClassProfile] = useState<ClassProfile>(CLASS_PROFILE);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize session & auth listener
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      // If Supabase is configured, use live Supabase Auth
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session: initialSession } } = await supabase.auth.getSession();
          if (initialSession?.user) {
            if (isMounted) {
              setSession(initialSession);
              setUser(initialSession.user);
            }
            await verifyRepresentative(initialSession.user);
          } else {
            if (isMounted) {
              setIsAuthenticated(false);
              setIsLoading(false);
            }
          }
        } catch (err: unknown) {
          console.error('Session retrieval error:', err);
          if (isMounted) {
            setIsAuthenticated(false);
            setIsLoading(false);
          }
        }

        // Listen for live auth state changes (sign-in, token refresh, sign-out)
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            if (!isMounted) return;
            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (event === 'SIGNED_IN' && currentSession?.user) {
              setIsLoading(true);
              await verifyRepresentative(currentSession.user);
            } else if (event === 'SIGNED_OUT') {
              setIsAuthenticated(false);
              setIsLoading(false);
            }
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        // In preview/local mode when Supabase is not configured yet
        const savedRepIdentifier = localStorage.getItem(LOCAL_SESSION_KEY);
        if (savedRepIdentifier) {
          await verifyLocalRepresentative(savedRepIdentifier);
        } else {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Validates Supabase Auth User against the representative database.
   * Only authorized representative accounts are granted access.
   */
  async function verifyRepresentative(authUser: User) {
    const email = authUser.email;
    if (!email) {
      setAuthError('User profile does not provide a valid email address.');
      setIsAuthenticated(false);
      setIsLoading(false);
      await signOutFromSupabase();
      return;
    }

    const result = await fetchRepresentativeClassData(email, authUser.id);
    if (!result.authorized || !result.representative || !result.classProfile) {
      setAuthError(
        result.error ||
          `Unauthorized: ${email} is not an authorized class representative. Only appointed representatives can log in.`
      );
      setIsAuthenticated(false);
      setIsLoading(false);
      await signOutFromSupabase();
      return;
    }

    setActiveRep(result.representative);
    if (result.coRepresentative) {
      setCoRep(result.coRepresentative);
    }
    setClassProfile(result.classProfile);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoading(false);
  }

  /**
   * Local verification for development/preview matching representative username or email
   */
  async function verifyLocalRepresentative(usernameOrEmail: string) {
    const normalized = usernameOrEmail.toLowerCase().trim();
    const reps = CLASS_PROFILE.representatives;
    const match = reps.find(
      (r) =>
        r.email.toLowerCase() === normalized ||
        (r.username && r.username.toLowerCase() === normalized)
    );

    if (!match) {
      setAuthError(
        `Unauthorized: '${usernameOrEmail}' is not an authorized representative for ${CLASS_PROFILE.classCode}.`
      );
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    const co = reps.find((r) => r.id !== match.id) ?? reps[0];
    setActiveRep(match);
    setCoRep(co);
    setClassProfile(CLASS_PROFILE);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoading(false);
  }

  /**
   * Username and Password Login handler
   */
  const loginWithUsername = async (username: string, password: string, rememberMe = false) => {
    setAuthError(null);
    setIsLoading(true);

    // Save or clear remembered username (passwords are NEVER stored in localStorage)
    if (rememberMe) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await signInWithUsername(username, password);
        // On success, Supabase onAuthStateChange will fire and call verifyRepresentative
      } catch (err: unknown) {
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'Invalid representative username or password.';
        setAuthError(msg);
        throw err;
      }
    } else {
      // Local preview fallback: validate password and username against mock representatives
      if (password.length < 4) {
        setIsLoading(false);
        const msg = 'Password must be at least 4 characters.';
        setAuthError(msg);
        throw new Error(msg);
      }

      localStorage.setItem(LOCAL_SESSION_KEY, username.trim());
      await verifyLocalRepresentative(username.trim());
    }
  };

  /**
   * Request password reset link for username or registered recovery email
   */
  const requestPasswordReset = async (usernameOrEmail: string) => {
    if (isSupabaseConfigured && supabase) {
      return await apiRequestPasswordReset(usernameOrEmail);
    } else {
      // Local preview mock
      return {
        success: true,
        maskedEmail: 're****@college.edu',
      };
    }
  };

  const simulateRepLogin = async (usernameOrEmail: string) => {
    setIsLoading(true);
    setAuthError(null);
    localStorage.setItem(LOCAL_SESSION_KEY, usernameOrEmail);
    await verifyLocalRepresentative(usernameOrEmail);
  };

  const signOut = async () => {
    setIsLoading(true);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    if (isSupabaseConfigured && supabase) {
      await signOutFromSupabase();
    }
    setSession(null);
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setIsLoading(false);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        activeRep,
        coRep,
        classProfile,
        user,
        authError,
        isConfigured: isSupabaseConfigured,
        loginWithUsername,
        requestPasswordReset,
        signOut,
        clearAuthError,
        simulateRepLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
