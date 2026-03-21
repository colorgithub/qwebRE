import { useState, useEffect, useRef, useCallback } from 'react';

export function useOneBot(url, token) {
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [messages, setMessages] = useState({}); // { sessionId: [msg1, msg2] }
  const [sessions, setSessions] = useState({}); // { sessionId: { id, type, name, avatar, lastMessage, timestamp } }
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selfInfo, setSelfInfo] = useState(null);
  const wsRef = useRef(null);

  const getSessionId = (type, id) => `${type}:${id}`;

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

  const fetchHistory = useCallback((type, id, count = 20, messageId = 0, messageSeq = 0) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const action = type === 'group' ? 'get_group_msg_history' : 'get_c2c_msg_history';
      
      const params = type === 'group' 
        ? { group_id: id.toString(), count }
        : { user_id: id.toString(), count };
      
      // If we are paginating backwards, we need to provide the exact sequence number
      if (messageSeq) {
          params.message_seq = messageSeq.toString(); 
      } else if (messageId) {
          // Fallback if we only have messageId
          params.message_id = messageId.toString();
          // Also pass message_seq as fallback since some API variants use it instead of message_id
          params.message_seq = messageId.toString();
      }

      // Fill in required default boolean params to ensure strict validation passes
      if (type === 'group') {
        params.reverse_order = false;
        params.disable_get_url = false;
        params.parse_mult_msg = true;
        params.quick_reply = false;
        params.reverseOrder = false;
      }

      wsRef.current.send(JSON.stringify({
        action: action,
        params: params,
        echo: `history_${type}_${id}_${messageId}` // Make echo unique per request
      }));
    }
  }, []);

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
      return Object.assign({}, prev, {
        [sessionId]: [].concat(currentMessages, [msg])
      });
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
          lastMessage: typeof msg.message === 'string' ? msg.message : '[Rich Media]',
          timestamp: msg.time,
          avatar: isPrivate 
            ? `https://q1.qlogo.cn/g?b=qq&nk=${targetId}&s=640`
            : `https://p.qlogo.cn/gh/${targetId}/${targetId}/100`
        })
      });
    });
  }, [fetchGroupInfo]);

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
          if (data.post_type === 'message') {
            const isSelf = String(data.user_id) === String(selfInfo ? selfInfo.user_id : '');
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
          } else if (data.echo && data.echo.startsWith('history_')) {
            const parts = data.echo.split('_');
            const type = parts[1];
            const id = parts[2];
            
            console.log('Received history data:', data); // Add debugging to see what backend returns

            if (data.status === 'ok' && data.data) {
              // Try to find the exact property the backend sent us (NapCat uses 'messages')
              let historyMessages = [];
              if (Array.isArray(data.data)) {
                historyMessages = data.data;
              } else if (data.data && Array.isArray(data.data.messages)) {
                historyMessages = data.data.messages;
              } else if (data.data && typeof data.data === 'object') {
                // Fallback: look for any array inside data.data
                const arrKey = Object.keys(data.data).find(key => Array.isArray(data.data[key]));
                if (arrKey) {
                  historyMessages = data.data[arrKey];
                }
              }
              
              if (historyMessages.length > 0) {
                const sessionId = getSessionId(type, id);
                
                setMessages(prev => {
                  const currentMsgs = prev[sessionId] || [];
                  const newMsgs = historyMessages.filter(h => !currentMsgs.some(c => c.message_id === h.message_id));
                  const normalizedNew = newMsgs.map(m => {
                    // Make sure user_id is compared correctly, convert to string
                    const isSelf = String(m.user_id) === String(selfInfo ? selfInfo.user_id : '');
                    return Object.assign({}, m, {
                      direction: isSelf ? 'outgoing' : 'incoming'
                    });
                  });
                  
                  console.log(`Adding ${normalizedNew.length} new messages to session ${sessionId}`);

                  // If it's the very first load (currentMsgs is empty), just return sorted history.
                  // If we are loading older messages, they should be PREPENDED to the current list.
                  // OneBot usually returns messages in chronological order (oldest first in the array), 
                  // so we just prepend the new batch before the old batch.
                  return Object.assign({}, prev, {
                    [sessionId]: [].concat(normalizedNew, currentMsgs).sort((a, b) => a.time - b.time)
                  });
                });
              } else {
                 console.warn('History response data does not contain an array of messages:', data);
              }
            } else {
               console.warn('History response was not OK:', data);
            }
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
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on manual close
        wsRef.current.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [url, token, addMessage, fetchContacts]);

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

  return { status, messages, sessions, sendMessage, fetchHistory, friends, groups, selfInfo };
}
