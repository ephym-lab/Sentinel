import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera as CameraIcon, CameraOff, Plus, AlertCircle, RefreshCw } from "lucide-react";
import api from "src/lib/api";
import EmptyState from "src/components/shared/EmptyState";
import CameraCard, { Camera } from "src/components/cameras/CameraCard";
import AddCameraDialog from "src/components/cameras/AddCameraDialog";

export default function DevicesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [dialogStep, setDialogStep] = useState<"details" | "upload">("details");

  // Query to fetch all registered cameras for the active tenant
  const { 
    data: cameras = [], 
    isLoading, 
    isError, 
    refetch, 
    isFetching 
  } = useQuery<Camera[]>({
    queryKey: ["cameras"],
    queryFn: async () => {
      const response = await api.get("/cameras/");
      return response.data;
    },
    // Poll every 5 seconds so processing transitions to active automatically
    refetchInterval: 5000,
  });

  // Camera deletion action
  const handleDeleteCamera = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this camera? This will permanently remove all video files associated with it.")) {
      return;
    }

    try {
      await api.delete(`/cameras/${id}`);
      refetch();
    } catch (err) {
      console.error("Failed to delete camera:", err);
      alert("Error: Failed to delete camera. Please try again.");
    }
  };

  // Replace Feed action (re-opens Step 2 for a specific camera ID)
  const handleReplaceFeed = (camera: Camera) => {
    setSelectedCameraId(camera.id);
    setDialogStep("upload");
    setIsDialogOpen(true);
  };

  // Add Camera action (starts clean at Step 1)
  const handleAddCamera = () => {
    setSelectedCameraId(null);
    setDialogStep("details");
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 min-h-screen pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/60">
        <div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <CameraIcon className="w-8 h-8 text-rose-500" /> Camera Management
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Register virtual security cameras and upload test video clips to simulate live security feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mr-2 bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-800/80">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" /> Syncing...
            </span>
          )}
          <button
            onClick={handleAddCamera}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-900/25 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Camera
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-800/80 bg-slate-900/20 aspect-video animate-pulse flex flex-col justify-between p-4 min-h-[200px]">
              <div className="w-1/3 h-4 bg-slate-800 rounded-md" />
              <div className="space-y-2">
                <div className="w-3/4 h-3 bg-slate-800 rounded-md" />
                <div className="w-1/2 h-3 bg-slate-800 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        // Error state
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-400 text-sm flex items-start gap-3 max-w-xl mx-auto mt-12 shadow-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-300">Connection Error</p>
            <p className="mt-1 leading-relaxed text-xs text-slate-400">
              Could not communicate with the Sentinel backend. Please check that the server is running on `http://localhost:8000`.
            </p>
            <button 
              onClick={() => refetch()}
              className="mt-3.5 px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg transition-all"
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : cameras.length === 0 ? (
        // Empty state
        <div className="pt-12">
          <EmptyState
            icon={CameraOff}
            title="No Cameras Configured"
            description="You haven't added any cameras to this tenant schema yet. Start by creating a virtual device and uploading a video feed to simulate live monitoring."
            action={
              <button
                onClick={handleAddCamera}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-900/25"
              >
                <Plus className="w-4 h-4" /> Add Your First Camera
              </button>
            }
          />
        </div>
      ) : (
        // Camera Grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              onDelete={handleDeleteCamera}
              onReplaceFeed={handleReplaceFeed}
            />
          ))}
        </div>
      )}

      {/* Multi-step Add/Edit Feed Dialog */}
      <AddCameraDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        initialCameraId={selectedCameraId}
        initialStep={dialogStep}
      />
    </div>
  );
}
