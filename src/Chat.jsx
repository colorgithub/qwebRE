import React, { useState, useEffect, useRef } from 'react';
import { useOneBot } from './useOneBot';
import MessageRenderer from './MessageRenderer';
import { MessageSquare, Users, User, Plus, Send, ArrowLeft, AtSign, Reply, X } from 'lucide-react';
import './Chat.css';
import './ChatTabs.css';
import './At.css';

export default function Chat({ config }) {
  const { status, messages, sessions, sendMessage, fetchHistory, friends, groups, selfInfo } = useOneBot(config.url, config.token);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [atList, setAtList] = useState([]); // Array of {id, name}
  const [replyingTo, setReplyingTo] = useState(null); // { message_id, text, sender }
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeTab, setActiveTab] = useState('sessions'); // sessions, contacts
  const [newChatId, setNewChatId] = useState('');
  const [newChatType, setNewChatType] = useState('private');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const oldestMessageIdRef = useRef(null);
  const scrollOffsetBeforeLoad = useRef(0);
  const inputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentMessages = selectedSessionId ? (messages[selectedSessionId] || []) : [];

  // Helper to get current session info even if it's not in the sessions list yet
  const getCurrentSessionInfo = () => {
    if (!selectedSessionId) return null;
    if (sessions[selectedSessionId]) return sessions[selectedSessionId];
    
    const [type, id] = selectedSessionId.split(':');
    return { id, type, name: id, avatar: null }; // Temporary info
  };
  
  const currentSession = getCurrentSessionInfo();

  const handleSend = (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && atList.length === 0) || !selectedSessionId) return;

    // Use currentSession helper which handles sessions that aren't in state yet
    const session = currentSession;
    if (session) {
        // Construct message with Reply, At, then Text
        let finalMessage = [];
        
        // Add Reply segment first
        if (replyingTo) {
            finalMessage.push({ type: 'reply', data: { id: replyingTo.message_id } });
        }
        
        // Add At segments
        atList.forEach(at => {
            finalMessage.push({ type: 'at', data: { qq: at.id } });
            finalMessage.push({ type: 'text', data: { text: ' ' } });
        });
        
        if (inputMessage) {
            finalMessage.push({ type: 'text', data: { text: inputMessage } });
        }

        sendMessage(session.id, finalMessage, session.type);
        setInputMessage('');
        setAtList([]);
        setReplyingTo(null);
    }
  };

  const handleAtUser = (userId, nickname) => {
      // Only for group chats
      const session = currentSession;
      if (session && session.type === 'group') {
          // Check if already in list
          if (!atList.some(item => item.id === userId)) {
              setAtList([].concat(atList, [{ id: userId, name: nickname || userId }]));
              if (inputRef.current) inputRef.current.focus();
          }
      }
  };

  const handleAtAll = () => {
    // Only for group chats
    const session = currentSession;
    if (session && session.type === 'group') {
        if (!atList.some(item => item.id === 'all')) {
            setAtList([].concat(atList, [{ id: 'all', name: 'All' }]));
            if (inputRef.current) inputRef.current.focus();
        }
    }
  };

  const removeAt = (userId) => {
      setAtList(atList.filter(item => item.id !== userId));
  };

  const handleReply = (msg) => {
      setReplyingTo({
          message_id: msg.message_id,
          sender: (msg.sender && msg.sender.nickname) || msg.user_id,
          text: typeof msg.message === 'string' ? msg.message : '[Rich Media]'
      });
      if (inputRef.current) inputRef.current.focus();
  };

  const handleStartNewChat = (e) => {
      e.preventDefault();
      if (!newChatId) return;
      const sessionId = `${newChatType}:${newChatId}`;
      
      setSelectedSessionId(sessionId);
      setShowNewChat(false);
      setNewChatId('');
      
      // Try to fetch history for new chat
      fetchHistory(newChatType, newChatId);
  };

  const handleLoadMoreHistory = () => {
    if (!selectedSessionId || currentMessages.length === 0 || loadingHistory) {
      console.log('Cannot load more:', { selectedSessionId, length: currentMessages.length, loadingHistory });
      return;
    }
    
    const oldestMessage = currentMessages[0];
    const session = sessions[selectedSessionId] || getCurrentSessionInfo(); // Fallback to helper if session isn't fully in state
    
    if (session && oldestMessage) {
      // Don't block manual clicks with oldestMessageIdRef check
      // Users might want to force retry
      
      const container = messagesContainerRef.current;
      if (container) {
        const firstMsgEl = container.querySelector(`[data-msg-id="${oldestMessage.message_id}"]`);
        if (firstMsgEl) {
          scrollOffsetBeforeLoad.current = firstMsgEl.offsetTop - container.scrollTop;
        }
      }
      
      oldestMessageIdRef.current = oldestMessage.message_id;
      setLoadingHistory(true);
      console.log('Triggering manual history load before:', oldestMessage.message_id, 'seq:', oldestMessage.message_seq, 'session:', session.type, session.id);
      fetchHistory(session.type, session.id, 20, oldestMessage.message_id, oldestMessage.message_seq);
    } else {
      console.log('Missing session or oldest message:', { session, oldestMessage });
    }
  };

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    
    // Check if we hit the top threshold
    if (scrollTop <= 50 && !loadingHistory && selectedSessionId && currentMessages.length > 0) {
      const oldestMessage = currentMessages[0];
      const session = sessions[selectedSessionId];
      
      if (session && oldestMessage) {
        // Prevent multiple triggers by checking if we just tried to load for this ID
        if (oldestMessageIdRef.current === oldestMessage.message_id) return;

        const firstMsgEl = e.currentTarget.querySelector(`[data-msg-id="${oldestMessage.message_id}"]`);
        if (firstMsgEl) {
          scrollOffsetBeforeLoad.current = firstMsgEl.offsetTop - scrollTop;
        }
        
        oldestMessageIdRef.current = oldestMessage.message_id;
        setLoadingHistory(true);
        console.log('Triggering history load before:', oldestMessage.message_id, 'seq:', oldestMessage.message_seq);
        fetchHistory(session.type, session.id, 20, oldestMessage.message_id, oldestMessage.message_seq);
      }
    }
  };

  useEffect(() => {
    if (loadingHistory) {
        // Auto-reset loading state if no new messages arrive within 2 seconds (e.g., reached the end)
        const timer = setTimeout(() => {
            setLoadingHistory(false);
            // We do NOT clear oldestMessageIdRef.current here so that we don't spam 
            // the same request repeatedly if there are no more older messages.
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [loadingHistory, selectedSessionId]);

  // Scroll to bottom on initial load or new outgoing message
  const prevMessagesLength = useRef(0);
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewMessage = currentMessages.length > prevMessagesLength.current;
    
    if (prevMessagesLength.current === 0 && currentMessages.length > 0) {
        // Initial load
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    } else if (isNewMessage) {
        if (loadingHistory && oldestMessageIdRef.current) {
            // History was loaded! 
            // Restore exact scroll position relative to the oldest message before load
            const oldFirstMsgEl = container.querySelector(`[data-msg-id="${oldestMessageIdRef.current}"]`);
            if (oldFirstMsgEl) {
                container.scrollTop = oldFirstMsgEl.offsetTop - scrollOffsetBeforeLoad.current;
            }
            setLoadingHistory(false);
            // Don't clear oldestMessageIdRef here, it will be updated next time we scroll to top
        } else if (!loadingHistory) {
            // Normal new message
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg && lastMsg.direction === 'outgoing') {
                if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            } else {
                // Check if we were near bottom
                if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
                    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
                }
            }
        }
    }
    
    prevMessagesLength.current = currentMessages.length;
  }, [currentMessages, selectedSessionId, loadingHistory]);

  // Reset tracking when switching sessions
  useEffect(() => {
    oldestMessageIdRef.current = null;
    prevMessagesLength.current = 0;
    setLoadingHistory(false);
  }, [selectedSessionId]);

  const handleContactClick = (type, id, name, avatar) => {
    const sessionId = `${type}:${id}`;
    
    if (!sessions[sessionId]) {
        setNewChatType(type);
        setNewChatId(id);
        setSelectedSessionId(sessionId);
        fetchHistory(type, id);
    } else {
        setSelectedSessionId(sessionId);
    }
    setActiveTab('sessions');
  };

  return (
    <div className="chat-container">
      {(!isMobile || !selectedSessionId) && (
        <div className="sidebar" style={isMobile ? { width: '100%', borderRight: 'none' } : {}}>
          <div className="sidebar-header">
            <h2>NapCat</h2>
            <div className={`status-badge ${status}`}>
              {status}
            </div>
          </div>
          
          <div className="sidebar-tabs">
            <button className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>
              <MessageSquare size={20} />
            </button>
            <button className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
              <Users size={20} />
            </button>
          </div>

          {activeTab === 'sessions' ? (
            <div className="sessions-list">
              {Object.entries(sessions).sort(([,a], [,b]) => b.timestamp - a.timestamp).map(([sessionId, session]) => (
                <div 
                  key={sessionId} 
                  className={`session-item ${selectedSessionId === sessionId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSessionId(sessionId);
                    if (!messages[sessionId] || messages[sessionId].length === 0) {
                      fetchHistory(session.type, session.id);
                    }
                  }}
                >
                  <img src={session.avatar || 'https://via.placeholder.com/40'} alt="avatar" className="avatar" />
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-preview">{session.lastMessage}</div>
                  </div>
                  <div className="session-meta">
                    {session.type === 'group' ? <Users size={14} /> : <User size={14} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="contacts-list">
              <div className="contacts-section">
                <h3>Friends ({friends.length})</h3>
                {friends.map(friend => (
                  <div key={friend.user_id} className="contact-item" onClick={() => handleContactClick('private', friend.user_id, friend.nickname)}>
                    <img src={`https://q1.qlogo.cn/g?b=qq&nk=${friend.user_id}&s=640`} alt={friend.nickname} className="avatar" />
                    <div className="contact-info">
                      <div className="contact-name">{friend.remark || friend.nickname}</div>
                      <div className="contact-id">{friend.user_id}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="contacts-section">
                <h3>Groups ({groups.length})</h3>
                {groups.map(group => (
                  <div key={group.group_id} className="contact-item" onClick={() => handleContactClick('group', group.group_id, group.group_name)}>
                    <img src={`https://p.qlogo.cn/gh/${group.group_id}/${group.group_id}/100`} alt={group.group_name} className="avatar" />
                    <div className="contact-info">
                      <div className="contact-name">{group.group_name}</div>
                      <div className="contact-id">{group.group_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="new-chat-btn" onClick={() => setShowNewChat(true)}>
            <Plus size={20} /> New Chat
          </button>
        </div>
      )}

      {(!isMobile || selectedSessionId) && (
        <div className="main-chat" style={isMobile ? { width: '100%', flex: 'none', height: '100%' } : {}}>
          {selectedSessionId ? (
            <>
              <div className="chat-header">
                {isMobile && (
                  <button className="back-btn" onClick={() => setSelectedSessionId(null)} style={{marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer'}}>
                    <ArrowLeft size={24} />
                  </button>
                )}
                <h3>{currentSession ? currentSession.name : selectedSessionId}</h3>
                <span className="chat-type">{currentSession ? currentSession.type : ''}</span>
              </div>
              <div className="messages-list" onScroll={handleScroll} ref={messagesContainerRef}>
                {currentMessages.length > 0 && !loadingHistory && (
                  <div 
                    className="load-more-btn-container" 
                    style={{ textAlign: 'center', padding: '10px 0' }}
                  >
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLoadMoreHistory();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '13px',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        backgroundColor: '#eff6ff',
                        fontWeight: 'bold'
                      }}
                    >
                      点击加载更老的消息
                    </button>
                  </div>
                )}
                {loadingHistory && (
                  <div className="loading-history-indicator" style={{ textAlign: 'center', padding: '10px 0', color: '#888', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '14px', height: '14px', border: '2px solid #ccc', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '6px' }}></div>
                    加载更老的消息...
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
                {currentMessages.map((msg, index) => {
                  // Determine if the message was sent by the current logged-in user
                  // Some messages from history might not have direction set correctly
                  const isSelf = msg.direction === 'outgoing' || String(msg.user_id) === String(selfInfo ? selfInfo.user_id : '');
                  
                  return (
                  <div key={index} data-msg-id={msg.message_id} className={`message ${isSelf ? 'sent' : 'received'}`}>
                    <div className="message-header">
                      <span 
                        className="sender" 
                        onClick={function() { if(!isSelf) handleAtUser(msg.user_id, msg.sender && msg.sender.nickname); }}
                        style={{cursor: !isSelf && currentSession && currentSession.type === 'group' ? 'pointer' : 'default'}}
                        title={!isSelf && currentSession && currentSession.type === 'group' ? "Click to @ this user" : ""}
                      >
                        {(msg.sender && msg.sender.nickname) || (isSelf ? 'Me' : msg.user_id)}
                      </span>
                      <div className="message-meta-right">
                        <span className="time">{new Date(msg.time * 1000).toLocaleTimeString()}</span>
                        <button className="reply-btn" onClick={() => handleReply(msg)} title="Reply">
                          <Reply size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="message-content">
                      <MessageRenderer message={msg.message} onAt={(qq) => handleAtUser(qq, qq)} />
                    </div>
                  </div>
                )})}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="message-input-area">
                {replyingTo && (
                  <div className="reply-preview">
                    <div className="reply-preview-info">
                      <Reply size={14} style={{marginRight: '8px'}} />
                      <span className="reply-sender">{replyingTo.sender}:</span>
                      <span className="reply-text">{replyingTo.text}</span>
                    </div>
                    <button type="button" className="cancel-reply" onClick={() => setReplyingTo(null)}>
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="input-row">
                  {currentSession && currentSession.type === 'group' && (
                    <button 
                      type="button" 
                      onClick={handleAtAll} 
                      className="at-all-btn"
                      title="@All"
                      style={{marginRight: '8px', padding: '0.5rem', borderRadius: '50%'}}
                    >
                      <AtSign size={20} />
                    </button>
                  )}
                  {atList.length > 0 && (
                    <div className="at-list">
                      {atList.map(at => (
                        <span key={at.id} className="at-tag" onClick={() => removeAt(at.id)}>
                          @{at.name}
                          <span className="at-remove">×</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Message ${currentSession ? currentSession.name : ''}...`}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    className="message-input"
                  />
                  <button type="submit" className="send-btn" disabled={status !== 'connected'}>
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="empty-state">
              <MessageSquare size={48} />
              <p>Select a chat or start a new one</p>
            </div>
          )}

          {showNewChat && (
            <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Start New Chat</h3>
                <form onSubmit={handleStartNewChat}>
                  <div className="form-group">
                    <label>Type</label>
                    <div className="radio-group">
                      <label>
                        <input type="radio" value="private" checked={newChatType === 'private'} onChange={e => setNewChatType(e.target.value)} />
                        Private
                      </label>
                      <label>
                        <input type="radio" value="group" checked={newChatType === 'group'} onChange={e => setNewChatType(e.target.value)} />
                        Group
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Target ID</label>
                    <input type="text" value={newChatId} onChange={e => setNewChatId(e.target.value)} placeholder="QQ Number or Group ID" required />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowNewChat(false)}>Cancel</button>
                    <button type="submit" className="primary">Start</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
