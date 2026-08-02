import React, { useState } from 'react';
import Config from './Config';
import Chat from './Chat';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function App() {
  // 惰性初始化：直接从 localStorage 恢复配置，避免先闪现配置页再 setState
  const [config, setConfig] = useState(() => {
    const savedUrl = localStorage.getItem('napcat_url');
    const savedToken = localStorage.getItem('napcat_token');
    return savedUrl ? { url: savedUrl, token: savedToken || '' } : null;
  });

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
