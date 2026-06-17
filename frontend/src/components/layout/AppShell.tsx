import React from "react";
import IconRail from "./IconRail";
import TopBar from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#07080a] text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200">
      {/* Sidebar Icon Rail */}
      <IconRail />
      
      {/* Main Container */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header TopBar */}
        <TopBar />
        
        {/* Page Content area */}
        <main className="flex-1 overflow-y-auto bg-[#07080a] p-6 focus:outline-none">
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
