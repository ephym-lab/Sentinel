import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 py-16 rounded-2xl bg-[#0b0c10]/60 border border-slate-800/80 backdrop-blur-md shadow-xl max-w-md mx-auto">
      {/* Glow Backdrop with Icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
          <Icon className="w-8 h-8 text-rose-500" />
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-bold text-slate-100 tracking-tight mb-2">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-xs">
        {description}
      </p>
      
      {/* Call to Action Button */}
      {action && (
        <div className="w-full flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}
