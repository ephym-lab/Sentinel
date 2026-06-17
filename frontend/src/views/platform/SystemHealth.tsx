import React, { useEffect, useState } from 'react';

export default function SystemHealth() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [mlService, setMlService] = useState<any>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ml' | 'cameras' | 'queues' | 'errors'>('ml');

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Query all 4 health endpoints concurrently
      const [camerasRes, mlRes, queuesRes, errorsRes] = await Promise.all([
        fetch('/api/v1/platform/health/cameras', { headers }),
        fetch('/api/v1/platform/health/ml-service', { headers }),
        fetch('/api/v1/platform/health/queues', { headers }),
        fetch('/api/v1/platform/health/errors', { headers })
      ]);

      if (camerasRes.ok) setCameras(await camerasRes.json());
      if (mlRes.ok) setMlService(await mlRes.json());
      if (queuesRes.ok) setQueues(await queuesRes.json());
      if (errorsRes.ok) setErrors(await errorsRes.json());
    } catch (err) {
      console.error('Error fetching health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !mlService) {
    return <div className="p-8 text-slate-400">Loading system metrics dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Health Monitor</h1>
        <p className="text-slate-400 text-sm">Real-time status of cameras, ML inference workloads, queues, and log buffers.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        {(['ml', 'cameras', 'queues', 'errors'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-all border-b-2 -mb-[2px] ${
              activeTab === tab
                ? 'border-maroon-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            style={activeTab === tab ? { borderBottomColor: '#800000' } : {}}
          >
            {tab === 'ml' ? 'ML Services' : tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'ml' && mlService && (
        <div className="space-y-6">
          {/* Resource Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
              <p className="text-slate-500 text-xs font-bold uppercase">ML Service Status</p>
              <p className="text-2xl font-bold text-white mt-1 capitalize">{mlService.status}</p>
              <span className={`inline-block w-2.5 h-2.5 rounded-full mt-2 ${
                mlService.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
              <p className="text-slate-500 text-xs font-bold uppercase">Inference Device</p>
              <p className="text-2xl font-bold text-white mt-1 font-mono uppercase">{mlService.device}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
              <p className="text-slate-500 text-xs font-bold uppercase">GPU Core Load</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{mlService.gpu_utilization}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
              <p className="text-slate-500 text-xs font-bold uppercase">CPU Core Load</p>
              <p className="text-2xl font-bold text-sky-400 mt-1">{mlService.cpu_utilization}</p>
            </div>
          </div>

          {/* Latency Percentiles */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Inference Latency Percentiles</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850">
                <span className="text-slate-500 text-xs block">50th Percentile (Median)</span>
                <span className="text-xl font-bold text-slate-200 mt-1 block">{mlService.inference_latency_percentiles.p50}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850">
                <span className="text-slate-500 text-xs block">95th Percentile (Spike Average)</span>
                <span className="text-xl font-bold text-amber-400 mt-1 block">{mlService.inference_latency_percentiles.p95}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850">
                <span className="text-slate-500 text-xs block">99th Percentile (Worst Case)</span>
                <span className="text-xl font-bold text-rose-400 mt-1 block">{mlService.inference_latency_percentiles.p99}</span>
              </div>
            </div>
          </div>

          {/* Loaded Models */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 bg-slate-950">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Model Registry Inventory</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">Model Name</th>
                  <th className="p-4">Active Device</th>
                  <th className="p-4">Variant</th>
                  <th className="p-4">Load Status</th>
                  <th className="p-4">Bootstrap Load Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                {mlService.models.map((model: any) => (
                  <tr key={model.name} className="hover:bg-slate-950/40 transition">
                    <td className="p-4 font-mono font-semibold text-slate-200">{model.name}</td>
                    <td className="p-4 uppercase text-xs font-mono">{model.device}</td>
                    <td className="p-4 text-slate-400">{model.variant}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        model.loaded ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {model.loaded ? 'Loaded' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 font-mono">{model.load_time_ms ? `${model.load_time_ms} ms` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cameras' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Active Camera Feeds</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Tenant Name</th>
                <th className="p-4">Camera ID</th>
                <th className="p-4">Name</th>
                <th className="p-4">Location</th>
                <th className="p-4">Feed Active</th>
                <th className="p-4">Last Ingestion Heartbeat</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
              {cameras.map((camera, i) => (
                <tr key={camera.camera_id + i} className="hover:bg-slate-950/40 transition">
                  <td className="p-4 font-semibold">{camera.tenant_name}</td>
                  <td className="p-4 font-mono text-xs">{camera.camera_id}</td>
                  <td className="p-4">{camera.name}</td>
                  <td className="p-4 text-slate-400">{camera.location || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      camera.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {camera.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{camera.last_heartbeat ? new Date(camera.last_heartbeat).toLocaleString() : 'Never'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      camera.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {camera.status}
                    </span>
                  </td>
                </tr>
              ))}
              {cameras.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No active cameras found in the directory.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'queues' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Redis Queue Lag Monitoring</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Tenant Name</th>
                <th className="p-4">Redis Key Queue</th>
                <th className="p-4">Backlog Depth</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
              {queues.map((q) => (
                <tr key={q.tenant_id} className="hover:bg-slate-950/40 transition">
                  <td className="p-4 font-semibold">{q.tenant_name}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{q.queue_name}</td>
                  <td className="p-4 font-mono font-bold text-slate-100">{q.depth} tasks</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      q.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      q.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Live Error log trace buffer</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Level</th>
                  <th className="p-4">Logger</th>
                  <th className="p-4">Module location</th>
                  <th className="p-4">Error message / Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs font-mono text-slate-300">
                {errors.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-950/40 transition align-top">
                    <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-4 text-indigo-400 whitespace-nowrap">{log.logger}</td>
                    <td className="p-4 text-slate-400 whitespace-nowrap">{log.filename}:{log.lineno}</td>
                    <td className="p-4 text-rose-200/90 break-all max-w-[400px]">{log.message}</td>
                  </tr>
                ))}
                {errors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">No recent error logs captured in memory. System is running cleanly.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
