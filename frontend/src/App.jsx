import { useEffect, useState } from 'react';
import { supabaseConfigured } from './supabaseClient.js';
import MarketingHomePage from './MarketingHomePage.jsx';
import BlogMappingMess from './BlogMappingMess.jsx';
import TopNav from './components/layout/TopNav.jsx';
import ConfigErrorPage from './components/auth/ConfigErrorPage.jsx';
import AuthPage from './components/auth/AuthPage.jsx';
import AppWorkspace from './components/workspace/AppWorkspace.jsx';
import SubscriptionPage from './components/billing/SubscriptionPage.jsx';
import StaticPage from './components/common/StaticPage.jsx';
import ContactPage from './components/common/ContactPage.jsx';
import NotFoundPage from './components/common/NotFoundPage.jsx';
import AahPharmaceuticalsXeroPage from './components/marketing/AahPharmaceuticalsXeroPage.jsx';
import RsComponentsNetSuitePage from './components/marketing/RsComponentsNetSuitePage.jsx';
import FarnellOdooInvoiceImportPage from './components/marketing/FarnellOdooInvoiceImportPage.jsx';
import { navigate } from './utils/navigation.js';
import { useAuth } from './hooks/useAuth.js';
import { clearIdentifiedUser, identifyUser, trackEvent, trackRouteChange } from './utils/analytics.js';

function getInitialTheme() {
  const saved = window.localStorage.getItem('tf-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [theme, setTheme] = useState(getInitialTheme);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.body.setAttribute('data-theme', theme);
    window.localStorage.setItem('tf-theme', theme);
  }, [theme]);

  useEffect(() => {
    trackRouteChange(path);
  }, [path]);

  useEffect(() => {
    if (auth.email) {
      identifyUser(auth.email);
      return;
    }

    if (!auth.token) {
      clearIdentifiedUser();
    }
  }, [auth.email, auth.token]);

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
    acceptTerms,
    setAcceptTerms,
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    trackEvent('login_attempt', { from: path });

    const result = await auth.submitAuth('login');
    if (result.ok) {
      trackEvent('login_success', { destination: '/app' });
      navigate('/app');
    }

    if (result.requiresPayment) {
      trackEvent('login_requires_payment', { destination: '/subscription' });
      navigate('/subscription');
    }

    if (!result.ok && !result.requiresPayment) {
      trackEvent('login_failed', { from: path });
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();

    if (!auth.signupOtpStep && !acceptTerms) {
      auth.setAuthStatus('Please accept Terms and Conditions to continue.');
      trackEvent('signup_blocked_terms_not_accepted', { from: path });
      return;
    }

    trackEvent('signup_attempt', { from: path, otp_step: auth.signupOtpStep });

    const result = await auth.submitAuth('register');
    if (result.requiresPayment) {
      setAcceptTerms(false);
      trackEvent('signup_verified_requires_payment', { destination: '/subscription' });
      navigate('/subscription');
    }

    if (result.ok) {
      setAcceptTerms(false);
      trackEvent('signup_success', { destination: '/app' });
      navigate('/app');
    }

    if (!result.ok && !result.requiresPayment) {
      trackEvent('signup_progress', { otp_step: auth.signupOtpStep });
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    setAcceptTerms(false);
    trackEvent('logout', { from: path, destination: '/' });
    navigate('/');
  };

  const handleThemeToggle = () => {
    setTheme((prev) => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      trackEvent('theme_toggled', { from: prev, to: nextTheme });
      return nextTheme;
    });
  };

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto w-[min(1180px,94vw)] py-6">
        <TopNav authed={false} onLogout={handleLogout} theme={theme} onToggleTheme={handleThemeToggle} />
        <ConfigErrorPage />
      </div>
    );
  }

  let content;
  if (path === '/app') {
    content = auth.token ? (
      <AppWorkspace
        token={auth.token}
        onUnauthorized={() => {
          trackEvent('session_unauthorized_redirect', { destination: '/login' });
          navigate('/login');
        }}
      />
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
  } else if (path === '/subscription') {
    content = <SubscriptionPage defaultEmail={auth.email} />;
  } else if (path === '/terms') {
    content = (
      <StaticPage title="Terms of Service">
        <p><strong>TrueFormat Terms and Conditions</strong></p>
        <p><strong>Last Updated:</strong> February 20, 2026</p>

        <p><strong>1. Acceptance of Terms</strong></p>
        <p>
          By accessing or using TrueFormat (&quot;the Software&quot;), you agree to be bound by these Terms and
          Conditions. TrueFormat is a B2B data extraction tool designed to format PDF invoices into CSV files for
          accounting software (e.g., Xero).
        </p>

        <p><strong>2. Data Processing and Privacy (GDPR Compliance)</strong></p>
        <p>TrueFormat acts as a Data Processor. You (the Customer) act as the Data Controller.</p>
        <p>
          <strong>Transient Processing:</strong> We process your uploaded documents (PDFs, CSVs) in-memory for the sole
          purpose of data extraction and mapping.
        </p>
        <p>
          <strong>No Storage:</strong> Once your session ends and the formatted CSV is downloaded, the original files and
          extracted data are permanently deleted from our processing servers.
        </p>
        <p>
          <strong>No AI Training:</strong> TrueFormat is a deterministic engine. We strictly do not use your financial
          data, client data, or uploaded invoices to train machine learning models.
        </p>

        <p><strong>3. Limitation of Liability (The &quot;Verification&quot; Clause)</strong></p>
        <p>
          TrueFormat provides an automated extraction service. However, optical character recognition (OCR) and document
          parsing are not infallible.
        </p>
        <p>
          You acknowledge that TrueFormat is a data ingestion tool, not a substitute for professional accounting or
          financial auditing.
        </p>
        <p>
          You agree that it is your sole responsibility to review, verify, and audit the extracted CSV data (including
          all line-items, quantities, and totals) prior to importing it into Xero, your ERP, or any other system.
        </p>
        <p>
          TrueFormat shall not be held liable for any financial losses, tax penalties, or business interruptions
          resulting from inaccurate data extraction or user failure to verify the output.
        </p>
        <p>
          In no event shall TrueFormat&apos;s total liability to you exceed the amount you paid for the service in the
          twelve (12) months preceding the claim.
        </p>

        <p><strong>4. Subscriptions and Payment</strong></p>
        <p>Enterprise and monthly subscription fees are billed in advance.</p>
        <p>
          Given the digital and immediate nature of the service, all annual license payments (e.g., the &pound;5,000
          Enterprise Tier) are non-refundable once the account is provisioned and processing has commenced, unless
          otherwise agreed in writing.
        </p>

        <p><strong>5. Service Availability</strong></p>
        <p>
          We strive for high uptime but do not guarantee 100% availability. We reserve the right to suspend the service
          for maintenance or updates.
        </p>
      </StaticPage>
    );
  } else if (path === '/privacy') {
    content = (
      <StaticPage title="Privacy Policy">
        <p><strong>TrueFormat Privacy Policy</strong></p>
        <p><strong>Last Updated:</strong> February 20, 2026</p>

        <p><strong>1. Introduction</strong></p>
        <p>
          TrueFormat (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy and is committed to protecting your
          personal and financial data. This Privacy Policy explains how we collect, use, and protect your information
          when you use our invoice data extraction software, in compliance with the UK General Data Protection Regulation
          (UK GDPR).
        </p>

        <p><strong>2. The Data We Collect</strong></p>
        <p>We collect two types of data:</p>
        <p>
          <strong>Account Data:</strong> Your name, email address, and billing information (processed securely via our
          payment provider, e.g., Stripe).
        </p>
        <p>
          <strong>Processing Data (Invoices):</strong> The PDF, CSV, or Excel files you upload for extraction.
        </p>

        <p><strong>3. How We Process Your Invoices (Our &quot;Zero Retention&quot; Guarantee)</strong></p>
        <p>TrueFormat acts as a Data Processor for the documents you upload.</p>
        <p>
          <strong>In-Memory Processing:</strong> When you upload an invoice, it is processed transiently to extract the
          required line items and map them to your accounting format (e.g., Xero).
        </p>
        <p>
          <strong>Immediate Deletion:</strong> Once your session is complete and your formatted CSV is generated and
          downloaded, the original uploaded file and the extracted data are permanently deleted from our servers. We do
          not keep backups of your clients&apos; invoices.
        </p>
        <p>
          <strong>No AI Training:</strong> We do not use your documents, financial data, or PII to train, fine-tune, or
          improve any machine learning or AI models.
        </p>

        <p><strong>4. Third-Party Service Providers</strong></p>
        <p>
          We use trusted third-party services to operate our infrastructure (e.g., secure cloud hosting via AWS/Google
          Cloud and payment processing via Stripe). These providers are GDPR-compliant and only process data as
          instructed by us.
        </p>

        <p><strong>5. Your Data Rights</strong></p>
        <p>
          Under UK GDPR, you have the right to access, rectify, or erase your Account Data at any time. Because we do
          not store your Processing Data (invoices) after your session ends, there is no historical invoice data for us
          to return or delete upon request. To manage your Account Data, please contact us at info@trueformat.co.uk.
        </p>
      </StaticPage>
    );
  } else if (path === '/contact') {
    content = <ContactPage />;
  } else if (path === '/blog') {
    content = <BlogMappingMess onCta={() => navigate('/signup')} />;
  } else if (path === '/') {
    content = <MarketingHomePage onPrimaryCta={() => navigate('/signup')} />;
  } else if (path === '/aah-pharmaceuticals-xero-import') {
    content = <AahPharmaceuticalsXeroPage />;
  } else if (path === '/rs-components-netsuite-csv-import') {
    content = <RsComponentsNetSuitePage />;
  } else if (path === '/farnell-odoo-invoice-import') {
    content = <FarnellOdooInvoiceImportPage />;
  } else {
    content = <NotFoundPage />;
  }

  return (
    <div className="mx-auto w-[min(1180px,94vw)] py-6 tf-page">
      <TopNav authed={Boolean(auth.token)} onLogout={handleLogout} theme={theme} onToggleTheme={handleThemeToggle} />
      {content}
      <footer className="mt-8 rounded-2xl border border-white/10 bg-[#27272A]/55 px-6 py-5 text-center text-xs text-[#94A3B8] tf-home-footer">
        <p>TrueFormat is a trading name of Fixturefix. Registered in England &amp; Wales. Company No:15448622.</p>
        <p className="mt-1">Registered office: 54 Wandsworth High Street, SW18 4RD.</p>
      </footer>
    </div>
  );
}
