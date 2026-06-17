import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function TenantDetail() {
  // Use location parsing if React Router useParams is not fully active, fallback safe
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<any>(null);
  const [configText, setConfigText] = useState<string>('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenantDetail = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/platform/tenants/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Failed to load tenant details');
        const data = await res.json();
        setTenant(data);
        setConfigText(JSON.stringify(data.config, null, 2));
      } catch (err: any) {
        setError(err.message || 'Error loading tenant details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTenantDetail();
    }
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      // Validate JSON syntax first
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(configText);
      } catch (e) {
        throw new Error('Invalid JSON format. Please correct it before saving.');
      }

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/platform/tenants/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: tenant.name,
          config: parsedConfig
        })
      });

      if (!res.ok) throw new Error('Failed to save configuration');
      const data = await res.json();
      setTenant(data);
      alert('Configuration updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading tenant configuration...</div>;
  if (error) return <div className="p-8 text-rose-500">Error: {error}</div>;
  if (!tenant) return <div className="p-8 text-slate-400">Tenant not found.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/platform/tenants')}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{tenant.name} Configuration</h1>
          <p className="text-slate-400 text-sm">Tenant ID: <span className="font-mono text-slate-300">{tenant.id}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Tenant Info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Schema Name</p>
              <p className="font-mono text-slate-300">{tenant.schema_name}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Environment Preset</p>
              <p className="text-slate-300 capitalize">{tenant.environment_type}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Status</p>
              <span className={`inline-block px-2 py-0.5 mt-1 rounded-full text-xs font-semibold ${
                tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {tenant.status}
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Created Date</p>
              <p className="text-slate-300">{new Date(tenant.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Configuration JSON</h3>
            <span className="text-slate-500 text-xs font-mono">Editable Object</span>
          </div>

          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className="w-full flex-grow bg-slate-950 font-mono text-xs text-indigo-300 p-4 border border-slate-800 focus:border-slate-700 rounded-lg outline-none resize-y min-h-[350px]"
          />

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setConfigText(JSON.stringify(tenant.config, null, 2))}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition"
            >
              Reset Changes
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ backgroundColor: '#800000' }}
            >
              {saving ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
