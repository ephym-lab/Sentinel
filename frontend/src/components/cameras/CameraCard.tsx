import React, { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Trash2, Edit3, RefreshCw, Film } from "lucide-react";
import { API_BASE_URL } from "src/lib/api";

export interface CameraFeed {
  id: string;
  file_path?: string;
  original_filename?: string;
  is_active: boolean;
}

export interface Camera {
  id: string;
  name: string;
  location?: string;
  zone?: string;
  camera_type?: string;
  is_active: boolean;
  active_feed?: CameraFeed | null;
  feeds?: CameraFeed[];
}

interface CameraCardProps {
  camera: Camera;
  onDelete: (id: string) => void;
  onReplaceFeed: (camera: Camera) => void;
}

export default function CameraCard({ camera, onDelete, onReplaceFeed }: CameraCardProps) {
  const [videoError, setVideoError] = useState(false);
  
  // Status check logic
  let status: "active" | "processing" | "offline" = "offline";
  if (!camera.is_active) {
    status = "offline";
  } else if (!camera.active_feed || !camera.active_feed.file_path) {
    status = "processing";
  } else {
    status = "active";
  }

  const feedUrl = camera.active_feed?.file_path 
    ? `${API_BASE_URL}/static/${camera.active_feed.file_path}` 
    : null;

  return (
    <div className="group rounded-2xl bg-[#0b0c10]/40 border border-slate-800/80 hover:border-slate-700/80 overflow-hidden shadow-lg transition-all duration-300 flex flex-col hover:-translate-y-0.5">
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center border-b border-slate-800/80 overflow-hidden">
        {feedUrl && !videoError ? (
          <video
            src={feedUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5 p-4">
            <Film className="w-8 h-8 text-slate-700" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {status === "processing" ? "Compiling feed..." : "No Active Feed"}
            </span>
          </div>
        )}

        {/* Hover Action to Go to Details */}
        <Link 
          href={`/admin/devices/${camera.id}`}
          className="absolute inset-0 z-10"
        />

        {/* Top Badges overlay */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[9px] font-bold text-slate-300 uppercase border border-white/5">
            {camera.camera_type || "General"}
          </span>
        </div>

        {/* Status dot overlay */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          {status === "active" && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
          {status === "processing" && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
          {status === "offline" && (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
          )}
        </div>
      </div>

      {/* Camera details */}
      <div className="p-4 flex-1 flex flex-col justify-between relative">
        <div className="min-w-0 pr-6">
          <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-rose-400 transition-colors">
            <Link href={`/admin/devices/${camera.id}`}>{camera.name}</Link>
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">
            Zone: <span className="text-slate-200">{camera.location || "General"}</span>
          </p>
        </div>

        {/* Status Text badges at bottom */}
        <div className="flex items-center justify-between mt-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
            status === "active" 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : status === "processing"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
          }`}>
            {status}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">
            {camera.active_feed?.original_filename ? "Simulated Stream" : "No Source"}
          </span>
        </div>

        {/* Dropdown Menu */}
        <div className="absolute top-3.5 right-3.5 z-20">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-1 rounded hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-all focus:outline-none">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="w-40 bg-[#0f111a] border border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-slate-300"
                sideOffset={5}
                align="end"
              >
                <DropdownMenu.Item asChild>
                  <Link 
                    href={`/admin/devices/${camera.id}`}
                    className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-slate-800/60 hover:text-white flex items-center gap-2 transition-all cursor-pointer focus:outline-none"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit details
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => onReplaceFeed(camera)}
                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-slate-800/60 hover:text-white flex items-center gap-2 transition-all cursor-pointer focus:outline-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Replace feed
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-slate-800 my-1" />
                <DropdownMenu.Item 
                  onClick={() => onDelete(camera.id)}
                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-rose-500/10 hover:text-rose-400 flex items-center gap-2 transition-all cursor-pointer focus:outline-none"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete camera
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}
