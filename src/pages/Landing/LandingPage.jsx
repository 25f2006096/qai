import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { EDUCATION_LEVELS, GOALS } from '../../data/modules.js';

export default function LandingPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot-password' | 'update-password'

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', education: '', goal: '' });
  const [regErr, setRegErr] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Google loading
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, register, signInWithGoogle, resetPassword, updatePassword } = useAuth();
  const nav = useNavigate();

  // Detect recovery flow from URL hash
  useState(() => {
    if (window.location.hash?.includes('type=recovery')) {
      setMode('update-password');
    }
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginErr('');
    setLoginLoading(true);
    try {
      const r = await login(loginEmail, loginPw);
      if (r.error) {
        setLoginErr(r.error);
      } else {
        // Returning users: go to dashboard if test done, else go to test
        nav(r.user?.knowledgeTestDone ? '/dashboard' : '/test');
      }
    } catch (err) {
      setLoginErr('An unexpected error occurred. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    setResetLoading(true);
    try {
      const r = await resetPassword(resetEmail);
      if (r.error) {
        setResetErr(r.error);
      } else {
        setResetMsg(r.message || 'Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      setResetErr('An unexpected error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePasswordSubmit = async (e) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    if (newPw.length < 6) {
      setResetErr('Password must be at least 6 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setResetErr('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    try {
      const r = await updatePassword(newPw);
      if (r.error) {
        setResetErr(r.error);
      } else {
        setResetMsg(r.message || 'Password updated successfully! You can now sign in.');
        setTimeout(() => setMode('login'), 2000);
      }
    } catch (err) {
      setResetErr('Unable to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setRegErr('');
    if (!regForm.education || !regForm.goal) {
      setRegErr('Please select education level and learning goal');
      return;
    }
    setRegLoading(true);
    try {
      const r = await register(regForm);
      if (r.error) {
        setRegErr(r.error);
      } else if (r.message) {
        // Email confirmation required
        setRegErr('');
        setMode('login');
        setLoginErr('');
        alert(r.message);
      } else {
        // All new users must take the knowledge assessment first
        nav('/test');
      }
    } catch (err) {
      setRegErr('An unexpected error occurred. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setLoginErr('');
    setRegErr('');
    try {
      const r = await signInWithGoogle();
      if (r.error) {
        setLoginErr(r.error);
        setRegErr(r.error);
      }
      // OAuth will redirect, so no need to navigate manually
    } catch (err) {
      setLoginErr('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Landing Navbar */}
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="brand-logo">⚛</span>
          <span className="brand-title">QuantumLearn <span className="brand-badge">AI</span></span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#simulators">Simulators</a>
          <a href="#curriculum">Curriculum</a>
          <a href="#auth-section" onClick={() => setMode('login')}>Sign In</a>
        </div>
        <div className="landing-nav-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => { setMode('login'); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
            Sign In
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setMode('register'); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
            Get Started Free
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" id="hero">
        <div className="landing-hero-grid">
          {/* Left Text */}
          <div className="hero-text-col fade-in">
            <div className="hero-badge">
              <span className="badge-sparkle">✨</span>
              <span>AI Powered • 3D Visualizer • 24 Modules</span>
            </div>
            <h1 className="hero-headline">
              Master Quantum Computing with <span className="gradient-text">Interactive AI</span>
            </h1>
            <p className="hero-subtext">
              QuantumLearn AI is your personalized quantum learning environment. Drag-and-drop circuit builder, 3D Bloch sphere vector tracking, live Grover's search benchmarks, and 24 structured modules guided by a 24/7 AI Tutor.
            </p>
            <div className="hero-highlights">
              <div className="highlight-item">
                <span className="icon">📚</span>
                <div>
                  <strong>24 Structured Modules</strong>
                  <p>Linear Algebra, Qiskit 1.x, Quantum Algorithms & QML</p>
                </div>
              </div>
              <div className="highlight-item">
                <span className="icon">🌐</span>
                <div>
                  <strong>3D Bloch Sphere & Circuit Builder</strong>
                  <p>Real-time qubit probability distributions & unitary matrices</p>
                </div>
              </div>
              <div className="highlight-item">
                <span className="icon">🤖</span>
                <div>
                  <strong>AI-Powered Quantum Tutor</strong>
                  <p>Step-by-step circuit breakdown using advanced neural reasoning models</p>
                </div>
              </div>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-num">24</span>
                <span className="stat-lbl">Modules</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">100+</span>
                <span className="stat-lbl">Tutorials</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">3D</span>
                <span className="stat-lbl">Bloch Sphere</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">AI</span>
                <span className="stat-lbl">Engine</span>
              </div>
            </div>
          </div>

          {/* Right Auth Card */}
          <div className="hero-auth-col fade-in" id="auth-section">
            <div className="auth-card-container">
              <div className="auth-card-header">
                <div className="auth-tabs">
                  <button
                    type="button"
                    className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                    onClick={() => setMode('login')}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                    onClick={() => setMode('register')}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              {mode === 'login' ? (
                <form className="auth-form" onSubmit={handleLoginSubmit}>
                  <h3 className="auth-form-title">Welcome Back 👋</h3>
                  <p className="auth-form-desc">Sign in to resume your quantum learning roadmap</p>

                  {loginErr && <div className="tag tag-danger auth-err">{loginErr}</div>}

                  {/* Google Sign In Button */}
                  <button
                    type="button"
                    className="btn-google-signin"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {googleLoading ? 'Redirecting...' : 'Continue with Google'}
                  </button>

                  <div className="auth-divider">
                    <span className="auth-divider-line"></span>
                    <span className="auth-divider-text">or sign in with email</span>
                    <span className="auth-divider-line"></span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={loginPw}
                      onChange={e => setLoginPw(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 12 }}>
                    <button
                      type="button"
                      style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => { setMode('forgot-password'); setResetErr(''); setResetMsg(''); }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={loginLoading}>
                    {loginLoading ? 'Signing In...' : 'Sign In →'}
                  </button>
                </form>
              ) : mode === 'forgot-password' ? (
                <form className="auth-form" onSubmit={handleResetSubmit}>
                  <h3 className="auth-form-title">Reset Password 🔐</h3>
                  <p className="auth-form-desc">Enter your email and we'll send you recovery instructions</p>

                  {resetErr && <div className="tag tag-danger auth-err">{resetErr}</div>}
                  {resetMsg && <div className="tag tag-success auth-err" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)' }}>{resetMsg}</div>}

                  <div className="form-group">
                    <label className="form-label">Account Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={resetLoading}>
                    {resetLoading ? 'Sending link...' : 'Send Recovery Link →'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => setMode('login')}
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              ) : mode === 'update-password' ? (
                <form className="auth-form" onSubmit={handleUpdatePasswordSubmit}>
                  <h3 className="auth-form-title">New Password 🔑</h3>
                  <p className="auth-form-desc">Enter a secure new password for your account</p>

                  {resetErr && <div className="tag tag-danger auth-err">{resetErr}</div>}
                  {resetMsg && <div className="tag tag-success auth-err" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)' }}>{resetMsg}</div>}

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="•••••••• (min 6 chars)"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={resetLoading}>
                    {resetLoading ? 'Updating password...' : 'Update Password →'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => setMode('login')}
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleRegSubmit}>
                  <h3 className="auth-form-title">Join QuantumLearn AI 🚀</h3>
                  <p className="auth-form-desc">Create your profile and take your skill assessment</p>

                  {regErr && <div className="tag tag-danger auth-err">{regErr}</div>}

                  {/* Google Sign Up Button */}
                  <button
                    type="button"
                    className="btn-google-signin"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {googleLoading ? 'Redirecting...' : 'Continue with Google'}
                  </button>

                  <div className="auth-divider">
                    <span className="auth-divider-line"></span>
                    <span className="auth-divider-text">or create with email</span>
                    <span className="auth-divider-line"></span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      placeholder="Alex Rivera"
                      value={regForm.name}
                      onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="alex@example.com"
                      value={regForm.email}
                      onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="•••••••• (min 6 chars)"
                      value={regForm.password}
                      onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Education Level</label>
                    <select
                      className="form-select"
                      value={regForm.education}
                      onChange={e => setRegForm({ ...regForm, education: e.target.value })}
                      required
                    >
                      <option value="">Select level...</option>
                      {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Learning Goal</label>
                    <select
                      className="form-select"
                      value={regForm.goal}
                      onChange={e => setRegForm({ ...regForm, goal: e.target.value })}
                      required
                    >
                      <option value="">Select goal...</option>
                      {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={regLoading}>
                    {regLoading ? 'Creating Account...' : 'Create Account & Start Assessment →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-section" id="features">
        <div className="section-header">
          <div className="section-tag">PLATFORM CAPABILITIES</div>
          <h2 className="section-title">Everything You Need to Master Quantum Computing</h2>
          <p className="section-subtitle">Designed for students, researchers, and engineers transitioning into quantum technologies.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(124, 77, 255, 0.1)', color: '#7c4dff' }}>⚡</div>
            <h3>Quantum Circuit Builder</h3>
            <p>Drag and drop H, X, Y, Z, CNOT, SWAP, and rotation gates on qubit wires. Observe live probability amplitudes and state collapse in real-time.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>🌐</div>
            <h3>3D Bloch Sphere Visualizer</h3>
            <p>Interactive 3D Bloch sphere rendered with WebGL. Drag rotation sliders to observe single-qubit state rotations in Hilbert space.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>🤖</div>
            <h3>AI-Powered Quantum Tutor</h3>
            <p>Powered by advanced neural reasoning models. Ask quantum physics questions, request step-by-step circuit breakdowns, and get instant debugging hints.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>🗺️</div>
            <h3>Personalized Skill Roadmap</h3>
            <p>Adaptive node-graph tailored to your background. Tracks proficiency across linear algebra, Qiskit, quantum algorithms, and hardware.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>⚔️</div>
            <h3>Classical vs Quantum Race</h3>
            <p>Live side-by-side search benchmark comparing classical O(N) linear search against quantum O(√N) Grover's algorithm search.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>🔬</div>
            <h3>Quantum Lab & Hardware</h3>
            <p>Execute jobs on pure JS statevector simulators, backend pulse configurations, and explore real quantum device topologies.</p>
          </div>
        </div>
      </section>

      {/* Simulators Showcase */}
      <section className="landing-section dark-section" id="simulators">
        <div className="sim-showcase-grid">
          <div className="sim-showcase-content">
            <div className="section-tag" style={{ color: '#38bdf8' }}>INTERACTIVE SIMULATORS</div>
            <h2>Visualize Superposition & Entanglement in 3D</h2>
            <p>
              Quantum mechanics can feel abstract. QuantumLearn AI bridges the gap between linear algebra and physical intuition by rendering state vectors live as you build circuits.
            </p>
            <ul className="sim-checklist">
              <li>✓ Dirac notation state evolution |ψ⟩ = α|0⟩ + β|1⟩</li>
              <li>✓ Unitary matrix tensor product calculations</li>
              <li>✓ Continuous Rx(θ), Ry(θ), Rz(θ) rotation sliders</li>
              <li>✓ Multi-qubit partial trace density matrix reduction</li>
            </ul>
            <button className="btn btn-primary" onClick={() => { setMode('register'); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
              Try Simulators Now →
            </button>
          </div>

          <div className="sim-preview-card">
            <div className="sim-preview-header">
              <div className="sim-dot red" />
              <div className="sim-dot yellow" />
              <div className="sim-dot green" />
              <span className="sim-title">Quantum Circuit Engine v1.0</span>
            </div>
            <div className="sim-preview-body">
              <div className="sim-wire-row">
                <span className="wire-label">q[0]</span>
                <div className="wire-gate purple">H</div>
                <div className="wire-line" />
                <div className="wire-gate pink">CNOT ⏺</div>
                <div className="wire-line" />
                <div className="wire-gate green">M 📊</div>
              </div>
              <div className="sim-wire-row">
                <span className="wire-label">q[1]</span>
                <div className="wire-line" style={{ width: 60 }} />
                <div className="wire-gate pink">⊕ Target</div>
                <div className="wire-line" />
                <div className="wire-gate green">M 📊</div>
              </div>

              <div className="sim-output-box">
                <div className="sim-out-title">StateVector Result:</div>
                <div className="sim-out-ket">|ψ⟩ = 1/√2 |00⟩ + 1/√2 |11⟩ (Bell State |Φ⁺⟩)</div>
                <div className="sim-out-probs">
                  <span>|00⟩: 50.0%</span>
                  <span>|11⟩: 50.0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum Preview */}
      <section className="landing-section" id="curriculum">
        <div className="section-header">
          <div className="section-tag">CURRICULUM HIGHLIGHTS</div>
          <h2 className="section-title">24 Comprehensive Learning Modules</h2>
          <p className="section-subtitle">Structured path from foundation physics to modern quantum machine learning.</p>
        </div>

        <div className="curriculum-grid">
          {[
            { num: 'Module 01', title: 'Foundations of Quantum Information', cat: 'Beginner', desc: 'Linear algebra, Hilbert space, complex vectors, and classical vs quantum bits.' },
            { num: 'Module 07', title: 'Qiskit 1.x & Circuit Programming', cat: 'Intermediate', desc: 'Constructing QuantumCircuit objects, transpilation, jobs, and result execution.' },
            { num: 'Module 09', title: 'Fundamental Quantum Algorithms', cat: 'Intermediate', desc: 'Deutsch-Jozsa, Bernstein-Vazirani, Simon, Teleportation, and Superdense Coding.' },
            { num: 'Module 11', title: 'Quantum Machine Learning (QML)', cat: 'Advanced', desc: 'Data encoding, Parameterized Quantum Circuits (PQC), VQC, and Pennylane.' },
            { num: 'Module 15', title: 'Quantum Fourier Transform (QFT)', cat: 'Advanced', desc: 'Phase estimation, Shor\'s factoring algorithm, and period finding mathematics.' },
            { num: 'Module 24', title: 'Fault-Tolerant Quantum Computing', cat: 'Advanced', desc: 'Surface codes, stabilizer formalism, logical qubits, and error mitigation.' },
          ].map((m, i) => (
            <div key={i} className="curr-card">
              <div className="curr-header">
                <span className="curr-num">{m.num}</span>
                <span className={`tag ${m.cat === 'Beginner' ? 'tag-success' : m.cat === 'Intermediate' ? 'tag-accent' : 'tag-warning'}`}>
                  {m.cat}
                </span>
              </div>
              <h3 className="curr-title">{m.title}</h3>
              <p className="curr-desc">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="brand-logo" style={{ fontSize: '1.5rem', fontWeight: 800 }}>⚛ QuantumLearn AI</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 6 }}>
              Interactive AI-Powered Quantum Computing Learning Platform
            </p>
          </div>
          <div className="footer-copy" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} QuantumLearn AI • Built with React, Vite, AI Engine & WebGL
          </div>
        </div>
      </footer>
    </div>
  );
}
