import { useState, useRef, useCallback, memo } from 'react';
import { Move, UploadCloud, X, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * ImagePositionPicker
 *
 * Lets users upload an image and drag it inside a fixed-aspect-ratio frame
 * to choose the visible portion (like CSS object-position).
 *
 * Props:
 *   value       - { url, posX, posY } — current saved position
 *   onChange    - fn({ url, posX, posY }) — called on change
 *   aspectRatio - CSS aspect-ratio string, default "16/6" (banner)
 *   folder      - Cloudinary upload folder
 *   label       - Upload button label
 *   onUpload    - async fn(file) => url — handles the actual upload
 */
const ImagePositionPicker = memo(function ImagePositionPicker({
  value = { url: '', posX: 50, posY: 50 },
  onChange,
  aspectRatio = '16/6',
  label = 'Upload Image',
  onUpload,
  uploadingText = 'Uploading...',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [posAtDragStart, setPosAtDragStart] = useState({ x: 50, y: 50 });
  const frameRef = useRef(null);
  const fileRef = useRef(null);

  const url = value?.url || '';
  const posX = value?.posX ?? 50;
  const posY = value?.posY ?? 50;

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    try {
      const uploadedUrl = await onUpload(file);
      onChange({ url: uploadedUrl, posX: 50, posY: 50 });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }, [onUpload, onChange]);

  // ── Drag to reposition ───────────────────────────────────────────────────
  const getFrameSize = () => {
    if (!frameRef.current) return { w: 1, h: 1 };
    const rect = frameRef.current.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  };

  const handlePointerDown = useCallback((e) => {
    if (!url) return;
    e.preventDefault();
    setIsDragging(true);
    setPosAtDragStart({ x: posX, y: posY });
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [url, posX, posY]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    const { w, h } = getFrameSize();
    const dx = ((e.clientX - dragStart.x) / w) * -100;
    const dy = ((e.clientY - dragStart.y) / h) * -100;
    const newX = Math.max(0, Math.min(100, posAtDragStart.x + dx));
    const newY = Math.max(0, Math.min(100, posAtDragStart.y + dy));
    onChange({ url, posX: Math.round(newX), posY: Math.round(newY) });
  }, [isDragging, dragStart, posAtDragStart, url, onChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleRemove = useCallback(() => {
    onChange({ url: '', posX: 50, posY: 50 });
  }, [onChange]);

  return (
    <div className="space-y-2">
      {/* Frame preview */}
      <div
        ref={frameRef}
        className={`relative w-full rounded-xl overflow-hidden bg-slate-100 border-2 transition-colors ${
          url ? 'border-slate-200 cursor-grab active:cursor-grabbing' : 'border-dashed border-slate-300'
        } ${isDragging ? 'border-primary-400' : ''}`}
        style={{ aspectRatio }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {url ? (
          <>
            <img
              src={url}
              alt="Preview"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                objectFit: 'cover',
                objectPosition: `${posX}% ${posY}%`,
                userSelect: 'none',
                draggable: 'false',
              }}
              draggable={false}
            />
            {/* Drag hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
              <div className="bg-white/90 rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-slate-700 font-medium shadow-lg">
                <Move className="w-4 h-4" /> Drag to reposition
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <UploadCloud className="w-8 h-8 text-slate-400" />
            <p className="text-sm text-slate-400">{label}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="btn-secondary text-sm py-1.5 flex-1"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              {uploadingText}
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              {url ? 'Change Image' : label}
            </>
          )}
        </button>

        {url && (
          <button
            type="button"
            onClick={handleRemove}
            className="btn-icon text-red-500 hover:bg-red-50"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Position sliders — visible only when image is loaded */}
      {url && (
        <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">
              Horizontal Position: {posX}%
            </label>
            <input
              type="range" min={0} max={100} value={posX}
              onChange={(e) => onChange({ url, posX: Number(e.target.value), posY })}
              className="w-full accent-primary-600"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">
              Vertical Position: {posY}%
            </label>
            <input
              type="range" min={0} max={100} value={posY}
              onChange={(e) => onChange({ url, posX, posY: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default ImagePositionPicker;
