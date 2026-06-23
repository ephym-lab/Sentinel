import Link from "next/link";
import { useRouter } from "next/router";
import { 
  LayoutGrid, 
  AlertTriangle, 
  Bell, 
  UserSearch, 
  Settings, 
  Camera, 
  ShieldAlert,
  ShoppingBag,
  HeartHandshake
} from "lucide-react";
import { useAuthStore } from "src/store/authStore";

export default function IconRail() {
  const router = useRouter();
  const { tenant, user } = useAuthStore();
  
  const currentPath = router.pathname;

  const mainNavItems = [
    { href: "/monitor", icon: LayoutGrid, label: "Live Monitor" },
    { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
    { href: "/alerts", icon: Bell, label: "Alert Centre" },
    { href: "/poi", icon: ShieldAlert, label: "POI Tracker" },
    { href: "/persons/lookup", icon: UserSearch, label: "Person Lookup" },
  ];

  // Mode-specific navigation items
  if (tenant?.mode === "mall") {
    mainNavItems.push({ href: "/recovery", icon: HeartHandshake, label: "Child Recovery" });
  } else if (tenant?.mode === "supermarket") {
    mainNavItems.push({ href: "/store", icon: ShoppingBag, label: "Store Monitor" });
  }

  const adminNavItems = [
    { href: "/admin/devices", icon: Camera, label: "Camera Admin" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-16 h-screen bg-[#0d0f14] border-r border-slate-800/80 flex flex-col items-center py-4 flex-shrink-0 z-30">
      {/* App Logo */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center mb-8 shadow-md shadow-rose-900/20">
        <span className="font-black text-white text-lg tracking-tight">S</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 w-full flex flex-col items-center gap-4">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.href);
          
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className="group relative w-full flex justify-center py-2"
              title={item.label}
            >
              {/* Highlight Left Border */}
              <div 
                className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-md bg-rose-500 transition-all duration-300 ${
                  isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 group-hover:opacity-50 group-hover:scale-y-75"
                }`} 
              />
              
              {/* Icon button */}
              <div 
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? "bg-rose-500/10 text-rose-400 shadow-sm" 
                    : "text-slate-400 group-hover:text-slate-100 group-hover:bg-slate-800/40"
                }`}
              >
                <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-105" />
              </div>

              {/* Tooltip */}
              <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg border border-slate-800 whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Admin & Settings (User Gated) */}
      <div className="w-full flex flex-col items-center gap-4 border-t border-slate-800/80 pt-4">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.href);

          // Gating check: only admins/super_admins can access admin sub-links
          if ((item.href.startsWith("/admin") || item.href === "/settings") && user?.role !== "admin" && user?.role !== "super_admin") {
            return null;
          }

          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className="group relative w-full flex justify-center py-2"
              title={item.label}
            >
              <div 
                className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-md bg-rose-500 transition-all duration-300 ${
                  isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 group-hover:opacity-50 group-hover:scale-y-75"
                }`} 
              />
              <div 
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? "bg-rose-500/10 text-rose-400" 
                    : "text-slate-400 group-hover:text-slate-100 group-hover:bg-slate-800/40"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg border border-slate-800 whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
