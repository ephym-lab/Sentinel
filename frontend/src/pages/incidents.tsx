import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ShieldAlert, Eye, Filter, Clock } from "lucide-react";
import Link from "next/link";
import api from "src/lib/api";

interface Incident {
  id: string;
  title: string;
  incident_type: string;
  severity: string;
  status: string;
  triggered_at: string;
  resolved_at: string | null;
}

export default function IncidentsListPage() {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const { data: incidents = [], isLoading, isError } = useQuery<Incident[]>({
    queryKey: ["incidents", filter],
    queryFn: async () => {
      let url = "/incidents/";
      if (filter === "active") {
        url += "?is_resolved=false";
      } else if (filter === "resolved") {
        url += "?is_resolved=true";
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
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

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-y-auto">
      {/* Title & Action Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-900">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5.5 h-5.5 text-rose-500 animate-pulse" /> Threat Dossier & Incidents
          </h1>
          <p className="text-xs text-slate-500 mt-1">Review active safety alarms, crowd events, and manual triggers.</p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 bg-[#0c0e15] border border-slate-900 rounded-xl p-1">
          {(["all", "active", "resolved"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                filter === mode
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-500 hover:text-slate-350"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Grid listing */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs gap-2 py-12">
          <div className="w-4 h-4 rounded-full border-2 border-slate-800 border-t-rose-500 animate-spin" />
          Loading security log registry...
        </div>
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs py-12">
          Failed to fetch incident log registry.
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/80" />
          <p className="text-xs">No recorded security incidents match the current filters.</p>
        </div>
      ) : (
        <div className="mt-6 border border-slate-900 rounded-2xl overflow-hidden bg-[#0c0e15] shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-900 bg-[#090a0f] text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Threat details</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Trigger Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/50">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-900/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-200">{inc.title}</td>
                  <td className="px-6 py-4 capitalize text-slate-400">{inc.incident_type.replace("_", " ")}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getSeverityBadgeClass(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(inc.triggered_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-bold ${
                      inc.status === "resolved" ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        inc.status === "resolved" ? "bg-emerald-500" : "bg-rose-500 animate-ping"
                      }`} />
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/incidents/${inc.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-800 text-slate-350 hover:text-slate-200 rounded-lg transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Command
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
