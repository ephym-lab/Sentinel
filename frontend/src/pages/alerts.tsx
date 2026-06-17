import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  AlertOctagon, 
  Clock, 
  Check, 
  MapPin, 
  Activity, 
  CheckCheck,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { useAlertStore } from "src/store/alertStore";
import { useEventStream } from "src/hooks/useEventStream";

interface AlertItem {
  id: string;
  cameraName: string;
  eventType: string;
  severity: "critical" | "high" | "medium" | "info";
  confidence: number;
  timestamp: string;
  isAcknowledged: boolean;
}

export default function AlertCenterPage() {
  const { isMuted, toggleMute, clearUnreadCount } = useAlertStore();
  const { subscribe } = useEventStream();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium">("all");

  // Clear unread alerts count when entering the Alert Center
  useEffect(() => {
    clearUnreadCount();
  }, [clearUnreadCount]);

  // Seed initial alerts
  useEffect(() => {
    const initialAlerts: AlertItem[] = [
      {
        id: "alert-1",
        cameraName: "Front Parking Lot 2",
        eventType: "Weapon Classification (Handgun)",
        severity: "critical",
        confidence: 0.94,
        timestamp: new Date(Date.now() - 4 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAcknowledged: false,
      },
      {
        id: "alert-2",
        cameraName: "Block B Hallway East",
        eventType: "Behavior (Aggression / Scuffle)",
        severity: "high",
        confidence: 0.88,
        timestamp: new Date(Date.now() - 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAcknowledged: false,
      },
      {
        id: "alert-3",
        cameraName: "Rear Trash Area",
        eventType: "Visual Fire Detection",
        severity: "critical",
        confidence: 0.91,
        timestamp: new Date(Date.now() - 25 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAcknowledged: true,
      },
      {
        id: "alert-4",
        cameraName: "Main Entrance Foyer",
        eventType: "Intrusion (After-Hours Sighting)",
        severity: "medium",
        confidence: 0.76,
        timestamp: new Date(Date.now() - 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAcknowledged: true,
      },
    ];
    setAlerts(initialAlerts);
  }, []);

  // Listen to WebSocket events to inject new alerts on-the-fly
  useEffect(() => {
    const unsubscribe = subscribe("detection", (payload: any) => {
      // Structure the new incoming alert
      const newAlert: AlertItem = {
        id: payload.id || `alert-ws-${Date.now()}`,
        cameraName: payload.camera_name || "Surveillance Node",
        eventType: payload.event_type || "General threat detection",
        severity: payload.threat?.is_threat ? "critical" : "high",
        confidence: payload.confidence_score || 0.85,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAcknowledged: false,
      };

      setAlerts((prev) => [newAlert, ...prev]);
    });

    return () => unsubscribe();
  }, [subscribe]);

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, isAcknowledged: true } : alert
      )
    );
  };

  const handleAcknowledgeAll = () => {
    setAlerts((prev) =>
      prev.map((alert) => ({ ...alert, isAcknowledged: true }))
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "medium":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    // Acknowledge filter
    if (filter === "active" && alert.isAcknowledged) return false;
    if (filter === "acknowledged" && !alert.isAcknowledged) return false;

    // Severity filter
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

    return true;
  });

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-y-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-900 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-5.5 h-5.5 text-rose-500" /> Alert Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">Configure audio alert volumes, manage triggers, and clear safety notifications.</p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className={`px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isMuted
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4" /> Muted
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" /> Audio On
              </>
            )}
          </button>

          <button
            onClick={handleAcknowledgeAll}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-800 text-slate-350 hover:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <CheckCheck className="w-4 h-4" /> Acknowledge All
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-3">
        <div className="flex items-center gap-2 bg-[#0c0e15] border border-slate-900 rounded-xl p-1">
          {(["all", "active", "acknowledged"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                filter === mode
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e: any) => setSeverityFilter(e.target.value)}
            className="bg-[#0c0e15] border border-slate-900 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed Grid */}
      {filteredAlerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
          <ShieldCheck className="w-12 h-12 text-emerald-500/80" />
          <p className="text-xs">All surveillance channels clear. No active alarms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                alert.isAcknowledged
                  ? "bg-[#0c0e15]/40 border-slate-900"
                  : "bg-[#0e1017] border-slate-850 hover:border-slate-800"
              }`}
            >
              {/* Alert Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${
                    alert.severity === "critical"
                      ? "bg-rose-500/10 text-rose-500"
                      : "bg-orange-500/10 text-orange-400"
                  }`}>
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{alert.eventType}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {alert.cameraName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {alert.timestamp}
                      </span>
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityColor(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>

              {/* Confidence Score & Action */}
              <div className="flex items-center justify-between border-t border-slate-900/50 mt-4 pt-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <Activity className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Confidence:</span>
                  <span className="font-semibold text-slate-300">{(alert.confidence * 100).toFixed(0)}%</span>
                </div>

                {!alert.isAcknowledged ? (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" /> Acknowledge
                  </button>
                ) : (
                  <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Acknowledged
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
