import React, { useState } from 'react';
import { saveAuth } from '../utils/auth.js';

function Login({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) return;
    saveAuth(username, password);
    onLogin();
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <h1 className="login-title">RSS Reader</h1>
        <p className="login-subtitle">Sign in to continue</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            Username
            <input
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>

          <label className="login-label">
            Password
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="login-btn">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
