import React from 'react';
import { Reply } from 'lucide-react';

// 解析 CQ 码字符串为数组结构
function parseCQCode(text) {
  if (typeof text !== 'string') return [{ type: 'text', data: { text: typeof text === 'object' ? JSON.stringify(text) : String(text) } }];
  
  const segments = [];
  let lastIndex = 0;
  
  // 简单的正则匹配 CQ 码: [CQ:type,key=value,...]
  const regex = /\[CQ:([a-zA-Z0-9-_.]+)(?:,([^\]]+))?\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 添加之前的纯文本
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        data: { text: text.substring(lastIndex, match.index) }
      });
    }

    const type = match[1];
    const paramsStr = match[2] || '';
    const data = {};
    
    // 解析参数
    paramsStr.split(',').forEach(param => {
      const idx = param.indexOf('=');
      if (idx !== -1) {
        const key = param.substring(0, idx);
        const value = param.substring(idx + 1);
        // 解码转义字符
        data[key] = value.replace(/&#44;/g, ',').replace(/&amp;/g, '&').replace(/&#91;/g, '[').replace(/&#93;/g, ']');
      }
    });

    segments.push({ type, data });
    lastIndex = regex.lastIndex;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      data: { text: text.substring(lastIndex) }
    });
  }

  return segments;
}

export default function MessageRenderer({ message, onAt }) {
  let segments = [];

  if (typeof message === 'string') {
    segments = parseCQCode(message);
  } else if (Array.isArray(message)) {
    segments = message;
  } else {
    // 如果是其他类型（如对象但不是数组），转为字符串显示
    segments = [{ type: 'text', data: { text: typeof message === 'object' ? JSON.stringify(message) : String(message) } }];
  }

  return (
    <div className="message-content-renderer">
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'text':
            return <span key={index} className="msg-text">{segment.data.text}</span>;
          
          case 'image':
             // NapCat/OneBot returns url or file (sometimes file is a local path or base64)
             let imgSrc = segment.data.url || segment.data.file;
             if (!imgSrc) return <span key={index}>[图片]</span>;
             
             // Extract base64 part if it's inside base64://...
             if (imgSrc.indexOf('base64://') !== -1) {
               imgSrc = 'data:image/png;base64,' + imgSrc.split('base64://')[1];
             } else if (imgSrc.startsWith('file://')) {
               // Sometimes the file protocol is used but points to a local cache we cannot read in browser
               // We might just show it if WebView supports it, or it will trigger onError
             } else if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:') && !imgSrc.startsWith('file:')) {
               // If it's a raw base64 string
               if (/^[A-Za-z0-9+/=]+$/.test(imgSrc) && imgSrc.length > 100) {
                 imgSrc = 'data:image/png;base64,' + imgSrc;
               }
             }

            return (
              <div key={index} className="msg-image-container">
                <img 
                  src={imgSrc} 
                  alt="[图片]" 
                  className="msg-image" 
                  style={{maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', marginTop: '4px', cursor: 'pointer'}}
                  onClick={function() { window.open(imgSrc, '_blank'); }}
                  onError={function(e) { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:red;font-size:0.8em;">[图片加载失败]</span>'); }}
                />
              </div>
            );
            
          case 'face':
            return <span key={index} className="msg-face" title={`Face ID: ${segment.data.id}`}>[表情: {segment.data.id}]</span>;
            
          case 'at':
            return (
              <span 
                key={index} 
                className="msg-at" 
                style={{color: '#2563eb', fontWeight: 'bold', marginRight: '4px', cursor: onAt ? 'pointer' : 'default'}}
                onClick={function() { if(onAt) onAt(segment.data.qq); }}
                title={onAt ? "Click to @ this user" : ""}
              >
                @{segment.data.name || segment.data.qq}
              </span>
            );
            
          case 'reply':
            return (
              <div 
                key={index} 
                className="msg-reply" 
                style={{
                  fontSize: '0.85em', 
                  color: '#666', 
                  borderLeft: '3px solid #3b82f6', 
                  paddingLeft: '8px', 
                  marginBottom: '6px',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                <div style={{fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <Reply size={12} /> 回复:
                </div>
                <div style={{opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  Message ID: {segment.data.id}
                </div>
              </div>
            );

          case 'record':
            return <div key={index} className="msg-record">[语音]</div>;
            
          case 'video':
            return <div key={index} className="msg-video">[视频]</div>;
            
          case 'share':
            return (
              <div key={index} className="msg-share" style={{border: '1px solid #ddd', borderRadius: '8px', padding: '8px', margin: '4px 0', cursor: 'pointer', background: '#fff'}} onClick={function() { if(segment.data.url) window.open(segment.data.url, '_blank'); }}>
                <div style={{fontWeight: 'bold', fontSize: '0.9em', color: '#333'}}>{segment.data.title || '分享链接'}</div>
                {segment.data.content ? <div style={{fontSize: '0.8em', color: '#666', marginTop: '4px'}}>{segment.data.content}</div> : null}
              </div>
            );

          case 'json':
            try {
              const jsonData = typeof segment.data.data === 'string' ? JSON.parse(segment.data.data) : segment.data.data;
              return <div key={index} className="msg-json"><pre style={{fontSize: '0.8em', background: '#f5f5f5', padding: '4px', borderRadius: '4px'}}>{JSON.stringify(jsonData, null, 2)}</pre></div>;
            } catch (e) {
              return <span key={index} className="msg-json">[JSON]</span>;
            }

          default:
            // 尝试展示未知的 CQ 码
            return <span key={index} className="msg-unknown" title={JSON.stringify(segment.data)} style={{color: '#999'}}>[{segment.type}]</span>;
        }
      })}
    </div>
  );
}
