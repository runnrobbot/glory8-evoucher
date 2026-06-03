import { useState, useRef, useCallback, memo } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadToCloudinary, UPLOAD_FOLDERS } from '@/lib/cloudinary';
import { toastError } from './Toast';

const FileUpload = memo(function FileUpload({
  value,
  onChange,
  folder = UPLOAD_FOLDERS.COMPANY_LOGO,
  label = 'Upload Image',
  accept = 'image/png,image/jpeg,image/webp',
  className = '',
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(value || null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    setIsUploading(true);
    setProgress(0);

    abortRef.current = new AbortController();

    try {
      const result = await uploadToCloudinary(file, {
        folder,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });

      setPreview(result.url);
      onChange(result.url);
    } catch (error) {
      if (error.code !== 'CANCELLED') {
        toastError(error.message || 'Upload failed');
        setPreview(value || null);
      }
    } finally {
      setIsUploading(false);
      setProgress(0);
      URL.revokeObjectURL(localUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [folder, onChange, value]);

  const handleRemove = useCallback(() => {
    if (isUploading && abortRef.current) {
      abortRef.current.abort();
    }
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isUploading, onChange]);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
        id={`file-upload-${folder}`}
      />

      {preview ? (
        <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-40 object-cover"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-white text-xs mt-1">{progress}%</p>
            </div>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <label
          htmlFor={`file-upload-${folder}`}
          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-all duration-200 group"
        >
          <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-primary-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-slate-400">PNG, JPG, WebP up to 5MB</span>
          </div>
        </label>
      )}
    </div>
  );
});

export default FileUpload;
