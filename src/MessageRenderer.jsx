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

// 只允许安全的外部链接，避免把不可信内容拼进 href
function isSafeUrl(url) {
  return typeof url === 'string' && /^(https?:|data:image\/|blob:)/i.test(url);
}

function MsgImage({ imgSrc, isSticker, onViewImage }) {
  const [attempt, setAttempt] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  const handleError = () => {
    if (attempt === 0) {
      // 第一次失败后延迟重试一次
      setTimeout(() => {
        setFailed(false);
        setAttempt(1);
      }, 500);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div style={{ marginTop: '4px', padding: '8px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', fontSize: '0.8em' }}>
        <span style={{ color: '#856404' }}>[{isSticker ? '表情' : '图片'}加载失败]</span>
        {isSafeUrl(imgSrc) && (
          <>
            <br />
            <a href={imgSrc} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline', wordBreak: 'break-all' }}>
              点击打开{isSticker ? '表情' : '图片'}链接
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="msg-image-container">
      <img
        key={attempt}
        src={imgSrc}
        alt={isSticker ? '[表情]' : '[图片]'}
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
        onClick={() => {
          if (isSafeUrl(imgSrc)) {
            if (onViewImage) onViewImage(imgSrc, isSticker ? '表情' : '图片');
            else window.open(imgSrc, '_blank');
          }
        }}
        onError={handleError}
      />
    </div>
  );
}

function MsgVideo({ videoSrc, isBase64, title }) {
  const [src, setSrc] = React.useState(videoSrc);
  const [failed, setFailed] = React.useState(false);

  // 释放为回退创建的 blob URL
  React.useEffect(() => {
    return () => {
      if (typeof src === 'string' && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src]);

  const handleError = () => {
    // 对于 base64 视频，尝试创建 Blob URL 作为回退
    if (isBase64 && typeof src === 'string' && src.startsWith('data:')) {
      try {
        const base64Data = src.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'video/mp4' });
        setSrc(URL.createObjectURL(blob));
        return;
      } catch (err) {
        console.error('Failed to create blob URL:', err);
      }
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div style={{ marginTop: '4px', padding: '8px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', fontSize: '0.8em' }}>
        <span style={{ color: '#856404' }}>[视频加载失败]</span>
        {isSafeUrl(src) && (
          <>
            <br />
            <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline', wordBreak: 'break-all' }}>
              点击打开视频链接
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="msg-video-container" style={{ margin: '8px 0' }}>
      <video
        src={src}
        controls
        referrerPolicy="no-referrer"
        style={{
          maxWidth: '100%',
          maxHeight: 'min(400px, 60vh)',
          borderRadius: '8px',
          backgroundColor: '#000'
        }}
        onError={handleError}
      >
        您的浏览器不支持视频播放
      </video>
      <div style={{ marginTop: '4px', fontSize: '0.85em', color: '#666' }}>
        {title}
      </div>
    </div>
  );
}

function FileMessage({ segment, onDownloadFile }) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState('');

  const extractNameFromPath = (path) => {
    if (!path || typeof path !== 'string') return '';
    const clean = path.replace(/^file:\/\//, '').replace(/\\/g, '/');
    const parts = clean.split('/');
    return parts[parts.length - 1] || '';
  };
  const fileName = segment?.name || segment?.fname || extractNameFromPath(segment?.file) || extractNameFromPath(segment?.url) || '未知文件';
  const fileSize = segment?.file_size || segment?.size || 0;
  const fileUrl = segment?.url || '';
  const fileData = segment?.file || '';
  const fileId = segment?.file_id || '';

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (Math.round(bytes / Math.pow(k, i) * 100) / 100) + ' ' + sizes[i];
  };

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
    if (['apk'].includes(ext)) return '[APK]';
    return '[FILE]';
  };

  const triggerDirectDownload = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const triggerBlobDownload = (blob, name) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  };

  const base64ToBlob = (b64) => {
    const raw = b64.split('base64://')[1] || b64;
    const chars = atob(raw);
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    return new Blob([bytes]);
  };

  // 同步路径（HTTP URL 保持用户手势）
  const handleDownload = () => {
    if (isDownloading) return;

    if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
      triggerDirectDownload(fileUrl);
      return;
    }
    if (fileData && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
      triggerDirectDownload(fileData);
      return;
    }
    if (fileData && fileData.startsWith('base64://')) {
      triggerBlobDownload(base64ToBlob(fileData), fileName);
      return;
    }

    // 异步路径：需要 WebSocket 交互
    handleAsyncDownload();
  };

  const handleAsyncDownload = async () => {
    setIsDownloading(true);
    setDownloadError('');

    try {
      if (typeof onDownloadFile === 'function') {
        // 传入完整 segment.data，让 Chat.jsx 依次尝试所有下载 API
        const result = await onDownloadFile(segment);
        if (!result) {
          setDownloadError('文件下载失败：服务器无响应。');
          return;
        }
        const responseData = result?.data?.data || result?.data;
        if (responseData) {
          // 尝试由 Chat 构造的 HTTP 下载链接
          const httpUrls = responseData._http_urls || [];
          for (const url of httpUrls) {
            try {
              const resp = await fetch(url, { mode: 'cors' });
              if (resp.ok) {
                triggerBlobDownload(await resp.blob(), responseData.file_name || fileName);
                return;
              }
            } catch { /* 继续尝试下一个链接 */ }
          }
          // 尝试文件内容（base64 或 HTTP URL）
          const content = responseData.file || responseData.url || '';
          if (content.startsWith('base64://')) {
            triggerBlobDownload(base64ToBlob(content), fileName);
            return;
          }
          if (content.startsWith('http://') || content.startsWith('https://')) {
            const correctName = responseData.file_name || fileName;
            // 先尝试 CORS fetch
            try {
              const resp = await fetch(content, { mode: 'cors' });
              if (resp.ok) {
                triggerBlobDownload(await resp.blob(), correctName);
                return;
              }
            } catch { /* 忽略 */ }
            // 再尝试 no-cors fetch（不透明响应，某些 CDN 可用）
            try {
              const resp = await fetch(content, { mode: 'no-cors' });
              if (resp.type === 'opaque') {
                triggerBlobDownload(await resp.blob(), correctName);
                return;
              }
            } catch { /* 忽略 */ }
            // 最后直接打开新标签页下载
            const a = document.createElement('a');
            a.href = content;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          // 服务器本地文件，无法直接下载
          const serverPath = responseData.file || responseData.file_path || responseData.url || '';
          const fname = responseData.file_name || fileName;
          setDownloadError(
            '文件存储在 NapCat 服务器本地，浏览器无法直接下载。\n\n' +
            '文件名：' + fname + '\n' +
            '服务器路径：' + serverPath + '\n\n' +
            (httpUrls.length > 0
              ? '已尝试 HTTP 下载链接但服务器无响应，请检查 NapCat 文件服务是否已暴露。\n' + httpUrls.join('\n')
              : '')
          );
          return;
        }
      }

      if (fileData && fileData.startsWith('file://')) {
        setDownloadError('文件存储在 NapCat 服务器本地，\n浏览器无法直接下载。');
        return;
      }

      // 显示原始字段供调试
      const debugInfo = JSON.stringify({ name: fileName, url: fileUrl, file: fileData, file_id: fileId });
      setDownloadError('此文件无法下载：缺少可用的下载链接。\n\n原始数据：' + debugInfo);
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadError('下载失败：' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClick = () => {
    if (isDownloading) return;
    if (downloadError) {
      setDownloadError('');
      return;
    }
    handleDownload();
  };

  return (
    <div
      className={`msg-file${isDownloading ? ' msg-file-downloading' : ''}${downloadError ? ' msg-file-error' : ''}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        margin: '4px 0',
        backgroundColor: isDownloading ? '#eff6ff' : downloadError ? '#fef2f2' : '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: isDownloading ? 'wait' : 'pointer',
        transition: 'background-color 0.2s',
        opacity: isDownloading ? 0.7 : 1
      }}
      onClick={handleClick}
      title={downloadError ? '点击关闭提示后重试' : isDownloading ? '下载中...' : '点击下载文件'}
    >
      {downloadError && (
        <div style={{
          fontSize: '12px',
          color: '#dc2626',
          background: '#fef2f2',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #fca5a5',
          whiteSpace: 'pre-line',
          lineHeight: 1.5
        }}>
          {downloadError}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
        <div style={{ fontSize: 'clamp(20px, 7vw, 32px)' }}>{getFileIcon(fileName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fileName}
          </div>
          <div style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '2px' }}>
            {isDownloading ? '正在下载...' : formatFileSize(fileSize)}
          </div>
        </div>
        <div style={{ color: isDownloading ? '#60a5fa' : '#3b82f6', fontSize: '20px' }}>
          {isDownloading ? '⏳' : '⬇'}
        </div>
      </div>
    </div>
  );
}

function normalizeHttpUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return 'https:' + u;
  if (u.indexOf('.') !== -1) return 'https://' + u;
  return '';
}

function getMiniProgramDetail(data) {
  const meta = data && data.meta;
  if (!meta || typeof meta !== 'object') return null;
  const values = Object.values(meta);
  return values.find(v => v && typeof v === 'object' && (v.title || v.appid)) || null;
}

// QQ 小程序卡片
function MiniProgramCard({ data }) {
  const detail = getMiniProgramDetail(data);
  const prompt = typeof data.prompt === 'string' ? data.prompt : '';
  const title = (detail && (detail.title || detail.appname)) || prompt.replace(/^\[QQ小程序\]\s*/, '') || 'QQ小程序';
  const desc = (detail && detail.desc) || '';
  const icon = (detail && detail.icon) || '';
  const preview = (detail && detail.preview) || icon;
  const url = normalizeHttpUrl((detail && (detail.qqdocurl || detail.url || detail.jumpUrl)) || '');

  return (
    <div
      className="msg-json-card"
      onClick={() => { if (url) window.open(url, '_blank'); }}
      title={url || 'QQ小程序'}
    >
      {preview && (
        <img
          className="msg-json-card-preview"
          src={preview}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="msg-json-card-body">
        <div className="msg-json-card-title">{title}</div>
        {desc && <div className="msg-json-card-desc">{desc}</div>}
        <div className="msg-json-card-footer">
          {icon && (
            <img
              className="msg-json-card-icon"
              src={icon}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span className="msg-json-card-tag">QQ小程序</span>
          {url && <span className="msg-json-card-open">点击打开 ↗</span>}
        </div>
      </div>
    </div>
  );
}

// QQ 音乐分享卡片
function MusicCard({ data }) {
  const music = (data && data.meta && data.meta.music) || {};
  const prompt = typeof data.prompt === 'string' ? data.prompt : '';
  const title = music.title || prompt.replace(/^\[QQ音乐\]\s*/, '') || '音乐分享';
  const desc = music.desc || music.album || music.singer || '';
  const preview = music.preview || music.album_pic_url || music.cover || '';
  const icon = music.icon || '';
  const url = normalizeHttpUrl(music.jumpUrl || music.url || '');

  return (
    <div
      className="msg-json-card"
      onClick={() => { if (url) window.open(url, '_blank'); }}
      title={url || 'QQ音乐'}
    >
      {preview && (
        <img
          className="msg-json-card-preview"
          src={preview}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="msg-json-card-body">
        <div className="msg-json-card-title">{title}</div>
        {desc && <div className="msg-json-card-desc">{desc}</div>}
        <div className="msg-json-card-footer">
          {icon && (
            <img
              className="msg-json-card-icon"
              src={icon}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span className="msg-json-card-tag">QQ音乐</span>
          {url && <span className="msg-json-card-open">点击打开 ↗</span>}
        </div>
      </div>
    </div>
  );
}

// JSON 消息分发：小程序 / 音乐 / 普通 JSON
function JsonMessage({ data }) {
  const app = typeof data.app === 'string' ? data.app : '';

  if (app.indexOf('miniapp') !== -1) {
    return <MiniProgramCard data={data} />;
  }
  if (data && data.meta && data.meta.music && typeof data.meta.music === 'object') {
    return <MusicCard data={data} />;
  }
  if (typeof data.prompt === 'string' && data.prompt.trim()) {
    return <div className="msg-json-prompt">{data.prompt}</div>;
  }
  return (
    <div className="msg-json">
      <pre style={{ fontSize: '0.8em', background: '#f5f5f5', padding: '4px', borderRadius: '4px' }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default function MessageRenderer({ message, onAt, groupMembers = [], resolveReplyMessage, onJumpToMessage, onViewForwardMessage, onDownloadFile, onViewImage }) {
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

          case 'image': {
            // NapCat/OneBot 返回 url 或 file（file 可能是本地路径或 base64）
            let imgSrc = segment.data.url || segment.data.file;
            if (!imgSrc) {
              console.warn('Image source not available:', segment.data);
              return <span key={index}>[图片]</span>;
            }

            const isSticker = segment.data.sub_type === 'sticker' || segment.type === 'face';

            // 提取 base64:// 中的内容
            if (imgSrc.indexOf('base64://') !== -1) {
              const base64Data = imgSrc.split('base64://')[1];
              const imageType = base64Data.toLowerCase().endsWith('.gif') ? 'gif'
                : base64Data.toLowerCase().endsWith('.jpg') || base64Data.toLowerCase().endsWith('.jpeg') ? 'jpeg'
                : base64Data.toLowerCase().endsWith('.webp') ? 'webp' : 'png';
              imgSrc = `data:image/${imageType};base64,${base64Data}`;
            } else if (imgSrc.startsWith('file://')) {
              // 浏览器无法访问 file:// 路径
              console.warn('File path only, no HTTP URL available:', imgSrc);
              return <span key={index}>[图片]</span>;
            } else if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
              // 裸 base64 字符串
              if (/^[A-Za-z0-9+/=]+$/.test(imgSrc) && imgSrc.length > 100) {
                const imageType = imgSrc.toLowerCase().startsWith('r0l') ? 'gif'
                  : imgSrc.toLowerCase().startsWith('/9j') ? 'jpeg' : 'png';
                imgSrc = `data:image/${imageType};base64,${imgSrc}`;
              } else if (imgSrc.startsWith('/')) {
                // 相对路径无法解析
                console.warn('Relative path cannot be resolved:', imgSrc);
                return <span key={index}>[图片]</span>;
              }
            }

            return <MsgImage key={index} imgSrc={imgSrc} isSticker={isSticker} onViewImage={onViewImage} />;
          }

          case 'video': {
            let videoSrc = segment.data.url || segment.data.file;
            const videoTitle = segment.data.title || '视频';

            if (!videoSrc) {
              return <span key={index}>[视频]</span>;
            }

            let isBase64 = false;
            if (videoSrc.indexOf('base64://') !== -1) {
              const base64Data = videoSrc.split('base64://')[1];
              const videoType = base64Data.toLowerCase().startsWith('aaaaIGZ0eXBtcDQy') ? 'video/mp4'
                : base64Data.toLowerCase().startsWith('gicg') ? 'video/ogg' : 'video/webm';
              videoSrc = `data:${videoType};base64,${base64Data}`;
              isBase64 = true;
            }

            return <MsgVideo key={index} videoSrc={videoSrc} isBase64={isBase64} title={videoTitle} />;
          }

          case 'face': {
            // QQ 表情支持：使用官方 CDN 加载表情图片
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
          }

          case 'at': {
            // 从群成员列表中查找昵称
            const qqId = String(segment.data.qq);
            let displayName = qqId;

            if (qqId === 'all') {
              displayName = '全体成员';
            } else {
              const member = groupMembers.find(m => String(m.user_id) === qqId);
              if (member) {
                displayName = member.card || member.nickname || qqId;
              } else if (segment.data.name) {
                displayName = segment.data.name;
              }
            }

            return (
              <span
                key={index}
                className="msg-at"
                style={{ color: '#2563eb', fontWeight: 'bold', marginRight: '4px', cursor: onAt ? 'pointer' : 'default' }}
                onClick={() => { if (onAt) onAt(qqId, displayName); }}
                title={onAt ? "Click to @ this user" : ""}
              >
                @{displayName}
              </span>
            );
          }

          case 'reply': {
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
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Reply size={12} /> 回复:
                </div>
                <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {resolved
                    ? `引用 ${resolved.sender}: ${resolved.text}`
                    : `引用消息 ID: ${replyId}`}
                </div>
              </div>
            );
          }

          case 'file':
            return <FileMessage key={index} segment={segment.data} onDownloadFile={onDownloadFile} />;

          case 'record':
            return <div key={index} className="msg-record">[语音]</div>;

          case 'share': {
            const shareUrl = segment.data.url || '';
            return (
              <div key={index} className="msg-share" style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '8px', margin: '4px 0', cursor: 'pointer', background: '#fff' }} onClick={() => { if (/^https?:/i.test(shareUrl)) window.open(shareUrl, '_blank'); }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#333' }}>{segment.data.title || '分享链接'}</div>
                {segment.data.content ? <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>{segment.data.content}</div> : null}
              </div>
            );
          }

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

          case 'json': {
            try {
              const jsonData = typeof segment.data.data === 'string' ? JSON.parse(segment.data.data) : segment.data.data;
              return <JsonMessage key={index} data={jsonData} />;
            } catch {
              return <span key={index} className="msg-json">[JSON]</span>;
            }
          }

          default:
            // 尝试显示未知 CQ 段
            return <span key={index} className="msg-unknown" title={JSON.stringify(segment.data)} style={{ color: '#999' }}>[{segment.type}]</span>;
        }
      })}
    </div>
  );
}