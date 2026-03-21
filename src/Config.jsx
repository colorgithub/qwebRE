import React, { useState, useEffect } from 'react';
import './Config.css';

export default function Config({ onConfig }) {
  const [url, setUrl] = useState(() => localStorage.getItem('napcat_url') || 'ws://127.0.0.1:3001');
  const [token, setToken] = useState(() => localStorage.getItem('napcat_token') || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('napcat_url', url);
    localStorage.setItem('napcat_token', token);
    onConfig({ url, token });
  };

  return (
    <div className="config-container">
      <h1>NapCat Web Client</h1>
      <form onSubmit={handleSubmit} className="config-form">
        <div className="form-group">
          <label htmlFor="url">WebSocket URL</label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://127.0.0.1:3001"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="token">Access Token (Optional)</label>
          <input
            type="text"
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Your Access Token"
          />
        </div>
        <button type="submit" className="connect-btn">Connect</button>
      </form>
    </div>
  );
}
