import React, { useRef } from "react";
import { useFileUpload } from "src/hooks/useFileUpload";
import { Upload, Video, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface VideoUploadStepProps {
  cameraId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VideoUploadStep({ cameraId, onSuccess, onCancel }: VideoUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    file,
    previewUrl,
    progress,
    isUploading,
    isSuccess,
    error,
    selectFile,
    upload,
    reset
  } = useFileUpload();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    try {
      await upload(`/cameras/${cameraId}/feed`);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {!file ? (
        // File Selection View
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group border-2 border-dashed border-slate-800 hover:border-rose-500/60 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-900/20 hover:bg-slate-900/40"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="video/mp4,video/quicktime,video/x-msvideo"
            className="hidden" 
          />
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-rose-400 group-hover:border-rose-500/30 transition-all mb-4">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-200">Select simulated camera feed</p>
          <p className="text-xs text-slate-500 mt-1.5 text-center max-w-xs leading-relaxed">
            Click to choose a video file from your computer (MP4, MOV, or AVI). Max size 200MB.
          </p>
        </div>
      ) : (
        // Preview View
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
            <video 
              src={previewUrl || ""} 
              controls 
              className="w-full max-h-64 object-contain"
            />
            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur text-[10px] font-semibold text-rose-400 border border-white/5 flex items-center gap-1">
              <Video className="w-3.5 h-3.5" /> Video Preview
            </div>
          </div>

          <div className="flex items-start justify-between bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5">
            <div className="min-w-0 pr-4">
              <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button 
              onClick={reset}
              disabled={isUploading}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}

      {/* Error View */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {/* Progress Bar */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading feed to storage...
            </span>
            <span className="text-rose-400">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success View */}
      {isSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">Upload complete! Live analytics will begin shortly.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-slate-800 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        {file && !isSuccess && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Upload and finish"}
          </button>
        )}
      </div>
    </div>
  );
}
