import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  TrendingUp, 
  AlertOctagon, 
  Check, 
  MapPin, 
  Clock, 
  Play, 
  Activity, 
  ShieldAlert,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";

interface CheckoutFlag {
  id: string;
  registerName: string;
  flagType: string;
  severity: "critical" | "high" | "medium";
  confidence: number;
  timestamp: string;
  status: "flagged" | "reviewed";
}

export default function StoreMonitorPage() {
  const [flags, setFlags] = useState<CheckoutFlag[]>([]);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  // Seed default store logs
  useEffect(() => {
    const initialFlags: CheckoutFlag[] = [
      {
        id: "flag-1",
        registerName: "Self-Checkout Node 4",
        flagType: "Sweethearting (Product Swap)",
        severity: "critical",
        confidence: 0.93,
        timestamp: "10:42 AM",
        status: "flagged",
      },
      {
        id: "flag-2",
        registerName: "Register 2 Express",
        flagType: "Missed Scan (Basket Pass-through)",
        severity: "high",
        confidence: 0.88,
        timestamp: "10:15 AM",
        status: "flagged",
      },
      {
        id: "flag-3",
        registerName: "Self-Checkout Node 1",
        flagType: "Sweethearting (Cashier/Customer Col)",
        severity: "medium",
        confidence: 0.76,
        timestamp: "09:34 AM",
        status: "reviewed",
      },
    ];
    setFlags(initialFlags);
    setSelectedFlagId("flag-1");
  }, []);

  const handleReviewFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: "reviewed" as const } : f
      )
    );
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      default:
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  const selectedFlag = flags.find((f) => f.id === selectedFlagId);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-hidden">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingBag className="w-5.5 h-5.5 text-rose-500" /> Checkout Analytics & Store Monitor
          </h1>
          <p className="text-xs text-slate-500 mt-1">Monitor self-checkout nodes, sweethearting alerts, and scan omissions in real-time.</p>
        </div>
      </div>

      {/* Metrics Card row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        
        {/* Metric 1 */}
        <div className="bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Checkout Throughput</span>
            <span className="text-2xl font-black text-slate-150 block mt-1">98.2%</span>
            <span className="text-[10px] text-emerald-500 font-semibold flex items-center mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +0.4% from yesterday
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Flagged Sessions (Today)</span>
            <span className="text-2xl font-black text-rose-400 block mt-1">{flags.filter(f => f.status === "flagged").length}</span>
            <span className="text-[10px] text-rose-455 font-semibold flex items-center mt-1">
              <TrendingDown className="w-3.5 h-3.5" /> -12% compared to last week
            </span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <AlertOctagon className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Prevented Shrinkage Loss</span>
            <span className="text-2xl font-black text-emerald-400 block mt-1">$480.00</span>
            <span className="text-[10px] text-emerald-500 font-semibold flex items-center mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Prevents sweethearting losses
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Grid columns split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 overflow-hidden">
        
        {/* Left Column: Flag list (col-span-6) */}
        <div className="lg:col-span-6 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Recent Session Flags
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {flags.map((flag) => (
              <div
                key={flag.id}
                onClick={() => setSelectedFlagId(flag.id)}
                className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-3 ${
                  selectedFlagId === flag.id
                    ? "bg-[#180a0f]/40 border-rose-500/35"
                    : "bg-[#07080a]/50 border-slate-900 hover:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{flag.flagType}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Node: {flag.registerName}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadgeClass(flag.severity)}`}>
                    {flag.severity}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/60 pt-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Flagged: {flag.timestamp}
                  </span>
                  
                  {flag.status === "flagged" ? (
                    <span className="text-rose-400 font-bold animate-pulse">Awaiting Review</span>
                  ) : (
                    <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> Reviewed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Video clip & details (col-span-6) */}
        <div className="lg:col-span-6 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Alert Details & Clip Reference
          </h3>

          {selectedFlag ? (
            <div className="space-y-6">
              {/* Simulated video frame */}
              <div className="bg-black border border-slate-900 rounded-xl relative aspect-video flex items-center justify-center overflow-hidden">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-200 uppercase tracking-widest px-2.5 py-1 rounded bg-black/70 backdrop-blur border border-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> Flagged Event Playback
                  </span>
                </div>
                
                <Play className="w-12 h-12 text-slate-700/80 cursor-pointer hover:text-rose-500 transition-colors" />
              </div>

              <div className="bg-[#07080a]/60 border border-slate-900 rounded-xl p-4 space-y-3">
                <div>
                  <span className="text-[10px] text-slate-500 block">Identified behavior anomaly</span>
                  <span className="text-xs font-bold text-slate-200">{selectedFlag.flagType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-mono">Verification Index</span>
                  <span className="text-xs text-slate-400">
                    AI confidence score of <span className="font-semibold text-rose-400">{(selectedFlag.confidence * 100).toFixed(0)}%</span> based on product weight and price swap lookup.
                  </span>
                </div>
              </div>

              {selectedFlag.status === "flagged" && (
                <button
                  onClick={() => handleReviewFlag(selectedFlag.id)}
                  className="w-full py-2 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Acknowledge & Archive Flag
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a flag from the log list to review the session clip.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
