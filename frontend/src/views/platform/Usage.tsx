import React, { useEffect, useState } from 'react';

export default function Usage() {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/usage?start_date=${startDate}&end_date=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch usage data');
      const data = await res.json();
      setUsageData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [startDate, endDate]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Usage Statistics</h1>
          <p className="text-slate-400 text-sm">Review operational activity, data pipelines throughput, and storage usage metrics.</p>
        </div>
        
        {/* Date Filters */}
        <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded px-2 py-1 outline-none"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded px-2 py-1 outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading usage metrics...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Tenant Name</th>
                <th className="p-4">Tenant ID</th>
                <th className="p-4 text-right">Detection Ingests</th>
                <th className="p-4 text-right">SMS Sent</th>
                <th className="p-4 text-right">Voice Alerts</th>
                <th className="p-4 text-right">Storage In Use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
              {usageData.map((row) => (
                <tr key={row.tenant_id} className="hover:bg-slate-950/40 transition">
                  <td className="p-4 font-semibold text-slate-200">{row.tenant_name}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{row.tenant_id}</td>
                  <td className="p-4 text-right font-mono font-semibold text-indigo-400">
                    {row.detection_event_count.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-300">
                    {row.sms_sent_count.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-300">
                    {row.voice_calls_count.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-300">
                    {row.storage_used_mb.toLocaleString()} MB
                  </td>
                </tr>
              ))}
              {usageData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No usage metrics loaded for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
