import React, { useEffect, useState } from 'react';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/platform/audit-log', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch platform audit log');
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Audit Log</h1>
        <p className="text-slate-400 text-sm">Review full traceback history of actions completed by platform super administrators.</p>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading security audit trails...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Performed At</th>
                <th className="p-4">Action</th>
                <th className="p-4">Super Admin ID</th>
                <th className="p-4">Tenant Scope</th>
                <th className="p-4">Parameters / Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs font-mono text-slate-300">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-950/40 transition align-top">
                  <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(log.performed_at).toLocaleString()}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.action.includes('suspend') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      log.action.includes('impersonate') ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 whitespace-nowrap">{log.super_admin_id}</td>
                  <td className="p-4 text-indigo-400 whitespace-nowrap">{log.tenant_id || 'Global'}</td>
                  <td className="p-4 text-slate-300 font-sans max-w-sm overflow-x-auto leading-relaxed">
                    {log.details ? (
                      <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-850 max-h-40 overflow-y-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr className="font-sans">
                  <td colSpan={5} className="p-8 text-center text-slate-500">No super admin actions have been logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
