import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Shield, Lock, Building, User } from "lucide-react";
import api from "src/lib/api";
import { useAuthStore } from "src/store/authStore";

export default function Register() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    tenant_name: "",
    environment_type: "mall",
  });
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/register", formData);
      const { access_token, role, tenant_id } = response.data;

      // Extract user info
      const user = {
        id: "extracted-from-token", 
        name: formData.name,
        email: formData.email,
        role: role,
      };

      // Mock the tenant info until we hit /auth/me or similar
      const tenant = {
        id: tenant_id,
        name: formData.tenant_name,
        mode: formData.environment_type as any,
      };

      setAuth(tenant, user, access_token);
      router.push("/onboarding");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center p-6 text-slate-300 font-sans selection:bg-rose-500/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Workspace</h1>
          <p className="text-sm text-slate-400 mt-2">Deploy Sentinel for your organization</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workspace Name</label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={formData.tenant_name}
                  onChange={(e) => setFormData({...formData, tenant_name: e.target.value})}
                  required
                  className="w-full bg-black/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  placeholder="e.g. Westfield Mall"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Environment Type</label>
              <select
                value={formData.environment_type}
                onChange={(e) => setFormData({...formData, environment_type: e.target.value})}
                className="w-full bg-black/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-colors"
              >
                <option value="mall">Shopping Mall</option>
                <option value="school">School / Campus</option>
                <option value="supermarket">Supermarket</option>
              </select>
            </div>

            <hr className="border-slate-800 my-4" />

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="w-full bg-black/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="w-full bg-black/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  className="w-full bg-black/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-800 text-white font-bold text-sm hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                "Create Workspace"
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Already have an account? <Link href="/login" className="text-rose-500 hover:text-rose-400 font-bold transition-colors">Sign In</Link>
          </p>
          <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors">
            &larr; Back to Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
