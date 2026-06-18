import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, 
  Tv, 
  Radio, 
  AlertCircle, 
  CheckCircle, 
  Sliders, 
  Terminal as TerminalIcon,
  Video,
  Volume2,
  VolumeX,
  Camera as CameraIcon,
  CameraOff
} from "lucide-react";
import api, { API_BASE_URL } from "src/lib/api";
import Link from "next/link";
import { useEventStream } from "src/hooks/useEventStream";
import { Camera } from "src/components/cameras/CameraCard";

interface LiveEvent {
  id: string;
  camera_id?: string;
  event_type: string;
  confidence_score: number;
  clip_path?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export default function MonitorPage() {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showYoloOverlay, setShowYoloOverlay] = useState(true);
  const [activeDetections, setActiveDetections] = useState<any>(null);
  const [analysisMode, setAnalysisMode] = useState<string>("full");
  
  // Zoom & Pan State
  const [isPaused, setIsPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [manualAnalysisResult, setManualAnalysisResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const { data: cameras = [], isLoading } = useQuery<Camera[]>({
    queryKey: ["cameras"],
    queryFn: async () => {
      const response = await api.get("/cameras/");
      return response.data;
    },
  });

  // Fallback to select first camera on load if not already set
  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0]);
    }
  }, [cameras, selectedCamera]);

  // Video Controls
  const togglePause = () => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
        setManualAnalysisResult(null); // Clear manual analysis on play
      } else {
        videoRef.current.pause();
      }
      setIsPaused(!isPaused);
      addTerminalLog(`Video playback ${!isPaused ? 'PAUSED' : 'RESUMED'}`);
    }
  };

  // Zoom handling (Simple scroll to zoom)
  const handleWheel = (e: React.WheelEvent) => {
    if (!videoRef.current) return;
    const zoomSensitivity = 0.005;
    let newZoom = zoom - e.deltaY * zoomSensitivity;
    newZoom = Math.max(1, Math.min(newZoom, 8)); // Clamp between 1x and 8x
    setZoom(newZoom);
    if (newZoom === 1) setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault(); // Prevent native HTML5 video element drag
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Manual Frame Analysis
  const performManualAnalysis = async () => {
    const video = videoRef.current;
    if (!video || !selectedCamera) return;

    setIsAnalyzing(true);
    addTerminalLog(`[MANUAL] Initiating high-res analysis on current frame...`);

    try {
      const canvas = document.createElement("canvas");
      // Use native video resolution for detailed manual analysis
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);

        const response = await api.post("/surveillance/process-frame", {
          camera_id: selectedCamera.id,
          image_b64: base64,
          analysis_mode: analysisMode,
        });

        if (response.data?.ml_raw_metrics) {
           setManualAnalysisResult(response.data);
           setActiveDetections(response.data.ml_raw_metrics); // Overlay on canvas
           addTerminalLog(`[MANUAL] Analysis complete in ${response.data.inference_time_ms}ms.`);
           
           const m = response.data.ml_raw_metrics;
           addTerminalLog(`[MANUAL] Found: ${m.faces_count} faces, ${m.persons_count} persons, ${m.object_count} objects.`);
        }
      }
    } catch (err) {
       console.error("Manual analysis failed:", err);
       addTerminalLog(`[ERROR] Manual analysis failed.`);
    } finally {
       setIsAnalyzing(false);
    }
  };

  // 2. WebSocket Stream Integration
  const { isConnected, subscribe } = useEventStream();

  // Synthesis Sonar Ping for threats
  const playThreatChime = () => {
    if (isAudioMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(330, audioCtx.currentTime + 0.3); // rapid slide down
      
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45); // decay
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context synth blocked by browser autoplay rules.", e);
    }
  };

  useEffect(() => {
    // Subscribe to all incoming detection events from WebSocket
    const unsubscribe = subscribe("detection", (payload: any) => {
      const newEvent: LiveEvent = {
        id: payload.id || Math.random().toString(36).substring(7),
        camera_id: payload.camera_id,
        event_type: payload.event_type || "visual_motion",
        confidence_score: payload.confidence_score || 0.85,
        clip_path: payload.clip_path,
        timestamp: new Date().toISOString(),
        metadata: payload.metadata
      };

      // Add to running event list (limit to 50 alerts)
      setEvents((prev) => [newEvent, ...prev].slice(0, 50));

      // Play chime if it's a threat
      const severity = getSeverity(newEvent.event_type);
      if (severity === "high") {
        playThreatChime();
      }

      // Add log to terminal
      const camName = cameras.find(c => c.id === payload.camera_id)?.name || "Unknown Camera";
      addTerminalLog(`[ALERT] ${newEvent.event_type.toUpperCase()} detected on ${camName} (conf: ${Math.round(newEvent.confidence_score * 100)}%)`);
    });

    return unsubscribe;
  }, [subscribe, cameras, isAudioMuted]);

  // 3. Mock Console Logs generator (runs every 3 seconds to show continuous monitoring)
  useEffect(() => {
    if (!selectedCamera) return;

    const interval = setInterval(() => {
      const frameRate = (15 + Math.random() * 5).toFixed(1);
      const detections = [
        "No anomalies found",
        "Analyzing bounding boxes: Person (0.91), Backpack (0.84)",
        "Computing optical flow vector magnitude: 0.12",
        "Contrast threshold optimal, IR light filter: active",
        "Object tracker id #104 continuous feed lock confirmed",
      ];
      const selectedLog = detections[Math.floor(Math.random() * detections.length)];
      addTerminalLog(`[${selectedCamera.name}] Frame processed. FPS: ${frameRate}. Detail: ${selectedLog}`);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedCamera]);

  const addTerminalLog = (log: string) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${time}] ${log}`].slice(-40));
  };

  // Scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Helper: Severity calculation
  const getSeverity = (type: string): "high" | "caution" | "info" => {
    const t = type.toLowerCase();
    if (t.includes("weapon") || t.includes("fire") || t.includes("smoke") || t.includes("gun")) return "high";
    if (t.includes("fight") || t.includes("scream") || t.includes("run") || t.includes("intrusion")) return "caution";
    return "info";
  };

  // Frame capture loop for live YOLO processing
  useEffect(() => {
    if (!showYoloOverlay || !selectedCamera?.active_feed?.file_path) {
      setActiveDetections(null);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const captureAndProcessFrame = async () => {
      if (!isSubscribed) return;
      
      if (video.paused || video.ended) {
        // If paused, schedule next check without extracting frame
        timerId = setTimeout(captureAndProcessFrame, 400);
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        // Extract at fixed low resolution for highly optimized transfer and backend inference
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
          const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);

          const response = await api.post("/surveillance/process-frame", {
            camera_id: selectedCamera.id,
            image_b64: base64,
            analysis_mode: analysisMode,
          });

          if (isSubscribed && response.data?.ml_raw_metrics) {
            setActiveDetections(response.data.ml_raw_metrics);
            
            const metrics = response.data.ml_raw_metrics;
            if (metrics.fire_detected) {
              addTerminalLog(`[ALERT] YOLO verified fire signature in camera stream!`);
            } else if (metrics.persons_count > 0) {
              addTerminalLog(`[YOLO] Detected ${metrics.persons_count} person(s) on-screen.`);
            } else if ((metrics.faces || []).length > 0) {
              addTerminalLog(`[YOLO] Detected ${metrics.faces.length} face(s) on-screen.`);
            }

            // Log security-relevant objects
            const securityObjects = (metrics.objects || []).filter((o: any) => o.is_security_relevant);
            if (securityObjects.length > 0) {
              const labels = securityObjects.map((o: any) => `${o.label} (${Math.round(o.confidence * 100)}%)`).join(", ");
              addTerminalLog(`[YOLO] Objects detected: ${labels}`);
            }
          }

        }
      } catch (err) {
        console.error("Surveillance frame processing failed:", err);
      }

      if (isSubscribed) {
        timerId = setTimeout(captureAndProcessFrame, 400); // Process at ~2.5 FPS for server thriftiness
      }
    };

    // Begin loop
    timerId = setTimeout(captureAndProcessFrame, 400);

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
    };
  }, [showYoloOverlay, selectedCamera]);

  // Real-time YOLO Bounding Box Drawer
  useEffect(() => {
    if (!showYoloOverlay || !selectedCamera?.active_feed?.file_path) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      if (!video || !canvas || !ctx) return;

      // Sync canvas dimensions with containing block
      const rect = video.getBoundingClientRect();
      const parent = video.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : rect;
      
      if (canvas.width !== parentRect.width || canvas.height !== parentRect.height) {
        canvas.width = parentRect.width;
        canvas.height = parentRect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Compute inner video dimensions for object-contain scaling
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 360;
      const scale = Math.min(canvas.width / videoWidth, canvas.height / videoHeight);
      
      const displayWidth = videoWidth * scale;
      const displayHeight = videoHeight * scale;
      
      const offsetX = (canvas.width - displayWidth) / 2;
      const offsetY = (canvas.height - displayHeight) / 2;

      // Maps coordinates relative to the 640x360 extraction resolution
      const scaleX = displayWidth / 640;
      const scaleY = displayHeight / 360;

      if (activeDetections) {
          // ── Face Detections (Track 1) ──────────────────────────────────
          const faces = activeDetections.faces || [];
          faces.forEach((face: any) => {
            const [x1, y1, x2, y2] = face.bbox;
            const x = offsetX + x1 * scaleX;
            const y = offsetY + y1 * scaleY;
            const w = (x2 - x1) * scaleX;
            const h = (y2 - y1) * scaleY;
            const color = "#06b6d4"; // Cyan — distinct from persons (green)

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            ctx.fillStyle = color;
            ctx.font = "9px monospace";
            const conf = Math.round(face.confidence * 100);
            const labelText = `Face ${conf}%`;
            const tw = ctx.measureText(labelText).width;
            ctx.fillRect(x - 1, y - 12, tw + 6, 12);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(labelText, x + 2, y - 3);
          });

          // ── General Objects (Track 4) ─────────────────────────────────
          const objects = activeDetections.objects || [];
          objects.forEach((obj: any) => {
            const [x1, y1, x2, y2] = obj.bbox;
            const x = offsetX + x1 * scaleX;
            const y = offsetY + y1 * scaleY;
            const w = (x2 - x1) * scaleX;
            const h = (y2 - y1) * scaleY;
            // Security-relevant → amber; everything else → slate-blue
            const color = obj.is_security_relevant ? "#f59e0b" : "#6366f1";

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]); // dashed to distinguish from solid person boxes
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            // Label badge
            const conf = Math.round(obj.confidence * 100);
            const labelText = `${obj.label} ${conf}%`;
            ctx.font = "9px monospace";
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillStyle = color;
            ctx.fillRect(x - 1, y - 12, textWidth + 6, 12);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(labelText, x + 2, y - 3);
          });

          // ── Tracked Persons (Track 2) ─────────────────────────────────
        const persons = activeDetections.tracked_persons || [];
        persons.forEach((person: any) => {
          const [x1, y1, x2, y2] = person.bbox;
          const x = offsetX + x1 * scaleX;
          const y = offsetY + y1 * scaleY;
          const w = (x2 - x1) * scaleX;
          const h = (y2 - y1) * scaleY;
          const color = "#10b981"; // Emerald green

          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);

          // Corner brackets
          const cornerLen = Math.min(w, h) * 0.15;
          ctx.fillStyle = color;
          ctx.fillRect(x - 1, y - 1, cornerLen, 2.5);
          ctx.fillRect(x - 1, y - 1, 2.5, cornerLen);
          ctx.fillRect(x + w - cornerLen + 1, y - 1, cornerLen, 2.5);
          ctx.fillRect(x + w - 1.5, y - 1, 2.5, cornerLen);
          ctx.fillRect(x - 1, y + h - 1.5, cornerLen, 2.5);
          ctx.fillRect(x - 1, y + h - cornerLen + 1, 2.5, cornerLen);
          ctx.fillRect(x + w - cornerLen + 1, y + h - 1.5, cornerLen, 2.5);
          ctx.fillRect(x + w - 1.5, y + h - cornerLen + 1, 2.5, cornerLen);

          // Text label
          ctx.fillStyle = color;
          ctx.font = "9px monospace";
          const labelText = `Person #${person.track_id} ${(person.confidence * 100).toFixed(0)}%`;
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillRect(x - 1, y - 12, textWidth + 6, 12);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(labelText, x + 2, y - 3);
        });

        // ── Fire Detections (Track 3) ─────────────────────────────────
        const fireDetections = activeDetections.fire_detections || [];
        fireDetections.forEach((fire: any) => {
          const [x1, y1, x2, y2] = fire.bbox;
          const x = offsetX + x1 * scaleX;
          const y = offsetY + y1 * scaleY;
          const w = (x2 - x1) * scaleX;
          const h = (y2 - y1) * scaleY;
          const color = "#ef4444"; // Red

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          const cornerLen = Math.min(w, h) * 0.15;
          ctx.fillStyle = color;
          ctx.fillRect(x - 1, y - 1, cornerLen, 2.5);
          ctx.fillRect(x - 1, y - 1, 2.5, cornerLen);
          ctx.fillRect(x + w - cornerLen + 1, y - 1, cornerLen, 2.5);
          ctx.fillRect(x + w - 1.5, y - 1, 2.5, cornerLen);
          ctx.fillRect(x - 1, y + h - 1.5, cornerLen, 2.5);
          ctx.fillRect(x - 1, y + h - cornerLen + 1, 2.5, cornerLen);
          ctx.fillRect(x + w - cornerLen + 1, y + h - 1.5, cornerLen, 2.5);
          ctx.fillRect(x + w - 1.5, y + h - cornerLen + 1, 2.5, cornerLen);

          ctx.fillStyle = color;
          ctx.font = "bold 9px monospace";
          const labelText = `FIRE ${(fire.confidence * 100).toFixed(0)}%`;
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillRect(x - 1, y - 12, textWidth + 6, 12);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(labelText, x + 2, y - 3);
        });
      }


      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showYoloOverlay, selectedCamera, activeDetections]);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-100px)] overflow-hidden">
      
      {/* Top Navigation Ops Bar */}
      <div className="flex justify-between items-center bg-[#0b0c10]/40 border border-slate-800/80 px-4 py-2.5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/15">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Live Surveillance Operations</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
              <span className="text-[10px] text-slate-400 font-semibold">
                {isConnected ? "Event Stream Connected" : "Stream Offline (Reconnecting)"}
              </span>
            </div>
          </div>
        </div>

        {/* Control Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Analysis Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
            {(["full", "face", "person", "fire", "objects"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setAnalysisMode(m);
                  setActiveDetections(null);
                  addTerminalLog(`[MODE] Analysis switched to: ${m.toUpperCase()}`);
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold capitalize transition-all ${
                  analysisMode === m
                    ? "bg-rose-500 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                title={`Run ${m} detection only`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* YOLO Overlay Toggle Button */}
          <button 
            onClick={() => {
              setShowYoloOverlay(!showYoloOverlay);
              addTerminalLog(`YOLO BBoxes Overlay: ${!showYoloOverlay ? "ENABLED" : "DISABLED"}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
              showYoloOverlay 
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15" 
                : "bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-200"
            }`}
            title="Toggle YOLO Bounding Boxes Overlay"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>YOLO Boxes</span>
          </button>

          {/* Mute Synth Button */}
          <button 
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-1.5 rounded-lg border transition-all ${
              isAudioMuted 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title={isAudioMuted ? "Unmute security synth" : "Mute security synth"}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="hidden sm:flex items-center gap-4 text-xs font-bold">
            <span className="text-slate-500">
              Active Feeds: <span className="text-slate-200">{cameras.filter(c => c.is_active).length}</span>
            </span>
            <span className="text-slate-500">
              Incoming Alerts: <span className="text-slate-200">{events.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-0">
        
        {/* Column 1: Devices Rail Sidebar */}
        <div className="xl:col-span-1 bg-[#0b0c10]/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-0">
          <div className="pb-3 border-b border-slate-850">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-500" /> Active Video Feeds
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
            {isLoading ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-12 w-full rounded-xl bg-slate-900/50 animate-pulse border border-slate-800/60" />
              ))
            ) : cameras.length === 0 ? (
              <div className="text-center py-8">
                <CameraOff className="w-7 h-7 text-slate-700 mx-auto mb-2" />
                <span className="text-xs text-slate-500 font-semibold block">No cameras added</span>
                <Link 
                  href="/admin/devices"
                  className="text-[10px] font-bold text-rose-500 hover:underline mt-2 block"
                >
                  Go to Cameras page
                </Link>
              </div>
            ) : (
              cameras.map((camera) => {
                const isSelected = selectedCamera?.id === camera.id;
                const isFeedActive = camera.is_active && camera.active_feed;
                return (
                  <div
                    key={camera.id}
                    onClick={() => {
                      setSelectedCamera(camera);
                      addTerminalLog(`Focusing stream: ${camera.name}`);
                    }}
                    className={`group w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected 
                        ? "bg-rose-500/5 border-rose-500/30 shadow-md shadow-rose-900/5" 
                        : "bg-slate-900/10 border-slate-850 hover:bg-slate-900/30 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-rose-500/10 text-rose-400" : "bg-slate-900 text-slate-400 group-hover:text-slate-200"}`}>
                        <CameraIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-slate-100" : "text-slate-300 group-hover:text-slate-200"}`}>
                          {camera.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{camera.location || "General"}</p>
                      </div>
                    </div>

                    {/* Status dot */}
                    <div className="flex items-center pl-2 flex-shrink-0">
                      {isFeedActive ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      ) : camera.is_active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2 & 3: Active Viewport & Analytics Console */}
        <div className="xl:col-span-2 flex flex-col gap-6 min-h-0">
          
          {/* Main player viewport */}
          <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-2xl relative overflow-hidden flex items-center justify-center min-h-[300px]">
            {selectedCamera?.active_feed?.file_path ? (
              <div 
                ref={viewportRef}
                className={`relative w-full h-full flex items-center justify-center overflow-hidden ${zoom === 1 ? 'cursor-zoom-in' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div 
                  className="relative w-full h-full flex items-center justify-center transition-transform duration-75 origin-center"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  <video
                    ref={videoRef}
                    src={`${API_BASE_URL}/static/${selectedCamera.active_feed.file_path}`}
                    crossOrigin="anonymous"
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  {/* Drag/Pan Overlay to catch mouse events smoothly when zoomed */}
                  {zoom > 1 && (
                    <div className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing" />
                  )}
                  {showYoloOverlay && (
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
                    />
                  )}
                </div>

                {/* Overlay Controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
                  <div className="bg-black/60 backdrop-blur rounded-lg border border-white/10 p-1 flex items-center gap-1 text-slate-300">
                    <button 
                      onClick={togglePause}
                      className="p-2 hover:bg-white/10 rounded-md transition-colors"
                      title={isPaused ? "Play" : "Pause"}
                    >
                      {isPaused ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      )}
                    </button>
                    
                    <div className="w-px h-4 bg-white/20 mx-1"></div>
                    
                    <button 
                      onClick={() => { setZoom(1); setPan({x:0, y:0}); }}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${zoom > 1 ? 'hover:bg-white/10 text-emerald-400' : 'text-slate-500 cursor-default'}`}
                      disabled={zoom === 1}
                      title="Reset Zoom"
                    >
                      {zoom.toFixed(1)}x
                    </button>

                    {isPaused && (
                      <>
                        <div className="w-px h-4 bg-white/20 mx-1"></div>
                        <button
                          onClick={performManualAnalysis}
                          disabled={isAnalyzing}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          {isAnalyzing ? "Analyzing..." : "Analyze Frame"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {manualAnalysisResult && isPaused && (
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur rounded-lg border border-white/10 p-3 max-w-xs z-20 shadow-xl overflow-hidden pointer-events-none">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <span className="text-xs font-bold text-slate-200">Manual Analysis</span>
                    </div>
                    <div className="space-y-1 text-[10px] text-slate-300">
                      <div className="flex justify-between gap-4"><span>Faces:</span> <span className="font-bold text-cyan-400">{manualAnalysisResult.ml_raw_metrics?.faces_count || 0}</span></div>
                      <div className="flex justify-between gap-4"><span>Persons:</span> <span className="font-bold text-emerald-400">{manualAnalysisResult.ml_raw_metrics?.persons_count || 0}</span></div>
                      <div className="flex justify-between gap-4"><span>Objects:</span> <span className="font-bold text-indigo-400">{manualAnalysisResult.ml_raw_metrics?.object_count || 0}</span></div>
                      <div className="flex justify-between gap-4"><span>Fire/Smoke:</span> <span className="font-bold text-rose-400">{manualAnalysisResult.ml_raw_metrics?.fire_detected ? "Yes" : "No"}</span></div>
                      <div className="flex justify-between gap-4"><span>Threat Score:</span> <span className="font-bold text-amber-400">{(manualAnalysisResult.threat_score || 0).toFixed(2)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedCamera ? (
              <div className="text-center p-6 text-slate-500 space-y-2">
                <Video className="w-12 h-12 mx-auto text-slate-700 animate-pulse" />
                <p className="text-xs font-bold">Simulated stream compiling</p>
                <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                  The camera feed file has been registered. The analytics pipeline is bootstrapping the inference worker pool.
                </p>
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500 space-y-2">
                <Tv className="w-12 h-12 mx-auto text-slate-700" />
                <p className="text-xs font-bold">Select camera feed to inspect</p>
              </div>
            )}

            <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-rose-400 border border-white/5 uppercase tracking-wider">
              {selectedCamera ? selectedCamera.name : "Operations Center"}
            </div>
          </div>

          {/* Real-time Metadata Console Terminal */}
          <div className="h-44 bg-[#050608] border border-slate-800/80 rounded-2xl p-4 flex flex-col font-mono text-xs select-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900 mb-2">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TerminalIcon className="w-3.5 h-3.5" /> Ops Console Terminal
              </span>
              <span className="text-[9px] text-slate-600 font-bold">LIVE FRAME FEED</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 text-slate-400 pr-1 text-[11px] leading-relaxed scrollbar-thin">
              {terminalLogs.length === 0 ? (
                <div className="text-slate-600 italic">[System initialized. Awaiting event ingestion...]</div>
              ) : (
                terminalLogs.map((log, index) => {
                  let colorClass = "text-slate-400";
                  if (log.includes("[ALERT]")) colorClass = "text-rose-400 font-semibold";
                  else if (log.includes("Focusing")) colorClass = "text-indigo-400";
                  
                  return (
                    <div key={index} className={colorClass}>
                      {log}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

        {/* Column 4: Running Threat Alert Feed */}
        <div className="xl:col-span-1 bg-[#0b0c10]/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-0">
          <div className="pb-3 border-b border-slate-850 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Active Alert Stream
            </span>
            {events.length > 0 && (
              <button 
                onClick={() => setEvents([])}
                className="text-[9px] font-bold text-slate-500 hover:text-rose-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Running list */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 min-h-0">
            {events.length === 0 ? (
              <div className="text-center py-16 text-slate-600 space-y-1.5">
                <CheckCircle className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs font-bold text-slate-500">Operations Normal</p>
                <p className="text-[10px] text-slate-600">No threat signatures currently detected.</p>
              </div>
            ) : (
              events.map((evt) => {
                const severity = getSeverity(evt.event_type);
                const originatingCam = cameras.find(c => c.id === evt.camera_id);
                const isSelected = selectedEvent?.id === evt.id;

                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(isSelected ? null : evt);
                      if (originatingCam) {
                        setSelectedCamera(originatingCam);
                      }
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-slate-900 border-slate-700"
                        : severity === "high" 
                        ? "bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10" 
                        : severity === "caution" 
                        ? "bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10"
                        : "bg-slate-900/20 border-slate-850 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        severity === "high" 
                          ? "bg-rose-600/10 text-rose-400 border border-rose-500/20" 
                          : severity === "caution" 
                          ? "bg-amber-600/10 text-amber-400 border border-amber-500/20" 
                          : "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {severity}
                      </span>
                      <span className="text-[9px] text-slate-500 font-medium">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-200 mt-2 capitalize">
                      {evt.event_type.replace("_", " ")}
                    </p>

                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                      Cam: <span className="text-slate-400">{originatingCam?.name || "Unknown"}</span>
                    </p>

                    {/* Expand details inside Card */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-[10px] text-slate-400 font-mono">
                        <div>
                          Confidence: <span className="text-slate-200 font-bold">{Math.round(evt.confidence_score * 100)}%</span>
                        </div>
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <div className="bg-black/40 rounded p-1.5 mt-1 border border-slate-850 overflow-x-auto text-[9px]">
                            {JSON.stringify(evt.metadata, null, 2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
