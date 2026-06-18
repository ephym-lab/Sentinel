import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Shield, Eye, Flame, Activity, Zap, ChevronRight, Lock, Users, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050608] text-slate-300 font-sans selection:bg-rose-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-[#050608]/80 backdrop-blur-md border-b border-white/5 py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-wider text-white">SENTINEL</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Platform</a>
            <a href="#technology" className="text-slate-400 hover:text-white transition-colors">Technology</a>
            <a href="#solutions" className="text-slate-400 hover:text-white transition-colors">Solutions</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-white hover:text-rose-400 transition-colors">
              Sign In
            </Link>
            <Link href="/login" className="px-5 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Live Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold tracking-wide uppercase mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            V2 Platform Now Live
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mb-6">
            Intelligent Surveillance, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-rose-600">Without the Noise.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Sentinel transforms your existing camera infrastructure into a proactive, multi-modal threat detection engine. Detect fires, track persons of interest, and analyze behaviors in real-time.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-rose-600 to-rose-800 text-white font-bold text-base hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 group">
              Access Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 border border-slate-800 text-white font-bold text-base hover:bg-slate-800 transition-all flex items-center justify-center">
              Explore Features
            </Link>
          </div>
        </div>
      </section>

      {/* Analytics Dashboard Preview */}
      <section className="max-w-6xl mx-auto px-6 relative z-20 -mt-10 mb-32">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-2 backdrop-blur-sm shadow-2xl shadow-black">
          <div className="rounded-xl overflow-hidden relative aspect-video bg-black border border-slate-800">
            {/* Mock Dashboard UI - Busy Street Scene */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517400508447-f8dd518b86db?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-luminosity" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            
            {/* Simulated Bounding Boxes */}
            <div className="absolute top-1/4 left-1/3 w-24 h-32 border-2 border-emerald-500/80 rounded bg-emerald-500/10">
              <span className="absolute -top-6 left-0 bg-emerald-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm">PERSON 98%</span>
            </div>
            <div className="absolute top-1/2 right-1/4 w-16 h-16 border-2 border-cyan-500/80 rounded-full border-dashed animate-[spin_10s_linear_infinite]">
              <span className="absolute -top-6 left-0 bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm animate-none">FACE DETECTED</span>
            </div>
            
            {/* UI Overlay */}
            <div className="absolute bottom-6 right-6 bg-black/80 backdrop-blur border border-white/10 rounded-lg p-4 w-64 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-white">Live Telemetry</span>
                <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-400">FPS</span> <span className="text-emerald-400 font-mono">24.0</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Latency</span> <span className="text-emerald-400 font-mono">42ms</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Active Threats</span> <span className="text-rose-400 font-mono font-bold">0</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#0a0c10] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">A Multi-Modal Approach</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Sentinel isn't just a motion detector. It uses a fusion of state-of-the-art neural networks to understand context, identity, and environmental hazards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Identity Re-ID", desc: "Track individuals across multiple camera feeds natively, maintaining context without facial visibility.", color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Eye, title: "Facial Recognition", desc: "Instantly match faces against known watchlists or VIP databases with sub-100ms latency.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: Flame, title: "Fire & Smoke", desc: "Detect thermal hazards visually before traditional ceiling sensors even trigger.", color: "text-rose-400", bg: "bg-rose-500/10" },
              { icon: Activity, title: "Behavioral Analytics", desc: "Identify fighting, loitering, or suspicious movements using temporal pose estimation.", color: "text-amber-400", bg: "bg-amber-500/10" },
              { icon: Shield, title: "Threat Fusion", desc: "Our proprietary engine fuses multiple signals to generate an actionable confidence score, eliminating false alarms.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { icon: Zap, title: "Selective Processing", desc: "Throttle execution. Run full analysis on entryways, and lightweight object detection on corridors.", color: "text-blue-400", bg: "bg-blue-500/10" },
            ].map((feature, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 p-8 rounded-2xl transition-colors group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${feature.bg} mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10] to-slate-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-rose-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center bg-slate-900/60 backdrop-blur-lg border border-white/10 p-12 rounded-3xl">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to secure your perimeter?</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Deploy Sentinel on-premise or connect your cloud camera feeds today. Experience zero-latency threat detection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-4 rounded-full bg-white text-black font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">
              Launch Console <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-900 text-center text-slate-600 text-xs bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="font-bold tracking-widest uppercase">Sentinel</span>
            <span className="px-2">|</span>
            <span>&copy; {new Date().getFullYear()} EphyLab. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
