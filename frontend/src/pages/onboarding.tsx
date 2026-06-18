import React, { useState } from "react";
import { useRouter } from "next/router";
import { Camera, ArrowRight, ShieldCheck, Check, Upload, AlertCircle, Sparkles } from "lucide-react";
import api from "src/lib/api";
import { useAuthStore } from "src/store/authStore";
import { useFileUpload } from "src/hooks/useFileUpload";

export default function Onboarding() {
  const router = useRouter();
  const { tenant } = useAuthStore();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  // Camera details
  const [cameraName, setCameraName] = useState("");
  const [cameraZone, setCameraZone] = useState("");
  const [cameraType, setCameraType] = useState("general");
  const [createdCameraId, setCreatedCameraId] = useState<string | null>(null);
  const [isSubmittingCamera, setIsSubmittingCamera] = useState(false);

  // Hook for video file upload progress
  const {
    file,
    previewUrl,
    progress,
    isUploading,
    isSuccess: isUploadSuccess,
    error: uploadError,
    selectFile,
    upload,
    reset: resetUpload,
  } = useFileUpload({ maxSizeMB: 200 });

  const handleCameraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cameraName.trim()) {
      setError("Camera name is required.");
      return;
    }
    setError(null);
    setIsSubmittingCamera(true);

    try {
      const response = await api.post("/cameras/", {
        name: cameraName,
        zone: cameraZone || "General",
        camera_type: cameraType,
        location: cameraZone || "General",
        is_active: true,
      });

      setCreatedCameraId(response.data.id);
      
      // If no file was selected, skip upload and complete onboarding
      if (!file) {
        setStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to register camera details.");
      setIsSubmittingCamera(false);
    }
  };

  const handleFileUpload = async () => {
    if (!createdCameraId) return;
    setError(null);
    try {
      await upload(`/cameras/${createdCameraId}/feed`);
      setStep(2);
    } catch (err: any) {
      setError(uploadError || "Failed to upload simulated video stream file.");
    }
  };

  const triggerFileSelect = () => {
    const input = document.getElementById("onboarding-file-input") as HTMLInputElement;
    if (input) input.click();
  };

  return (
    <div className="min-h-screen bg-[#07080a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full space-y-8 bg-[#0c0e15] border border-slate-900 rounded-2xl p-8 shadow-2xl relative z-10">
        
        {/* Logo and Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Almost there!</h2>
          <p className="mt-2 text-sm text-slate-400">Let's set up the first camera for {tenant?.name || "your workspace"}</p>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-500" /> Register First Camera
              </h3>
              <p className="text-xs text-slate-400">Register your first hardware device and mock upload a video stream.</p>
            </div>

            {!createdCameraId ? (
              <form onSubmit={handleCameraSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Camera Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Entry Gate"
                    value={cameraName}
                    onChange={(e) => setCameraName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Zone / Location Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Parking Lot A"
                    value={cameraZone}
                    onChange={(e) => setCameraZone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Lens Type / Mode</label>
                  <select
                    value={cameraType}
                    onChange={(e) => setCameraType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-855 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  >
                    <option value="general">General Surveillance</option>
                    <option value="thermal">Thermal Imaging</option>
                    <option value="wide-angle">Wide-Angle Panorama</option>
                    <option value="face-focused">Face-Focused Recognition</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 px-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-semibold transition-all"
                  >
                    Skip for Now
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCamera}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {isSubmittingCamera ? "Saving Details..." : "Next: Stream Video"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <input
                  type="file"
                  id="onboarding-file-input"
                  className="hidden"
                  accept="video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) selectFile(f);
                  }}
                />

                {!file ? (
                  <div
                    onClick={triggerFileSelect}
                    className="border-2 border-dashed border-slate-850 hover:border-rose-500/50 rounded-xl p-8 text-center cursor-pointer bg-slate-950/65 hover:bg-slate-900/20 transition-all group"
                  >
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-rose-500 mx-auto mb-2 transition-colors" />
                    <span className="text-xs font-semibold text-slate-300 block mb-1">Select Simulated Feed File</span>
                    <span className="text-[10px] text-slate-500 block">MP4, MOV, or AVI streams (Max size 200MB)</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {previewUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-850 bg-black aspect-video relative">
                        <video src={previewUrl} controls className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <span className="truncate max-w-[240px] font-medium text-slate-300">{file.name}</span>
                      <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>

                    {isUploading ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Uploading Stream Feed...</span>
                          <span className="font-semibold text-rose-500">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => resetUpload()}
                          className="flex-1 py-2.5 px-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-semibold transition-all"
                        >
                          Clear Selection
                        </button>
                        <button
                          type="button"
                          onClick={handleFileUpload}
                          className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-all"
                        >
                          Upload & Complete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-6 space-y-6">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 animate-bounce">
              <ShieldCheck className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Setup Completed Successfully!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Your organization has been onboarded and your security workstation has been initialized with threat detection logic.
              </p>
            </div>

            <button
              onClick={() => router.push("/monitor")}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 transition-all"
            >
              Enter Dashboard Monitor
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
