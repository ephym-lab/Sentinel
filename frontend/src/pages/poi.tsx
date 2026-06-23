import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ShieldAlert, 
  UserPlus, 
  Search, 
  UserCheck, 
  Camera, 
  FileText, 
  Clock, 
  MapPin, 
  AlertCircle,
  Eye,
  Check,
  Upload
} from "lucide-react";
import api from "src/lib/api";
import { useAuthStore } from "src/store/authStore";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const getCroppedImg = (imageSrc: string, percentCrop: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const cropWidthInPixels = (percentCrop.width / 100) * image.naturalWidth;
      const cropHeightInPixels = (percentCrop.height / 100) * image.naturalHeight;
      const cropXInPixels = (percentCrop.x / 100) * image.naturalWidth;
      const cropYInPixels = (percentCrop.y / 100) * image.naturalHeight;

      canvas.width = cropWidthInPixels;
      canvas.height = cropHeightInPixels;
      const ctx = canvas.getContext("2d");

      if (!ctx) return reject("No 2d context");

      ctx.drawImage(
        image,
        cropXInPixels,
        cropYInPixels,
        cropWidthInPixels,
        cropHeightInPixels,
        0,
        0,
        cropWidthInPixels,
        cropHeightInPixels
      );

      const base64Image = canvas.toDataURL("image/jpeg");
      resolve(base64Image);
    };
    image.onerror = (error) => reject(error);
  });
};

interface POI {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  has_face_embedding: boolean;
  has_reid_embedding: boolean;
}

interface Sighting {
  id: string;
  camera_name: string;
  spotted_at: string;
  match_score: number;
  match_type: string;
}

interface Camera {
  id: string;
  name: string;
}

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

export default function POITrackerPage() {
  const tenant = useAuthStore((state) => state.tenant);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New POI form states
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [targetCameras, setTargetCameras] = useState<string[]>([]); // empty means all
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image Upload and Crop State (Face)
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<any>(null);

  // Image Upload and Crop State (Body)
  const [showBodyUpload, setShowBodyUpload] = useState(false);
  const [bodyImageSrc, setBodyImageSrc] = useState<string | null>(null);
  const [bodyCrop, setBodyCrop] = useState<Crop>({ unit: "%", width: 50, height: 80, x: 25, y: 10 });
  const [bodyCompletedCrop, setBodyCompletedCrop] = useState<any>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCompletedCrop(null);
      const reader = new FileReader();
      reader.addEventListener("load", () => setImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onSelectBodyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBodyCompletedCrop(null);
      const reader = new FileReader();
      reader.addEventListener("load", () => setBodyImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Selected POI for detailed timeline view
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  // Fetch available cameras
  const { data: cameras = [] } = useQuery<Camera[]>({
    queryKey: ["cameras"],
    queryFn: async () => {
      const response = await api.get("/cameras/");
      return response.data;
    },
  });

  // Fetch registered POIs from backend
  const { data: pois = [], isLoading, isError, refetch } = useQuery<POI[]>({
    queryKey: ["pois"],
    queryFn: async () => {
      const response = await api.get("/pois/");
      return response.data;
    },
  });

  // Fetch sightings for selected POI
  const { data: sightings = [], isLoading: isLoadingSightings } = useQuery<Sighting[]>({
    queryKey: ["poi_sightings", selectedPoiId],
    queryFn: async () => {
      if (!selectedPoiId) return [];
      const response = await api.get(`/pois/${selectedPoiId}/sightings`);
      return response.data;
    },
    enabled: !!selectedPoiId,
  });

  const handleCreatePOI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    let face_embedding: number[] | undefined = undefined;
    let reid_embedding: number[] | undefined = undefined;
    let photo_path: string | undefined = undefined;

    const poi_id = generateUUID();

    if (imageSrc && completedCrop) {
      try {
        const croppedB64WithMime = await getCroppedImg(imageSrc, completedCrop);
        const base64 = croppedB64WithMime.split(',')[1];
        
        // Hit the ML service directly for the ArcFace embedding
        const mlResponse = await fetch("http://localhost:8001/face/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            face_b64: base64,
            tenant_id: tenant?.id,
            poi_id: poi_id
          })
        });
        
        if (!mlResponse.ok) {
          const errData = await mlResponse.json();
          throw new Error(errData.detail || "Failed to extract face embedding.");
        }
        
        const mlData = await mlResponse.json();
        face_embedding = mlData.embedding;
        if (mlData.snapshot_path) {
          photo_path = mlData.snapshot_path;
        }
      } catch (err: any) {
        setError(err.message || "Failed to process face crop.");
        setIsSubmitting(false);
        return;
      }
    }

    if (bodyImageSrc && bodyCompletedCrop) {
      try {
        const croppedB64WithMime = await getCroppedImg(bodyImageSrc, bodyCompletedCrop);
        const base64 = croppedB64WithMime.split(',')[1];
        
        // Hit the ML service directly for the Re-ID embedding
        const mlResponse = await fetch("http://localhost:8001/reid/extract-reid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            person_crop_b64: base64,
            tenant_id: tenant?.id,
            poi_id: poi_id,
            save_snapshot: true
          })
        });
        
        if (!mlResponse.ok) {
          const errData = await mlResponse.json();
          throw new Error(errData.detail || "Failed to extract body Re-ID embedding.");
        }
        
        const mlData = await mlResponse.json();
        reid_embedding = mlData.embedding;
        // If we don't have a face photo, use the body photo as the primary POI image
        if (!photo_path && mlData.snapshot_path) {
          photo_path = mlData.snapshot_path;
        }
      } catch (err: any) {
        setError(err.message || "Failed to process body crop.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await api.post("/pois/", {
        id: poi_id,
        name,
        notes: notes || "Watchlist candidate.",
        face_embedding,
        reid_embedding,
        target_cameras: targetCameras.length > 0 ? targetCameras : [],
        photo_path
      });

      // Reset form
      setName("");
      setNotes("");
      setTargetCameras([]);
      setImageSrc(null);
      setCompletedCrop(null);
      setBodyImageSrc(null);
      setBodyCompletedCrop(null);
      setShowBodyUpload(false);
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to register watch target.");
    } finally {
      setIsSubmitting(false);
    }
  };



  const filteredPois = pois.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-hidden">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5.5 h-5.5 text-rose-500" /> Watchlist & POI Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-1">Register Persons of Interest with facial/Re-ID embeddings for automated tracking alerts.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search watchlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0c0e15] border border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-350 focus:outline-none focus:border-rose-500/50"
          />
        </div>
      </div>

      {/* Workspace columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 overflow-hidden">
        
        {/* Left: Registration Form (col-span-4) */}
        <div className="lg:col-span-4 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <UserPlus className="w-4.5 h-4.5 text-rose-500" /> Add Watchlist Target
          </h3>

          <form onSubmit={handleCreatePOI} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Alert Context / Notes</label>
              <textarea
                rows={3}
                placeholder="e.g. Ex-employee, safety risk. Trigger alert immediately on sighting."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Cameras</label>
              <p className="text-[10px] text-slate-500 mb-2">Select specific cameras or leave empty to track across all cameras.</p>
              <div className="flex flex-wrap gap-2">
                {cameras.map((cam) => {
                  const isSelected = targetCameras.includes(cam.id);
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setTargetCameras(targetCameras.filter((id) => id !== cam.id));
                        } else {
                          setTargetCameras([...targetCameras, cam.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                        isSelected
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/50"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {cam.name}
                    </button>
                  );
                })}
                {cameras.length === 0 && <span className="text-xs text-slate-500">No cameras available.</span>}
              </div>
            </div>

            <div className={`space-y-2 border-t border-slate-900 pt-3 ${showBodyUpload ? 'hidden' : ''}`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                <Upload className="w-3 h-3" /> Upload Face Photo
              </span>
              
              {!imageSrc ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/50 hover:border-slate-700 transition-all bg-slate-950">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-slate-500" />
                    <p className="mb-1 text-xs text-slate-400"><span className="font-semibold text-rose-500">Click to upload</span> or drag and drop</p>
                    <p className="text-[10px] text-slate-500">PNG or JPG (Face should be clearly visible)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={onSelectFile} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-center max-h-64 overflow-hidden">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(_, percentCrop) => setCompletedCrop(percentCrop)}
                      aspect={1}
                      circularCrop
                    >
                      <img src={imageSrc} alt="Crop" className="max-h-60 object-contain" />
                    </ReactCrop>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400">Drag to crop the face for maximum ML accuracy.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setImageSrc(null);
                        setCompletedCrop(null);
                      }}
                      className="text-[10px] text-rose-500 hover:text-rose-400 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showBodyUpload && (
              <div className="space-y-2 border-t border-slate-900 pt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Upload Full Body Photo (Optional)
                </span>
                
                {!bodyImageSrc ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/50 hover:border-slate-700 transition-all bg-slate-950">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 mb-2 text-slate-500" />
                      <p className="mb-1 text-xs text-slate-400"><span className="font-semibold text-rose-500">Click to upload body</span> or drag and drop</p>
                      <p className="text-[10px] text-slate-500">PNG or JPG (Full body from head to toe)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={onSelectBodyFile} />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-center max-h-64 overflow-hidden">
                      <ReactCrop
                        crop={bodyCrop}
                        onChange={(_, percentCrop) => setBodyCrop(percentCrop)}
                        onComplete={(_, percentCrop) => setBodyCompletedCrop(percentCrop)}
                      >
                        <img src={bodyImageSrc} alt="Body Crop" className="max-h-60 object-contain" />
                      </ReactCrop>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-slate-400">Crop the full body for Re-ID accuracy.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setBodyImageSrc(null);
                          setBodyCompletedCrop(null);
                        }}
                        className="text-[10px] text-rose-500 hover:text-rose-400 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            {!showBodyUpload ? (
              <button
                type="button"
                onClick={() => setShowBodyUpload(true)}
                disabled={!name.trim()}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Proceed to Upload Body (Optional)
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBodyUpload(false)}
                  className="w-1/3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Registering Target..." : "Register Watch Target"}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Center: List of POIs (col-span-4) */}
        <div className="lg:col-span-4 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Active Watch targets
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Loading watch lists...
              </div>
            ) : filteredPois.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No watchlist targets registered.
              </div>
            ) : (
              filteredPois.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPoiId(p.id)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                    selectedPoiId === p.id
                      ? "bg-[#180a0f]/40 border-rose-500/30"
                      : "bg-[#07080a]/50 border-slate-900 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{p.name}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.notes}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-900/50 mt-3 pt-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.has_face_embedding ? "bg-emerald-500" : "bg-slate-700"}`} /> Face
                      <span className={`w-1.5 h-1.5 rounded-full ${p.has_reid_embedding ? "bg-emerald-500" : "bg-slate-700"}`} /> Re-ID
                    </div>
                    <span className="text-[9px] text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Sighting History Timeline (col-span-4) */}
        <div className="lg:col-span-4 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Sighting Details & Logs
          </h3>

          {selectedPoiId ? (
            <div className="space-y-6">
              <div className="bg-[#07080a]/80 border border-slate-900 rounded-xl p-4">
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest block mb-1">Target Name</span>
                <span className="text-sm font-bold text-slate-100">
                  {pois.find((p) => p.id === selectedPoiId)?.name}
                </span>
                <span className="text-[10px] text-slate-500 block mt-2 leading-relaxed">
                  {pois.find((p) => p.id === selectedPoiId)?.notes}
                </span>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Sighting History Logs</h4>
                <div className="space-y-4 pl-3 border-l border-slate-900">
                  {isLoadingSightings ? (
                    <div className="text-slate-500 text-xs py-4">Loading sightings...</div>
                  ) : sightings.length === 0 ? (
                    <div className="text-slate-500 text-xs py-4">No sightings recorded yet.</div>
                  ) : sightings.map((sight) => (
                    <div key={sight.id} className="relative">
                      {/* Sighting Node Pin dot */}
                      <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#0c0e15]" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" /> {sight.camera_name}
                          </span>
                          <span className="text-slate-500 text-[10px] font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(sight.spotted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Match confidence: <span className="font-semibold text-emerald-400">{(sight.match_score * 100).toFixed(0)}%</span> ({sight.match_type.replace('_', ' ')} Match)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 text-center py-16">
              <Eye className="w-8 h-8 text-slate-700 mb-1" />
              <p className="text-xs">Select a watchlist target to see live sighting history maps.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
