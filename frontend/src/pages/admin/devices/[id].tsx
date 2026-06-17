import React, { useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera as CameraIcon, Film, AlertTriangle, Check, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import api, { API_BASE_URL } from "src/lib/api";
import FeedHistoryList from "src/components/cameras/FeedHistoryList";
import AddCameraDialog from "src/components/cameras/AddCameraDialog";
import { Camera } from "src/components/cameras/CameraCard";

export default function CameraDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [cameraType, setCameraType] = useState("general");
  const [location, setLocation] = useState("");

  const { data: camera, isLoading, isError, refetch } = useQuery<Camera>({
    queryKey: ["camera", id],
    queryFn: async () => {
      const response = await api.get(`/cameras/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Since React Query v5 deprecates onSuccess in useQuery directly, we sync state in render/effects if needed.
  // We can do it on first load or when camera changes.
  React.useEffect(() => {
    if (camera) {
      setName(camera.name);
      setZone(camera.zone || camera.location || "");
      setCameraType(camera.camera_type || "general");
      setLocation(camera.location || "");
    }
  }, [camera]);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      await api.patch(`/cameras/${id}`, {
        name,
        zone,
        camera_type: cameraType,
        location: location || zone,
        is_active: true
      });
      setSaveSuccess(true);
      refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update camera parameters.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCamera = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this camera? This will remove all history and files associated with it.")) {
      return;
    }

    try {
      await api.delete(`/cameras/${id}`);
      router.push("/admin/devices");
    } catch (err) {
      console.error("Failed to delete camera:", err);
      alert("Error: Failed to delete camera.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400 text-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-rose-500" /> Loading camera details...
        </div>
      </div>
    );
  }

  if (isError || !camera) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-400 text-sm max-w-md mx-auto mt-12 text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="font-bold">Camera Not Found</p>
        <p className="mt-1 text-xs text-slate-500">The camera ID is invalid or has been deleted.</p>
        <Link href="/admin/devices" className="mt-4 inline-flex px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200">
          Back to Cameras
        </Link>
      </div>
    );
  }

  const feedUrl = camera.active_feed?.file_path 
    ? `${API_BASE_URL}/static/${camera.active_feed.file_path}` 
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <div>
        <Link href="/admin/devices" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Camera Management
        </Link>
      </div>

      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            {camera.name}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Device ID: <span className="font-mono text-slate-300">{camera.id}</span>
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Replace Feed File
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Video Preview and Feed History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Video Viewport */}
          <div className="aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden relative shadow-2xl flex items-center justify-center">
            {feedUrl ? (
              <video
                src={feedUrl}
                controls
                muted
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-600 gap-2">
                <Film className="w-12 h-12 text-slate-700" />
                <span className="text-xs uppercase font-bold tracking-wider">No Active Video Feed</span>
              </div>
            )}

            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-xs font-semibold text-rose-400 border border-white/5 uppercase">
              Live Feed Viewport
            </div>
          </div>

          {/* Feed History component */}
          <FeedHistoryList 
            cameraId={camera.id} 
            feeds={camera.feeds || []} 
            onRefresh={refetch} 
          />
        </div>

        {/* Right 1 Column: Settings panel */}
        <div className="space-y-6">
          {/* Settings Form Card */}
          <div className="bg-[#0b0c10]/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-rose-500" /> Camera Parameters
            </h3>
            
            <form onSubmit={handleUpdateDetails} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Camera Name</label>
                <input
                  type="text"
                  required
                  placeholder="Camera Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                />
              </div>

              {/* Zone */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zone / Location Tag</label>
                <input
                  type="text"
                  placeholder="Zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                />
              </div>

              {/* Specific Location Details */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Specific Coordinates</label>
                <input
                  type="text"
                  placeholder="Location specifics"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                />
              </div>

              {/* Camera Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lens Type</label>
                <select
                  value={cameraType}
                  onChange={(e) => setCameraType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                >
                  <option value="general">General Surveillance</option>
                  <option value="thermal">Thermal Imaging</option>
                  <option value="wide-angle">Wide-Angle Panorama</option>
                  <option value="face-focused">Face-Focused Recognition</option>
                </select>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Parameters saved successfully.
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-900/10 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Parameters"}
              </button>
            </form>
          </div>

          {/* Delete Danger Zone */}
          <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4.5 h-4.5" /> Danger Zone
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Permanently deletes this camera, all feed clips stored on disk, and historical event registries.
            </p>
            <button
              onClick={handleDeleteCamera}
              className="w-full py-2 bg-rose-950/40 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              Delete Camera Device
            </button>
          </div>
        </div>

      </div>

      {/* Dialog for Uploading a Replacement Feed */}
      <AddCameraDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        initialCameraId={camera.id}
        initialStep="upload"
      />
    </div>
  );
}
