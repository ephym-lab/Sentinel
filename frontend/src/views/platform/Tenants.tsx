import React, { useEffect, useState } from 'react';

// Reusing general styles and layout assumptions
export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Onboarding modal state
  const [showModal, setShowModal] = useState(false);
  const [newTenant, setNewTenant] = useState({
    id: '',
    name: '',
    environment_type: 'school',
    config: {}
  });

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/platform/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSuspend = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/tenants/${id}/suspend`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to suspend tenant');
      fetchTenants();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/tenants/${id}/reactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to reactivate tenant');
      fetchTenants();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImpersonate = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/tenants/${id}/impersonate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to impersonate tenant');
      const data = await res.json();
      
      // Store current admin token as "admin_token" to allow switching back later
      localStorage.setItem('admin_token', token || '');
      // Set the active session token to the impersonation token
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('tenant_id', data.impersonated_tenant_id);
      
      alert(`Impersonating tenant ${id}. Redirecting to user dashboard...`);
      window.location.href = '/';
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/platform/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTenant)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to onboard tenant');
      }
      setShowModal(false);
      setNewTenant({ id: '', name: '', environment_type: 'school', config: {} });
      fetchTenants();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading tenants directory...</div>;
  if (error) return <div className="p-8 text-rose-500">Error: {error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tenants Directory</h1>
          <p className="text-slate-400 text-sm">Manage registered tenant environments, configurations, and operations.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg text-sm font-semibold transition"
          style={{ backgroundColor: '#800000' }} // Premium Maroon Theme Accent
        >
          Onboard Tenant
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <th className="p-4">Tenant ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Schema Name</th>
              <th className="p-4">Environment</th>
              <th className="p-4">Status</th>
              <th className="p-4">Onboarded At</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-slate-950/40 transition">
                <td className="p-4 font-mono font-semibold text-slate-200">{tenant.id}</td>
                <td className="p-4">{tenant.name}</td>
                <td className="p-4 text-slate-500 font-mono text-xs">{tenant.schema_name}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs capitalize">
                    {tenant.environment_type}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="p-4 text-slate-400">{new Date(tenant.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleImpersonate(tenant.id)}
                    className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded border border-indigo-500/20 text-xs font-medium transition"
                  >
                    Impersonate
                  </button>
                  <a
                    href={`/platform/tenants/${tenant.id}`}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs font-medium transition inline-block"
                  >
                    Configure
                  </a>
                  {tenant.status === 'active' ? (
                    <button
                      onClick={() => handleSuspend(tenant.id)}
                      className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded border border-rose-500/20 text-xs font-medium transition"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(tenant.id)}
                      className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded border border-emerald-500/20 text-xs font-medium transition"
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Onboard New Tenant</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-bold uppercase">Tenant Slug ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kca-university, tuskys-hq"
                  value={newTenant.id}
                  onChange={(e) => setNewTenant({ ...newTenant, id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-bold uppercase">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KCA University, Tuskys Headquarters"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-bold uppercase">Environment Preset</label>
                <select
                  value={newTenant.environment_type}
                  onChange={(e) => setNewTenant({ ...newTenant, environment_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none"
                >
                  <option value="school">School (Education Safety)</option>
                  <option value="mall">Mall (Retail Threat Analysis)</option>
                  <option value="supermarket">Supermarket (Customer Insights & Loss Prevention)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition"
                  style={{ backgroundColor: '#800000' }}
                >
                  Provision Schema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
