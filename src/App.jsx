import React, { useState, useEffect } from 'react';
import Config from './Config';
import Chat from './Chat';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('napcat_url');
    const savedToken = localStorage.getItem('napcat_token');
    if (savedUrl) {
      setConfig({ url: savedUrl, token: savedToken || '' });
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="app">
        {!config ? (
          <Config onConfig={setConfig} />
        ) : (
          <Chat config={config} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
