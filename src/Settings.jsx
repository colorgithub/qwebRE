import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  X,
  Moon,
  Sun,
  LogOut,
  UserCircle2,
  Server,
  Shield,
} from 'lucide-react';
import './Settings.css';

export default function SettingsPanel({
  isOpen,
  onClose,
  onLogout,
  darkMode,
  onToggleDarkMode,
  config,
  selfInfo,
  messagePrefix,
  onUpdateMessagePrefix,
  onUpdateNickname,
  onUpdateSignature,
}) {
  const [showToken, setShowToken] = useState(false);
  const [nickname, setNickname] = useState('');
  const [signature, setSignature] = useState('');
  const [prefixDraft, setPrefixDraft] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setNickname(selfInfo?.nickname || '');
    setSignature(selfInfo?.longNick || selfInfo?.long_nick || selfInfo?.personal_note || '');
    setPrefixDraft(messagePrefix || '');
  }, [isOpen, selfInfo, messagePrefix]);

  if (!isOpen) return null;

  const token = config?.token || '';
  const maskedToken = token ? `${token.slice(0, 4)}****${token.slice(-4)}` : '未设置';

  return (
    <div className="settings-overlay" onClick={onClose}>
      <aside
        className={`settings-panel ${darkMode ? 'dark-mode' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <div className="settings-title-wrap">
            <SettingsIcon size={20} />
            <h2>设置</h2>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="关闭设置">
            <X size={18} />
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <h3>账号信息</h3>
            <div className="settings-card">
              <div className="info-row">
                <span className="info-label">
                  <UserCircle2 size={15} />
                  QQ 号
                </span>
                <span className="info-value">{selfInfo?.user_id || '获取中...'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">昵称</span>
                <span className="info-value">{selfInfo?.nickname || '获取中...'}</span>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3>连接信息</h3>
            <div className="settings-card">
              <div className="info-row">
                <span className="info-label">
                  <Server size={15} />
                  服务器
                </span>
                <span className="info-value mono" title={config?.url}>
                  {config?.url || '未配置'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">
                  <Shield size={15} />
                  Token
                </span>
                <span className="info-value mono">{showToken ? token || '未设置' : maskedToken}</span>
              </div>
              <button type="button" className="small-btn" onClick={() => setShowToken((v) => !v)}>
                {showToken ? '隐藏 Token' : '显示 Token'}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>外观</h3>
            <div className="settings-card">
              <label className="switch-item">
                <div className="switch-text">
                  <span className="switch-title">{darkMode ? <Moon size={16} /> : <Sun size={16} />} 深色模式</span>
                  <span className="switch-desc">切换浅色/深色主题</span>
                </div>
                <span className="toggle-switch">
                  <input type="checkbox" checked={darkMode} onChange={onToggleDarkMode} />
                  <span className="toggle-slider" />
                </span>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>资料编辑</h3>
            <div className="settings-card">
              <div className="edit-row">
                <label className="edit-label" htmlFor="nickname-input">昵称</label>
                <input
                  id="nickname-input"
                  className="edit-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入新昵称"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="save-btn"
                  disabled={savingNickname}
                  onClick={async () => {
                    if (!onUpdateNickname) return;
                    setSavingNickname(true);
                    try {
                      await onUpdateNickname(nickname);
                    } finally {
                      setSavingNickname(false);
                    }
                  }}
                >
                  {savingNickname ? '保存中...' : '保存昵称'}
                </button>
              </div>

              <div className="edit-row">
                <label className="edit-label" htmlFor="signature-input">签名</label>
                <textarea
                  id="signature-input"
                  className="edit-textarea"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="输入新的个性签名"
                  rows={3}
                  maxLength={120}
                />
                <button
                  type="button"
                  className="save-btn secondary"
                  disabled={savingSignature}
                  onClick={async () => {
                    if (!onUpdateSignature) return;
                    setSavingSignature(true);
                    try {
                      await onUpdateSignature(signature);
                    } finally {
                      setSavingSignature(false);
                    }
                  }}
                >
                  {savingSignature ? '保存中...' : '保存签名'}
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3>消息前缀</h3>
            <div className="settings-card">
              <div className="edit-row">
                <label className="edit-label" htmlFor="message-prefix-input">发送前自动添加</label>
                <input
                  id="message-prefix-input"
                  className="edit-input"
                  type="text"
                  value={prefixDraft}
                  onChange={(e) => setPrefixDraft(e.target.value)}
                  placeholder="例如：[BOT] "
                  maxLength={50}
                />
                <button
                  type="button"
                  className="save-btn"
                  onClick={() => onUpdateMessagePrefix && onUpdateMessagePrefix(prefixDraft)}
                >
                  保存前缀
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" className="logout-btn" onClick={onLogout}>
            <LogOut size={16} />
            退出登录
          </button>
        </footer>
      </aside>
    </div>
  );
}
