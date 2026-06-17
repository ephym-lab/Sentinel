import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Camera, Plus, Video, Check } from "lucide-react";
import api from "src/lib/api";
import VideoUploadStep from "./VideoUploadStep";

interface AddCameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialCameraId?: string | null;
  initialStep?: "details" | "upload";
}

type Step = "details" | "upload";

export default function AddCameraDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  initialCameraId = null,
  initialStep = "details"
}: AddCameraDialogProps) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [cameraType, setCameraType] = useState("general");
  const [location, setLocation] = useState("");
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [createdCameraId, setCreatedCameraId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (initialCameraId) {
        setCreatedCameraId(initialCameraId);
        setStep(initialStep);
      } else {
        setStep("details");
        setCreatedCameraId(null);
      }
    }
  }, [open, initialCameraId, initialStep]);

  // Predefined zones for autocomplete
  const popularZones = ["Entrance", "Parking Lot", "Corridor A", "Cafeteria", "Main Lobby"];

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Camera name is required.");
      return;
    }
    setError(null);
    setIsSubmittingDetails(true);

    try {
      // POST schema requirements match CameraCreate
      const response = await api.post("/cameras/", {
        name,
        zone: zone || "General",
        camera_type: cameraType,
        location: location || zone || "General",
        is_active: true
      });
      
      setCreatedCameraId(response.data.id);
      setStep("upload");
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to register camera details.";
      setError(errMsg);
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  const handleReset = () => {
    setStep("details");
    setName("");
    setZone("");
    setCameraType("general");
    setLocation("");
    setCreatedCameraId(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300" />
        
        {/* Content Box */}
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#0e1017] border border-slate-800 rounded-2xl p-6 shadow-2xl z-50 focus:outline-none transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Camera className="w-5 h-5 text-rose-500" /> Add New Camera
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-400 mt-1">
                {step === "details" ? "Step 1 of 2: Camera details & zone" : "Step 2 of 2: Upload simulated feed"}
              </Dialog.Description>
            </div>
            
            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form Content */}
          {step === "details" ? (
            <form onSubmit={handleNext} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Camera Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Lobby Entrance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                />
              </div>

              {/* Zone Selector/Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Zone / Sector</label>
                <input
                  type="text"
                  placeholder="e.g. Parking Lot B"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                  list="suggested-zones"
                />
                <datalist id="suggested-zones">
                  {popularZones.map((z) => <option key={z} value={z} />)}
                </datalist>
                <p className="text-[10px] text-slate-500">Type to create a custom zone or select one from your suggestions.</p>
              </div>

              {/* Location Detail */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Location Specifics</label>
                <input
                  type="text"
                  placeholder="e.g. Near elevators, Floor 1"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all"
                />
              </div>

              {/* Camera Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Camera Lens Type</label>
                <select
                  value={cameraType}
                  onChange={(e) => setCameraType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/35 transition-all appearance-none"
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

              {/* Step Footer Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                <Dialog.Close className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-slate-800 transition-all">
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isSubmittingDetails}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20 transition-all disabled:opacity-50"
                >
                  {isSubmittingDetails ? "Saving Details..." : "Next: Upload Feed"}
                </button>
              </div>
            </form>
          ) : (
            // Upload Feed Step
            createdCameraId && (
              <VideoUploadStep
                cameraId={createdCameraId}
                onSuccess={() => {
                  onSuccess();
                  handleClose();
                }}
                onCancel={handleClose}
              />
            )
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
