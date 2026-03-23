import React, { useState } from 'react';
import { Settings, LogOut, Moon, Sun, Code, Server, MonitorSmartphone, X } from 'lucide-react';
import './Settings.css';

export default function SettingsPanel({ 
  isOpen, 
  onClose, 
  onLogout, 
  darkMode, 
  onToggleDarkMode,
  config,
  selfInfo 
}) {
  const [showDeveloperOptions, setShowDeveloperOptions] = useState(false);
  
  // 检查是否为开发者账户
  const isDeveloperAccount = config?.url === 'wss://sb.color111111.dpdns.org' && config?.token === 'wenchonghao223';

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>
            <Settings size={24} />
            设置
          </h2>
          <button className="settings-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="settings-content">
          {/* 账户信息 */}
          <div className="settings-section">
            <h3>账户信息</h3>
            <div className="account-info">
              {selfInfo ? (
                <>
                  <div className="account-row">
                    <span className="label">QQ 号:</span>
                    <span className="value">{selfInfo.user_id}</span>
                  </div>
                  <div className="account-row">
                    <span className="label">昵称:</span>
                    <span className="value">{selfInfo.nickname}</span>
                  </div>
                </>
              ) : (
                <div className="account-row">
                  <span className="label">状态:</span>
                  <span className="value">获取中...</span>
                </div>
              )}
              <div className="account-row">
                <span className="label">服务器:</span>
                <span className="value server-url" title={config?.url}>{config?.url}</span>
              </div>
            </div>
          </div>

          {/* 外观设置 */}
          <div className="settings-section">
            <h3>外观</h3>
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div className="setting-text">
                  <div className="setting-title">深色模式</div>
                  <div className="setting-description">切换深色/浅色主题</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={onToggleDarkMode} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* 账户操作 */}
          <div className="settings-section">
            <h3>账户操作</h3>
            <button className="logout-btn" onClick={onLogout}>
              <LogOut size={20} />
              退出登录
            </button>
          </div>

          {/* 开发者选项 - 仅特定账户可见 */}
          {isDeveloperAccount && (
            <div className="settings-section developer-section">
              <div 
                className="setting-item" 
                onClick={() => setShowDeveloperOptions(!showDeveloperOptions)}
                style={{ cursor: 'pointer' }}
              >
                <div className="setting-info">
                  <div className="setting-icon developer-icon">
                    <Code size={20} />
                  </div>
                  <div className="setting-text">
                    <div className="setting-title">开发者选项</div>
                    <div className="setting-description">管理服务器与 qwebRE</div>
                  </div>
                </div>
                <div className="setting-arrow">
                  {showDeveloperOptions ? '▼' : '▶'}
                </div>
              </div>

              {showDeveloperOptions && (
                <div className="developer-options">
                  <div className="developer-option">
                    <div className="developer-option-icon">
                      <Server size={20} />
                    </div>
                    <div className="developer-option-text">
                      <div className="developer-option-title">服务器管理</div>
                      <div className="developer-option-description">查看和管理 WebSocket 服务器状态</div>
                    </div>
                  </div>
                  
                  <div className="developer-option">
                    <div className="developer-option-icon">
                      <MonitorSmartphone size={20} />
                    </div>
                    <div className="developer-option-text">
                      <div className="developer-option-title">qwebRE 管理</div>
                      <div className="developer-option-description">查看客户端状态和调试信息</div>
                    </div>
                  </div>

                  <div className="developer-info">
                    <div className="info-badge">开发者模式</div>
                    <p>当前账户已启用开发者选项</p>
                    <p className="info-note">更多功能即将推出...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
