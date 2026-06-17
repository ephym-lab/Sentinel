import React from "react";
import { Film, Trash2, Check, Clock, Calendar } from "lucide-react";
import api from "src/lib/api";
import { CameraFeed } from "./CameraCard";

interface FeedHistoryListProps {
  cameraId: string;
  feeds: CameraFeed[];
  onRefresh: () => void;
}

export default function FeedHistoryList({ cameraId, feeds, onRefresh }: FeedHistoryListProps) {
  
  const handleActivate = async (feedId: string) => {
    try {
      await api.patch(`/cameras/${cameraId}/feed/${feedId}/activate`);
      onRefresh();
    } catch (err) {
      console.error("Failed to activate feed:", err);
      alert("Error: Failed to activate feed.");
    }
  };

  const handleDelete = async (feedId: string) => {
    if (!window.confirm("Are you sure you want to delete this video feed file from the server?")) {
      return;
    }
    try {
      await api.delete(`/cameras/${cameraId}/feed/${feedId}`);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete feed:", err);
      alert("Error: Failed to delete feed.");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown Date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="bg-[#0b0c10]/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
        <Film className="w-4 h-4 text-rose-500" /> Feed Source History
      </h3>
      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
        Switch the active surveillance simulation to any of the previously uploaded files, or delete old feeds to free up disk storage space.
      </p>

      {feeds.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
          <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-semibold">No video uploads found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div 
              key={feed.id} 
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all ${
                feed.is_active 
                  ? "bg-rose-500/5 border-rose-500/25" 
                  : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${feed.is_active ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-400"} mt-0.5`}>
                  <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0 pr-4">
                  <p className="text-xs font-semibold text-slate-200 truncate">{feed.original_filename || "simulated_feed.mp4"}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    Uploaded at: {/* @ts-ignore */}
                    {formatDate(feed.uploaded_at)}
                  </p>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-2 mt-4 sm:mt-0 justify-end">
                {feed.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                    <Check className="w-3 h-3" /> Active Feed
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleActivate(feed.id)}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-all uppercase tracking-wider"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => handleDelete(feed.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Delete video feed file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
