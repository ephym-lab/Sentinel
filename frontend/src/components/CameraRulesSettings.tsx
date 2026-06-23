import { useState, useEffect } from "react";
import { Camera, ShieldAlert, Trash2, Plus, Zap, Check, AlertTriangle } from "lucide-react";
import api from "src/lib/api";

interface CameraRule {
  id: string;
  name: string | null;
  behavior: string[];
  action: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
}

interface CameraItem {
  id: string;
  name: string;
}

const AVAILABLE_BEHAVIORS = [
  "fighting", "crowd_panic", "person_down", "loitering", 
  "suspicious_proximity", "perimeter_climbing", "night_gathering",
  "concealment_gesture", "item_to_bag", "repeated_aisle_passes", 
  "high_value_dwell", "self_checkout_anomaly", "crowd_crush"
];

const AVAILABLE_ACTIONS = [
  "Critical WebSocket Alert + Webhook",
  "High Alert Dashboard Push",
  "Medium Event Log + Review Flag",
  "Low Event Log Only",
  "Mobile App Notification"
];

export default function CameraRulesSettings() {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [rules, setRules] = useState<CameraRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCameras();
  }, []);

  useEffect(() => {
    if (selectedCameraId) {
      fetchRules(selectedCameraId);
    } else {
      setRules([]);
    }
  }, [selectedCameraId]);

  const fetchCameras = async () => {
    try {
      const res = await api.get("/cameras");
      setCameras(res.data);
      if (res.data.length > 0) {
        setSelectedCameraId(res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch cameras", err);
    }
  };

  const fetchRules = async (camId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/cameras/${camId}/rules`);
      setRules(res.data);
    } catch (err) {
      setError("Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  };

  const addEmptyRule = async () => {
    if (!selectedCameraId) return;
    try {
      const newRule = { 
        name: "New Security Rule",
        behavior: [], 
        action: AVAILABLE_ACTIONS[0],
        is_active: true 
      };
      const res = await api.post(`/cameras/${selectedCameraId}/rules`, newRule);
      setRules([...rules, res.data]);
    } catch (err) {
      setError("Failed to add rule");
    }
  };

  const updateRule = async (ruleId: string, updates: Partial<CameraRule>) => {
    try {
      const res = await api.patch(`/cameras/${selectedCameraId}/rules/${ruleId}`, updates);
      setRules(rules.map(r => r.id === ruleId ? res.data : r));
    } catch (err) {
      setError("Failed to update rule");
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await api.delete(`/cameras/${selectedCameraId}/rules/${ruleId}`);
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError("Failed to delete rule");
    }
  };

  const toggleBehavior = (rule: CameraRule, behaviorToToggle: string) => {
    const currentBehaviors = rule.behavior || [];
    let newBehaviors;
    if (currentBehaviors.includes(behaviorToToggle)) {
      newBehaviors = currentBehaviors.filter((b: string) => b !== behaviorToToggle);
    } else {
      newBehaviors = [...currentBehaviors, behaviorToToggle];
    }
    updateRule(rule.id, { behavior: newBehaviors });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/60 shadow-[0_0_40px_rgba(99,102,241,0.05)]">
        <div>
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 flex items-center gap-3 drop-shadow-md">
            <ShieldAlert className="w-7 h-7 text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            Enterprise Rule Engine
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">Design complex temporal and behavioral detection triggers instantly.</p>
        </div>
        <button 
          onClick={addEmptyRule}
          disabled={!selectedCameraId}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 active:scale-95"
        >
          <Plus className="w-5 h-5" /> New Trigger Rule
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-rose-300 text-sm bg-rose-500/10 p-4 rounded-xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          {error}
        </div>
      )}

      {/* Camera Selection */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-colors duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-widest flex items-center gap-2">
          <Camera className="w-4 h-4 text-indigo-400" /> Target Feed Selection
        </label>
        <div className="relative">
          <select 
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="w-full bg-slate-950/80 border-2 border-slate-800/80 rounded-2xl pl-5 pr-10 py-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80 font-bold cursor-pointer appearance-none shadow-inner transition-all hover:bg-slate-950"
          >
            <option value="">-- Assign a camera feed --</option>
            {cameras.map(cam => (
              <option key={cam.id} value={cam.id}>{cam.name}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-400 transform rotate-45" />
          </div>
        </div>
      </div>

      {/* Rules List */}
      {selectedCameraId && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-sm text-slate-500 text-center py-12 animate-pulse font-medium">Synchronizing rules engine...</div>
          ) : rules.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-16 bg-slate-900/20 rounded-3xl border border-slate-800/50 border-dashed backdrop-blur-sm">
              <ShieldAlert className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-50" />
              No behavioral triggers established for this feed.<br/>Deploy a <span className="text-indigo-400 font-bold">New Trigger Rule</span> to begin.
            </div>
          ) : (
            rules.map((rule, idx) => {
              const activeBehaviors = rule.behavior || [];
              
              return (
                <div 
                  key={rule.id} 
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 group"
                >
                  {/* Card Header */}
                  <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                        {idx + 1}
                      </div>
                      <input 
                        type="text" 
                        value={rule.name || ""} 
                        onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                        placeholder="Rule Identifier (e.g. ATM Guard)"
                        className="bg-transparent border-b-2 border-transparent hover:border-slate-700 focus:border-indigo-500 text-base font-black text-white focus:outline-none w-full md:w-2/3 px-1 py-1 transition-colors placeholder:text-slate-700"
                      />
                    </div>
                    
                    <div className="flex items-center gap-5 bg-slate-900/80 p-1.5 pl-4 rounded-xl border border-slate-800">
                      <label className="flex items-center gap-3 cursor-pointer group/toggle">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={rule.is_active} 
                            onChange={(e) => updateRule(rule.id, { is_active: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5 rounded-full transition-colors ${rule.is_active ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}></div>
                          <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${rule.is_active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest ${rule.is_active ? 'text-indigo-400' : 'text-slate-500 group-hover/toggle:text-slate-400'}`}>
                          {rule.is_active ? 'Live' : 'Paused'}
                        </span>
                      </label>
                      <div className="w-px h-5 bg-slate-800"></div>
                      <button 
                        onClick={() => deleteRule(rule.id)} 
                        className="text-slate-500 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-rose-500/10"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 md:p-8 space-y-8">
                    
                    {/* Block: Time Window */}
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-48 shrink-0 pt-2">
                        <span className="font-bold text-slate-500 uppercase text-xs tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                          Active Window
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 flex-1">
                        <input 
                          type="time" 
                          step="1"
                          value={rule.start_time || ""} 
                          onChange={(e) => updateRule(rule.id, { start_time: e.target.value || null })}
                          className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 shadow-inner font-mono text-sm transition-all hover:border-slate-600"
                        />
                        <span className="text-slate-600 font-bold text-xs">UNTIL</span>
                        <input 
                          type="time" 
                          step="1"
                          value={rule.end_time || ""} 
                          onChange={(e) => updateRule(rule.id, { end_time: e.target.value || null })}
                          className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 shadow-inner font-mono text-sm transition-all hover:border-slate-600"
                        />
                        <span className="text-xs text-slate-500 font-medium bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">Leave blank for 24/7 monitoring</span>
                      </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent opacity-50"></div>

                    {/* Block: Behaviors */}
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-48 shrink-0 pt-2">
                        <span className="font-bold text-slate-500 uppercase text-xs tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                          Detect Behaviors
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2.5">
                          {AVAILABLE_BEHAVIORS.map(b => {
                            const isSelected = activeBehaviors.includes(b);
                            return (
                              <button 
                                key={b}
                                onClick={() => toggleBehavior(rule, b)}
                                className={`
                                  flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300
                                  ${isSelected 
                                    ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                                    : 'bg-slate-950/60 border border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300 hover:bg-slate-900'
                                  }
                                `}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                {b.replace(/_/g, ' ')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent opacity-50"></div>

                    {/* Block: Action */}
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-48 shrink-0 pt-2">
                        <span className="font-bold text-rose-400 uppercase text-xs tracking-widest flex items-center gap-2 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                          <Zap className="w-3.5 h-3.5" fill="currentColor" />
                          Execute Action
                        </span>
                      </div>
                      <div className="flex-1 relative">
                        <select 
                          value={rule.action || ""} 
                          onChange={(e) => updateRule(rule.id, { action: e.target.value })}
                          className="w-full md:w-2/3 bg-rose-950/20 border border-rose-500/30 rounded-xl px-5 py-3.5 text-sm text-rose-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 font-bold cursor-pointer appearance-none transition-all hover:bg-rose-950/40"
                        >
                          <option value="" className="bg-slate-900">-- Select an automated action --</option>
                          {AVAILABLE_ACTIONS.map(act => (
                            <option key={act} value={act} className="bg-slate-900 text-slate-200">{act}</option>
                          ))}
                        </select>
                        <div className="absolute right-[33%] md:right-[calc(33.333%+16px)] top-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="w-2 h-2 border-b-2 border-r-2 border-rose-400 transform rotate-45" />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
