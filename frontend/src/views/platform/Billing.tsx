import React, { useEffect, useState } from 'react';

export default function Billing() {
  const [billingData, setBillingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/billing?start_date=${startDate}&end_date=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch billing data');
      const data = await res.json();
      setBillingData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [startDate, endDate]);

  const totalCost = billingData.reduce((acc, row) => acc + row.total_billing_kes, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Outbound API Costs</h1>
          <p className="text-slate-400 text-sm">Monitor Africa's Talking API message dispatch costs, rates, and totals across tenants.</p>
        </div>
        
        {/* Date Filter & Total Card */}
        <div className="flex items-center space-x-4">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-right shadow-md">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Incurred Cost</span>
            <span className="text-lg font-bold text-amber-400 font-mono">KES {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

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
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading billing metrics...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Tenant Name</th>
                <th className="p-4">Tenant ID</th>
                <th className="p-4 text-right">SMS Dispatched</th>
                <th className="p-4 text-right">SMS Cost</th>
                <th className="p-4 text-right">Voice Dispatched</th>
                <th className="p-4 text-right">Voice Cost</th>
                <th className="p-4 text-right">Grand Total (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
              {billingData.map((row) => (
                <tr key={row.tenant_id} className="hover:bg-slate-950/40 transition">
                  <td className="p-4 font-semibold text-slate-200">{row.tenant_name}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{row.tenant_id}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{row.sms_sent_count}</td>
                  <td className="p-4 text-right font-mono text-slate-300">KES {row.sms_cost_kes.toFixed(2)}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{row.voice_calls_count}</td>
                  <td className="p-4 text-right font-mono text-slate-300">KES {row.voice_calls_cost_kes.toFixed(2)}</td>
                  <td className="p-4 text-right font-mono font-bold text-amber-400">
                    KES {row.total_billing_kes.toFixed(2)}
                  </td>
                </tr>
              ))}
              {billingData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No outbound notifications occurred in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
