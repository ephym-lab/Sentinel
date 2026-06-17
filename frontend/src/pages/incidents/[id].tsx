import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Shield, 
  Users, 
  Search, 
  UserCheck, 
  Clock, 
  Video, 
  Volume2,
  Lock,
  UserMinus,
  Sparkles,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import Link from "next/link";
import api, { API_BASE_URL } from "src/lib/api";
import { useAuthStore } from "src/store/authStore";

interface Incident {
  id: string;
  title: string;
  incident_type: string;
  severity: string;
  status: string;
  trigger_events: string[];
  resolved_by: string | null;
  triggered_at: string;
  resolved_at: string | null;
  snapshot_path: string | null;
  video_path: string | null;
}

interface RollCallPerson {
  id: string;
  name: string;
  role: string;
  status: "safe" | "missing";
  lastLocation: string;
  checkedInAt?: string;
}

export default function IncidentDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { tenant } = useAuthStore();

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Search and filter for roll-call checklist
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "safe" | "missing">("all");

  // Local console logs for the emergency console feed
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Local roll-call lists for dynamic simulation & WebSocket synchronization
  const [people, setPeople] = useState<RollCallPerson[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // 1. Fetch Incident Details
  const { data: incident, isLoading, isError, refetch } = useQuery<Incident>({
    queryKey: ["incident", id],
    queryFn: async () => {
      const response = await api.get(`/incidents/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Seed default roll-call roster
  useEffect(() => {
    if (!tenant) return;
    const isSchool = tenant.mode === "school";
    const roster: RollCallPerson[] = [
      { id: "p-1", name: "Sarah Jenkins", role: isSchool ? "Teacher" : "Floor Manager", status: "safe", lastLocation: "Main Entrance", checkedInAt: "10:32 AM" },
      { id: "p-2", name: "Michael Chang", role: isSchool ? "Student (Grade 11)" : "Cashier", status: "missing", lastLocation: "Zone B North" },
      { id: "p-3", name: "Emily Rodriguez", role: isSchool ? "Student (Grade 10)" : "Sales Assoc", status: "safe", lastLocation: "Cafeteria", checkedInAt: "10:34 AM" },
      { id: "p-4", name: "David Kim", role: isSchool ? "Teacher" : "Security Guard", status: "safe", lastLocation: "Block A West", checkedInAt: "10:31 AM" },
      { id: "p-5", name: "Jessica Taylor", role: isSchool ? "Student (Grade 12)" : "Cashier", status: "missing", lastLocation: "Zone C South" },
      { id: "p-6", name: "James Wilson", role: isSchool ? "Student (Grade 10)" : "Stock Clerk", status: "safe", lastLocation: "Gymnasium", checkedInAt: "10:35 AM" },
      { id: "p-7", name: "Amanda Martinez", role: isSchool ? "School Nurse" : "Customer Support", status: "missing", lastLocation: "Main Offices" },
      { id: "p-8", name: "Robert Chen", role: isSchool ? "Student (Grade 11)" : "Sales Assoc", status: "safe", lastLocation: "Library Lobby", checkedInAt: "10:33 AM" },
    ];
    setPeople(roster);

    // Initial console logs
    setConsoleLogs([
      `[SYSTEM] Incident triage system initialized for ID: ${id}`,
      `[ALERT] Local authorities notified automatically via escalation protocol.`,
      `[INFO] Evacuation routes broadcasted to all active handheld devices.`,
    ]);
  }, [tenant, id]);

  // Scroll console logs to bottom
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // 2. Set up Roll-Call WebSocket connection
  useEffect(() => {
    if (!id || !tenant?.id) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = "localhost:8000";
    if (API_BASE_URL.startsWith("http")) {
      wsHost = API_BASE_URL.replace(/^https?:\/\//, "");
    }
    const wsUrl = `${wsProtocol}//${wsHost}/ws/stream/roll-call/${id}?tenant_id=${tenant.id}`;

    console.log(`Connecting to Roll Call WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      setConsoleLogs((prev) => [...prev, `[WS] Established real-time roll-call connection.`]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // If data contains roll call updates: e.g. { person_id: "...", status: "safe", location: "..." }
        if (data.person_id && data.status) {
          setPeople((prev) =>
            prev.map((p) =>
              p.id === data.person_id
                ? { 
                    ...p, 
                    status: data.status, 
                    lastLocation: data.location || p.lastLocation,
                    checkedInAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  }
                : p
            )
          );
          const name = rosterLookup(data.person_id);
          setConsoleLogs((prev) => [
            ...prev,
            `[UPDATE] ${name || "Unknown Person"} checked in from ${data.location || "unknown"} (Status: SAFE)`,
          ]);
        }
      } catch (err) {
        console.error("Failed to parse Roll Call WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setConsoleLogs((prev) => [...prev, `[WS] Disconnected. Running local check-in simulation fallback.`]);
    };

    return () => {
      ws.close();
    };
  }, [id, tenant?.id]);

  // Run a local simulation checking people in if they are missing
  useEffect(() => {
    if (incident?.status === "resolved") return;

    const interval = setInterval(() => {
      setPeople((prev) => {
        const missing = prev.filter((p) => p.status === "missing");
        if (missing.length === 0) {
          clearInterval(interval);
          return prev;
        }

        // Pick a random missing person and check them in
        const target = missing[Math.floor(Math.random() * missing.length)];
        setConsoleLogs((logs) => [
          ...logs,
          `[CHECK-IN] ${target.name} registered safe at evac point: ${target.lastLocation}.`,
        ]);

        return prev.map((p) =>
          p.id === target.id
            ? {
                ...p,
                status: "safe" as const,
                checkedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              }
            : p
        );
      });
    }, 12000); // Check-in every 12 seconds

    return () => clearInterval(interval);
  }, [incident?.status]);

  const rosterLookup = (personId: string) => {
    return people.find((p) => p.id === personId)?.name || personId;
  };

  // Severity style mappings
  const getSeverityStyles = (severity: string = "info") => {
    switch (severity.toLowerCase()) {
      case "critical":
        return { text: "text-rose-400 bg-rose-500/10 border-rose-500/20", dot: "bg-rose-500" };
      case "high":
        return { text: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500" };
      case "medium":
        return { text: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" };
      default:
        return { text: "text-sky-400 bg-sky-500/10 border-sky-500/20", dot: "bg-sky-500" };
    }
  };

  // Submit resolution handler
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResolving(true);
    setResolveError(null);

    try {
      await api.put(`/incidents/${id}/resolve`, {
        resolution_notes: resolutionNotes || "Emergency resolved by administrator.",
      });
      setIsResolveModalOpen(false);
      setResolutionNotes("");
      refetch();
      setConsoleLogs((prev) => [
        ...prev,
        `[SYSTEM] THREAT STATUS CHANGED: RESOLVED by security admin.`,
      ]);
    } catch (err: any) {
      setResolveError(err.response?.data?.detail || "Failed to resolve incident.");
    } finally {
      setIsResolving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#07080a] text-slate-400 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin" />
          Analyzing emergency incident dossier...
        </div>
      </div>
    );
  }

  if (isError || !incident) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#07080a] text-slate-400 text-sm">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <p>Failed to load incident record details.</p>
          <Link href="/monitor" className="text-xs text-rose-400 underline">
            Return to Live Operations Center
          </Link>
        </div>
      </div>
    );
  }

  const sev = getSeverityStyles(incident.severity);

  // Compute roll-call counts
  const totalPeople = people.length;
  const safePeople = people.filter((p) => p.status === "safe").length;
  const missingPeople = people.filter((p) => p.status === "missing").length;
  const safePercent = Math.round((safePeople / totalPeople) * 100);

  // Filtered roster
  const filteredPeople = people.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.lastLocation.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === "safe") return matchesSearch && p.status === "safe";
    if (statusFilter === "missing") return matchesSearch && p.status === "missing";
    return matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a]">
      {/* Top Header Rail */}
      <div className="border-b border-slate-900 bg-[#0c0e15] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/monitor" 
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${sev.text}`}>
                {incident.severity}
              </span>
              <h1 className="text-base font-bold text-slate-100">{incident.title}</h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ID: <span className="font-mono">{incident.id}</span> • Triggered {new Date(incident.triggered_at).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {incident.status !== "resolved" ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Active Emergency
              </span>
              <button
                onClick={() => setIsResolveModalOpen(true)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-900/10 active:scale-95"
              >
                Resolve Threat
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> Threat Resolved
            </span>
          )}
        </div>
      </div>

      {/* Main Panel grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Column - Incident Profile (col-span-3) */}
        <div className="lg:col-span-3 border-r border-slate-900 bg-[#090b0f] p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Threat Profile</h3>
            <div className="bg-[#0c0e15] border border-slate-900 rounded-xl p-4 space-y-3">
              <div>
                <span className="text-[10px] text-slate-500 block">Threat Classification</span>
                <span className="text-sm font-semibold text-slate-200 capitalize">{incident.incident_type.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Verification Status</span>
                <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 mt-0.5">
                  <Activity className="w-3.5 h-3.5" /> AI Validated (Auto-Triage)
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Triggered Timestamp</span>
                <span className="text-xs text-slate-300 font-medium">{new Date(incident.triggered_at).toLocaleString()}</span>
              </div>
              {incident.resolved_at && (
                <div>
                  <span className="text-[10px] text-slate-500 block">Resolved Timestamp</span>
                  <span className="text-xs text-emerald-400 font-medium">{new Date(incident.resolved_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trigger Events</h3>
            <div className="space-y-2">
              {incident.trigger_events.map((evtId, idx) => (
                <div key={idx} className="bg-slate-900/60 border border-slate-850 rounded-lg p-3 text-xs flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-300 block">Safety Signal Trigger</span>
                    <span className="font-mono text-[10px] text-slate-500 block">{evtId}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                    AI Alert
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Shield className="w-4 h-4 text-rose-500" /> Platform Escalation
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Emergency response protocols dictate real-time audit captures. All user resolution notes are logged under platform audit trails.
              </p>
            </div>
          </div>
        </div>

        {/* Center Column - Evacuation Stream View (col-span-5) */}
        <div className="lg:col-span-5 flex flex-col bg-[#07080a] overflow-hidden">
          
          {/* Main Video Screen */}
          <div className="flex-1 bg-black relative flex items-center justify-center border-b border-slate-900 aspect-video lg:aspect-auto">
            {incident.video_path ? (
              <video 
                src={`${API_BASE_URL}/static/${incident.video_path}`}
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center space-y-3 text-slate-500">
                <Video className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-xs">No incident video file registered. Displaying live terminal logs.</p>
              </div>
            )}
            
            {/* Camera Overlay Status */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-200 uppercase tracking-widest px-2.5 py-1 rounded bg-black/70 backdrop-blur border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> Camera Stream Feed
              </span>
            </div>
          </div>

          {/* Emergency Logs terminal console */}
          <div className="h-44 bg-[#050608] border-t border-slate-900 p-4 flex flex-col font-mono text-[11px] text-emerald-500/80">
            <div className="flex items-center justify-between border-b border-slate-900/60 pb-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Emergency Operations Console</span>
              <span className="text-[9px] text-slate-500">Log Buffer Feed</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-none">
              {consoleLogs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              <div ref={consoleBottomRef} />
            </div>
          </div>

        </div>

        {/* Right Column - Roll Call Widget (col-span-4) */}
        <div className="lg:col-span-4 border-l border-slate-900 bg-[#090b0f] flex flex-col overflow-hidden">
          
          {/* Roll Call Header Metrics */}
          <div className="p-5 border-b border-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-rose-500" /> Active Roll Call Checklist
              </h3>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                <span className="text-[9px] text-slate-500 font-semibold uppercase font-mono">
                  {wsConnected ? "Sync" : "Mock Fallback"}
                </span>
              </div>
            </div>

            {/* Safety Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Evacuated Safety Check-in</span>
                <span className="font-bold text-emerald-400">{safePeople} / {totalPeople} ({safePercent}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${safePercent}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="bg-[#0c0e15] border border-slate-900/60 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Safe Checked-in</span>
                  <span className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                    <UserCheck className="w-4 h-4" /> {safePeople}
                  </span>
                </div>
                <div className="bg-[#0c0e15] border border-slate-900/60 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Unaccounted For</span>
                  <span className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1 mt-0.5">
                    <UserMinus className="w-4 h-4 animate-pulse" /> {missingPeople}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Roster search/filters */}
          <div className="px-5 py-3 border-b border-slate-900 flex gap-2 bg-[#080a0d]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff & students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500/50"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="safe">Safe</option>
              <option value="missing">Missing</option>
            </select>
          </div>

          {/* Roster Listing */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#08090d]">
            {filteredPeople.map((person) => (
              <div 
                key={person.id}
                className={`border rounded-xl p-3 flex items-center justify-between transition-all ${
                  person.status === "safe"
                    ? "bg-[#091511]/30 border-emerald-500/10 hover:border-emerald-500/25"
                    : "bg-[#180a0f]/40 border-rose-500/10 hover:border-rose-500/25"
                }`}
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{person.name}</span>
                    <span className="text-[9px] text-slate-500 font-medium px-1.5 py-0.2 bg-slate-900 border border-slate-850 rounded">
                      {person.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Last Loc: <span className="font-semibold text-slate-300">{person.lastLocation}</span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    person.status === "safe"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse"
                  }`}>
                    {person.status}
                  </span>
                  {person.checkedInAt && (
                    <span className="text-[9px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {person.checkedInAt}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredPeople.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No matching personnel records found.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal dialog for resolving the threat */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0c0e15] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Resolve Active Incident
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Submit resolution logs. This action marks the emergency status as resolved and logs user details to the platform audit trace.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Resolution Logs / Notes</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Fire contained by block marshals. False positive behavior classifier triggered."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all resize-none"
                />
              </div>

              {resolveError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {resolveError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResolveModalOpen(false);
                    setResolutionNotes("");
                    setResolveError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
                >
                  {isResolving ? "Saving Resolution..." : "Resolve Incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
