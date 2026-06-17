import React, { useState, useEffect } from "react";
import { 
  HeartHandshake, 
  MapPin, 
  Clock, 
  UserPlus, 
  AlertTriangle, 
  Camera, 
  CheckCircle2, 
  Search,
  Navigation,
  Activity,
  Compass
} from "lucide-react";

interface ChildReport {
  id: string;
  name: string;
  age: number;
  lastSeenTime: string;
  lastSeenLocation: string;
  description: string;
  status: "searching" | "reunited";
}

interface SightingNode {
  id: string;
  cameraName: string;
  coordinates: { x: number; y: number };
  timestamp: string;
  confidence: number;
}

export default function ChildRecoveryPage() {
  const [reports, setReports] = useState<ChildReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // New report form states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [lastLoc, setLastLoc] = useState("Zone B Central Plaza");
  const [childDesc, setChildDesc] = useState("");

  // Seed default report
  useEffect(() => {
    const initialReports: ChildReport[] = [
      {
        id: "child-1",
        name: "Tommy Miller",
        age: 6,
        lastSeenTime: "11:15 AM",
        lastSeenLocation: "Zone B Central Plaza",
        description: "Red hoodie, blue jeans, yellow sneakers.",
        status: "searching",
      },
      {
        id: "child-2",
        name: "Lily Watson",
        age: 8,
        lastSeenTime: "09:42 AM",
        lastSeenLocation: "Zone A Food Court",
        description: "Pink dress, white hair bow.",
        status: "reunited",
      },
    ];
    setReports(initialReports);
    setSelectedReportId("child-1");
  }, []);

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !childAge.trim()) return;

    const newReport: ChildReport = {
      id: `child-${Date.now()}`,
      name: childName,
      age: parseInt(childAge),
      lastSeenTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      lastSeenLocation: lastLoc,
      description: childDesc,
      status: "searching",
    };

    setReports((prev) => [newReport, ...prev]);
    setSelectedReportId(newReport.id);
    setIsReportModalOpen(false);

    // Reset fields
    setChildName("");
    setChildAge("");
    setChildDesc("");
  };

  const handleReunited = (id: string) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "reunited" as const } : r
      )
    );
  };

  // Coordinates on our visual map representation
  const getMockMapSightings = (id: string): SightingNode[] => {
    if (id === "child-1") {
      return [
        { id: "node-1", cameraName: "Central Court Escalator", coordinates: { x: 40, y: 35 }, timestamp: "11:18 AM", confidence: 0.94 },
        { id: "node-2", cameraName: "East Wing Arcade Gate", coordinates: { x: 75, y: 65 }, timestamp: "11:22 AM", confidence: 0.88 },
      ];
    }
    return [
      { id: "node-3", cameraName: "Food Court Entrance", coordinates: { x: 25, y: 70 }, timestamp: "09:44 AM", confidence: 0.96 },
    ];
  };

  const activeReport = reports.find((r) => r.id === selectedReportId);
  const sightings = activeReport ? getMockMapSightings(activeReport.id) : [];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-hidden">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <HeartHandshake className="w-5.5 h-5.5 text-rose-500" /> Lost Child Search & Recovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">Coordinate camera visual tracking sweeps across Mall terminals.</p>
        </div>

        <button
          onClick={() => setIsReportModalOpen(true)}
          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> Create Lost Alert
        </button>
      </div>

      {/* Columns Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 overflow-hidden">
        
        {/* Left Column: Active Cases (col-span-4) */}
        <div className="lg:col-span-4 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Active Lost Reports
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-3 ${
                  selectedReportId === report.id
                    ? "bg-[#180a0f]/45 border-rose-500/35"
                    : "bg-[#07080a]/50 border-slate-900 hover:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{report.name} (Age: {report.age})</h4>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Last Spot: {report.lastSeenLocation}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    report.status === "searching"
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse"
                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  }`}>
                    {report.status}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed italic bg-slate-950/40 p-2 rounded-lg border border-slate-900/40">
                  "{report.description}"
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/60 pt-2.5">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Report: {report.lastSeenTime}</span>
                  {report.status === "searching" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReunited(report.id);
                      }}
                      className="px-2 py-0.5 bg-emerald-650 hover:bg-emerald-600 text-white rounded text-[9px] font-bold transition-all"
                    >
                      Mark Reunited
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Column: Sighting terminal map (col-span-5) */}
        <div className="lg:col-span-5 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Compass className="w-4.5 h-4.5 text-rose-500" /> Sighting Terminals Coordinates Map
          </h3>

          {/* Simulated Map */}
          <div className="flex-1 bg-[#07080a] border border-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center p-4 min-h-[260px]">
            {/* Grid background lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0e15_1px,transparent_1px),linear-gradient(to_bottom,#0c0e15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

            {/* Shopping Mall sectors sketch */}
            <div className="absolute border border-slate-900/65 rounded-xl w-[85%] h-[85%] border-dashed flex items-center justify-center text-[10px] text-slate-700 pointer-events-none font-mono uppercase tracking-widest">
              Mall Floor Layout Area
            </div>

            {/* Render camera sighting coordinate nodes */}
            {sightings.map((sight) => (
              <div
                key={sight.id}
                className="absolute flex flex-col items-center group cursor-pointer transition-all duration-300"
                style={{ left: `${sight.coordinates.x}%`, top: `${sight.coordinates.y}%` }}
              >
                {/* Ping circle */}
                <div className="relative">
                  <span className="absolute -inset-2 rounded-full bg-rose-500/35 animate-ping" />
                  <div className="w-4 h-4 rounded-full bg-rose-600 border border-white/20 flex items-center justify-center relative z-10 shadow-lg shadow-rose-900/50">
                    <Navigation className="w-2.5 h-2.5 text-white rotate-45" />
                  </div>
                </div>

                {/* Info bubble */}
                <div className="absolute bottom-6 bg-slate-900 border border-slate-800 text-[9px] text-slate-200 px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity">
                  {sight.cameraName} ({sight.timestamp})
                </div>
              </div>
            ))}

            {/* Active alert location badge if no sightings */}
            {activeReport && sightings.length === 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-850 text-center space-y-1 z-10">
                <AlertTriangle className="w-5 h-5 text-rose-500 mx-auto" />
                <p className="text-[10px] text-slate-400">Awaiting visual sighting sweeps matches...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sighting coordinates logs (col-span-3) */}
        <div className="lg:col-span-3 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Recovery coordinates
          </h3>

          <div className="space-y-4 pl-3 border-l border-slate-900/60">
            {sightings.map((sight) => (
              <div key={sight.id} className="relative">
                {/* Sighting Node Pin dot */}
                <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#0c0e15]" />
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{sight.cameraName}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{sight.timestamp}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    AI verification score: <span className="font-semibold text-emerald-400">{(sight.confidence * 100).toFixed(0)}%</span> Re-ID match.
                  </div>
                </div>
              </div>
            ))}

            {sightings.length === 0 && (
              <div className="text-slate-500 text-xs text-center py-12">
                No telemetry sighting logs.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Create Alert Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0c0e15] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" /> Dispatch Lost Child Alert
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter target child profile details to initialize camera pattern matcher tracking.
            </p>

            <form onSubmit={handleCreateReport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-350">Child Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tommy Miller"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Age *</label>
                  <input
                    type="number"
                    required
                    placeholder="6"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Last Seen Area</label>
                  <select
                    value={lastLoc}
                    onChange={(e) => setLastLoc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Zone B Central Plaza">Zone B Central Plaza</option>
                    <option value="Zone A Food Court">Zone A Food Court</option>
                    <option value="Zone C Cinema Hall">Zone C Cinema Hall</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-350">Clothing & Physical Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Red hoodie, blue sneakers, black backpack."
                  value={childDesc}
                  onChange={(e) => setChildDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
                >
                  Dispatch Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
