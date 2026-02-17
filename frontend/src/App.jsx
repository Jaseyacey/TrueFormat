import { useEffect, useState } from 'react';
import { supabaseConfigured } from './supabaseClient.js';
import MarketingHomePage from './MarketingHomePage.jsx';
import BlogMappingMess from './BlogMappingMess.jsx';
import TopNav from './components/layout/TopNav.jsx';
import ConfigErrorPage from './components/auth/ConfigErrorPage.jsx';
import AuthPage from './components/auth/AuthPage.jsx';
import AppWorkspace from './components/workspace/AppWorkspace.jsx';
import StaticPage from './components/common/StaticPage.jsx';
import { navigate } from './utils/navigation.js';
import { useAuth } from './hooks/useAuth.js';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const auth = useAuth();

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const authBindings = {
    email: auth.email,
    setEmail: auth.setEmail,
    password: auth.password,
    setPassword: auth.setPassword,
    confirmPassword: auth.confirmPassword,
    setConfirmPassword: auth.setConfirmPassword,
    otpCode: auth.otpCode,
    setOtpCode: auth.setOtpCode,
    authStatus: auth.authStatus,
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    const isAuthed = await auth.submitAuth('login');
    if (isAuthed) navigate('/app');
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    const isAuthed = await auth.submitAuth('register');
    if (isAuthed) navigate('/app');
  };

  const handleLogout = async () => {
    await auth.logout();
    navigate('/');
  };

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto w-[min(1180px,94vw)] py-6">
        <TopNav authed={false} onLogout={handleLogout} />
        <ConfigErrorPage />
      </div>
    );
  }

  let content;
  if (path === '/app') {
    content = auth.token ? (
      <AppWorkspace token={auth.token} onUnauthorized={() => navigate('/login')} />
    ) : (
      <AuthPage mode="login" {...authBindings} isOtpStep={false} onSubmit={handleLoginSubmit} />
    );
  } else if (path === '/login') {
    content = <AuthPage mode="login" {...authBindings} isOtpStep={false} onSubmit={handleLoginSubmit} />;
  } else if (path === '/signup') {
    content = (
      <AuthPage
        mode="signup"
        {...authBindings}
        isOtpStep={auth.signupOtpStep}
        onResendOtp={auth.resendSignupOtp}
        onSubmit={handleSignupSubmit}
      />
    );
  } else if (path === '/terms') {
    content = (
      <StaticPage title="Terms of Service">
        <p>Use TrueFormat lawfully and only with data you are authorized to process.</p>
        <p>You are responsible for validating exported data before importing into downstream systems.</p>
        <p>Service availability and features may change as we improve extraction quality.</p>
      </StaticPage>
    );
  } else if (path === '/privacy') {
    content = (
      <StaticPage title="Privacy Policy">
        <p>TrueFormat processes files you upload to produce structured export outputs.</p>
        <p>Interest form data is stored to contact you about onboarding and product updates.</p>
        <p>Do not upload sensitive documents unless your organization has approved this workflow.</p>
      </StaticPage>
    );
  } else if (path === '/blog') {
    content = <BlogMappingMess onCta={() => navigate('/signup')} />;
  } else {
    content = <MarketingHomePage onPrimaryCta={() => navigate('/signup')} />;
  }

  return (
    <div className="mx-auto w-[min(1180px,94vw)] py-6 tf-page">
      <TopNav authed={Boolean(auth.token)} onLogout={handleLogout} />
      {content}
    </div>
  );
}
