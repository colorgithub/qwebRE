import { useState, useEffect, useRef, useCallback } from 'react';

export function useOneBot(url, token) {
  const [status, setStatus] = useState('disconnected');
  
  // 不从 localStorage 加载消息，因为文件应该存储在服务器上
  // 消息会在运行时从 NapCat 服务器加载
  const [messages, setMessages] = useState({});
  const [sessions, setSessions] = useState({}); // { sessionId: { id, type, name, avatar, lastMessage, timestamp } }
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState({}); // { groupId: [member1, member2] }
  const [customFaces, setCustomFaces] = useState([]); // [{ faceId, url, raw }]
  const [customFacePager, setCustomFacePager] = useState({
    loading: false,
    marker: 'idle', // idle | ready | end | error
    count: 48
  });
  const [selfInfo, setSelfInfo] = useState(null);
  const wsRef = useRef(null);
  const selfInfoRef = useRef(null);
  const pendingActionsRef = useRef({});
  const getWsRef = () => wsRef; // Export wsRef for external use

  const getSessionId = (type, id) => `${type}:${id}`;

  // 生成消息预览文本
  const getMessagePreview = (message) => {
    if (typeof message === 'string') {
      return message;
    }
    
    if (Array.isArray(message)) {
      // 解析消息数组，生成预览
      const previews = [];
      for (const segment of message) {
        if (segment.type === 'text') {
          previews.push(segment.data?.text || '');
        } else if (segment.type === 'image') {
          previews.push('[图片]');
        } else if (segment.type === 'face') {
          previews.push('[表情]');
        } else if (segment.type === 'video') {
          previews.push('[视频]');
        } else if (segment.type === 'record') {
          previews.push('[语音]');
        } else if (segment.type === 'file') {
          previews.push(`[文件：${segment.data?.name || '未知文件'}]`);
        } else if (segment.type === 'at') {
          if (String(segment.data?.qq) === 'all') {
            previews.push('@全体成员');
          } else {
            previews.push(`@${segment.data?.name || segment.data?.qq || '某人'}`);
          }
        } else if (segment.type === 'reply') {
          previews.push('[回复]');
        } else if (segment.type === 'share') {
          previews.push(segment.data?.title || '[分享]');
        } else if (segment.type === 'json') {
          try {
            const jsonData = typeof segment.data?.data === 'string' ? JSON.parse(segment.data.data) : segment.data?.data;
            if (jsonData?.app === 'com.tencent.miniapp') {
              previews.push('[小程序]');
            } else if (jsonData?.prompt) {
              previews.push(jsonData.prompt);
            } else {
              previews.push('[JSON 消息]');
            }
          } catch {
            previews.push('[JSON 消息]');
          }
        } else {
          previews.push(`[${segment.type}]`);
        }
      }
      return previews.join(' ');
    }
    
    return '[消息]';
  };

  const fetchContacts = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'get_login_info',
        echo: 'get_login_info'
      }));
      wsRef.current.send(JSON.stringify({
        action: 'get_friend_list',
        echo: 'get_friend_list'
      }));
      wsRef.current.send(JSON.stringify({
        action: 'get_group_list',
        echo: 'get_group_list'
      }));
    }
  }, []);

  const fetchGroupInfo = useCallback((groupId) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
              action: 'get_group_info',
              params: { group_id: parseInt(groupId) },
              echo: `group_info_${groupId}`
          }));
      }
  }, []);

  const fetchGroupMemberList = useCallback((groupId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'get_group_member_list',
        params: { group_id: parseInt(groupId) },
        echo: `group_members_${groupId}`
      }));
    }
  }, []);

  const fetchHistory = useCallback((type, id, count = 100, messageId, messageSeq) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // NapCat API names:
      // For group chats: get_group_msg_history
      // For private chats: get_forward_msg_history (OneBot standard)
      const action = type === 'group' ? 'get_group_msg_history' : 'get_forward_msg_history';
      
      console.log('=== Fetch History Request ===', { type, id, count, messageId, messageSeq, action });
      
      // Build params based on chat type
      let params = {};
      
      // Set the correct ID parameter based on chat type
      if (type === 'group') {
        params.group_id = id.toString();
      } else {
        params.user_id = id.toString();
      }
      
      // NapCat pagination logic:
      // - For group chats: uses message_seq
      // - For private chats: uses message_id
      if (messageSeq && type === 'group') {
          params.message_seq = messageSeq.toString();
          console.log('Using message_seq for pagination:', params.message_seq);
      } else if (messageId) {
          params.message_id = messageId.toString();
          console.log('Using message_id for pagination:', params.message_id);
      } else {
          console.log('Fetching latest messages (no pagination)');
      }

      // Add count parameter - default to 100 for private chats, 20 for group chats
      params.count = (count || (type === 'private' ? 100 : 20)).toString();
      
      // Add required boolean parameters for both group and private chats
      params.reverse_order = 'true';
      params.disable_get_url = 'false';
      params.parse_mult_msg = 'true';
      params.quick_reply = 'false';

      console.log('Final params:', JSON.stringify(params, null, 2));

      wsRef.current.send(JSON.stringify({
        action: action,
        params: params,
        echo: `history_${type}_${id}_${messageSeq || messageId || 'latest'}`
      }));
    } else {
      console.warn('WebSocket not connected, cannot fetch history');
    }
  }, []);

  const normalizeCustomFaces = useCallback((payload) => {
    const root = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.faces)
          ? payload.faces
          : Array.isArray(payload?.list)
            ? payload.list
            : [];

    const findLikelyUrl = (obj) => {
      if (!obj || typeof obj !== 'object') return '';
      const preferredKeys = [
        'url', 'file', 'path', 'download_url', 'img_url', 'img', 'src', 'thumb', 'thumbnail'
      ];
      for (const key of preferredKeys) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      for (const value of Object.values(obj)) {
        if (typeof value !== 'string') continue;
        const v = value.trim();
        if (!v) continue;
        if (
          v.startsWith('http://') ||
          v.startsWith('https://') ||
          v.startsWith('base64://') ||
          v.startsWith('file://')
        ) {
          return v;
        }
      }
      return '';
    };

    const findLikelyCode = (obj) => {
      if (!obj || typeof obj !== 'object') return '';
      const preferredKeys = [
        'face_id', 'id', 'custom_face_id', 'emoji_id', 'file_id', 'code', 'face_code', 'qid'
      ];
      for (const key of preferredKeys) {
        const value = obj[key];
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim();
        }
      }
      for (const value of Object.values(obj)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
      }
      return '';
    };

    return root
      .map((item, index) => {
        if (typeof item === 'number' || typeof item === 'string') {
          const raw = String(item);
          const parsed = parseInt(raw, 10);
          const faceId = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
          return {
            key: `${raw}_${index}`,
            faceId,
            faceCode: raw,
            url: '',
            raw: item
          };
        }
        if (!item || typeof item !== 'object') return null;
        const faceCode = findLikelyCode(item);
        const parsed = parseInt(faceCode, 10);
        const faceId = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
        const url = findLikelyUrl(item);
        return {
          key: `${faceCode || 'face'}_${index}`,
          faceId,
          faceCode,
          url: typeof url === 'string' ? url : '',
          raw: item
        };
      })
      .filter((item) => item && (item.faceId !== null || item.faceCode || item.url));
  }, []);

  const fetchCustomFace = useCallback(() => {
    return fetchCustomFaceWithPager({ pagerType: 'append', count: customFacePager.count });
  }, [customFacePager.count]);

  const mergeCustomFaces = useCallback((baseList, incomingList) => {
    const merged = [];
    const seen = new Set();
    const pushUnique = (item) => {
      const key = [
        item?.key || '',
        item?.faceId ?? '',
        item?.faceCode || '',
        item?.url || ''
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    };
    (baseList || []).forEach(pushUnique);
    (incomingList || []).forEach(pushUnique);
    return merged;
  }, []);

  const fetchCustomFaceWithPager = useCallback(({ pagerType = 'append', count = 48 } = {}) => {
    if (!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.warn('WebSocket not connected, cannot fetch custom face');
      setCustomFacePager(prev => ({ ...prev, loading: false, marker: 'error' }));
      return;
    }
    const safeCount = Number.isFinite(Number(count)) ? Math.max(1, Number(count)) : 48;
    const safePagerType = pagerType === 'full' ? 'full' : 'append';
    setCustomFacePager(prev => ({ ...prev, loading: true, marker: prev.marker === 'end' && safePagerType === 'append' ? 'end' : prev.marker, count: safeCount }));
    wsRef.current.send(JSON.stringify({
      action: 'fetch_custom_face',
      params: { count: safeCount },
      echo: `fetch_custom_face_${safePagerType}_${safeCount}_${Date.now()}`
    }));
  }, []);

  const reloadCustomFace = useCallback(() => {
    fetchCustomFaceWithPager({ pagerType: 'full', count: 48 });
  }, [fetchCustomFaceWithPager]);

  const loadMoreCustomFace = useCallback(() => {
    setCustomFacePager(prev => {
      if (prev.loading || prev.marker === 'end') return prev;
      const nextCount = prev.count + 48;
      fetchCustomFaceWithPager({ pagerType: 'append', count: nextCount });
      return { ...prev, loading: true, count: nextCount };
    });
  }, [fetchCustomFaceWithPager]);

  const sendActionWithEcho = useCallback((action, params = {}, echoPrefix = action) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const echo = `${echoPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        if (pendingActionsRef.current[echo]) {
          delete pendingActionsRef.current[echo];
          reject(new Error(`Action timeout: ${action}`));
        }
      }, 12000);

      pendingActionsRef.current[echo] = {
        resolve,
        reject,
        timer
      };

      wsRef.current.send(JSON.stringify({
        action,
        params,
        echo
      }));
    });
  }, []);

  const updateNickname = useCallback(async (nickname) => {
    const trimmed = (nickname || '').trim();
    if (!trimmed) {
      throw new Error('Nickname cannot be empty');
    }

    const result = await sendActionWithEcho('set_qq_profile', { nickname: trimmed }, 'set_nickname');

    // Refresh self info after profile update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'get_login_info',
        echo: 'get_login_info'
      }));
    }
    return result;
  }, [sendActionWithEcho]);

  const updateSignature = useCallback(async (signature) => {
    const text = (signature || '').trim();
    if (!text) {
      throw new Error('Signature cannot be empty');
    }

    try {
      // NapCat/Go-CQHTTP common API
      const result = await sendActionWithEcho('set_self_longnick', { longNick: text }, 'set_signature');
      return result;
    } catch (err) {
      // Fallback for implementations that map signature to personal_note
      return sendActionWithEcho('set_qq_profile', { personal_note: text }, 'set_signature_alt');
    }
  }, [sendActionWithEcho]);

  const updateGroupName = useCallback(async (groupId, groupName) => {
    const gid = Number(groupId);
    const name = String(groupName || '').trim();
    if (!Number.isFinite(gid) || gid <= 0) {
      throw new Error('Invalid group id');
    }
    if (!name) {
      throw new Error('Group name cannot be empty');
    }
    const result = await sendActionWithEcho(
      'set_group_name',
      { group_id: gid, group_name: name },
      'set_group_name'
    );
    fetchGroupInfo(gid);
    return result;
  }, [sendActionWithEcho, fetchGroupInfo]);

  const setGroupWholeBan = useCallback(async (groupId, enable) => {
    const gid = Number(groupId);
    if (!Number.isFinite(gid) || gid <= 0) {
      throw new Error('Invalid group id');
    }
    return sendActionWithEcho(
      'set_group_whole_ban',
      { group_id: gid, enable: !!enable },
      'set_group_whole_ban'
    );
  }, [sendActionWithEcho]);

  const leaveGroup = useCallback(async (groupId, isDismiss = false) => {
    const gid = Number(groupId);
    if (!Number.isFinite(gid) || gid <= 0) {
      throw new Error('Invalid group id');
    }
    return sendActionWithEcho(
      'set_group_leave',
      { group_id: gid, is_dismiss: !!isDismiss },
      'set_group_leave'
    );
  }, [sendActionWithEcho]);

  const getForwardMessage = useCallback(async (forwardId) => {
    const id = String(forwardId || '').trim();
    if (!id) {
      throw new Error('forward id is required');
    }
    return sendActionWithEcho('get_forward_msg', { id }, 'get_forward_msg');
  }, [sendActionWithEcho]);

  const addMessage = useCallback((msg) => {
    const isPrivate = msg.message_type === 'private';
    // For incoming messages:
    // - Private: user_id is the sender (the other person).
    // - Group: group_id is the group.
    // For outgoing messages (which we manually construct):
    // - Private: user_id is the receiver (the other person).
    // - Group: group_id is the group.
    
    // So targetId is always the 'other' entity ID.
    const targetId = isPrivate ? msg.user_id : msg.group_id;
    const sessionId = getSessionId(msg.message_type, targetId);
    
    setMessages(prev => {
      const currentMessages = prev[sessionId] || [];
      // Simple dedup by message_id if available
      if (msg.message_id && currentMessages.some(m => m.message_id === msg.message_id)) {
        return prev;
      }
      
      // 不保存到 localStorage，因为 base64 数据会占用太多空间
      // 文件应该存储在 NapCat 服务器上，通过 URL 访问
      const updated = Object.assign({}, prev, {
        [sessionId]: [].concat(currentMessages, [msg])
      });
      
      console.log('Message added to memory (not saved to localStorage):', {
        sessionId,
        type: msg.message?.[0]?.type,
        messageCount: updated[sessionId].length
      });
      
      return updated;
    });

    setSessions(prev => {
      const existingSession = prev[sessionId] || {};
      let name = existingSession.name;
      
      if (isPrivate) {
          name = msg.sender?.nickname || name || targetId;
      } else {
          // For group, targetId is the group ID. 
          // If we don't have a name yet, use ID and trigger fetch.
          if (!name) {
              name = `Group ${targetId}`;
              fetchGroupInfo(targetId);
          }
      }

      return Object.assign({}, prev, {
        [sessionId]: Object.assign({}, existingSession, {
          id: targetId,
          type: msg.message_type,
          name: name,
          lastMessage: getMessagePreview(msg.message),
          timestamp: msg.time,
          avatar: isPrivate 
            ? `https://q1.qlogo.cn/g?b=qq&nk=${targetId}&s=640`
            : `https://p.qlogo.cn/gh/${targetId}/${targetId}/100`
        })
      });
    });
  }, [fetchGroupInfo]);

  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

  useEffect(() => {
    if (!url) return;

    let wsUrl = url;
    if (token) {
      wsUrl += (wsUrl.includes('?') ? '&' : '?') + `access_token=${token}`;
    }

    let reconnectTimer = null;
    let isComponentMounted = true;

    const connect = () => {
      console.log('Connecting to', wsUrl);
      setStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted) return;
        console.log('Connected to OneBot');
        setStatus('connected');
        fetchContacts();
      };

      ws.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.echo && pendingActionsRef.current[data.echo]) {
            const pending = pendingActionsRef.current[data.echo];
            clearTimeout(pending.timer);
            delete pendingActionsRef.current[data.echo];
            if (data.status === 'ok' || data.retcode === 0) {
              pending.resolve(data);
            } else {
              pending.reject(new Error(data.message || `Action failed: ${data.echo}`));
            }
          } else if (data.post_type === 'message') {
            const isSelf = String(data.user_id) === String(selfInfoRef.current ? selfInfoRef.current.user_id : '');
            addMessage(Object.assign({}, data, { direction: isSelf ? 'outgoing' : 'incoming' }));
          } else if (data.echo === 'get_login_info') {
            if (data.status === 'ok' && data.data) {
              setSelfInfo(data.data);
            }
          } else if (data.echo === 'get_friend_list') {
            if (data.status === 'ok' && Array.isArray(data.data)) {
              setFriends(data.data);
            }
          } else if (data.echo === 'get_group_list') {
            if (data.status === 'ok' && Array.isArray(data.data)) {
              setGroups(data.data);
            }
          } else if (data.echo && data.echo.startsWith('fetch_custom_face_')) {
            const match = /^fetch_custom_face_(full|append)_(\d+)_/.exec(data.echo || '');
            const pagerType = match ? match[1] : 'append';
            const requestedCount = match ? parseInt(match[2], 10) : 48;
            if (data.status === 'ok') {
              const list = normalizeCustomFaces(data.data);
              const invalid = list.filter((item) => item.faceId === null && !item.url);
              if (invalid.length > 0) {
                console.warn('Unsendable custom faces detected:', invalid.slice(0, 5));
              }
              if (pagerType === 'full') {
                setCustomFaces(list);
              } else {
                setCustomFaces(prev => mergeCustomFaces(prev, list));
              }
              const isEnd = list.length === 0 || list.length < requestedCount;
              setCustomFacePager(prev => ({
                ...prev,
                loading: false,
                marker: isEnd ? 'end' : 'ready',
                count: requestedCount
              }));
              console.log('Custom faces fetched:', list.length);
            } else {
              console.error('Failed to fetch custom faces:', data);
              setCustomFacePager(prev => ({ ...prev, loading: false, marker: 'error' }));
            }
          } else if (data.echo && data.echo.startsWith('delete_msg_')) {
            // Handle message deletion response
            if (data.status === 'ok') {
              console.log('Message deleted successfully on server');
              // Message will be removed from all sessions
              setMessages(prev => {
                const updated = {};
                Object.keys(prev).forEach(sessionId => {
                  updated[sessionId] = prev[sessionId].filter(m => 
                    String(m.message_id) !== String(data.params?.message_id)
                  );
                });
                return updated;
              });
            } else {
              console.error('Failed to delete message on server:', data);
            }
          } else if (data.echo && data.echo.startsWith('essence_msg_')) {
            // Handle essence message response
            if (data.status === 'ok') {
              console.log('Message set as essence successfully');
              // Update local message state
              const messageId = data.params?.message_id;
              setMessages(prev => {
                const updated = {};
                Object.keys(prev).forEach(sessionId => {
                  updated[sessionId] = prev[sessionId].map(m => {
                    if (String(m.message_id) === String(messageId)) {
                      return { ...m, essence: true };
                    }
                    return m;
                  });
                });
                return updated;
              });
            } else {
              console.error('Failed to set essence message:', data);
            }
          } else if (data.echo && data.echo.startsWith('recall_msg_')) {
            // Handle message recall response
            if (data.status === 'ok') {
              console.log('Message recalled successfully');
              const messageId = data.params?.message_id;
              setMessages(prev => {
                const updated = {};
                Object.keys(prev).forEach(sessionId => {
                  updated[sessionId] = prev[sessionId].map(m => {
                    if (String(m.message_id) === String(messageId)) {
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
                  });
                });
                return updated;
              });
            } else {
              console.error('Failed to recall message:', data);
            }
          } else if (data.echo && data.echo.startsWith('group_recall_')) {
            // Handle group recall response
            if (data.status === 'ok') {
              console.log('Message group recalled successfully');
              const messageId = data.params?.message_id;
              setMessages(prev => {
                const updated = {};
                Object.keys(prev).forEach(sessionId => {
                  updated[sessionId] = prev[sessionId].map(m => {
                    if (String(m.message_id) === String(messageId)) {
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
                  });
                });
                return updated;
              });
            } else {
              console.error('Failed to group recall message:', data);
            }
          } else if (data.echo && data.echo.startsWith('history_')) {
            const parts = data.echo.split('_');
            const type = parts[1];
            const id = parts[2];
            
            console.log('========== HISTORY RESPONSE ==========');
            console.log('Echo:', data.echo);
            console.log('Type:', type);
            console.log('ID:', id);
            console.log('Status:', data.status);
            console.log('Retcode:', data.retcode);
            console.log('Data:', data.data);
            
            // Check for unsupported API
            if (data.retcode === 1404 || (data.message && data.message.includes('不支持'))) {
              console.warn('API not supported for this chat type:', {
                type,
                action: data.action,
                message: data.message
              });
              
              // Show user-friendly message in console
              if (type === 'private') {
                console.log('%c[提示] 当前版本的 NapCat 可能不支持私聊历史消息加载。', 'color: orange; font-size: 14px; font-weight: bold;');
                console.log('%c这不影响正常聊天，只是无法向上滚动加载更多历史消息。', 'color: orange; font-size: 12px;');
              }
            }
            
            // Check for error responses
            if (data.status !== 'ok') {
              console.error('History request failed:', {
                echo: data.echo,
                status: data.status,
                retcode: data.retcode,
                data: data.data
              });
            }
            
            if (data.data && typeof data.data === 'object') {
              console.log('Data keys:', Object.keys(data.data));
              console.log('Data.messages exists:', data.data.messages ? 'yes' : 'no');
              console.log('Data.messages length:', data.data.messages ? data.data.messages.length : 'N/A');
              console.log('Data.data exists:', data.data.data ? 'yes' : 'no');
              if (data.data.data && Array.isArray(data.data.data)) {
                console.log('Data.data length:', data.data.data.length);
              }
            }
            if (Array.isArray(data.data)) {
              console.log('Data is array, length:', data.data.length);
              if (data.data.length > 0) {
                console.log('First message:', data.data[0]);
              }
            }

            if (data.status === 'ok' && data.data) {
              // Try to find the exact property the backend sent us (NapCat uses 'messages')
              let historyMessages = [];
              if (Array.isArray(data.data)) {
                historyMessages = data.data;
                console.log('Using data as array directly');
              } else if (data.data && Array.isArray(data.data.messages)) {
                historyMessages = data.data.messages;
                console.log('Using data.messages array');
              } else if (data.data && Array.isArray(data.data.data)) {
                // Some APIs return data inside data.data
                historyMessages = data.data.data;
                console.log('Using data.data array');
              } else if (data.data && typeof data.data === 'object') {
                // Fallback: look for any array inside data.data
                const arrKey = Object.keys(data.data).find(key => Array.isArray(data.data[key]));
                if (arrKey) {
                  historyMessages = data.data[arrKey];
                  console.log('Using data[' + arrKey + '] array');
                } else {
                  console.warn('No array found in data.data');
                }
              }
              
              console.log('History messages count:', historyMessages.length);
              
              if (historyMessages.length > 0) {
                const sessionId = getSessionId(type, id);
                
                setMessages(prev => {
                  const currentMsgs = prev[sessionId] || [];
                  console.log('Current messages in session:', currentMsgs.length);
                  
                  // Log current message IDs and seqs for debugging
                  if (currentMsgs.length > 0) {
                    console.log('Current message IDs:', currentMsgs.map(m => m.message_id));
                    console.log('Current message seqs:', currentMsgs.map(m => m.message_seq));
                  }
                  
                  // Use message_seq for deduplication (NapCat's primary key)
                  // Fall back to message_id if message_seq is not available
                  const currentSeqs = new Set(currentMsgs.map(m => m.message_seq || m.message_id));
                  const newMsgs = historyMessages.filter(h => {
                    const seq = h.message_seq || h.message_id;
                    return !currentSeqs.has(seq);
                  });
                  
                  // Log incoming message IDs and seqs for debugging
                  console.log('Incoming message IDs:', historyMessages.map(m => m.message_id));
                  console.log('Incoming message seqs:', historyMessages.map(m => m.message_seq));
                  console.log('Current seqs Set:', Array.from(currentSeqs));
                  
                  console.log('Filtered new messages:', newMsgs.length, '(removed', historyMessages.length - newMsgs.length, 'duplicates)');
                  
                  const normalizedNew = newMsgs.map(m => {
                    // Make sure user_id is compared correctly, convert to string
                    const isSelf = String(m.user_id) === String(selfInfoRef.current ? selfInfoRef.current.user_id : '');
                    return Object.assign({}, m, {
                      direction: isSelf ? 'outgoing' : 'incoming'
                    });
                  });
                  
                  if (normalizedNew.length > 0) {
                    console.log('Adding new messages:', {
                      sessionId,
                      count: normalizedNew.length,
                      oldestSeq: normalizedNew[0]?.message_seq,
                      oldestTime: normalizedNew[0]?.time,
                      newestSeq: normalizedNew[normalizedNew.length - 1]?.message_seq,
                      newestTime: normalizedNew[normalizedNew.length - 1]?.time
                    });
                  } else {
                    console.log('No new messages to add (all duplicates or empty)');
                    console.log('Why all filtered out? Check if incoming seqs match current seqs');
                  }

                  // If it's the very first load (currentMsgs is empty), just return sorted history.
                  // If we are loading older messages, they should be PREPENDED to the current list.
                  // OneBot usually returns messages in chronological order (oldest first in the array), 
                  // so we just prepend the new batch before the old batch.
                  return Object.assign({}, prev, {
                    [sessionId]: [].concat(normalizedNew, currentMsgs).sort((a, b) => a.time - b.time)
                  });
                });
              } else {
                 console.warn('History response is empty or has no messages array');
              }
            } else {
               console.warn('History response status is not ok:', data);
            }
            console.log('=====================================\n');
            } else if (data.echo && data.echo.startsWith('send_video_')) {
              // Server response for video send
              console.log('========== VIDEO SEND RESPONSE ==========');
              console.log('Echo:', data.echo);
              console.log('Status:', data.status);
              console.log('Retcode:', data.retcode);
              console.log('Data:', data.data);
              
              if (data.status === 'ok' && data.data && data.data.message_id) {
                console.log('✅ Video sent successfully, message_id:', data.data.message_id);
                
                // Update the temporary message with real message_id
                const tempId = 'temp_video_';
                setMessages(prev => {
                  const updated = {};
                  Object.keys(prev).forEach(sessionId => {
                    updated[sessionId] = prev[sessionId].map(m => {
                      if (String(m.message_id).startsWith(tempId)) {
                        console.log('Replacing temp message with real one:', {
                          tempId: m.message_id,
                          realId: data.data.message_id
                        });
                        return {
                          ...m,
                          message_id: data.data.message_id
                        };
                      }
                      return m;
                    });
                  });
                  return updated;
                });
              } else {
                console.error('❌ Video send failed:', data);
                alert('视频发送失败：' + (data.message || '未知错误'));
                
                // Remove the temporary message
                setMessages(prev => {
                  const updated = {};
                  Object.keys(prev).forEach(sessionId => {
                    updated[sessionId] = prev[sessionId].filter(m => 
                      !String(m.message_id).startsWith('temp_video_')
                    );
                  });
                  return updated;
                });
              }
              console.log('=====================================\n');
            } else if (data.echo && data.echo.startsWith('send_file_')) {
              // Server response for file send
              console.log('========== FILE SEND RESPONSE ==========');
              console.log('Echo:', data.echo);
              console.log('Status:', data.status);
              console.log('Retcode:', data.retcode);
              console.log('Data:', data.data);
              
              if (data.status === 'ok' && data.data && data.data.message_id) {
                console.log('✅ File sent successfully, message_id:', data.data.message_id);
                
                // Update the temporary message with real message_id
                const tempId = 'temp_file_';
                setMessages(prev => {
                  const updated = {};
                  Object.keys(prev).forEach(sessionId => {
                    updated[sessionId] = prev[sessionId].map(m => {
                      if (String(m.message_id).startsWith(tempId)) {
                        console.log('Replacing temp message with real one:', {
                          tempId: m.message_id,
                          realId: data.data.message_id
                        });
                        return {
                          ...m,
                          message_id: data.data.message_id
                        };
                      }
                      return m;
                    });
                  });
                  return updated;
                });
              } else {
                console.error('❌ File send failed:', data);
                alert('文件发送失败：' + (data.message || '未知错误'));
                
                // Remove the temporary message
                setMessages(prev => {
                  const updated = {};
                  Object.keys(prev).forEach(sessionId => {
                    updated[sessionId] = prev[sessionId].filter(m => 
                      !String(m.message_id).startsWith('temp_file_')
                    );
                  });
                  return updated;
                });
              }
              console.log('=====================================\n');
          } else if (data.echo && data.echo.startsWith('group_info_')) {
            const groupId = data.echo.replace('group_info_', '');
            if (data.status === 'ok' && data.data) {
              const sessionId = `group:${groupId}`;
              setSessions(prev => {
                const existing = prev[sessionId] || {};
                return Object.assign({}, prev, {
                  [sessionId]: Object.assign({}, existing, {
                    id: groupId,
                    type: 'group',
                    name: data.data.group_name || `Group ${groupId}`,
                    avatar: `https://p.qlogo.cn/gh/${groupId}/${groupId}/100`
                  })
                });
              });
            }
          } else if (data.echo && data.echo.startsWith('group_members_')) {
            const groupId = data.echo.replace('group_members_', '');
            if (data.status === 'ok' && Array.isArray(data.data)) {
              setGroupMembers(prev => ({
                ...prev,
                [groupId]: data.data
              }));
            }
          } else if (data.echo && data.echo.startsWith('group_member_info_')) {
            const parts = data.echo.replace('group_member_info_', '').split('_');
            const groupId = parts[0];
            const userId = parts[1];
            if (data.status === 'ok' && data.data) {
              const sessionId = `group:${groupId}`;
              setGroupMembers(prev => {
                const groupGroupMembers = prev[groupId] || {};
                return Object.assign({}, prev, {
                  [groupId]: Object.assign({}, groupGroupMembers, {
                    [userId]: data.data
                  })
                });
              });
              
              // Also update existing messages in this session with the nickname
              setMessages(prev => {
                const currentMsgs = prev[sessionId] || [];
                let changed = false;
                const updatedMsgs = currentMsgs.map(msg => {
                  if (String(msg.user_id) === String(userId) && (!msg.sender || !msg.sender.nickname)) {
                    changed = true;
                    return Object.assign({}, msg, {
                      sender: Object.assign({}, (msg.sender || {}), {
                        nickname: data.data.card || data.data.nickname || userId
                      })
                    });
                  }
                  return msg;
                });
                
                if (changed) {
                  return Object.assign({}, prev, {
                    [sessionId]: updatedMsgs
                  });
                }
                return prev;
              });
            }
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      ws.onerror = (error) => {
        if (!isComponentMounted) return;
        console.error('WebSocket error:', error);
        setStatus('error');
      };

      ws.onclose = () => {
        if (!isComponentMounted) return;
        console.log('Disconnected from OneBot');
        setStatus('disconnected');
        // Auto reconnect after 5 seconds
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      Object.keys(pendingActionsRef.current).forEach((echo) => {
        const pending = pendingActionsRef.current[echo];
        clearTimeout(pending.timer);
        pending.reject(new Error('Connection closed'));
      });
      pendingActionsRef.current = {};
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on manual close
        wsRef.current.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [url, token, addMessage, fetchContacts, normalizeCustomFaces, mergeCustomFaces]);

  const sendMessage = useCallback((targetId, message, messageType = 'private') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'send_msg',
        params: {
          message_type: messageType,
          user_id: messageType === 'private' ? parseInt(targetId) : undefined,
          group_id: messageType === 'group' ? parseInt(targetId) : undefined,
          message: message
        },
        echo: Date.now().toString()
      };
      wsRef.current.send(JSON.stringify(payload));
      
      // Optimistically add to messages
      addMessage({
        post_type: 'message',
        message_type: messageType,
        user_id: messageType === 'private' ? parseInt(targetId) : undefined,
        group_id: messageType === 'group' ? parseInt(targetId) : undefined,
        message: message,
        time: Math.floor(Date.now() / 1000),
        sender: { nickname: 'Me' },
        direction: 'outgoing',
        message_id: 'temp_' + Date.now() // temporary ID
      });
    } else {
      console.error('WebSocket is not connected');
    }
  }, [addMessage]);

  const sendImage = useCallback(async (targetId, imageFile, messageType = 'private') => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      
      console.log('Sending image:', { 
        fileName: imageFile.name, 
        fileSize: imageFile.size,
        fileType: imageFile.type,
        targetId,
        messageType
      });
      
      // Convert image file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1];
          console.log('Image converted to base64, length:', base64Data.length);
          
          const imageMessage = [
            {
              type: 'image',
              data: {
                file: `base64://${base64Data}`
              }
            }
          ];
          
          const payload = {
            action: 'send_msg',
            params: {
              message_type: messageType,
              user_id: messageType === 'private' ? parseInt(targetId) : undefined,
              group_id: messageType === 'group' ? parseInt(targetId) : undefined,
              message: imageMessage
            },
            echo: `send_image_${Date.now()}`
          };
          
          console.log('Sending image payload:', JSON.stringify(payload, null, 2));
          wsRef.current.send(JSON.stringify(payload));
          
          // Optimistically add to messages
          addMessage({
            post_type: 'message',
            message_type: messageType,
            user_id: messageType === 'private' ? parseInt(targetId) : undefined,
            group_id: messageType === 'group' ? parseInt(targetId) : undefined,
            message: imageMessage,
            time: Math.floor(Date.now() / 1000),
            sender: { nickname: 'Me' },
            direction: 'outgoing',
            message_id: 'temp_img_' + Date.now()
          });
          
          console.log('Image sent successfully');
          resolve();
        } catch (error) {
          console.error('Error sending image:', error);
          reject(error);
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('Failed to read image file'));
      };
      reader.readAsDataURL(imageFile);
    });
  }, [addMessage]);

  const sendVideo = useCallback(async (targetId, videoFile, messageType = 'private') => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      
      console.log('========== SENDING VIDEO ==========');
      console.log('Sending video:', { 
        fileName: videoFile.name, 
        fileSize: (videoFile.size / (1024 * 1024)).toFixed(2) + ' MB',
        fileType: videoFile.type,
        targetId,
        messageType
      });
      
      // Convert video file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1];
          console.log('Video converted to base64, length:', (base64Data.length / 1024).toFixed(2) + ' KB');
          
          // 警告：大视频可能无法被服务器处理
          if (base64Data.length > 10 * 1024 * 1024) { // > 10MB base64
            console.warn('⚠️ Large video detected. NapCat may reject videos > 10MB.');
          }
          
          const videoMessage = [
            {
              type: 'video',
              data: {
                file: `base64://${base64Data}`,
                name: videoFile.name
              }
            }
          ];
          
          const payload = {
            action: 'send_msg',
            params: {
              message_type: messageType,
              user_id: messageType === 'private' ? parseInt(targetId) : undefined,
              group_id: messageType === 'group' ? parseInt(targetId) : undefined,
              message: videoMessage
            },
            echo: `send_video_${Date.now()}`
          };
          
          console.log('Sending video payload:', JSON.stringify(payload, null, 2));
          console.log('=====================================\n');
          
          wsRef.current.send(JSON.stringify(payload));
          
          // Optimistically add to messages (will be replaced by server response)
          const tempMessage = {
            post_type: 'message',
            message_type: messageType,
            user_id: messageType === 'private' ? parseInt(targetId) : undefined,
            group_id: messageType === 'group' ? parseInt(targetId) : undefined,
            message: videoMessage,
            time: Math.floor(Date.now() / 1000),
            sender: { nickname: 'Me' },
            direction: 'outgoing',
            message_id: 'temp_video_' + Date.now()
          };
          
          addMessage(tempMessage);
          console.log('Video message added (temporary, waiting for server response)');
          resolve();
        } catch (error) {
          console.error('Error sending video:', error);
          reject(error);
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('Failed to read video file'));
      };
      reader.readAsDataURL(videoFile);
    });
  }, [addMessage]);

  const sendFile = useCallback(async (targetId, file, messageType = 'private') => {
    return new Promise((resolve, reject) => {
      // 检查文件大小：1GB 限制（图片和视频除外）
      const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && file.size > MAX_FILE_SIZE) {
        reject(new Error(`文件大小超过 1GB 限制（当前：${(file.size / (1024 * 1024)).toFixed(2)} MB）`));
        return;
      }
      
      console.log('Sending file:', { 
        fileName: file.name, 
        fileSize: file.size,
        fileType: file.type,
        targetId,
        messageType
      });
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Data = e.target.result.split(',')[1];
            console.log('File converted to base64, length:', base64Data.length);
            
            const fileMessage = [
              {
                type: 'file',
                data: {
                  file: `base64://${base64Data}`,
                  name: file.name,
                  size: file.size
                }
              }
            ];
            
            const payload = {
              action: 'send_msg',
              params: {
                message_type: messageType,
                user_id: messageType === 'private' ? parseInt(targetId) : undefined,
                group_id: messageType === 'group' ? parseInt(targetId) : undefined,
                message: fileMessage
              },
              echo: `send_file_${Date.now()}`
            };
            
            console.log('Sending file payload');
            wsRef.current.send(JSON.stringify(payload));
            
            // Optimistically add to messages
            addMessage({
              post_type: 'message',
              message_type: messageType,
              user_id: messageType === 'private' ? parseInt(targetId) : undefined,
              group_id: messageType === 'group' ? parseInt(targetId) : undefined,
              message: fileMessage,
              time: Math.floor(Date.now() / 1000),
              sender: { nickname: 'Me' },
              direction: 'outgoing',
              message_id: 'temp_file_' + Date.now()
            });
            
            console.log('File sent successfully');
            resolve();
          } catch (error) {
            console.error('Error sending file:', error);
            reject(error);
          }
        };
        reader.onerror = (err) => {
          console.error('FileReader error:', err);
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      } else {
        reject(new Error('WebSocket is not connected'));
      }
    });
  }, [addMessage]);

  return { status, messages, setMessages, sessions, sendMessage, sendImage, sendVideo, sendFile, fetchHistory, fetchGroupInfo, fetchGroupMemberList, fetchCustomFace, fetchCustomFaceWithPager, reloadCustomFace, loadMoreCustomFace, customFacePager, getWsRef, friends, groups, groupMembers, customFaces, selfInfo, updateNickname, updateSignature, updateGroupName, setGroupWholeBan, leaveGroup, getForwardMessage };
}
