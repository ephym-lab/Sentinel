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
  Check
} from "lucide-react";
import api from "src/lib/api";

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
  cameraName: string;
  timestamp: string;
  confidence: number;
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
  const [searchQuery, setSearchQuery] = useState("");
  
  // New POI form states
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [registerFace, setRegisterFace] = useState(true);
  const [registerReid, setRegisterReid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected POI for detailed timeline view
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  // Fetch registered POIs from backend
  const { data: pois = [], isLoading, isError, refetch } = useQuery<POI[]>({
    queryKey: ["pois"],
    queryFn: async () => {
      const response = await api.get("/pois/");
      return response.data;
    },
  });

  const handleCreatePOI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    // Generate dummy embeddings if enabled
    const face_embedding = registerFace ? Array.from({ length: 512 }, () => Math.random() * 0.1) : undefined;
    const reid_embedding = registerReid ? Array.from({ length: 512 }, () => Math.random() * 0.1) : undefined;

    try {
      await api.post("/pois/", {
        id: generateUUID(),
        name,
        notes: notes || "Watchlist candidate.",
        face_embedding,
        reid_embedding,
      });

      // Reset form
      setName("");
      setNotes("");
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to register watch target.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMockSightings = (poiId: string): Sighting[] => {
    // Return simple consistent mock sightings based on POI id
    return [
      {
        id: `sight-1-${poiId}`,
        cameraName: "Front Gate Entrance",
        timestamp: new Date(Date.now() - 32 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 0.92,
      },
      {
        id: `sight-2-${poiId}`,
        cameraName: "Block C Hallway West",
        timestamp: new Date(Date.now() - 74 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 0.86,
      },
    ];
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

            <div className="space-y-2 border-t border-slate-900 pt-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Embedding Options</span>
              
              <label className="flex items-center gap-2 text-xs text-slate-450 cursor-pointer">
                <input
                  type="checkbox"
                  checked={registerFace}
                  onChange={(e) => setRegisterFace(e.target.checked)}
                  className="rounded border-slate-800 text-rose-600 focus:ring-rose-500/30 bg-slate-950"
                />
                Generate 512-dim Face Vector Preset
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-455 cursor-pointer">
                <input
                  type="checkbox"
                  checked={registerReid}
                  onChange={(e) => setRegisterReid(e.target.checked)}
                  className="rounded border-slate-800 text-rose-600 focus:ring-rose-500/30 bg-slate-950"
                />
                Generate 512-dim Re-ID Vector Preset
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Registering Target..." : "Register Watch Target"}
            </button>
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
                  {getMockSightings(selectedPoiId).map((sight, idx) => (
                    <div key={sight.id} className="relative">
                      {/* Sighting Node Pin dot */}
                      <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#0c0e15]" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" /> {sight.cameraName}
                          </span>
                          <span className="text-slate-500 text-[10px] font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {sight.timestamp}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Match confidence: <span className="font-semibold text-emerald-400">{(sight.confidence * 100).toFixed(0)}%</span> (Face Recognizer Vector Match)
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
