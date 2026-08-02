const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

console.log('Mock NapCat Server running on ws://localhost:3001');

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial lifecycle event
  ws.send(JSON.stringify({
    post_type: 'meta_event',
    meta_event_type: 'lifecycle',
    sub_type: 'connect',
    time: Math.floor(Date.now() / 1000)
  }));

  // Mock heartbeat
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        post_type: 'meta_event',
        meta_event_type: 'heartbeat',
        time: Math.floor(Date.now() / 1000),
        status: { online: true, good: true }
      }));
    }
  }, 5000);

  // Mock random incoming message
  const randomMessageInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && Math.random() > 0.7) {
      const isGroup = Math.random() > 0.5;
      const userId = Math.floor(Math.random() * 5) + 10000;
      const groupId = isGroup ? Math.floor(Math.random() * 3) + 20000 : undefined;
      
      // Randomly choose message format: string or array
      const useArray = Math.random() > 0.5;
      
      let messageContent;
      let rawMessage;

      if (useArray) {
        // Generate 1-3 random QQ faces
        const faceCount = Math.floor(Math.random() * 3) + 1;
        const faces = [];
        for (let i = 0; i < faceCount; i++) {
          faces.push({ type: 'face', data: { id: Math.floor(Math.random() * 258) + 1 } });
        }
        
        messageContent = [
          { type: 'text', data: { text: `Hello from ${isGroup ? 'Group ' + groupId : 'User ' + userId}! ` } },
          ...faces,
          { type: 'text', data: { text: ` Random: ${Math.floor(Math.random() * 100)}` } }
        ];
        // Simulate image occasionally
        if (Math.random() > 0.7) {
            const isSticker = Math.random() > 0.5; // 50% chance of being a sticker
            if (isSticker) {
                // Simulate sticker/face image (like QQ favorites)
                messageContent.push({ 
                    type: 'image', 
                    data: { 
                        file: `https://p.qlogo.cn/gh/${Math.floor(Math.random() * 1000)}/${Math.floor(Math.random() * 1000)}/100`,
                        url: `https://p.qlogo.cn/gh/${Math.floor(Math.random() * 1000)}/${Math.floor(Math.random() * 1000)}/100`,
                        sub_type: 'sticker'
                    } 
                });
            } else {
                // Simulate regular image (may fail to load)
                const imageType = Math.random() > 0.5 ? 'normal' : 'sticker';
                if (imageType === 'sticker') {
                    messageContent.push({ 
                        type: 'image', 
                        data: { 
                            file: `https://qqface.com/sticker/${Math.floor(Math.random() * 100)}.gif`,
                            url: `https://qqface.com/sticker/${Math.floor(Math.random() * 100)}.gif`,
                            sub_type: 'sticker'
                        } 
                    });
                } else {
                    messageContent.push({ 
                        type: 'image', 
                        data: { 
                            file: 'https://picsum.photos/200/300',
                            url: 'https://picsum.photos/200/300' 
                        } 
                    });
                }
            }
        }
        rawMessage = messageContent.map(s => s.type === 'text' ? s.data.text : `[CQ:${s.type},...]`).join('');
      } else {
        // String format with CQ code - support multiple faces
        const faceCount = Math.floor(Math.random() * 3) + 1;
        let faceCodes = '';
        for (let i = 0; i < faceCount; i++) {
          const faceId = Math.floor(Math.random() * 258) + 1;
          faceCodes += `[CQ:face,id=${faceId}]`;
        }
        messageContent = `Hello from ${isGroup ? 'Group ' + groupId : 'User ' + userId}! ${faceCodes} Random: ${Math.floor(Math.random() * 100)}`;
        rawMessage = messageContent;
      }
      
      ws.send(JSON.stringify({
        post_type: 'message',
        message_type: isGroup ? 'group' : 'private',
        sub_type: 'friend',
        message_id: Math.floor(Math.random() * 100000),
        user_id: userId,
        group_id: groupId,
        message: messageContent,
        raw_message: rawMessage,
        font: 0,
        sender: {
          user_id: userId,
          nickname: `User ${userId}`,
          sex: 'unknown',
          age: 0
        },
        time: Math.floor(Date.now() / 1000)
      }));
    }
  }, 10000);

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    try {
      const data = JSON.parse(message);
      
      // Handle API calls
      if (data.action === 'send_msg') {
        const { params, echo } = data;
        
        // Echo back success
        ws.send(JSON.stringify({
          status: 'ok',
          retcode: 0,
          data: { message_id: Math.floor(Math.random() * 100000) },
          echo
        }));

        // Simulate reply after a short delay
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                const replyMsg = `Received your message: "${params.message}"`;
                ws.send(JSON.stringify({
                    post_type: 'message',
                    message_type: params.message_type,
                    sub_type: 'friend',
                    message_id: Math.floor(Math.random() * 100000),
                    user_id: params.user_id || params.group_id, // Simulate reply from same target
                    group_id: params.group_id,
                    message: replyMsg,
                    raw_message: replyMsg,
                    font: 0,
                    sender: {
                        user_id: params.user_id || params.group_id,
                        nickname: `User ${params.user_id || params.group_id}`,
                    },
                    time: Math.floor(Date.now() / 1000)
                }));
            }
        }, 1000);
      } else if (data.action === 'get_group_info') {
        const { params, echo } = data;
        ws.send(JSON.stringify({
          status: 'ok',
          retcode: 0,
          data: {
            group_id: params.group_id,
            group_name: `Mock Group ${params.group_id}`,
            member_count: 100,
            max_member_count: 500
          },
          echo
        }));
      } else if (data.action === 'get_msg_history' || data.action === 'get_group_msg_history' || data.action === 'get_c2c_msg_history' || data.action === 'get_friend_msg_history') {
        const { params, echo } = data;
        const count = params.count || 10;
        const history = [];
        // Support both old separate endpoints and unified get_msg_history
        const isGroup = data.action === 'get_group_msg_history' || params.message_type === 'group' || !!params.group_id;
        const targetId = isGroup ? params.group_id : params.user_id;
        const messageId = params.message_id || params.message_seq || 0;

        // If messageId is provided, we simulate messages BEFORE this ID.
        // We just assume message_id is a timestamp-like or sequential ID.
        // For mock purposes, let's just generate IDs relative to the requested ID or current time.
        
        let baseId = messageId ? parseInt(messageId) : Math.floor(Math.random() * 100000) + 1000000;
        let baseTime = Math.floor(Date.now() / 1000);
        
        // If we are paging, shift time back significantly
        if (messageId) {
            baseTime -= 3600; // 1 hour ago
            baseId -= 1; // Start from previous
        }

        for (let i = 0; i < count; i++) {
            history.push({
                post_type: 'message',
                message_type: isGroup ? 'group' : 'private',
                sub_type: 'friend',
                message_id: baseId - i, // Decreasing IDs
                user_id: isGroup ? Math.floor(Math.random() * 5) + 10000 : targetId,
                group_id: isGroup ? targetId : undefined,
                message: `History message ${baseId - i} from ${isGroup ? 'Group ' + targetId : 'User ' + targetId}`,
                raw_message: `History message ${baseId - i} from ${isGroup ? 'Group ' + targetId : 'User ' + targetId}`,
                font: 0,
                sender: {
                    user_id: isGroup ? Math.floor(Math.random() * 5) + 10000 : targetId,
                    nickname: `History User`,
                    sex: 'unknown',
                    age: 0
                },
                time: baseTime - i * 60
            });
        }
        
        // Reverse to return in chronological order (oldest first) if that's what the client expects?
        // Usually history APIs return latest first or oldest first depending on implementation.
        // But our UI sorts them.
        
        ws.send(JSON.stringify({
          status: 'ok',
          retcode: 0,
          data: {
            messages: history
          },
          echo
        }));
      } else if (data.action === 'get_friend_list') {
        const { echo } = data;
        const friends = [];
        for (let i = 0; i < 20; i++) {
            const uid = 10000 + i;
            friends.push({
                user_id: uid,
                nickname: `Friend ${uid}`,
                remark: i % 3 === 0 ? `Bestie ${uid}` : '',
                sex: 'unknown',
                level: 0
            });
        }
        ws.send(JSON.stringify({
            status: 'ok',
            retcode: 0,
            data: friends,
            echo
        }));
      } else if (data.action === 'get_group_list') {
        const { echo } = data;
        const groups = [];
        for (let i = 0; i < 10; i++) {
            const gid = 20000 + i;
            groups.push({
                group_id: gid,
                group_name: `Group ${gid}`,
                member_count: 50,
                max_member_count: 100
            });
        }
        ws.send(JSON.stringify({
            status: 'ok',
            retcode: 0,
            data: groups,
            echo
        }));
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(heartbeatInterval);
    clearInterval(randomMessageInterval);
  });
});
