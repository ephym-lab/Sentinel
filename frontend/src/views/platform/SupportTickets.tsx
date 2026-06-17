import React, { useEffect, useState } from 'react';

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submit new ticket state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [tenantId, setTenantId] = useState('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/platform/support-tickets', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch support tickets');
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleResolve = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/support-tickets/${id}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to resolve support ticket');
      fetchTickets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/platform/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: tenantId || null,
          subject,
          description
        })
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      setSubject('');
      setDescription('');
      setTenantId('');
      fetchTickets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Support Requests</h1>
        <p className="text-slate-400 text-sm">Review, track, and close system tickets and maintenance requests.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-sans">Active Support Tickets</h3>
            </div>
            {loading ? (
              <div className="p-8 text-slate-400 text-sm">Loading tickets...</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-5 hover:bg-slate-950/20 transition flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {ticket.status}
                        </span>
                        {ticket.tenant_id && (
                          <span className="text-slate-500 text-xs font-mono">Tenant: {ticket.tenant_id}</span>
                        )}
                        <span className="text-slate-600 text-xs font-mono">ID: {ticket.id.slice(0, 8)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-200">{ticket.subject}</h4>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{ticket.description || 'No description provided.'}</p>
                      <span className="text-slate-500 text-[10px] block pt-2">Created at {new Date(ticket.created_at).toLocaleString()}</span>
                    </div>

                    {ticket.status === 'open' && (
                      <button
                        onClick={() => handleResolve(ticket.id)}
                        className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded border border-emerald-500/20 text-xs font-semibold transition"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
                {tickets.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No support tickets found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit Ticket Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl h-fit space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">File a Ticket</h3>
          <form onSubmit={handleCreateTicket} className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="text-slate-500 text-xs font-bold uppercase block">Tenant ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. kca-university"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-500 text-xs font-bold uppercase block">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. YOLO ML model server timing out"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-500 text-xs font-bold uppercase block">Description</label>
              <textarea
                required
                placeholder="Details of the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none resize-none h-28"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-white rounded-lg text-xs font-bold tracking-wide transition uppercase"
              style={{ backgroundColor: '#800000' }}
            >
              Submit Ticket
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
