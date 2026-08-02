import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import './ImageViewer.css';

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.3;
const DOUBLE_CLICK_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

// 内置图片查看器：滚轮/按钮缩放、双击放大、拖动平移、Esc/点击遮罩关闭
export default function ImageViewer({ image, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const dragRef = useRef(null);
  const lastTapRef = useRef(0);
  const suppressDblRef = useRef(false);
  const stageRef = useRef(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLoadFailed(false);
  }, []);

  const zoomIn = useCallback(() => {
    setScale(s => Math.min(MAX_SCALE, s * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(MIN_SCALE, s / ZOOM_STEP));
  }, []);

  // 滚轮缩放（非 passive，保证能 preventDefault，页面不会跟着滚动）
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !image) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [image]);

  // Esc 关闭 + 打开期间锁定背景滚动
  useEffect(() => {
    if (!image) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [image, onClose]);

  if (!image) return null;

  const toggleZoom = () => {
    setScale(s => (s > 1 ? 1 : DOUBLE_CLICK_SCALE));
    setOffset({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (suppressDblRef.current) return;
    toggleZoom();
  };

  // 移动端双击（双击两下）放大，并抑制随后的 dblclick 避免重复触发
  const handleTap = () => {
    const now = Date.now();
    const dt = now - lastTapRef.current;
    lastTapRef.current = now;
    if (dt > 0 && dt < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      suppressDblRef.current = true;
      toggleZoom();
      setTimeout(() => { suppressDblRef.current = false; }, 400);
    }
  };

  const handlePointerDown = (e) => {
    if (scale <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-toolbar" onClick={(e) => e.stopPropagation()}>
        <span className="image-viewer-scale">{Math.round(scale * 100)}%</span>
        <button type="button" className="image-viewer-btn" onClick={zoomOut} title="缩小">
          <ZoomOut size={20} />
        </button>
        <button type="button" className="image-viewer-btn" onClick={reset} title="重置缩放">
          1:1
        </button>
        <button type="button" className="image-viewer-btn" onClick={zoomIn} title="放大">
          <ZoomIn size={20} />
        </button>
        <button type="button" className="image-viewer-btn image-viewer-close" onClick={onClose} title="关闭">
          <X size={22} />
        </button>
      </div>

      <div
        ref={stageRef}
        className={`image-viewer-stage${dragging ? ' is-dragging' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleDoubleClick}
        onTouchEnd={handleTap}
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {loadFailed ? (
          <div className="image-viewer-error">图片加载失败</div>
        ) : (
          <img
            src={image.src}
            alt={image.alt || '图片'}
            draggable={false}
            onError={() => setLoadFailed(true)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging ? 'none' : 'transform 0.15s ease-out'
            }}
          />
        )}
      </div>

      <div className="image-viewer-hint">滚轮 / 按钮缩放 · 双击放大 · 拖动平移 · Esc 关闭</div>
    </div>
  );
}