import { useState } from "react";
import { useAuthStore } from "src/store/authStore";
import { User as UserIcon, Building, Shield, Lock, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "src/lib/api";

export default function Settings() {
  const { tenant, user, setAuth, token } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Only send password if it's not empty
      const payload: any = {
        name: formData.name,
        email: formData.email,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await api.patch("/users/me", payload);
      
      // Update local state
      if (tenant && token) {
        setAuth(
          tenant,
          {
            ...user!,
            name: response.data.name,
            email: response.data.email,
          },
          token
        );
      }
      
      setSuccess("Profile updated successfully!");
      setFormData(prev => ({ ...prev, password: "" })); // clear password field
    } catch (err: any) {
      console.error("Update failed:", err);
      setError(err.response?.data?.detail || "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Workspace Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your organization and account details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Info (Read-Only) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Building className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Organization Info</h2>
                <p className="text-[10px] text-slate-500">Current workspace details</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tenant Name</label>
                <div className="mt-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 font-medium">
                  {tenant?.name || "Global Environment"}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Environment Mode</label>
                <div className="mt-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 font-medium capitalize flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  {tenant?.mode || "System Default"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <UserIcon className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Account Profile</h2>
                <p className="text-[10px] text-slate-500">Update your personal credentials</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Role</label>
                  <div className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-500 capitalize cursor-not-allowed">
                    {user?.role}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-400">Change Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2.5 px-6 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/10 transition-all disabled:opacity-50"
                >
                  {isLoading ? "Saving Changes..." : "Save Profile"}
                  {!isLoading && <Save className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
