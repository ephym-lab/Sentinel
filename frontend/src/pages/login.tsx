import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Shield, Eye, Lock } from "lucide-react";
import api from "src/lib/api";
import { useAuthStore } from "src/store/authStore";

export default function Login() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      const { access_token, role, tenant_id, is_super_admin } = response.data;

      // Extract user info
      const user = {
        id: "extracted-from-token", // ideally we'd hit /auth/me for this, but for now we mock based on payload
        name: email.split("@")[0],
        email: email,
        role: role,
      };

      // Mock the tenant info until we add a proper /tenant/me route
      const tenant = {
        id: tenant_id || "global",
        name: "Sentinel Workspace",
        mode: "mall" as any,
      };

      setAuth(tenant, user, access_token);
      router.push("/monitor");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center p-6 text-slate-300 font-sans selection:bg-rose-500/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to your Sentinel workspace</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-800 text-white font-bold text-sm hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Don't have an account? <Link href="/register" className="text-rose-500 hover:text-rose-400 font-bold transition-colors">Register here</Link>
          </p>
          <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
            &larr; Back to Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
