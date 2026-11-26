import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchRepresentativeClassData,
  signInWithGoogle,
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
  loginWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  // Fallback demo simulator for development environments where live Supabase is not yet populated
  simulateRepLogin: (repEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_SESSION_KEY = 'repz_local_session';

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

        // Listen for live auth state changes (Google OAuth redirect, token refresh, signout)
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
        // In local/preview mode when Supabase env variables are not yet configured:
        // Check if an authorized representative was previously signed in via local storage
        const savedRepEmail = localStorage.getItem(LOCAL_SESSION_KEY);
        if (savedRepEmail) {
          await verifyLocalRepresentative(savedRepEmail);
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
   * Validates Supabase Google Auth User against the representative database.
   * Only authorized representative email addresses are granted access.
   */
  async function verifyRepresentative(authUser: User) {
    const email = authUser.email;
    if (!email) {
      setAuthError('Google user profile does not provide a valid email address.');
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
   * Local verification matching the same authorization rule (only authorized rep emails)
   */
  async function verifyLocalRepresentative(email: string) {
    const normalized = email.toLowerCase().trim();
    const reps = CLASS_PROFILE.representatives;
    const match = reps.find((r) => r.email.toLowerCase() === normalized);

    if (!match) {
      setAuthError(
        `Unauthorized: '${email}' is not an authorized representative for ${CLASS_PROFILE.classCode}.`
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

  const loginWithGoogle = async () => {
    setAuthError(null);
    if (isSupabaseConfigured && supabase) {
      await signInWithGoogle();
    } else {
      throw new Error(
        'Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }
  };

  const simulateRepLogin = async (repEmail: string) => {
    setIsLoading(true);
    setAuthError(null);
    localStorage.setItem(LOCAL_SESSION_KEY, repEmail);
    await verifyLocalRepresentative(repEmail);
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
        loginWithGoogle,
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
