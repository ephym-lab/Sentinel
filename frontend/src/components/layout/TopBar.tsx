import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { 
  Bell, 
  Search, 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  LogOut, 
  User as UserIcon, 
  Shield 
} from "lucide-react";
import { useAuthStore } from "src/store/authStore";
import { useAlertStore } from "src/store/alertStore";

export default function TopBar() {
  const { theme, setTheme } = useTheme();
  const { tenant, user, clearAuth } = useAuthStore();
  const { isMuted, toggleMute, unreadAlertsCount, clearUnreadCount } = useAlertStore();
  
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertMenuOpen, setIsAlertMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0d0f14]/90 backdrop-blur-md px-6 flex items-center justify-between text-slate-100 sticky top-0 z-20">
      {/* Search Bar */}
      <div className="flex items-center gap-3 w-96 relative">
        <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search cameras, zones, POIs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl py-1.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Tenant Environment Indicator */}
        {tenant && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20 capitalize">
            <Shield className="w-3.5 h-3.5" />
            {tenant.mode} Mode
          </span>
        )}

        {/* Audio Alert Toggle */}
        <button
          onClick={toggleMute}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-all"
          title={isMuted ? "Unmute alarm sounds" : "Mute alarm sounds"}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-rose-400 animate-pulse" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-all"
          title="Toggle color theme"
        >
          {!mounted ? (
            <div className="w-5 h-5" />
          ) : theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsAlertMenuOpen(!isAlertMenuOpen);
              if (unreadAlertsCount > 0) clearUnreadCount();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 relative transition-all"
          >
            <Bell className="w-5 h-5" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {isAlertMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-1.5 border-b border-slate-800 flex justify-between items-center">
                <span className="font-semibold text-xs text-slate-300">Recent Notifications</span>
                <button 
                  onClick={clearUnreadCount}
                  className="text-[10px] text-rose-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto px-2 py-1">
                {unreadAlertsCount === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-6">No new notifications</p>
                ) : (
                  <div className="py-2 px-3 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-all">
                    <p className="text-slate-200 text-xs font-medium">New Threat Alert</p>
                    <p className="text-slate-400 text-[10px]">Loitering detected near Gate A</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700/80 transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              {user?.name?.[0].toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-200 leading-none">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">{user?.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#0f111a] border border-slate-800 rounded-xl shadow-2xl py-1 z-50">
              <div className="px-4 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-200">{user?.name}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  window.location.href = "/admin/notifications";
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800/50 hover:text-white flex items-center gap-2 transition-all"
              >
                <UserIcon className="w-4 h-4" /> Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2 border-t border-slate-800 transition-all"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
