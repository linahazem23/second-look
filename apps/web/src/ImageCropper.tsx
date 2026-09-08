import React, { useEffect, useRef, useState } from 'react';

const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 800;

export function ImageCropModal({ file, onCancel, onCropped }: { file: File; onCancel: () => void; onCropped: (blob: Blob) => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = imgSize.width && imgSize.height
    ? Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height)
    : 1;
  const displayScale = baseScale * zoom;
  const displayWidth = imgSize.width * displayScale;
  const displayHeight = imgSize.height * displayScale;

  function clamp(value: { x: number; y: number }) {
    const minX = VIEWPORT_SIZE - displayWidth;
    const minY = VIEWPORT_SIZE - displayHeight;
    return { x: Math.min(0, Math.max(minX, value.x)), y: Math.min(0, Math.max(minY, value.y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp({ x: dragRef.current.startOffsetX + dx, y: dragRef.current.startOffsetY + dy }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(next: number) {
    setZoom(next);
    setOffset((prev) => clamp(prev));
  }

  function confirmCrop() {
    if (!imgUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const sx = -offset.x / displayScale;
      const sy = -offset.y / displayScale;
      const sSize = VIEWPORT_SIZE / displayScale;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob((blob) => { if (blob) onCropped(blob); }, 'image/jpeg', 0.9);
    };
    img.src = imgUrl;
  }

  return (
    <div className="crop-overlay">
      <div className="crop-modal">
        <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5, margin: '0 0 10px' }}>Crop photo</h3>
        <div
          className="crop-viewport"
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {imgUrl && (
            <img
              src={imgUrl}
              alt="Crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: displayWidth,
                height: displayHeight,
                maxWidth: 'none'
              }}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          style={{ width: VIEWPORT_SIZE, marginTop: 12 }}
        />
        <div className="form-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-solid" onClick={confirmCrop}>
            <span className="shine" /><span className="label">Use photo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
