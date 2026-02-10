import React, { useEffect, useMemo, useState } from 'react';
import ColumnMapper from './ColumnMapper.jsx';
import { supabase, supabaseConfigured } from './supabaseClient.js';
import './App.css';

const API_BASE = 'http://127.0.0.1:8000';
const TARGET_SCHEMA = ['transaction_id', 'date', 'description', 'quantity', 'amount', 'line_total', 'customer_name'];

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

async function getApiError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

function NavLink({ path, children }) {
  return (
    <button className="link-btn" onClick={() => navigate(path)}>
      {children}
    </button>
  );
}

function TopNav({ authed, onLogout }) {
  return (
    <header className="top-nav">
      <button className="brand-btn" onClick={() => navigate('/')}>TrueFormat</button>
      <nav className="top-links">
        <NavLink path="/">Home</NavLink>
        <NavLink path="/blog">Blog</NavLink>
        <NavLink path="/terms">Terms</NavLink>
        <NavLink path="/privacy">Privacy</NavLink>
        {authed ? (
          <>
            <NavLink path="/app">App</NavLink>
            <button className="btn btn-ghost" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <NavLink path="/login">Log in</NavLink>
            <button className="btn btn-primary" onClick={() => navigate('/signup')}>Get Started</button>
          </>
        )}
      </nav>
    </header>
  );
}

function ConfigErrorPage() {
  return (
    <section className="static-card">
      <h2 className="section-title">Frontend Config Missing</h2>
      <div className="page-copy">
        <p>Add these keys to <code>frontend/.env</code>:</p>
        <p><code>VITE_SUPABASE_URL=...</code></p>
        <p><code>VITE_SUPABASE_ANON_KEY=...</code></p>
        <p>Then restart Vite dev server.</p>
      </div>
    </section>
  );
}

function HomePage({ interestForm, setInterestForm, interestStatus, onSubmitInterest }) {
  return (
    <section className="page-grid">
      <div className="hero">
        <h1 className="app-title">TrueFormat</h1>
        <p className="hero-text">Turn messy invoices into clean import-ready data with reliable PDF extraction and validation.</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/signup')}>Create Account</button>
          <button className="btn btn-dark" onClick={() => navigate('/app')}>Open App</button>
        </div>
      </div>
      <aside className="interest-card">
        <h2 className="section-title">Interest Form</h2>
        <p className="muted">Tell us what you need. We will follow up with setup guidance.</p>
        <form onSubmit={onSubmitInterest} className="stack-form">
          <input
            className="mapper-input"
            placeholder="Full name"
            value={interestForm.name}
            onChange={(e) => setInterestForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            className="mapper-input"
            type="email"
            placeholder="Work email"
            value={interestForm.email}
            onChange={(e) => setInterestForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            className="mapper-input"
            placeholder="Company"
            value={interestForm.company}
            onChange={(e) => setInterestForm((prev) => ({ ...prev, company: e.target.value }))}
          />
          <textarea
            className="mapper-input"
            rows={4}
            placeholder="What extraction formats or workflows do you need?"
            value={interestForm.message}
            onChange={(e) => setInterestForm((prev) => ({ ...prev, message: e.target.value }))}
          />
          <button className="btn btn-success" type="submit">Submit Interest</button>
          {interestStatus && <p className="status-text">{interestStatus}</p>}
        </form>
      </aside>
    </section>
  );
}

function AuthPage({ mode, email, setEmail, password, setPassword, authStatus, onSubmit }) {
  return (
    <section className="auth-card">
      <h2 className="section-title">{mode === 'login' ? 'Log in to TrueFormat' : 'Create your TrueFormat account'}</h2>
      <form className="stack-form" onSubmit={onSubmit}>
        <input
          className="mapper-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          className="mapper-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 chars)"
          minLength={8}
          required
        />
        <button className="btn btn-primary" type="submit">
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      {authStatus && <p className="status-text">{authStatus}</p>}
      <p className="muted">
        {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
        <button className="link-btn" onClick={() => navigate(mode === 'login' ? '/signup' : '/login')}>
          {mode === 'login' ? 'Create account' : 'Log in'}
        </button>
      </p>
    </section>
  );
}

function AppWorkspace({ token }) {
  const [file, setFile] = useState(null);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [suggestedMapping, setSuggestedMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [nullCount, setNullCount] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [finalMapping, setFinalMapping] = useState(null);
  const [rowCount, setRowCount] = useState(0);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a file first.');
      return;
    }
    setError('');
    setStatus('Uploading and analyzing columns...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        if (supabase) await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error(await getApiError(res, `Upload failed (${res.status})`));
      const data = await res.json();
      setSourceColumns(data.sourceColumns || []);
      setSuggestedMapping(data.suggestedMapping || {});
      setStatus('Columns loaded. Confirm the mapping below.');
    } catch (e) {
      setError(e.message || 'Failed to upload file.');
      setStatus('');
    }
  };

  const handleFinalize = async (finalMap) => {
    if (!file) {
      setError('No file loaded.');
      return;
    }
    setError('');
    setStatus('Transforming data...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(finalMap));
    try {
      const res = await fetch(`${API_BASE}/transform`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        if (supabase) await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || `Transform failed (${res.status})`);
      setPreview(data.preview || []);
      setNullCount(data.null_count || {});
      setRowCount(data.row_count || 0);
      setFinalMapping(finalMap);
      setStatus('Transform complete. Review the preview below.');
    } catch (e) {
      setError(e.message || 'Failed to transform data.');
      setStatus('');
    }
  };

  const handleDownload = async () => {
    if (!file || !finalMapping) {
      setError('No data to export.');
      return;
    }
    setStatus('Exporting CSV...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(finalMapping));
    try {
      const res = await fetch(`${API_BASE}/export-csv`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        if (supabase) await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error(await getApiError(res, `Export failed (${res.status})`));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trueformat-export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setStatus('CSV exported successfully.');
    } catch (e) {
      setError(e.message || 'Failed to export CSV.');
      setStatus('');
    }
  };

  return (
    <section className="app-shell">
      <h1 className="app-title">TrueFormat – Secure Data Extraction</h1>
      <div className="upload-row">
        <input
          className="file-input"
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn btn-primary" onClick={handleUpload}>Upload & Auto-map</button>
      </div>
      {status && <p className="status-text">{status}</p>}
      {error && <p className="error-text">{error}</p>}
      {sourceColumns.length > 0 && (
        <ColumnMapper
          sourceColumns={sourceColumns}
          targetFields={TARGET_SCHEMA}
          suggestedMapping={suggestedMapping}
          onFinalize={handleFinalize}
        />
      )}
      {preview.length > 0 && (
        <section className="preview-section">
          <h2 className="section-title">Preview ({rowCount || preview.length} rows)</h2>
          <div className="table-wrap">
            <table className="preview-table">
              <thead>
                <tr>{Object.keys(preview[0]).map((col) => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(row).map((col) => (
                      <td key={col}>{row[col] === null ? '' : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="section-title">Null counts</h3>
          <ul className="null-list">
            {Object.entries(nullCount).map(([col, count]) => (
              <li key={col}><strong>{col}</strong>: {count}</li>
            ))}
          </ul>
          <button className="btn btn-success" onClick={handleDownload}>Download CSV</button>
        </section>
      )}
    </section>
  );
}

function StaticPage({ title, children }) {
  return (
    <section className="static-card">
      <h2 className="section-title">{title}</h2>
      <div className="page-copy">{children}</div>
    </section>
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [interestStatus, setInterestStatus] = useState('');
  const [interestForm, setInterestForm] = useState({ name: '', email: '', company: '', message: '' });

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      return;
    }
    setAuthStatus('Processing...');
    try {
      let authResult;
      if (mode === 'register') {
        authResult = await supabase.auth.signUp({ email, password });
      } else {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      }
      if (authResult.error) throw authResult.error;
      const accessToken = authResult.data.session?.access_token || '';
      if (accessToken) {
        setToken(accessToken);
        setAuthStatus('Authenticated.');
        navigate('/app');
      } else if (mode === 'register') {
        setAuthStatus('Signup successful. Check your email to confirm your account.');
      } else {
        setAuthStatus('Authentication succeeded, but no session was returned.');
      }
    } catch (e) {
      setAuthStatus(e.message || 'Authentication failed.');
    }
  };

  const submitInterest = async (e) => {
    e.preventDefault();
    setInterestStatus('Sending...');
    try {
      const res = await fetch(`${API_BASE}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interestForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send.');
      setInterestStatus('Thanks. Your request was submitted.');
      setInterestForm({ name: '', email: '', company: '', message: '' });
    } catch (e2) {
      setInterestStatus(e2.message || 'Could not submit form.');
    }
  };

  const onLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setToken('');
    navigate('/');
  };

  if (!supabaseConfigured) {
    return (
      <div className="site-shell">
        <TopNav authed={false} onLogout={onLogout} />
        <ConfigErrorPage />
      </div>
    );
  }

  let content;
  if (path === '/app') {
    content = token ? <AppWorkspace token={token} /> : <AuthPage mode="login" {...{ email, setEmail, password, setPassword, authStatus }} onSubmit={(e) => { e.preventDefault(); submitAuth('login'); }} />;
  } else if (path === '/login') {
    content = <AuthPage mode="login" {...{ email, setEmail, password, setPassword, authStatus }} onSubmit={(e) => { e.preventDefault(); submitAuth('login'); }} />;
  } else if (path === '/signup') {
    content = <AuthPage mode="signup" {...{ email, setEmail, password, setPassword, authStatus }} onSubmit={(e) => { e.preventDefault(); submitAuth('register'); }} />;
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
    content = (
      <StaticPage title="Blog">
        <p><strong>Improving OCR for scanned invoices</strong>: fallback parsing now handles image-only PDFs.</p>
        <p><strong>Schema reliability updates</strong>: quantity/amount/line_total reconciliation reduces null fields.</p>
        <p><strong>What is next</strong>: configurable extraction templates and supplier-specific profiles.</p>
      </StaticPage>
    );
  } else {
    content = <HomePage interestForm={interestForm} setInterestForm={setInterestForm} interestStatus={interestStatus} onSubmitInterest={submitInterest} />;
  }

  return (
    <div className="site-shell">
      <TopNav authed={Boolean(token)} onLogout={onLogout} />
      {content}
    </div>
  );
}
