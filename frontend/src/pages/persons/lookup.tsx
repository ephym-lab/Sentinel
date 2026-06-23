import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  UserSearch, 
  UserPlus, 
  Search, 
  MapPin, 
  Clock, 
  Upload, 
  Check, 
  AlertCircle,
  Eye,
  Camera,
  Activity,
  Award
} from "lucide-react";
import api, { API_BASE_URL } from "src/lib/api";
import { useAuthStore } from "src/store/authStore";

interface Person {
  id: string;
  full_name: string;
  person_type: string;
  identifier: string;
  class_grade: string | null;
  dormitory: string | null;
  status: string;
  photo_path: string | null;
  last_seen_at: string | null;
}

export default function PersonLookupPage() {
  const { tenant } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Registration Form States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [personType, setPersonType] = useState("student");
  const [classGrade, setClassGrade] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // File Upload states for Photo enrollment
  const [enrollPersonId, setEnrollPersonId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Identification Tool states
  const [searchPhoto, setSearchPhoto] = useState<File | null>(null);
  const [searchPhotoUrl, setSearchPhotoUrl] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  // Fetch roster listing
  const { data: roster = [], isLoading, isError, refetch } = useQuery<Person[]>({
    queryKey: ["roster"],
    queryFn: async () => {
      const response = await api.get("/persons/");
      return response.data;
    },
  });

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !identifier.trim()) return;

    setIsSubmitting(true);
    setEnrollError(null);

    try {
      const response = await api.post("/persons/", {
        full_name: fullName,
        identifier,
        person_type: personType,
        class_grade: classGrade || undefined,
        status: "active",
      });

      // Move to photo enrollment step
      setEnrollPersonId(response.data.id);
    } catch (err: any) {
      setEnrollError(err.response?.data?.detail || "Failed to create person record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!enrollPersonId || !selectedPhoto) return;
    setIsUploadingPhoto(true);
    setEnrollError(null);

    const formData = new FormData();
    formData.append("file", selectedPhoto);

    try {
      await api.post(`/persons/${enrollPersonId}/face`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Reset enrollment states
      setIsEnrollModalOpen(false);
      setEnrollPersonId(null);
      setSelectedPhoto(null);
      setFullName("");
      setIdentifier("");
      setClassGrade("");
      refetch();
    } catch (err: any) {
      setEnrollError(err.response?.data?.detail || "Failed to upload enrollment photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Trigger Face Identification comparison
  const handleIdentifySearch = async (file: File) => {
    setSearchPhoto(file);
    const objectUrl = URL.createObjectURL(file);
    setSearchPhotoUrl(objectUrl);
    setIsIdentifying(true);
    setMatchResult(null);
    setIdentifyError(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:image/jpeg;base64, prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data || result);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      // Hit /identify with actual base64 image data
      const response = await api.post("/persons/identify", {
        image_b64: base64,
      });
      setMatchResult(response.data);
    } catch (err: any) {
      console.error("Identification failure:", err);
      setIdentifyError(err.response?.data?.detail || "Failed to identify person from photo.");
    } finally {
      setIsIdentifying(false);
    }
  };

  const filteredRoster = roster.filter((p) =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.identifier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#07080a] p-6 overflow-hidden">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <UserSearch className="w-5.5 h-5.5 text-rose-500" /> Personnel Directory & Search
          </h1>
          <p className="text-xs text-slate-500 mt-1">Enroll staff, upload bios, and perform AI facial vector search lookups.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search roster..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c0e15] border border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-350 focus:outline-none focus:border-rose-500/50"
            />
          </div>

          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Enroll Person
          </button>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 overflow-hidden">
        
        {/* Left Column: Enrollment Directory (col-span-8) */}
        <div className="lg:col-span-8 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-hidden">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4">
            Registered Personnel
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Loading roster directory...
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No personnel records registered in database yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredRoster.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 bg-[#07080a]/60 border border-slate-900 hover:border-slate-800 rounded-xl flex items-center gap-4 transition-all"
                  >
                    {/* Photo Placeholder */}
                    <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {person.photo_path ? (
                        <img 
                          src={`${API_BASE_URL}/static/${person.photo_path}`} 
                          alt={person.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-4.5 h-4.5 text-slate-600" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">{person.full_name}</span>
                        <span className="text-[9px] text-slate-500 font-semibold px-1.5 py-0.2 bg-slate-900 border border-slate-850 rounded capitalize">
                          {person.person_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate">ID: {person.identifier}</span>
                        {person.class_grade && <span>Class: {person.class_grade}</span>}
                      </div>

                      {person.last_seen_at && (
                        <div className="text-[9px] text-emerald-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Last Seen: {new Date(person.last_seen_at).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Face Identification Upload Tool (col-span-4) */}
        <div className="lg:col-span-4 bg-[#0c0e15] border border-slate-900 rounded-2xl p-5 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-rose-500 animate-pulse" /> AI Face Match Lookup
          </h3>

          <div className="space-y-6">
            <input
              type="file"
              id="identify-file-input"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleIdentifySearch(f);
              }}
            />

            {!searchPhoto ? (
              <div
                onClick={() => document.getElementById("identify-file-input")?.click()}
                className="border-2 border-dashed border-slate-850 hover:border-rose-500/50 rounded-xl p-8 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-900/10 transition-all group"
              >
                <Upload className="w-8 h-8 text-slate-600 group-hover:text-rose-500 mx-auto mb-2 transition-colors" />
                <span className="text-xs font-semibold text-slate-300 block mb-1">Upload Face Photo</span>
                <span className="text-[10px] text-slate-500 block">Extracts embedding to query matching profiles</span>
              </div>
            ) : (
              <div className="space-y-4">
                {searchPhotoUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-850 bg-black aspect-square relative w-full max-w-[200px] mx-auto">
                    <img src={searchPhotoUrl} alt="Query Face" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchPhoto(null);
                      setSearchPhotoUrl(null);
                      setMatchResult(null);
                      setIdentifyError(null);
                    }}
                    className="w-full py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all"
                  >
                    Clear Search
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("identify-file-input")?.click()}
                    className="w-full py-2 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Replace Photo
                  </button>
                </div>
              </div>
            )}

            {/* Match Results Display */}
            {isIdentifying && (
              <div className="text-center py-6 text-slate-500 text-xs gap-2 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-slate-800 border-t-rose-500 animate-spin" />
                Querying pgvector search index...
              </div>
            )}

            {identifyError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{identifyError}</span>
              </div>
            )}

            {matchResult && (
              <div className="space-y-4 border-t border-slate-900 pt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Query Results</span>
                
                {matchResult.matched ? (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <Award className="w-4.5 h-4.5" /> Similarity Match Found!
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-850">
                        {matchResult.person.photo_path && (
                          <img 
                            src={`${API_BASE_URL}/static/${matchResult.person.photo_path}`} 
                            alt={matchResult.person.full_name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{matchResult.person.full_name}</h4>
                        <span className="text-[9px] text-slate-450 capitalize">{matchResult.person.person_type} • ID: {matchResult.person.identifier}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Match Confidence: <span className="font-semibold text-emerald-400">{(matchResult.confidence * 100).toFixed(0)}%</span> (Cosine similarity)
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-xl text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-bold">
                      <AlertCircle className="w-4.5 h-4.5" /> No Profiles Match
                    </div>
                    <p className="text-[10px] text-slate-500">No profile matches found above the 0.75 cosine similarity threshold.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Roster Enrollment Modal */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0c0e15] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-rose-500" /> Enroll New Person
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter personnel bio details and then upload their profile face photo.
            </p>

            {!enrollPersonId ? (
              <form onSubmit={handleCreatePerson} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Personnel Identifier / Card ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CARD-9831"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Roster Classification</label>
                  <select
                    value={personType}
                    onChange={(e) => setPersonType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="employee">Employee</option>
                    <option value="staff">General Staff</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Class Grade / Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 11-A, Operations"
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {enrollError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {enrollError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEnrollModalOpen(false);
                      setEnrollError(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
                  >
                    {isSubmitting ? "Creating Record..." : "Next: Enrol Face"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <input
                  type="file"
                  id="enroll-photo-input"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedPhoto(f);
                  }}
                />

                {!selectedPhoto ? (
                  <div
                    onClick={() => document.getElementById("enroll-photo-input")?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-rose-500/50 rounded-xl p-8 text-center cursor-pointer bg-slate-950/65 hover:bg-slate-900/10 transition-all group"
                  >
                    <Upload className="w-8 h-8 text-slate-600 group-hover:text-rose-500 mx-auto mb-2 transition-colors" />
                    <span className="text-xs font-semibold text-slate-300 block mb-1">Select Face Image File</span>
                    <span className="text-[10px] text-slate-500 block">JPEG or PNG files (Max size 5MB)</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <span className="truncate max-w-[240px] font-medium text-slate-300">{selectedPhoto.name}</span>
                      <span>{(selectedPhoto.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(null)}
                        className="flex-1 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all"
                      >
                        Clear Selection
                      </button>
                      <button
                        type="button"
                        onClick={handlePhotoUpload}
                        disabled={isUploadingPhoto}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        {isUploadingPhoto ? "Uploading & Indexing..." : "Upload & Save"}
                      </button>
                    </div>
                  </div>
                )}

                {enrollError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {enrollError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
