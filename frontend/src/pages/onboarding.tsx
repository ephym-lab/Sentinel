import React, { useState } from "react";
import { useRouter } from "next/router";
import { Building2, User, Camera, ArrowRight, ShieldCheck, Check, Upload, AlertCircle, Sparkles } from "lucide-react";
import api from "src/lib/api";
import { useAuthStore } from "src/store/authStore";
import { useFileUpload } from "src/hooks/useFileUpload";

function generateUUID() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Onboarding() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Tenant Organization Details
  const [tenantId] = useState(() => generateUUID());
  const [tenantName, setTenantName] = useState("");
  const [tenantMode, setTenantMode] = useState<"school" | "mall" | "supermarket">("school");
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);

  // Step 2: Owner User Details
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Step 3: First Camera details
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

  // Navigation handlers
  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      setError("Organization name is required.");
      return;
    }
    setError(null);
    setIsSubmittingTenant(true);

    try {
      await api.post("/tenants/", {
        id: tenantId,
        name: tenantName,
        mode: tenantMode,
      });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create organization. Please try again.");
    } finally {
      setIsSubmittingTenant(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError("All fields are required.");
      return;
    }
    setError(null);
    setIsSubmittingUser(true);

    try {
      const response = await api.post("/users/", {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        tenant_id: tenantId,
      });

      // The backend user creation will save the user details.
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create administrator account.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleCameraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cameraName.trim()) {
      setError("Camera name is required.");
      return;
    }
    setError(null);
    setIsSubmittingCamera(true);

    try {
      const response = await api.post(
        "/cameras/",
        {
          name: cameraName,
          zone: cameraZone || "General",
          camera_type: cameraType,
          location: cameraZone || "General",
          is_active: true,
        },
        {
          headers: {
            "X-Tenant-ID": tenantId,
          },
        }
      );

      setCreatedCameraId(response.data.id);
      
      // If no file was selected, skip upload and complete onboarding
      if (!file) {
        completeOnboarding();
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
      completeOnboarding();
    } catch (err: any) {
      setError(uploadError || "Failed to upload simulated video stream file.");
    }
  };

  const completeOnboarding = () => {
    // Save to auth store
    setAuth(
      {
        id: tenantId,
        name: tenantName,
        mode: tenantMode,
      },
      {
        id: "user-onboarded",
        name: adminName,
        email: adminEmail,
        role: "admin",
      },
      "mock-jwt-token"
    );

    // Navigate to step 4 (Success state)
    setStep(4);
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Setup Sentinel Surveillance</h2>
          <p className="mt-2 text-sm text-slate-400">Secure your facility in real-time with AI analysis</p>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-900">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    step === s
                      ? "bg-rose-600 text-white shadow-md shadow-rose-900/30 ring-2 ring-rose-500/30"
                      : step > s
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    step === s ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {s === 1 ? "Organization" : s === 2 ? "Account" : "First Camera"}
                </span>
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 mx-4 rounded ${step > s ? "bg-emerald-500/20" : "bg-slate-900"}`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 1 && (
          <form onSubmit={handleTenantSubmit} className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-500" /> Step 1: Organization Details
              </h3>
              <p className="text-xs text-slate-400">Initialize your dedicated database schema workspace.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oakridge High School"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Deployment Environment Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["school", "mall", "supermarket"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTenantMode(mode)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        tenantMode === mode
                          ? "bg-rose-500/10 border-rose-500 text-rose-400"
                          : "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-300"
                      }`}
                    >
                      <span className="text-xs capitalize font-semibold">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingTenant}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/10 transition-all disabled:opacity-50"
            >
              {isSubmittingTenant ? "Creating Workspace..." : "Continue to Account Settings"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleUserSubmit} className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-rose-500" /> Step 2: Administrator Credentials
              </h3>
              <p className="text-xs text-slate-400">Create the primary admin account for this tenant workspace.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Alex Mercer"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@school.edu"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingUser}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/10 transition-all disabled:opacity-50"
            >
              {isSubmittingUser ? "Creating Account..." : "Continue to Device Registration"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-500" /> Step 3: Register First Camera
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
                    onClick={() => completeOnboarding()}
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

        {step === 4 && (
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
