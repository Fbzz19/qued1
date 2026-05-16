import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AvatarCropModalProps {
  file: File;
  onClose: () => void;
  onSaved: (url: string) => void;
}

interface DragState {
  dragging: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const CANVAS_SIZE = 400; // output px (square)
const PREVIEW_SIZE = 260; // viewport circle px

export default function AvatarCropModal({ file, onClose, onSaved }: AvatarCropModalProps) {
  const { user, refreshProfile } = useAuth();

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Validate and read file
  useEffect(() => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Only JPG, PNG, and WEBP images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => setImgSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [file]);

  function onImgLoad() {
    if (!imgRef.current) return;
    setNaturalW(imgRef.current.naturalWidth);
    setNaturalH(imgRef.current.naturalHeight);
    // Start with image filling the circle
    const minDim = Math.min(imgRef.current.naturalWidth, imgRef.current.naturalHeight);
    const initZoom = PREVIEW_SIZE / minDim;
    setZoom(initZoom);
    setOffsetX(0);
    setOffsetY(0);
  }

  // Clamp offset so image always covers the circle
  function clamp(ox: number, oy: number, z: number): [number, number] {
    if (!naturalW || !naturalH) return [ox, oy];
    const rendW = naturalW * z;
    const rendH = naturalH * z;
    const maxX = Math.max(0, (rendW - PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (rendH - PREVIEW_SIZE) / 2);
    return [
      Math.max(-maxX, Math.min(maxX, ox)),
      Math.max(-maxY, Math.min(maxY, oy)),
    ];
  }

  function setZoomClamped(z: number) {
    const newZ = Math.max(minZoom(), Math.min(4, z));
    const [cx, cy] = clamp(offsetX, offsetY, newZ);
    setZoom(newZ);
    setOffsetX(cx);
    setOffsetY(cy);
  }

  function minZoom(): number {
    if (!naturalW || !naturalH) return 1;
    return PREVIEW_SIZE / Math.min(naturalW, naturalH);
  }

  // ── Pointer events for drag ──────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: offsetX, originY: offsetY };
  }, [offsetX, offsetY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const [cx, cy] = clamp(dragRef.current.originX + dx, dragRef.current.originY + dy, zoom);
    setOffsetX(cx);
    setOffsetY(cy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, naturalW, naturalH]);

  const onPointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoomClamped(zoom - e.deltaY * 0.001);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offsetX, offsetY, naturalW, naturalH]);

  // Prevent page scroll when mouse is over the viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handle = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', handle, { passive: false });
    return () => el.removeEventListener('wheel', handle);
  }, []);

  // ── Crop and upload ──────────────────────────────────────────────────────────
  async function save() {
    if (!imgSrc || !user) return;
    setSaving(true);
    setError('');

    try {
      // Draw cropped region to canvas
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d')!;

      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = imgSrc;
      });

      // What portion of the natural image maps to the PREVIEW_SIZE circle
      const rendW = naturalW * zoom;
      const rendH = naturalH * zoom;
      // Centre of rendered image in viewport coords
      const imgCX = PREVIEW_SIZE / 2 + offsetX;
      const imgCY = PREVIEW_SIZE / 2 + offsetY;
      // Top-left of rendered image in viewport coords
      const imgLeft = imgCX - rendW / 2;
      const imgTop  = imgCY - rendH / 2;
      // Visible portion of the viewport (circle = PREVIEW_SIZE square)
      const srcX = (0 - imgLeft) / zoom;
      const srcY = (0 - imgTop)  / zoom;
      const srcW = PREVIEW_SIZE  / zoom;
      const srcH = PREVIEW_SIZE  / zoom;

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Convert to blob
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), 'image/jpeg', 0.92)
      );

      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase.from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbErr) throw dbErr;

      await refreshProfile();
      onSaved(publicUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const renderedW = naturalW * zoom;
  const renderedH = naturalH * zoom;
  const imgLeft = PREVIEW_SIZE / 2 + offsetX - renderedW / 2;
  const imgTop  = PREVIEW_SIZE / 2 + offsetY - renderedH / 2;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#111', borderRadius: 20, border: '1px solid #2e2e2e', padding: 28, width: '100%', maxWidth: 380, position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={15} color="#f59e0b" />
            </div>
            <div>
              <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>Edit Profile Photo</p>
              <p style={{ margin: 0, color: '#555', fontSize: 11 }}>Drag to reposition · Scroll to zoom</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            <X size={16} />
          </button>
        </div>

        {error && !imgSrc ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#f87171', fontSize: 13 }}>{error}</p>
            <button onClick={onClose} className="btn-ghost" style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, fontSize: 13 }}>Close</button>
          </div>
        ) : imgSrc ? (
          <>
            {/* Crop viewport */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div
                ref={viewportRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
                style={{
                  width: PREVIEW_SIZE,
                  height: PREVIEW_SIZE,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'grab',
                  border: '3px solid #f59e0b',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,.6)',
                  touchAction: 'none',
                  userSelect: 'none',
                  background: '#0a0a0a',
                  flexShrink: 0,
                }}
              >
                {imgSrc && (
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    onLoad={onImgLoad}
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: imgLeft,
                      top: imgTop,
                      width: renderedW,
                      height: renderedH,
                      pointerEvents: 'none',
                      userSelect: 'none',
                      maxWidth: 'none',
                    }}
                    alt="crop preview"
                  />
                )}
              </div>

              {/* Zoom controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: PREVIEW_SIZE }}>
                <button
                  onClick={() => setZoomClamped(zoom - 0.1)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #2e2e2e', background: '#0d0d0d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                >
                  <ZoomOut size={14} />
                </button>
                <input
                  type="range"
                  min={minZoom()}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={e => setZoomClamped(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#f59e0b', cursor: 'pointer' }}
                />
                <button
                  onClick={() => setZoomClamped(zoom + 0.1)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #2e2e2e', background: '#0d0d0d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {error && (
              <p style={{ margin: 0, color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid #2e2e2e', background: 'none', color: '#888', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', transition: 'all .2s' }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#ccc'; } }}
                onMouseLeave={e => { if (!saving) { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#888'; } }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: saving ? '#3a2f10' : '#f59e0b', color: saving ? '#888' : '#000', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#fbbf24'; }}
                onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#f59e0b'; }}
              >
                {saving ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid #555', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Save Photo
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', animation: 'bounceDot 1.4s 0ms infinite', display: 'inline-block', margin: '0 4px' }} />
            <div style={{ width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', animation: 'bounceDot 1.4s 150ms infinite', display: 'inline-block', margin: '0 4px' }} />
            <div style={{ width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', animation: 'bounceDot 1.4s 300ms infinite', display: 'inline-block', margin: '0 4px' }} />
          </div>
        )}
      </div>
    </div>
  );
}
