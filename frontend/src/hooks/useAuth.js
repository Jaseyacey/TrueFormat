import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../supabaseClient.js';
import { resolveApiBase } from '../utils/apiBase.js';

const API_BASE = resolveApiBase();

async function getApiError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

export function useAuth() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [signupOtpStep, setSignupOtpStep] = useState(false);
  const [pendingSignupPassword, setPendingSignupPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('');

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || '');
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const submitAuth = async (mode) => {
    if (!supabaseConfigured || !supabase) {
      setAuthStatus('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return false;
    }

    if (mode === 'register' && !signupOtpStep) {
      if (password !== confirmPassword) {
        setAuthStatus('Password and confirm password must match.');
        return false;
      }
      if (password.length < 8) {
        setAuthStatus('Password must be at least 8 characters.');
        return false;
      }
    }

    if (mode === 'register' && signupOtpStep && !/^\d{6}$/.test(otpCode)) {
      setAuthStatus('Enter a valid 6-digit code.');
      return false;
    }

    setAuthStatus('Processing...');
    try {
      if (mode === 'register' && !signupOtpStep) {
        const res = await fetch(`${API_BASE}/auth/signup/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(await getApiError(res, `Signup start failed (${res.status})`));
        setPendingSignupPassword(password);
        setSignupOtpStep(true);
        setOtpCode('');
        setAuthStatus('Signup started. Check your email for the 6-digit code.');
        return false;
      }

      if (mode === 'register' && signupOtpStep) {
        const verifyRes = await fetch(`${API_BASE}/auth/signup/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pendingSignupPassword, code: otpCode }),
        });
        if (!verifyRes.ok) throw new Error(await getApiError(verifyRes, `Verification failed (${verifyRes.status})`));

        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password: pendingSignupPassword,
        });
        if (signInResult.error) throw signInResult.error;
        const accessToken = signInResult.data.session?.access_token || '';
        if (!accessToken) throw new Error('Verification succeeded, but sign in did not return a session.');

        setToken(accessToken);
        setSignupOtpStep(false);
        setPendingSignupPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setAuthStatus('Authenticated.');
        return true;
      }

      const authResult = await supabase.auth.signInWithPassword({ email, password });
      if (authResult.error) throw authResult.error;

      const accessToken = authResult.data.session?.access_token || '';
      if (!accessToken) {
        setAuthStatus('Authentication succeeded, but no session was returned.');
        return false;
      }

      setToken(accessToken);
      setAuthStatus('Authenticated.');
      return true;
    } catch (e) {
      setAuthStatus(e.message || 'Authentication failed.');
      return false;
    }
  };

  const resendSignupOtp = async () => {
    if (!supabaseConfigured || !supabase) return;
    if (!email) {
      setAuthStatus('Missing email for resend.');
      return;
    }

    setAuthStatus('Sending a new code...');
    try {
      const res = await fetch(`${API_BASE}/auth/signup/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await getApiError(res, `Resend failed (${res.status})`));
      setAuthStatus('A new 6-digit code has been sent.');
    } catch (e) {
      setAuthStatus(e.message || 'Failed to resend code.');
    }
  };

  const logout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Fall through: local session state is still cleared below.
    } finally {
      setToken('');
      setAuthStatus('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setSignupOtpStep(false);
      setPendingSignupPassword('');
    }
  };

  return {
    token,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    otpCode,
    setOtpCode,
    signupOtpStep,
    authStatus,
    submitAuth,
    resendSignupOtp,
    logout,
  };
}
