import React from 'react';
import { Reply } from 'lucide-react';

// 瑙ｆ瀽 CQ 鐮佸瓧绗︿覆涓烘暟缁勭粨鏋?
function parseCQCode(text) {
  if (typeof text !== 'string') return [{ type: 'text', data: { text: typeof text === 'object' ? JSON.stringify(text) : String(text) } }];
  
  const segments = [];
  let lastIndex = 0;
  
  // 绠€鍗曠殑姝ｅ垯鍖归厤 CQ 鐮? [CQ:type,key=value,...]
  const regex = /\[CQ:([a-zA-Z0-9-_.]+)(?:,([^\]]+))?\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 娣诲姞涔嬪墠鐨勭函鏂囨湰
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        data: { text: text.substring(lastIndex, match.index) }
      });
    }

    const type = match[1];
    const paramsStr = match[2] || '';
    const data = {};
    
    // 瑙ｆ瀽鍙傛暟
    paramsStr.split(',').forEach(param => {
      const idx = param.indexOf('=');
      if (idx !== -1) {
        const key = param.substring(0, idx);
        const value = param.substring(idx + 1);
        // 瑙ｇ爜杞箟瀛楃
        data[key] = value.replace(/&#44;/g, ',').replace(/&amp;/g, '&').replace(/&#91;/g, '[').replace(/&#93;/g, ']');
      }
    });

    segments.push({ type, data });
    lastIndex = regex.lastIndex;
  }

  // 娣诲姞鍓╀綑鐨勬枃鏈?
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      data: { text: text.substring(lastIndex) }
    });
  }

  return segments;
}

export default function MessageRenderer({ message, onAt, groupMembers = [] }) {
  let segments = [];

  if (typeof message === 'string') {
    segments = parseCQCode(message);
  } else if (Array.isArray(message)) {
    segments = message;
  } else {
    // 濡傛灉鏄叾浠栫被鍨嬶紙濡傚璞′絾涓嶆槸鏁扮粍锛夛紝杞负瀛楃涓叉樉绀?
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
               return <span key={index}>[鍥剧墖]</span>;
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
                 return <span key={index}>[鍥剧墖]</span>;
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
                return <span key={index}>[鍥剧墖]</span>;
              }
            }

            // Use proxy for HTTP images to bypass CORS
            const PROXY_URL = 'http://localhost:3002/?url=';
            const finalImgSrc = imgSrc.startsWith('http') ? PROXY_URL + encodeURIComponent(imgSrc) : imgSrc;

            return (
              <div key={index} className="msg-image-container">
                <img 
                  src={finalImgSrc} 
                  alt={isSticker ? "[琛ㄦ儏]" : "[鍥剧墖]"} 
                  className="msg-image" 
                  style={{
                    maxWidth: isSticker ? '150px' : '100%', 
                    maxHeight: isSticker ? '150px' : '300px', 
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
                        <span style="color: #856404;">[${isSticker ? '琛ㄦ儏' : '鍥剧墖'}鍔犺浇澶辫触]</span>
                        <br/>
                        <a href="${imgSrc}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline; word-break: break-all;">
                          鐐瑰嚮鎵撳紑${isSticker ? '琛ㄦ儏' : '鍥剧墖'}閾炬帴
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
            const videoTitle = segment.data.title || '瑙嗛';
            
            if (!videoSrc) {
              return <span key={index}>[瑙嗛]</span>;
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
              // Use proxy for HTTP videos to bypass CORS
              const VIDEO_PROXY_URL = 'http://localhost:3002/?url=';
              videoSrc = VIDEO_PROXY_URL + encodeURIComponent(videoSrc);
              console.log('Using video proxy:', videoSrc);
            }
            
            return (
              <div key={index} className="msg-video-container" style={{ margin: '8px 0' }}>
                <video 
                  src={videoSrc}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
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
                        <span style="color: #856404;">[瑙嗛鍔犺浇澶辫触]</span>
                        <br/>
                        <a href="${videoSrc}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline; word-break: break-all;">
                          鐐瑰嚮鎵撳紑瑙嗛閾炬帴
                        </a>
                      </div>
                    `);
                  }}
                >
                  鎮ㄧ殑娴忚鍣ㄤ笉鏀寔瑙嗛鎾斁
                </video>
                <div style={{ marginTop: '4px', fontSize: '0.85em', color: '#666' }}>
                  {videoTitle}
                </div>
              </div>
            );
            
          case 'face':
            // QQ 琛ㄦ儏鏀寔 - 浣跨敤瀹樻柟 CDN 鍔犺浇琛ㄦ儏鍥剧墖
            // QQ 琛ㄦ儏 ID 鑼冨洿锛?-258锛堢粡鍏歌〃鎯咃級锛岃繕鏈夋洿澶氭墿灞曡〃鎯?
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
            // 浠庣兢鎴愬憳鍒楄〃涓煡鎵炬樀绉?
            const qqId = String(segment.data.qq);
            let displayName = qqId;
            
            // 鐗规畩澶勭悊鍏ㄤ綋鎴愬憳
            if (qqId === 'all') {
              displayName = '鍏ㄤ綋鎴愬憳';
            } else {
              // 浠庣兢鎴愬憳鍒楄〃涓煡鎵?
              const member = groupMembers.find(m => String(m.user_id) === qqId);
              if (member) {
                displayName = member.nickname || member.card || qqId;
              } else if (segment.data.name) {
                // 濡傛灉 CQ 鐮佷腑鏈?name 灞炴€э紝浼樺厛浣跨敤
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
                  <Reply size={12} /> 鍥炲:
                </div>
                <div style={{opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  Message ID: {segment.data.id}
                </div>
              </div>
            );

          case 'file':
            // 鏂囦欢娑堟伅娓叉煋
            const fileName = segment.data?.name || '鏈煡鏂囦欢';
            const fileSize = segment.data?.size || 0;
            const fileBase64 = segment.data?.file || '';
            
            console.log('File message rendering:', {
              fileName,
              fileSize,
              hasBase64: fileBase64 ? true : false,
              base64Prefix: fileBase64 ? fileBase64.substring(0, 20) : 'N/A',
              base64Length: fileBase64 ? fileBase64.length : 0
            });
            
            // 鏍煎紡鍖栨枃浠跺ぇ灏?
            const formatFileSize = (bytes) => {
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            };
            
            // 鑾峰彇鏂囦欢鍥炬爣
            const getFileIcon = (filename) => {
              const ext = filename.split('.').pop().toLowerCase();
              if (['pdf'].includes(ext)) return '馃搫';
              if (['doc', 'docx'].includes(ext)) return '馃摑';
              if (['xls', 'xlsx'].includes(ext)) return '馃搳';
              if (['ppt', 'pptx'].includes(ext)) return '馃搳';
              if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '馃摝';
              if (['txt', 'md', 'json', 'js', 'css', 'html'].includes(ext)) return '馃搩';
              if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '馃幍';
              if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return '馃幀';
              if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return '🖼️';
              if (['exe', 'msi', 'dmg'].includes(ext)) return '鈿欙笍';
              return '馃搧';
            };
            
            // 鍒涘缓涓嬭浇閾炬帴 - 鍐呯疆鏂囦欢鍔犺浇鍣?
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
                // NapCat 杩斿洖鐨勬枃浠惰矾寰?
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
                title="鐐瑰嚮涓嬭浇鏂囦欢"
              >
                <div style={{fontSize: '32px'}}>{getFileIcon(fileName)}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {fileName}
                  </div>
                  <div style={{fontSize: '0.8em', color: '#6b7280', marginTop: '2px'}}>
                    {formatFileSize(fileSize)}
                    {fileSize === 0 && ' (0 B - 鏂囦欢鍙兘宸叉崯鍧忔垨鏈繚瀛?'}
                  </div>
                </div>
                <div style={{color: '#3b82f6', fontSize: '20px'}}>猬囷笍</div>
              </div>
            );

          case 'record':
            return <div key={index} className="msg-record">[璇煶]</div>;
            
          case 'share':
            return (
              <div key={index} className="msg-share" style={{border: '1px solid #ddd', borderRadius: '8px', padding: '8px', margin: '4px 0', cursor: 'pointer', background: '#fff'}} onClick={function() { if(segment.data.url) window.open(segment.data.url, '_blank'); }}>
                <div style={{fontWeight: 'bold', fontSize: '0.9em', color: '#333'}}>{segment.data.title || '鍒嗕韩閾炬帴'}</div>
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
            // 灏濊瘯灞曠ず鏈煡鐨?CQ 鐮?
            return <span key={index} className="msg-unknown" title={JSON.stringify(segment.data)} style={{color: '#999'}}>[{segment.type}]</span>;
        }
      })}
    </div>
  );
}
