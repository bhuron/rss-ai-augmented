import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get registration options
      const optionsRes = await fetch('/api/auth/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() })
      });

      if (!optionsRes.ok) {
        const text = await optionsRes.text();
        throw new Error(`Server error: ${optionsRes.status} - ${text.substring(0, 100)}`);
      }

      const options = await optionsRes.json();

      // Start registration with authenticator
      const attResp = await startRegistration({ optionsJSON: options });

      // Verify registration
      const verifyRes = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(attResp)
      });

      if (!verifyRes.ok) {
        const text = await verifyRes.text();
        throw new Error(`Verification failed: ${verifyRes.status} - ${text.substring(0, 100)}`);
      }

      const verification = await verifyRes.json();

      if (verification.verified) {
        onLoginSuccess(username);
      } else {
        setError('Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Get authentication options
      const optionsRes = await fetch('/api/auth/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() || undefined })
      });

      const options = await optionsRes.json();

      // Start authentication with authenticator
      const authResp = await startAuthentication({ optionsJSON: options });

      // Verify authentication
      const verifyRes = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(authResp)
      });

      const verification = await verifyRes.json();

      if (verification.verified) {
        onLoginSuccess(verification.username);
      } else {
        setError('Authentication failed');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>RSS Reader</h1>
        <p className="login-subtitle">Sign in with a passkey</p>

        <div className="login-form">
          <input
            type="text"
            placeholder="Username (optional for login)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            disabled={loading}
            className="login-input"
          />

          {error && <div className="login-error">{error}</div>}

          <div className="login-buttons">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="login-btn login-btn-primary"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || !username.trim()}
              className="login-btn login-btn-secondary"
            >
              Register New Passkey
            </button>
          </div>

          <p className="login-help">
            First time? Enter a username and click "Register New Passkey" to create your account.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
