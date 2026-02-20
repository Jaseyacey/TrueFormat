import { useCallback, useEffect, useState } from 'react';
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
  const [signupVerifiedPendingPayment, setSignupVerifiedPendingPayment] = useState(false);
  const [authStatus, setAuthStatus] = useState('');

  const checkPaymentStatus = useCallback(async (accessToken) => {
    const res = await fetch(`${API_BASE}/auth/payment-status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(await getApiError(res, `Payment status check failed (${res.status})`));
    const data = await res.json();
    return Boolean(data?.payment_processed);
  }, []);

  const clearTransientAuthState = () => {
    setToken('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setSignupOtpStep(false);
    setPendingSignupPassword('');
  };

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;

    const syncSession = async (session) => {
      const accessToken = session?.access_token || '';
      if (!accessToken) {
        setToken('');
        return;
      }
      try {
        const paymentProcessed = await checkPaymentStatus(accessToken);
        if (!paymentProcessed) {
          await supabase.auth.signOut();
          setToken('');
          setAuthStatus('Your subscription payment is pending. Complete payment to sign in.');
          return;
        }
        setToken(accessToken);
      } catch (e) {
        setToken('');
        setAuthStatus(e.message || 'Unable to validate payment status.');
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [checkPaymentStatus]);

  const submitAuth = async (mode) => {
    if (!supabaseConfigured || !supabase) {
      setAuthStatus('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return { ok: false };
    }

    if (mode === 'register' && !signupOtpStep) {
      if (password !== confirmPassword) {
        setAuthStatus('Password and confirm password must match.');
        return { ok: false };
      }
      if (password.length < 8) {
        setAuthStatus('Password must be at least 8 characters.');
        return { ok: false };
      }
    }

    if (mode === 'register' && signupOtpStep && !/^\d{6}$/.test(otpCode)) {
      setAuthStatus('Enter a valid 6-digit code.');
      return { ok: false };
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
        setSignupVerifiedPendingPayment(false);
        setAuthStatus('Signup started. Check your email for the 6-digit code.');
        return { ok: false };
      }

      if (mode === 'register' && signupOtpStep) {
        const verifyRes = await fetch(`${API_BASE}/auth/signup/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pendingSignupPassword, code: otpCode }),
        });
        if (!verifyRes.ok) throw new Error(await getApiError(verifyRes, `Verification failed (${verifyRes.status})`));

        setSignupOtpStep(false);
        setPendingSignupPassword('');
        setPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setSignupVerifiedPendingPayment(true);
        setAuthStatus('Email verified. Continue to the subscription payment page.');
        return { ok: false, requiresPayment: true };
      }

      const authResult = await supabase.auth.signInWithPassword({ email, password });
      if (authResult.error) throw authResult.error;

      const accessToken = authResult.data.session?.access_token || '';
      if (!accessToken) {
        setAuthStatus('Authentication succeeded, but no session was returned.');
        return { ok: false };
      }

      const paymentProcessed = await checkPaymentStatus(accessToken);
      if (!paymentProcessed) {
        await supabase.auth.signOut();
        clearTransientAuthState();
        setAuthStatus('Payment required. Complete your subscription before signing in.');
        return { ok: false, requiresPayment: true };
      }

      setToken(accessToken);
      setSignupVerifiedPendingPayment(false);
      setAuthStatus('Authenticated.');
      return { ok: true };
    } catch (e) {
      setAuthStatus(e.message || 'Authentication failed.');
      return { ok: false };
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
      clearTransientAuthState();
      setAuthStatus('');
      setEmail('');
      setSignupVerifiedPendingPayment(false);
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
    signupVerifiedPendingPayment,
    setSignupVerifiedPendingPayment,
    authStatus,
    setAuthStatus,
    submitAuth,
    resendSignupOtp,
    logout,
  };
}
