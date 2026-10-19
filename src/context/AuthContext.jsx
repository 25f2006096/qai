import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { storage, createDefaultProgress, createDefaultSkills } from '../utils/storage.js';

export const normalizeLocalUser = (record = {}) => {
  const role = record.role || 'student';
  return {
    id: record.id || `local-${Date.now()}`,
    email: record.email || '',
    name: record.name || record.full_name || record.email?.split('@')[0] || 'User',
    avatar_url: record.avatar_url || null,
    role,
    isAdmin: role === 'admin',
    isInstructor: role === 'instructor',
    isStudent: role === 'student',
    total_xp: Number(record.total_xp || 0),
    current_streak: Number(record.current_streak || 0),
    knowledgeTestDone: Boolean(record.knowledge_test_done || record.knowledgeTestDone || false),
    knowledgeScore: Number(record.knowledge_score || record.knowledgeScore || 0),
    education: record.education || null,
    goal: record.goal || null,
    createdAt: record.created_at || record.createdAt || new Date().toISOString(),
  };
};

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's profile from Supabase 'profiles' table
  const fetchProfile = async (authUser) => {
    if (!authUser) return null;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, total_xp, current_streak, knowledge_test_done, knowledge_score, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Unable to fetch profile:', error.message);
    }

    const role = profile?.role || 'student';
    return {
      id: authUser.id,
      email: authUser.email,
      name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
      role,
      isAdmin: role === 'admin',
      isInstructor: role === 'instructor',
      isStudent: role === 'student',
      total_xp: Number(profile?.total_xp || 0),
      current_streak: Number(profile?.current_streak || 0),
      knowledgeTestDone: Boolean(profile?.knowledge_test_done || false),
      knowledgeScore: Number(profile?.knowledge_score || 0),
      education: authUser.user_metadata?.education || null,
      goal: authUser.user_metadata?.goal || null,
      createdAt: profile?.created_at || authUser.created_at,
    };
  };

  const refreshUser = async () => {
    if (!supabase) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return null;
      }

      const fullUser = await fetchProfile(session.user);
      setUser(fullUser);
      await ensureLocalDefaults(fullUser.id);
      return fullUser;
    } catch (err) {
      console.error('Unable to refresh user profile:', err);
      return null;
    }
  };

  // Ensure initial defaults exist in database
  const ensureLocalDefaults = async (userId) => {
    const progress = await storage.getProgress(userId);
    if (!progress?.completedModules) {
      await storage.setProgress(userId, createDefaultProgress());
    }
    const skills = await storage.getSkills(userId);
    if (!skills || (skills.mathematics === undefined)) {
      await storage.setSkills(userId, createDefaultSkills());
    }
  };

  // Initialize: check existing session + listen for auth changes
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (!supabase) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const fullUser = await fetchProfile(session.user);
          setUser(fullUser);
          await ensureLocalDefaults(fullUser.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
        const fullUser = await fetchProfile(session.user);
        if (mounted) {
          setUser(fullUser);
          setLoading(false);
          await ensureLocalDefaults(fullUser.id);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Email + Password Sign Up
  const register = async ({ name, email, password, education, goal }) => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before creating an account.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          education,
          goal,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        },
      },
    });

    if (error) return { error: error.message };

    if (data.user) {
      await new Promise(r => setTimeout(r, 600));
      const fullUser = await fetchProfile(data.user);
      setUser(fullUser);
      await ensureLocalDefaults(fullUser.id);
      return { success: true, user: fullUser, isNewUser: true };
    }

    return { success: true, message: 'Check your email to confirm your account.' };
  };

  // Email + Password Sign In
  const login = async (email, password) => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: error.message };

    const fullUser = await fetchProfile(data.user);
    setUser(fullUser);
    await ensureLocalDefaults(fullUser.id);

    return { success: true, user: fullUser };
  };

  // Google OAuth Sign In
  const signInWithGoogle = async () => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google sign-in.' };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) return { error: error.message };
    return { success: true, data };
  };

  // Sign Out
  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  // Update user profile safely via RPC functions & user metadata
  const updateUser = async (updates) => {
    if (!user) return;

    if (!supabase) {
      const updated = { ...user, ...updates };
      setUser(updated);
      return;
    }

    try {
      if (updates.name !== undefined || updates.avatar_url !== undefined) {
        const { error } = await supabase.rpc('update_my_profile', {
          p_full_name: updates.name || null,
          p_avatar_url: updates.avatar_url || null,
        });
        if (error) console.error('Failed to update profile:', error.message);
      }

      if (updates.education !== undefined || updates.goal !== undefined || updates.name !== undefined || updates.avatar_url !== undefined) {
        const metadataUpdates = {};
        if (updates.education !== undefined) metadataUpdates.education = updates.education;
        if (updates.goal !== undefined) metadataUpdates.goal = updates.goal;
        if (updates.name !== undefined) metadataUpdates.full_name = updates.name;
        if (updates.avatar_url !== undefined) metadataUpdates.avatar_url = updates.avatar_url;
        await supabase.auth.updateUser({ data: metadataUpdates }).catch(err => console.warn('Metadata update notice:', err.message));
      }

      if (updates.knowledgeTestDone !== undefined || updates.knowledgeScore !== undefined) {
        const score = updates.knowledgeScore !== undefined ? updates.knowledgeScore : (user.knowledgeScore || 0);
        const { error } = await supabase.rpc('complete_knowledge_test', {
          p_score: score,
        });
        if (error) console.error('Failed to update knowledge test status:', error.message);
      }
    } catch (err) {
      console.error('Error updating user:', err);
    }

    const updated = { ...user, ...updates };
    setUser(updated);
  };

  // Password reset request
  const resetPassword = async (email) => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable password recovery.' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login#type=recovery`,
      });
      if (error) return { error: error.message };
      return { success: true, message: 'Password recovery email sent! Please check your inbox for instructions.' };
    } catch (err) {
      return { error: err.message || 'Unable to send password recovery email.' };
    }
  };

  // Update password (for recovery sessions or user settings)
  const updatePassword = async (newPassword) => {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      return { success: true, message: 'Password has been successfully updated.' };
    } catch (err) {
      return { error: err.message || 'Unable to update password.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, updateUser, refreshUser, signInWithGoogle, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) return { user: null, loading: true, register: async () => ({}), login: async () => ({}), logout: async () => { }, updateUser: async () => { }, refreshUser: async () => null, signInWithGoogle: async () => ({}), resetPassword: async () => ({}), updatePassword: async () => ({}) };
  return ctx;
};
