import React from 'react';
import { Reply } from 'lucide-react';

// 解析 CQ 码字符串为消息段数组
function parseCQCode(text) {
  if (typeof text !== 'string') return [{ type: 'text', data: { text: typeof text === 'object' ? JSON.stringify(text) : String(text) } }];
  
  const segments = [];
  let lastIndex = 0;
  
  // 简单正则匹配 CQ 码: [CQ:type,key=value,...]
  const regex = /\[CQ:([a-zA-Z0-9-_.]+)(?:,([^\]]+))?\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 添加 CQ 码前面的纯文本
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

  // 添加剩余文本
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      data: { text: text.substring(lastIndex) }
    });
  }

  return segments;
}

export default function MessageRenderer({ message, onAt, groupMembers = [], resolveReplyMessage, onJumpToMessage, onViewForwardMessage }) {
  let segments = [];

  if (typeof message === 'string') {
    segments = parseCQCode(message);
  } else if (Array.isArray(message)) {
    segments = message;
  } else {
    // 其他类型（如对象但非数组）转为字符串显示
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
             if (!imgSrc) {
               console.warn('Image source not available:', segment.data);
               return <span key={index}>[图片]</span>;
             }
             
             // Check if this is a sticker/face (should be displayed as image)
             const isSticker = segment.data.sub_type === 'sticker' || segment.type === 'face';
             
             // Extract base64 part if it's inside base64://...
             if (imgSrc.indexOf('base64://') !== -1) {
               const base64Data = imgSrc.split('base64://')[1];
               // Try to detect image type from file extension or default to png
               const imageType = base64Data.toLowerCase().endsWith('.gif') ? 'gif' : 
                                base64Data.toLowerCase().endsWith('.jpg') || base64Data.toLowerCase().endsWith('.jpeg') ? 'jpeg' :
                                base64Data.toLowerCase().endsWith('.webp') ? 'webp' : 'png';
               imgSrc = `data:image/${imageType};base64,${base64Data}`;
               console.log('Loaded base64 image:', imageType);
             } else if (imgSrc.startsWith('file://')) {
               // NapCat usually provides HTTP URL alongside file:// path
               // If only file:// is available, try to construct URL from common NapCat file server
               const filePath = imgSrc.replace('file://', '');
               // Try using the URL if available, otherwise show placeholder
               if (!segment.data.url) {
                 // File path cannot be accessed in browser, show placeholder
                 console.warn('File path only, no HTTP URL available:', filePath);
                 return <span key={index}>[图片]</span>;
               }
             } else if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
              // If it's a raw base64 string (without data:image prefix)
              if (/^[A-Za-z0-9+/=]+$/.test(imgSrc) && imgSrc.length > 100) {
                const imageType = imgSrc.toLowerCase().startsWith('r0l') ? 'gif' : 
                                 imgSrc.toLowerCase().startsWith('/9j') ? 'jpeg' : 'png';
                imgSrc = `data:image/${imageType};base64,${imgSrc}`;
                console.log('Loaded raw base64 image:', imageType);
              } else if (imgSrc.startsWith('/')) {
                // Relative path, cannot be resolved without base URL
                console.warn('Relative path cannot be resolved:', imgSrc);
                return <span key={index}>[图片]</span>;
              }
            }

            // Use original URL directly — <img> tags are not subject to CORS restrictions
            const finalImgSrc = imgSrc;

            return (
              <div key={index} className="msg-image-container">
                <img
                  src={finalImgSrc}
                  alt={isSticker ? "[表情]" : "[图片]"}
                  className="msg-image"
                  referrerPolicy="no-referrer"
                  style={{
                    maxWidth: isSticker ? 'min(150px, 40vw)' : '100%',
                    maxHeight: isSticker ? 'min(150px, 40vw)' : 'min(300px, 60vh)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    cursor: 'pointer',
                    objectFit: isSticker ? 'contain' : 'cover'
                  }}
                  onClick={function() { window.open(imgSrc, '_blank'); }}
                  onError={async function(e) { 
                    console.error('Image load failed:', finalImgSrc, e);
                    // Try to reload once after 500ms delay
                    if (!e.target.dataset.retryAttempt) {
                      e.target.dataset.retryAttempt = '1';
                      setTimeout(() => { e.target.src = finalImgSrc; }, 500);
                      return;
                    }
                    // Second failure - show error message with clickable link
                    e.target.style.display = 'none'; 
                    e.target.insertAdjacentHTML('afterend', `
                      <div style="margin-top: 4px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.8em;">
                        <span style="color: #856404;">[${isSticker ? '表情' : '图片'}加载失败]</span>
                        <br/>
                        <a href="${imgSrc}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline; word-break: break-all;">
                          点击打开${isSticker ? '表情' : '图片'}链接
                        </a>
                      </div>
                    `); 
                  }}
                  onLoad={function() { console.log('Image loaded successfully:', finalImgSrc); }}
                />
              </div>
            );
            
          case 'video':
            // Video support - similar to image but with video player
            let videoSrc = segment.data.url || segment.data.file;
            const videoTitle = segment.data.title || '视频';
            
            if (!videoSrc) {
              return <span key={index}>[视频]</span>;
            }
            
            // Handle base64 video data
            let isBase64 = false;
            if (videoSrc.indexOf('base64://') !== -1) {
              const base64Data = videoSrc.split('base64://')[1];
              // Detect video type from base64 data
              const videoType = base64Data.toLowerCase().startsWith('aaaaIGZ0eXBtcDQy') ? 'video/mp4' : 
                               base64Data.toLowerCase().startsWith('gicg') ? 'video/ogg' : 'video/webm';
              videoSrc = `data:${videoType};base64,${base64Data}`;
              isBase64 = true;
              console.log('Loaded base64 video:', videoType, 'length:', base64Data.length);
            } else if (videoSrc.startsWith('http')) {
              // <video> tags are not subject to CORS restrictions, use original URL directly
              console.log('Using original video URL:', videoSrc);
            }
            
            return (
              <div key={index} className="msg-video-container" style={{ margin: '8px 0' }}>
                <video
                  src={videoSrc}
                  controls
                  referrerPolicy="no-referrer"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'min(400px, 60vh)',
                    borderRadius: '8px',
                    backgroundColor: '#000'
                  }}
                  onError={async function(e) {
                    console.error('Video load failed:', videoSrc, e);
                    // For base64 videos, try to create Blob URL as fallback
                    if (isBase64 && videoSrc.startsWith('data:')) {
                      try {
                        const base64Data = videoSrc.split(',')[1];
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'video/mp4' });
                        const blobUrl = URL.createObjectURL(blob);
                        e.target.src = blobUrl;
                        return;
                      } catch (err) {
                        console.error('Failed to create blob URL:', err);
                      }
                    }
                    // Second failure - show error message
                    e.target.style.display = 'none';
                    e.target.insertAdjacentHTML('afterend', `
                      <div style="margin-top: 4px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.8em;">
                        <span style="color: #856404;">[视频加载失败]</span>
                        <br/>
                        <a href="${videoSrc}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline; word-break: break-all;">
                          点击打开视频链接
                        </a>
                      </div>
                    `);
                  }}
                >
                  您的浏览器不支持视频播放
                </video>
                <div style={{ marginTop: '4px', fontSize: '0.85em', color: '#666' }}>
                  {videoTitle}
                </div>
              </div>
            );
            
          case 'face':
            // QQ 表情支持：使用官方 CDN 加载表情图片
            // 常见 QQ 表情 ID 范围 0-258（经典表情）
            const faceId = parseInt(segment.data.id);
            const faceUrl = `https://p.qpic.cn/face/${faceId}/0`;
            
            return (
              <span
                key={index}
                title={`QQ face #${faceId}`}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  verticalAlign: 'middle',
                  margin: '0 2px',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }} aria-hidden='true'>😀</span>
                <img
                  src={faceUrl}
                  alt={`face ${faceId}`}
                  style={{
                    width: '24px',
                    height: '24px',
                    position: 'absolute',
                    inset: 0
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  loading="lazy"
                />
              </span>
            );
            
          case 'at':
            // 从群成员列表中查找昵称
            const qqId = String(segment.data.qq);
            let displayName = qqId;
            
            // 特殊处理 @全体成员
            if (qqId === 'all') {
              displayName = '全体成员';
            } else {
              // 从群成员列表中查找
              const member = groupMembers.find(m => String(m.user_id) === qqId);
              if (member) {
                displayName = member.card || member.nickname || qqId;
              } else if (segment.data.name) {
                // 若 CQ 码中带有 name 字段，则优先使用
                displayName = segment.data.name;
              }
            }
            
            return (
              <span 
                key={index} 
                className="msg-at" 
                style={{color: '#2563eb', fontWeight: 'bold', marginRight: '4px', cursor: onAt ? 'pointer' : 'default'}}
                onClick={function() { if(onAt) onAt(qqId, displayName); }}
                title={onAt ? "Click to @ this user" : ""}
              >
                @{displayName}
              </span>
            );
            
          case 'reply':
            {
              const replyId = segment.data?.id;
              const resolved = typeof resolveReplyMessage === 'function'
                ? resolveReplyMessage(replyId)
                : null;

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
                  borderRadius: '4px',
                  cursor: onJumpToMessage ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (onJumpToMessage && replyId !== undefined && replyId !== null) {
                    onJumpToMessage(replyId);
                  }
                }}
                title={onJumpToMessage ? '点击跳转到原消息' : ''}
              >
                <div style={{fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <Reply size={12} /> 回复:
                </div>
                <div style={{opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {resolved
                    ? `引用 ${resolved.sender}: ${resolved.text}`
                    : `引用消息 ID: ${replyId}`}
                </div>
              </div>
            );
            }

          case 'file':
            // 文件消息渲染
            const fileName = segment.data?.name || '未知文件';
            const fileSize = segment.data?.size || 0;
            const fileBase64 = segment.data?.file || '';
            
            console.log('File message rendering:', {
              fileName,
              fileSize,
              hasBase64: fileBase64 ? true : false,
              base64Prefix: fileBase64 ? fileBase64.substring(0, 20) : 'N/A',
              base64Length: fileBase64 ? fileBase64.length : 0
            });
            
            // 格式化文件大小
            const formatFileSize = (bytes) => {
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            };
            
            // 获取文件图标
            const getFileIcon = (filename) => {
              const ext = filename.split('.').pop().toLowerCase();
              if (['pdf'].includes(ext)) return '[PDF]';
              if (['doc', 'docx'].includes(ext)) return '[DOC]';
              if (['xls', 'xlsx'].includes(ext)) return '[XLS]';
              if (['ppt', 'pptx'].includes(ext)) return '[PPT]';
              if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '[ZIP]';
              if (['txt', 'md', 'json', 'js', 'css', 'html'].includes(ext)) return '[TXT]';
              if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '[AUD]';
              if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return '[VID]';
              if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return '🖼️';
              if (['exe', 'msi', 'dmg'].includes(ext)) return '[EXE]';
              return '[FILE]';
            };
            
            // 创建下载动作（前端 base64 下载）
            const handleDownload = () => {
              console.log('Download clicked:', { fileName, fileSize, hasBase64: !!fileBase64 });
              
              if (fileBase64 && fileBase64.startsWith('base64://')) {
                const base64Data = fileBase64.split('base64://')[1];
                console.log('Base64 data length:', base64Data.length);
                
                try {
                  // Step 1: Decode base64
                  console.log('Decoding base64...');
                  const byteCharacters = atob(base64Data);
                  console.log('Decoded bytes:', byteCharacters.length);
                  
                  // Step 2: Convert to byte array
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  console.log('Byte array created:', byteArray.length, 'bytes');
                  
                  // Step 3: Create Blob
                  const blob = new Blob([byteArray]);
                  console.log('Blob created:', blob.size, 'bytes, type:', blob.type || 'unknown');
                  
                  // Step 4: Create download link
                  const blobUrl = URL.createObjectURL(blob);
                  console.log('Blob URL created:', blobUrl);
                  
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  
                  // Step 5: Cleanup
                  setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    console.log('Blob URL revoked');
                  }, 1000);
                  
                  console.log('Download completed successfully');
                } catch (err) {
                  console.error('Download failed:', err);
                  console.error('Error stack:', err.stack);
                  alert('File download failed: ' + err.message + '\n\nPlease check console for details.');
                }
              } else if (fileBase64 && fileBase64.startsWith('file://')) {
                // NapCat 返回的是服务端文件路径，浏览器无法直接访问
                console.warn('File path detected, cannot download directly:', fileBase64);
                alert('This file is stored on server and cannot be downloaded directly.\n\nPath: ' + fileBase64);
              } else {
                console.error('File data not available:', { fileBase64, type: typeof fileBase64 });
                alert('File data unavailable, cannot download.\n\nPossible reasons:\n1. Upload failed\n2. Data lost after refresh\n3. Server does not support this file type');
              }
            };
            
            return (
              <div 
                key={index} 
                className="msg-file"
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  margin: '4px 0',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={handleDownload}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                title="点击下载文件"
              >
                <div style={{fontSize: 'clamp(20px, 7vw, 32px)'}}>{getFileIcon(fileName)}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {fileName}
                  </div>
                  <div style={{fontSize: '0.8em', color: '#6b7280', marginTop: '2px'}}>
                    {formatFileSize(fileSize)}
                    {fileSize === 0 && ' (0 B - 文件可能已损坏或未保存)'}
                  </div>
                </div>
                <div style={{color: '#3b82f6', fontSize: '20px'}}>⬇</div>
              </div>
            );

          case 'record':
            return <div key={index} className="msg-record">[语音]</div>;
            
          case 'share':
            return (
              <div key={index} className="msg-share" style={{border: '1px solid #ddd', borderRadius: '8px', padding: '8px', margin: '4px 0', cursor: 'pointer', background: '#fff'}} onClick={function() { if(segment.data.url) window.open(segment.data.url, '_blank'); }}>
                <div style={{fontWeight: 'bold', fontSize: '0.9em', color: '#333'}}>{segment.data.title || '分享链接'}</div>
                {segment.data.content ? <div style={{fontSize: '0.8em', color: '#666', marginTop: '4px'}}>{segment.data.content}</div> : null}
              </div>
            );

          case 'forward': {
            const forwardId = segment.data?.id || segment.data?.resid || segment.data?.file || '';
            return (
              <div
                key={index}
                className="msg-forward"
                style={{
                  border: '1px solid #dbeafe',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  margin: '4px 0',
                  background: '#eff6ff',
                  cursor: onViewForwardMessage ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (onViewForwardMessage && forwardId) {
                    onViewForwardMessage(forwardId);
                  }
                }}
                title={onViewForwardMessage ? '点击查看转发消息内容' : ''}
              >
                <div style={{ fontWeight: 'bold', color: '#1d4ed8', marginBottom: '2px' }}>转发消息</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {forwardId ? `ID: ${forwardId}` : '无可用 ID'}
                </div>
              </div>
            );
          }

          case 'json':
            try {
              const jsonData = typeof segment.data.data === 'string' ? JSON.parse(segment.data.data) : segment.data.data;
              return <div key={index} className="msg-json"><pre style={{fontSize: '0.8em', background: '#f5f5f5', padding: '4px', borderRadius: '4px'}}>{JSON.stringify(jsonData, null, 2)}</pre></div>;
            } catch (e) {
              return <span key={index} className="msg-json">[JSON]</span>;
            }

          default:
            // 尝试显示未知 CQ 段
            return <span key={index} className="msg-unknown" title={JSON.stringify(segment.data)} style={{color: '#999'}}>[{segment.type}]</span>;
        }
      })}
    </div>
  );
}
