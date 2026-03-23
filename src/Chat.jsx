import React, { useState, useEffect, useRef } from 'react';
import { useOneBot } from './useOneBot';
import MessageRenderer from './MessageRenderer';
import SettingsPanel from './Settings';
import { MessageSquare, Users, User, Plus, Send, ArrowLeft, AtSign, Reply, X, Settings } from 'lucide-react';
import './Chat.css';
import './ChatTabs.css';
import './At.css';

export default function Chat({ config }) {
  const { status, messages, setMessages, sessions, sendMessage, sendImage, sendVideo, sendFile, fetchHistory, fetchGroupMemberList, getWsRef, friends, groups, groupMembers, selfInfo } = useOneBot(config.url, config.token);
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
  const [selectedImage, setSelectedImage] = useState(null); // { file, preview }
  const [selectedVideo, setSelectedVideo] = useState(null); // { file, preview }
  const [selectedFile, setSelectedFile] = useState(null); // { file, name, size }
  const [showAtMenu, setShowAtMenu] = useState(false); // Show @ user selection menu
  const [showDrawer, setShowDrawer] = useState(false); // Show attachment drawer
  const [showMessageMenu, setShowMessageMenu] = useState(false); // Show message context menu
  const [selectedMessage, setSelectedMessage] = useState(null); // Selected message for context menu
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); // Menu position
  const [fetchedMembersGroups, setFetchedMembersGroups] = useState({}); // Track which groups have had members fetched
  const [showSettings, setShowSettings] = useState(false); // Show settings panel
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [isUserAtBottom, setIsUserAtBottom] = useState(true); // Track if user is at bottom of messages
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileUploadInputRef = useRef(null);
  const atMenuRef = useRef(null);
  const messageMenuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('napcat_url');
    localStorage.removeItem('napcat_token');
    localStorage.removeItem('darkMode');
    window.location.reload();
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file);
      setSelectedImage({ file, preview });
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!selectedImage || !selectedSessionId) return;
    
    const session = currentSession;
    if (session) {
      try {
        await sendImage(session.id, selectedImage.file, session.type);
        setSelectedImage(null);
      } catch (error) {
        console.error('Failed to send image:', error);
        alert('Failed to send image: ' + error.message);
      }
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const preview = URL.createObjectURL(file);
      setSelectedVideo({ file, preview });
    }
    // Reset file input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleSendVideo = async () => {
    if (!selectedVideo || !selectedSessionId) return;
    
    const session = currentSession;
    if (session) {
      try {
        await sendVideo(session.id, selectedVideo.file, session.type);
        setSelectedVideo(null);
      } catch (error) {
        console.error('Failed to send video:', error);
        alert('Failed to send video: ' + error.message);
      }
    }
  };

  const handleRemoveVideo = () => {
    setSelectedVideo(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 检查文件大小：100MB 限制（图片和视频除外）
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && file.size > MAX_FILE_SIZE) {
        alert(`文件大小超过 100MB 限制（当前：${(file.size / (1024 * 1024)).toFixed(2)} MB）`);
        if (fileUploadInputRef.current) {
          fileUploadInputRef.current.value = '';
        }
        return;
      }
      setSelectedFile({ file, name: file.name, size: file.size });
    }
    // Reset file input
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = '';
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !selectedSessionId) return;
    
    const session = currentSession;
    if (session) {
      try {
        await sendFile(session.id, selectedFile.file, session.type);
        setSelectedFile(null);
      } catch (error) {
        console.error('Failed to send file:', error);
        alert('Failed to send file: ' + error.message);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = '';
    }
  };

  // Long press detection for mobile
  const useLongPress = (callback = () => {}, ms = 500) => {
    const [startLongPress, setStartLongPress] = useState(0);

    return {
      onMouseDown: (e) => {
        setStartLongPress(Date.now());
      },
      onMouseUp: (e) => {
        if (Date.now() - startLongPress < ms) {
          // Short press - do nothing, let normal click handle
        }
        setStartLongPress(0);
      },
      onMouseLeave: (e) => {
        setStartLongPress(0);
      },
      onTouchStart: (e) => {
        setStartLongPress(Date.now());
      },
      onTouchEnd: (e) => {
        if (Date.now() - startLongPress < ms) {
          // Short press - do nothing
        }
        setStartLongPress(0);
      },
      onTouchMove: (e) => {
        // If user scrolls, cancel long press
        setStartLongPress(0);
      }
    };
  };

  // Handle message context menu
  const handleMessageContextMenu = (msg, e, isLongPress = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if it's a right click or long press
    if (e.type === 'contextmenu' || isLongPress) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.type === 'contextmenu' ? e.clientX : rect.left + rect.width / 2;
      const y = e.type === 'contextmenu' ? e.clientY : rect.top + rect.height / 2;
      
      setSelectedMessage(msg);
      setMenuPosition({ x, y });
      setShowMessageMenu(true);
    }
  };

  const handleSendMessageCopy = async () => {
    // +1 functionality - send the same message
    if (!selectedMessage || !currentSession) return;
    
    try {
      await sendMessage(currentSession.id, selectedMessage.message, currentSession.type);
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to send message copy:', error);
    }
  };

  const handleDeleteMessage = async () => {
    // Delete message from server
    if (!selectedMessage || !selectedMessage.message_id) return;
    
    const ws = getWsRef();
    if (!ws || !ws.current) return;
    
    if (ws.current.readyState !== WebSocket.OPEN) return;
    
    try {
      // Send delete request to server
      ws.current.send(JSON.stringify({
        action: 'delete_msg',
        params: { 
          message_id: parseInt(selectedMessage.message_id)
        },
        echo: `delete_msg_${Date.now()}`
      }));
      
      // Note: Message will be removed when we receive the response echo
      // Don't remove locally until server confirms
      
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleRecallMessage = async () => {
    // Recall own message (within time limit)
    if (!selectedMessage || !selectedMessage.message_id) return;
    
    const timeLimit = 120; // 2 minutes in seconds
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - selectedMessage.time;
    
    if (timeDiff > timeLimit) return;
    
    const ws = getWsRef();
    if (!ws || !ws.current) return;
    
    if (ws.current.readyState !== WebSocket.OPEN) return;
    
    try {
      // Use delete_msg action which works for recall in OneBot
      ws.current.send(JSON.stringify({
        action: 'delete_msg',
        params: { 
          message_id: parseInt(selectedMessage.message_id),
          // NapCat specific: force recall even if beyond time limit (for admin)
          is_recall: true
        },
        echo: `recall_msg_${Date.now()}`
      }));
      
      // Update local message to show recall indicator
      const sessionId = `${currentSession.type}:${currentSession.id}`;
      setMessages(prev => {
        const sessionMessages = prev[sessionId] || [];
        return {
          ...prev,
          [sessionId]: sessionMessages.map(m => {
            if (m.message_id === selectedMessage.message_id) {
              return {
                ...m,
                message: [{
                  type: 'text',
                  data: { text: '原消息已被撤回' }
                }],
                recalled: true
              };
            }
            return m;
          })
        };
      });
      
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to recall message:', error);
    }
  };

  const handleSetEssenceMessage = async () => {
    // Set as essence message (admin/group owner only)
    if (!selectedMessage || !selectedMessage.message_id) return;
    
    const ws = getWsRef();
    if (!ws || !ws.current) return;
    
    if (ws.current.readyState !== WebSocket.OPEN) return;
    
    try {
      // Use set_msg_essence action for OneBot/NapCat
      ws.current.send(JSON.stringify({
        action: 'set_msg_essence',
        params: { 
          message_id: parseInt(selectedMessage.message_id),
          group_id: parseInt(currentSession.id)
        },
        echo: `essence_msg_${Date.now()}`
      }));
      
      // Update local message to show essence indicator
      const sessionId = `${currentSession.type}:${currentSession.id}`;
      setMessages(prev => {
        const sessionMessages = prev[sessionId] || [];
        return {
          ...prev,
          [sessionId]: sessionMessages.map(m => {
            if (m.message_id === selectedMessage.message_id) {
              return {
                ...m,
                essence: true
              };
            }
            return m;
          })
        };
      });
      
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to set essence message:', error);
    }
  };

  const handleGroupRecallMessage = async () => {
    // Group recall (admin/group owner only, no time limit)
    if (!selectedMessage || !selectedMessage.message_id) return;
    
    const ws = getWsRef();
    if (!ws || !ws.current) return;
    
    if (ws.current.readyState !== WebSocket.OPEN) return;
    
    try {
      // Use delete_msg with group_id for admin recall in OneBot/NapCat
      ws.current.send(JSON.stringify({
        action: 'delete_msg',
        params: { 
          message_id: parseInt(selectedMessage.message_id),
          group_id: parseInt(currentSession.id),
          // NapCat specific: admin recall without time limit
          is_recall: true
        },
        echo: `group_recall_${Date.now()}`
      }));
      
      // Update local message to show recall indicator
      const sessionId = `${currentSession.type}:${currentSession.id}`;
      setMessages(prev => {
        const sessionMessages = prev[sessionId] || [];
        return {
          ...prev,
          [sessionId]: sessionMessages.map(m => {
            if (m.message_id === selectedMessage.message_id) {
              return {
                ...m,
                message: [{
                  type: 'text',
                  data: { text: '原消息已被撤回' }
                }],
                recalled: true
              };
            }
            return m;
          })
        };
      });
      
      setShowMessageMenu(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to group recall message:', error);
    }
  };

  // Check if user is admin or group owner
  const isUserAdminOrOwner = () => {
    if (!currentSession || currentSession.type !== 'group' || !selfInfo) return false;
    
    const members = groupMembers[currentSession.id] || [];
    const selfMember = members.find(m => String(m.user_id) === String(selfInfo.user_id));
    
    if (!selfMember) return false;
    
    const role = selfMember.role;
    return role === 'owner' || role === 'admin';
  };

  const handleAtClick = () => {
    setShowAtMenu(true);
  };

  const handleAtUserSelect = (userId, userName) => {
    setAtList(prev => [...prev, { id: userId, name: userName }]);
    setShowAtMenu(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleAtAll = () => {
    setAtList(prev => [...prev, { id: 'all', name: '全体成员' }]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Fetch group members when entering a group chat
  useEffect(() => {
    if (selectedSessionId && currentSession && currentSession.type === 'group') {
      const groupId = currentSession.id;
      // Only fetch if not already fetched
      if (!fetchedMembersGroups[groupId]) {
        console.log('Fetching group members for group:', groupId);
        fetchGroupMemberList(groupId);
        setFetchedMembersGroups(prev => ({ ...prev, [groupId]: true }));
      }
    }
  }, [selectedSessionId, currentSession, fetchGroupMemberList, fetchedMembersGroups]);

  // Close @ menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAtMenu && atMenuRef.current && !atMenuRef.current.contains(event.target)) {
        setShowAtMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAtMenu]);

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDrawer && !event.target.closest('.attachment-area')) {
        setShowDrawer(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDrawer]);

  // Close message menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMessageMenu && messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
        setShowMessageMenu(false);
        setSelectedMessage(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMessageMenu]);

  // Get group members for @ menu
  const getGroupMembers = () => {
    if (!currentSession || currentSession.type !== 'group') return [];
    
    // Get members from groupMembers state
    const members = groupMembers[currentSession.id];
    if (members && Array.isArray(members)) {
      return [
        { user_id: 'all', nickname: '全体成员' },
        ...members.map(member => ({
          user_id: String(member.user_id),
          nickname: member.nickname || member.card || String(member.user_id)
        }))
      ];
    }
    
    // Fallback: if no members data, return just the all option
    return [
      { user_id: 'all', nickname: '全体成员' }
    ];
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
    const session = sessions[selectedSessionId] || getCurrentSessionInfo();
    
    if (session && oldestMessage) {
      const container = messagesContainerRef.current;
      if (container) {
        const firstMsgEl = container.querySelector(`[data-msg-id="${oldestMessage.message_id}"]`);
        if (firstMsgEl) {
          scrollOffsetBeforeLoad.current = firstMsgEl.offsetTop - container.scrollTop;
        }
      }
      
      oldestMessageIdRef.current = oldestMessage.message_id;
      setLoadingHistory(true);
      console.log('>>>>>> TRIGGERING MANUAL HISTORY LOAD <<<<<<', {
        type: session.type,
        id: session.id,
        count: 20,
        messageId: oldestMessage.message_id,
        messageSeq: oldestMessage.message_seq
      });
      // Pass both message_id and message_seq
      fetchHistory(session.type, session.id, 20, oldestMessage.message_id, oldestMessage.message_seq);
    } else {
      console.log('Missing session or oldest message:', { session, oldestMessage });
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Check if user is at bottom (within 50px threshold)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsUserAtBottom(isAtBottom);
    
    console.log('Scroll event:', {
      scrollTop,
      threshold: 50,
      isNearTop: scrollTop <= 50,
      loadingHistory,
      selectedSessionId,
      messageCount: currentMessages.length,
      oldestMessageIdRef: oldestMessageIdRef.current,
      isAtBottom
    });
    
    // Check if we hit the top threshold
    if (scrollTop <= 50 && !loadingHistory && selectedSessionId && currentMessages.length > 0) {
      const oldestMessage = currentMessages[0];
      const session = sessions[selectedSessionId] || getCurrentSessionInfo();
      
      console.log('Checking scroll load conditions:', {
        hasSession: !!session,
        hasOldestMessage: !!oldestMessage,
        oldestMessage,
        session
      });
      
      if (session && oldestMessage) {
        // Use message_id for tracking (NapCat uses message_id for pagination)
        const currentId = oldestMessage.message_id;
        
        console.log('ID check:', {
          currentId,
          currentIdType: typeof currentId,
          oldestMessageIdRef: oldestMessageIdRef.current,
          shouldSkip: oldestMessageIdRef.current === currentId,
          fullMessage: oldestMessage
        });
        
        // Prevent multiple triggers by checking if we just tried to load for this ID
        if (oldestMessageIdRef.current === currentId) {
          console.log('Skipping load - same ID as before');
          return;
        }

        const firstMsgEl = e.currentTarget.querySelector(`[data-msg-id="${oldestMessage.message_id}"]`);
        if (firstMsgEl) {
          scrollOffsetBeforeLoad.current = firstMsgEl.offsetTop - scrollTop;
        }
        
        oldestMessageIdRef.current = currentId;
        setLoadingHistory(true);
        console.log('>>>>>> TRIGGERING HISTORY LOAD <<<<<<', {
          type: session.type,
          id: session.id,
          count: 20,
          messageId: oldestMessage.message_id,
          messageSeq: oldestMessage.message_seq
        });
        // Pass both message_id and message_seq
        fetchHistory(session.type, session.id, 20, oldestMessage.message_id, oldestMessage.message_seq);
      }
    }
  };

  useEffect(() => {
    if (loadingHistory) {
        // Auto-reset loading state if no new messages arrive within 2 seconds (e.g., reached the end)
        const timer = setTimeout(() => {
            setLoadingHistory(false);
            // Clear oldestMessageIdRef to allow next scroll-to-top to trigger load
            // Even if no messages were loaded, we should allow retry
            oldestMessageIdRef.current = null;
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [loadingHistory, selectedSessionId]);

  // Scroll to bottom on initial load or new outgoing message
  const prevMessagesLength = useRef(0);
  const prevSessionId = useRef(null);
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewMessage = currentMessages.length > prevMessagesLength.current;
    const isHistoryLoad = isNewMessage && oldestMessageIdRef.current !== null;
    const isSessionSwitch = prevSessionId.current !== selectedSessionId;
    
    // Check if this is a new session or messages just loaded from localStorage
    if (prevMessagesLength.current === 0 && currentMessages.length > 0) {
        // Initial load - always scroll to bottom when opening a chat
        console.log('Initial load - scroll to bottom, messages:', currentMessages.length);
        
        // Use setTimeout to ensure DOM is rendered
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "auto" });
                console.log('Scrolled to bottom');
            }
            setIsUserAtBottom(true);
        }, 100);
    } else if (isNewMessage) {
        if (isHistoryLoad) {
            // History was loaded! 
            // Restore exact scroll position relative to the oldest message before load
            console.log('History loaded - restoring scroll position');
            const oldFirstMsgEl = container.querySelector(`[data-msg-id="${oldestMessageIdRef.current}"]`);
            if (oldFirstMsgEl) {
                container.scrollTop = oldFirstMsgEl.offsetTop - scrollOffsetBeforeLoad.current;
            } else {
                console.warn('Could not find the reference message element');
            }
            setLoadingHistory(false);
            // Clear oldestMessageIdRef after restoring scroll
            oldestMessageIdRef.current = null;
        } else if (!loadingHistory) {
            // Normal new message - only auto-scroll if user is at bottom
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg && lastMsg.direction === 'outgoing') {
                // User sent a message - always scroll to bottom
                console.log('Outgoing message - scroll to bottom');
                if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
                setIsUserAtBottom(true);
            } else {
                // Received a message - only scroll if user was already at bottom
                console.log('Received message - isUserAtBottom:', isUserAtBottom);
                if (isUserAtBottom) {
                    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
                }
            }
        }
    }
    
    prevMessagesLength.current = currentMessages.length;
    prevSessionId.current = selectedSessionId;
  }, [currentMessages, selectedSessionId, loadingHistory, isUserAtBottom]);

  // Reset tracking when switching sessions
  useEffect(() => {
    oldestMessageIdRef.current = null;
    prevMessagesLength.current = 0;
    setLoadingHistory(false);
    setIsUserAtBottom(true); // Reset to true when switching chats
  }, [selectedSessionId]);

  const handleContactClick = (type, id, name, avatar) => {
    const sessionId = `${type}:${id}`;
    
    if (!sessions[sessionId]) {
        setNewChatType(type);
        setNewChatId(id);
        setSelectedSessionId(sessionId);
        // Load more messages for private chats (100) vs group chats (20)
        const messageCount = type === 'private' ? 100 : 20;
        fetchHistory(type, id, messageCount);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={`status-badge ${status}`}>
                {status}
              </div>
              <button 
                className="settings-btn" 
                onClick={() => setShowSettings(true)}
                title="设置"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Settings size={20} />
              </button>
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
                  const timeLimit = 120; // 2 minutes
                  const now = Math.floor(Date.now() / 1000);
                  const timeDiff = now - msg.time;
                  const canRecall = isSelf && timeDiff <= timeLimit;
                  const isAdmin = isUserAdminOrOwner();
                  
                  return (
                  <div 
                    key={index} 
                    data-msg-id={msg.message_id} 
                    className={`message ${isSelf ? 'sent' : 'received'} ${msg.essence ? 'essence-message' : ''} ${msg.recalled ? 'recalled-message' : ''}`}
                    onContextMenu={(e) => {
                      // Disable context menu for recalled messages
                      if (msg.recalled) {
                        e.preventDefault();
                        return;
                      }
                      handleMessageContextMenu(msg, e);
                    }}
                    style={{
                      cursor: msg.recalled ? 'not-allowed' : 'context-menu',
                      opacity: msg.recalled ? 0.6 : 1,
                      position: 'relative'
                    }}
                    title={msg.recalled ? '已撤回的消息无法操作' : '右键点击查看更多操作'}
                  >
                    {msg.essence && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '8px',
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        color: 'white',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 10
                      }}>
                        ⭐ 精华
                      </div>
                    )}
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
                      <MessageRenderer 
                        message={msg.message} 
                        onAt={(qq, nickname) => handleAtUser(qq, nickname)}
                        groupMembers={currentSession && currentSession.type === 'group' ? (groupMembers[currentSession.id] || []) : []}
                      />
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
                
                {/* Image preview */}
                {selectedImage && (
                  <div className="image-preview-area" style={{ padding: '0.5rem', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={selectedImage.preview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px' }} />
                      <button 
                        type="button" 
                        onClick={handleRemoveImage}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Video preview */}
                {selectedVideo && (
                  <div className="video-preview-area" style={{ padding: '0.5rem', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <video src={selectedVideo.preview} style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px' }} controls />
                      <button 
                        type="button" 
                        onClick={handleRemoveVideo}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* File preview */}
                {selectedFile && (
                  <div className="file-preview-area" style={{ padding: '0.5rem', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '32px' }}>📁</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedFile.name}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#6b7280' }}>
                          {Math.round(selectedFile.size / 1024)} KB
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleRemoveFile}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="input-row">
                  {/* Attachment button with drawer */}
                  <div className="attachment-area" style={{ position: 'relative', marginRight: '8px' }}>
                    {/* Plus button to toggle drawer */}
                    <button 
                      type="button" 
                      onClick={() => setShowDrawer(!showDrawer)} 
                      className="attachment-btn"
                      title="Attachments"
                      style={{
                        padding: '0.5rem', 
                        borderRadius: '50%', 
                        background: showDrawer ? '#3b82f6' : '#6b7280', 
                        border: 'none', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        transition: 'background 0.2s'
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="white" xmlns="http://www.w3.org/2000/svg" style={{transform: showDrawer ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}>
                        <path d="M10 2.5C10.8284 2.5 11.5 3.17157 11.5 4V8.5H16C16.8284 8.5 17.5 9.17157 17.5 10C17.5 10.8284 16.8284 11.5 16 11.5H11.5V16C11.5 16.8284 10.8284 17.5 10 17.5C9.17157 17.5 8.5 16.8284 8.5 16V11.5H4C3.17157 11.5 2.5 10.8284 2.5 10C2.5 9.17157 3.17157 8.5 4 8.5H8.5V4C8.5 3.17157 9.17157 2.5 10 2.5Z"/>
                      </svg>
                    </button>
                    
                    {/* Drawer with attachment options */}
                    {showDrawer && (
                      <div 
                        className="attachment-drawer"
                        style={{
                          position: 'absolute',
                          bottom: '45px',
                          left: '0',
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          minWidth: '160px',
                          zIndex: 1001,
                          animation: 'slideUp 0.2s ease-out'
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                          选择文件类型
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { fileInputRef.current?.click(); setShowDrawer(false); }} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f3f4f6',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="#6b7280" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5ZM10 4.16667C11.2308 4.16667 12.3833 4.53583 13.3542 5.17917L10.875 7.65833C10.6792 7.85417 10.6792 8.17083 10.875 8.36667L13.3542 10.8458C12.3833 11.4892 11.2308 11.8583 10 11.8583C7.79167 11.8583 5.91667 10.4667 5.16667 8.58333H7.08333C7.08333 8.12083 6.70833 7.74583 6.25 7.74583H3.75C3.2875 7.74583 2.9125 8.12083 2.9125 8.58333V11.0833C2.9125 11.5458 3.2875 11.9208 3.75 11.9208C4.2125 11.9208 4.5875 11.5458 4.5875 11.0833V9.6875C5.58333 12.2708 8.08333 14.1667 11.0417 14.1667C14.9292 14.1667 18.0833 11.0125 18.0833 7.125C18.0833 3.2375 14.9292 0.0833333 11.0417 0.0833333H10V4.16667Z" fill="#6b7280"/>
                          </svg>
                          <span style={{ color: '#1f2937', fontSize: '14px' }}>图片</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { videoInputRef.current?.click(); setShowDrawer(false); }} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f3f4f6',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="#6b7280" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 3.5C15 2.67157 14.3284 2 13.5 2H6.5C5.67157 2 5 2.67157 5 3.5V16.5C5 17.3284 5.67157 18 6.5 18H13.5C14.3284 18 15 17.3284 15 16.5V3.5ZM13.5 16.5H6.5V3.5H13.5V16.5ZM10.5 7.5L13 10L10.5 12.5V7.5Z"/>
                          </svg>
                          <span style={{ color: '#1f2937', fontSize: '14px' }}>视频</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { fileUploadInputRef.current?.click(); setShowDrawer(false); }} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f3f4f6',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="#6b7280" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2.5C7.5 2.5 5.5 4.5 5.5 7V10H3L6.5 13.5L10 10H7.5V7C7.5 5.5 8.5 4.5 10 4.5C11.5 4.5 12.5 5.5 12.5 7V10H14.5V7C14.5 4.5 12.5 2.5 10 2.5ZM4.5 12V15.5C4.5 16.5 5.5 17.5 6.5 17.5H13.5C14.5 17.5 15.5 16.5 15.5 15.5V12H13.5V15.5H6.5V12H4.5Z"/>
                          </svg>
                          <span style={{ color: '#1f2937', fontSize: '14px' }}>文件</span>
                        </button>
                        {currentSession && currentSession.type === 'group' && (
                          <button 
                            type="button" 
                            onClick={() => { handleAtClick(); setShowDrawer(false); }} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#f3f4f6',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          >
                            <AtSign size={20} style={{ color: '#6b7280' }} />
                            <span style={{ color: '#1f2937', fontSize: '14px' }}>@成员</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={fileUploadInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  {/* @ User Selection Menu */}
                  {showAtMenu && currentSession && currentSession.type === 'group' && (
                    <div 
                      ref={atMenuRef}
                      className="at-menu"
                      style={{
                        position: 'absolute',
                        bottom: '60px',
                        left: '10px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        minWidth: '200px'
                      }}
                    >
                      <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', color: '#374151' }}>
                        选择要@的用户
                      </div>
                      {getGroupMembers().map(member => (
                        <div
                          key={member.user_id}
                          onClick={() => handleAtUserSelect(member.user_id, member.nickname)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <AtSign size={16} style={{ color: '#6b7280' }} />
                          <span style={{ color: '#1f2937' }}>{member.nickname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Message Context Menu */}
                  {showMessageMenu && selectedMessage && (() => {
                    const isSelfMsg = selectedMessage.direction === 'outgoing' || String(selectedMessage.user_id) === String(selfInfo ? selfInfo.user_id : '');
                    const timeLimit = 120; // 2 minutes
                    const now = Math.floor(Date.now() / 1000);
                    const timeDiff = now - selectedMessage.time;
                    const canRecallMsg = isSelfMsg && timeDiff <= timeLimit;
                    const isAdminUser = isUserAdminOrOwner();
                    
                    return (
                    <div 
                      ref={messageMenuRef}
                      className="message-context-menu"
                      style={{
                        position: 'fixed',
                        top: menuPosition.y,
                        left: menuPosition.x,
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: '180px',
                        zIndex: 10000,
                        animation: 'slideUp 0.2s ease-out'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#9ca3af', padding: '4px 8px', marginBottom: '4px' }}>
                        消息操作
                      </div>
                      
                      {/* +1 option */}
                      <button
                        onClick={handleSendMessageCopy}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: '#1f2937',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '18px' }}>👍</span>
                        <span>+1</span>
                      </button>
                      
                      {/* Delete option */}
                      <button
                        onClick={handleDeleteMessage}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: '#1f2937',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '18px' }}>🗑️</span>
                        <span>删除</span>
                      </button>
                      
                      {/* Recall option (own message, within time limit) */}
                      {canRecallMsg && (
                        <button
                          onClick={handleRecallMessage}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            color: '#1f2937',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontSize: '18px' }}>↩️</span>
                          <span>撤回</span>
                        </button>
                      )}
                      
                      {/* Divider */}
                      <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
                      
                      {/* Admin/Owner only options */}
                      {isAdminUser && currentSession && currentSession.type === 'group' && (
                        <>
                          {/* Set essence message */}
                          <button
                            onClick={handleSetEssenceMessage}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '14px',
                              color: '#1f2937',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '18px' }}>⭐</span>
                            <span>设为精华</span>
                          </button>
                          
                          {/* Group recall (no time limit) */}
                          <button
                            onClick={handleGroupRecallMessage}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '14px',
                              color: '#ef4444',
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '18px' }}>🚫</span>
                            <span>群撤回</span>
                          </button>
                        </>
                      )}
                    </div>
                  );
                  })()}
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
                  {selectedImage ? (
                    <button type="button" onClick={handleSendImage} className="send-btn" disabled={status !== 'connected'}>
                      <Send size={20} />
                    </button>
                  ) : selectedVideo ? (
                    <button type="button" onClick={handleSendVideo} className="send-btn" disabled={status !== 'connected'}>
                      <Send size={20} />
                    </button>
                  ) : selectedFile ? (
                    <button type="button" onClick={handleSendFile} className="send-btn" disabled={status !== 'connected'}>
                      <Send size={20} />
                    </button>
                  ) : (
                    <button type="submit" className="send-btn" disabled={status !== 'connected'}>
                      <Send size={20} />
                    </button>
                  )}
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

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        config={config}
        selfInfo={selfInfo}
      />
    </div>
  );
}
