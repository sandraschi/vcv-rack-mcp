import React, { useState, useEffect } from "react";
import { 
  Music, 
  Folder, 
  BookOpen, 
  Cpu, 
  Activity, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Search, 
  FileText, 
  Sliders, 
  SlidersHorizontal,
  ExternalLink,
  Upload,
  Clock,
  Sparkles
} from "lucide-react";

// Page types
type Page = "depot" | "patch-detail" | "catalog" | "modules" | "jobs";

// Interface definitions
interface Patch {
  id: string;
  name: string;
  slug: string;
  persona: string;
  description: string;
  version: number;
  parent_version?: string;
  modules_json: any[] | string;
  cables_json: any[] | string;
  sidecar_md?: string;
  osc_address_map?: any;
  validation_status: string;
  created_at: string;
  updated_at: string;
}

interface Module {
  plugin_slug: string;
  model_slug: string;
  display_name: string;
  brand?: string;
  function_tags: string[];
  persona_tags: string[];
  params?: any[];
  inputs?: any[];
  outputs?: any[];
  notes?: string;
}

interface Job {
  id: string;
  brief: string;
  persona?: string;
  iterations: number;
  max_iterations: number;
  status: string;
  result_patch_id?: string;
  error?: string;
  created_at: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("depot");
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  
  // Status info
  const [status, setStatus] = useState<any>(null);
  
  // Data lists
  const [patches, setPatches] = useState<Patch[]>([]);
  const [catalog, setCatalog] = useState<Module[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  // Detail views
  const [activePatch, setActivePatch] = useState<Patch | null>(null);
  
  // Search / filter states
  const [patchFilter, setPatchFilter] = useState<string>("all");
  const [catalogQuery, setCatalogQuery] = useState<string>("");
  const [catalogTag, setCatalogTag] = useState<string>("");
  const [catalogPersona, setCatalogPersona] = useState<string>("");
  
  // Forms states
  const [newPatchName, setNewPatchName] = useState("");
  const [newPatchDesc, setNewPatchDesc] = useState("");
  const [newPatchPersona, setNewPatchPersona] = useState("generative");
  const [newPatchHints, setNewPatchHints] = useState("");
  const [isCreatingPatch, setIsCreatingPatch] = useState(false);
  
  const [newJobBrief, setNewJobBrief] = useState("");
  const [newJobPersona, setNewJobPersona] = useState("generative");
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  
  const [sideloadUrl, setSideloadUrl] = useState("");
  const [isSideloading, setIsSideloading] = useState(false);
  const [sideloadConfirm, setSideloadConfirm] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{message: string, type: "success" | "error"} | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch status & basic data
  const fetchData = async () => {
    try {
      const resStatus = await fetch("/api/status");
      const dataStatus = await resStatus.json();
      if (dataStatus.success) setStatus(dataStatus);
      
      const resPatches = await fetch("/api/patches");
      const dataPatches = await resPatches.json();
      if (dataPatches.success) setPatches(dataPatches.patches);

      const resCatalog = await fetch("/api/catalog");
      const dataCatalog = await resCatalog.json();
      if (dataCatalog.success) setCatalog(dataCatalog.modules);

      const resJobs = await fetch("/api/jobs");
      const dataJobs = await resJobs.json();
      if (dataJobs.success) setJobs(dataJobs.jobs);
    } catch (e) {
      console.error("Error fetching data", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Fetch single patch detail
  useEffect(() => {
    if (selectedPatchId) {
      fetch(`/api/patches/${selectedPatchId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setActivePatch(data.patch);
          }
        })
        .catch(err => console.error("Error fetching patch", err));
    } else {
      setActivePatch(null);
    }
  }, [selectedPatchId]);

  // Open patch in VCV Rack
  const handleOpenInRack = async (id: string) => {
    try {
      const res = await fetch(`/api/patches/${id}/open`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showNotification("VCV Rack triggered successfully!");
      } else {
        showNotification(data.error || "Failed to open patch in VCV Rack.", "error");
      }
    } catch (e) {
      showNotification("Error connecting to server.", "error");
    }
  };

  // Create new patch
  const handleCreatePatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatchName) return;
    setIsCreatingPatch(true);
    try {
      const res = await fetch("/api/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPatchName,
          description: newPatchDesc,
          persona: newPatchPersona,
          module_hints: newPatchHints
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Patch "${newPatchName}" created successfully!`);
        setNewPatchName("");
        setNewPatchDesc("");
        setNewPatchHints("");
        fetchData();
        setSelectedPatchId(data.patch_id);
        setCurrentPage("patch-detail");
      } else {
        showNotification(data.error || "Creation failed", "error");
      }
    } catch (err) {
      showNotification("Error communicating with server", "error");
    } finally {
      setIsCreatingPatch(false);
    }
  };

  // Create agentic job
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobBrief) return;
    setIsCreatingJob(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: newJobBrief,
          persona: newJobPersona
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification("Agentic workflow started in background!");
        setNewJobBrief("");
        fetchData();
      } else {
        showNotification(data.error || "Failed to start job", "error");
      }
    } catch (err) {
      showNotification("Error starting job", "error");
    } finally {
      setIsCreatingJob(false);
    }
  };

  // Parse modules and cables safely
  const parseJSON = (field: any) => {
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch (e) {
        return [];
      }
    }
    return field || [];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border transition-all duration-300 transform translate-y-0 ${
          notification.type === "success" 
            ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50" 
            : "bg-rose-950/90 text-rose-300 border-rose-500/50"
        }`}>
          {notification.type === "success" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">VCV Rack MCP</h1>
            <p className="text-xs text-slate-500">Autonomous Authorship Console</p>
          </div>
        </div>

        {/* Global status summary */}
        {status && (
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Rack: <strong className="text-slate-200">{status.rack_installed ? "Found" : "Not Found"}</strong></span>
            </div>
            <div className="border-l border-slate-800 h-4"></div>
            <div>
              <span>Catalog: <strong className="text-slate-200">{status.catalog_size} modules</strong></span>
            </div>
            <div className="border-l border-slate-800 h-4"></div>
            <div>
              <span>Patches: <strong className="text-slate-200">{status.recent_patches} saved</strong></span>
            </div>
          </div>
        )}
      </header>

      {/* Main workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-slate-900 bg-slate-950/50 p-4 flex flex-col justify-between">
          <nav className="space-y-1">
            <button 
              onClick={() => setCurrentPage("depot")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === "depot" || currentPage === "patch-detail"
                  ? "bg-slate-900 text-violet-400" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Patch Depot</span>
            </button>
            <button 
              onClick={() => setCurrentPage("catalog")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === "catalog"
                  ? "bg-slate-900 text-violet-400" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Modules Catalog</span>
            </button>
            <button 
              onClick={() => setCurrentPage("modules")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === "modules"
                  ? "bg-slate-900 text-violet-400" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>VCV Library</span>
            </button>
            <button 
              onClick={() => setCurrentPage("jobs")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === "jobs"
                  ? "bg-slate-900 text-violet-400" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Agentic Jobs</span>
            </button>
          </nav>

          {/* Footer branding */}
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-900 text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5 mb-1 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              <span className="font-semibold">Antigravity Engine</span>
            </div>
            <span>Ready for VCV Rack v2.4.x</span>
          </div>
        </aside>

        {/* Content canvas */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* ========================================== */}
          {/* PAGE: DEPOT                                */}
          {/* ========================================== */}
          {currentPage === "depot" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Patch Depot</h2>
                  <p className="text-sm text-slate-400">Explore, open, and generate VCV Rack synthesizer patches.</p>
                </div>
                
                {/* Filters */}
                <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button 
                    onClick={() => setPatchFilter("all")} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${patchFilter === "all" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setPatchFilter("generative")} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${patchFilter === "generative" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Generative
                  </button>
                  <button 
                    onClick={() => setPatchFilter("performance")} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${patchFilter === "performance" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Performance
                  </button>
                </div>
              </div>

              {/* Grid split: Patches list vs Quick creation wizard */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Patches list */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Saved Patches ({patches.filter(p => patchFilter === "all" || p.persona === patchFilter).length})</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patches
                      .filter(p => patchFilter === "all" || p.persona === patchFilter)
                      .map(p => {
                        const mCount = parseJSON(p.modules_json).length;
                        const cCount = parseJSON(p.cables_json).length;
                        return (
                          <div 
                            key={p.id} 
                            className="glass rounded-xl p-5 hover:border-slate-800 transition-all flex flex-col justify-between h-48 cursor-pointer relative group overflow-hidden"
                            onClick={() => {
                              setSelectedPatchId(p.id);
                              setCurrentPage("patch-detail");
                            }}
                          >
                            {/* Decorative gradient overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                            
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-bold text-slate-100 group-hover:text-violet-400 transition-colors truncate">{p.name}</h4>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                  p.persona === "generative" ? "bg-violet-950 text-violet-300 border border-violet-800/30" : "bg-emerald-950 text-emerald-300 border border-emerald-800/30"
                                }`}>
                                  {p.persona}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-2 line-clamp-2">{p.description || "No description provided."}</p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-900/50 flex justify-between items-center text-[10px] text-slate-500">
                              <div className="flex gap-3">
                                <span>{mCount} Modules</span>
                                <span>{cCount} Cables</span>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInRack(p.id);
                                  }}
                                  className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                                  title="Open in VCV Rack"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Quick creation sidebar */}
                <div className="glass rounded-2xl p-6 h-fit border border-slate-900">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-violet-500" />
                    <h3 className="font-bold text-slate-200">Compose Patch</h3>
                  </div>
                  
                  <form onSubmit={handleCreatePatch} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Patch Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Ambient Reverb swell" 
                        value={newPatchName}
                        onChange={e => setNewPatchName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Brief Description</label>
                      <textarea 
                        placeholder="How it behaves or tone description..." 
                        rows={2}
                        value={newPatchDesc}
                        onChange={e => setNewPatchDesc(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Synthesizer Persona</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPatchPersona("generative")}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                            newPatchPersona === "generative" 
                              ? "bg-violet-950/50 border-violet-500 text-violet-300 shadow-md shadow-violet-500/5" 
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          Generative
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPatchPersona("performance")}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                            newPatchPersona === "performance" 
                              ? "bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/5" 
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          Performance
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Module Hints / Brief (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Bogaudio LFO, Valley Reverb" 
                        value={newPatchHints}
                        onChange={e => setNewPatchHints(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isCreatingPatch}
                      className="w-full mt-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingPatch ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating Patch...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Generate declarative patch</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE: PATCH DETAIL                         */}
          {/* ========================================== */}
          {currentPage === "patch-detail" && activePatch && (
            <div className="space-y-8 max-w-6xl mx-auto">
              {/* Back to list */}
              <button 
                onClick={() => {
                  setSelectedPatchId(null);
                  setCurrentPage("depot");
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                ← Back to Depot
              </button>

              {/* Title panel */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">{activePatch.name}</h2>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                      activePatch.persona === "generative" ? "bg-violet-950 text-violet-300 border border-violet-800/30" : "bg-emerald-950 text-emerald-300 border border-emerald-800/30"
                    }`}>
                      {activePatch.persona}
                    </span>
                    <span className="text-xs text-slate-500">v{activePatch.version}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{activePatch.description}</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenInRack(activePatch.id)}
                    className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Open in Rack</span>
                  </button>
                </div>
              </div>

              {/* Validation panel */}
              <div className={`glass rounded-xl p-4 border flex items-center justify-between ${
                activePatch.validation_status === "passed"
                  ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400"
                  : "border-slate-800 bg-slate-900/50 text-slate-300"
              }`}>
                <div className="flex items-center gap-3">
                  {activePatch.validation_status === "passed" ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  )}
                  <div>
                    <h4 className="font-semibold text-sm">Validation Status: {activePatch.validation_status}</h4>
                    <p className="text-xs text-slate-500">Checked against catalog modules, installed plugins, and cable polarities.</p>
                  </div>
                </div>
              </div>

              {/* Grid sections */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Modules list (2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass rounded-2xl p-6 border border-slate-900">
                    <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-violet-400" />
                      <span>Modules Layout ({parseJSON(activePatch.modules_json).length})</span>
                    </h3>
                    
                    <div className="space-y-3">
                      {parseJSON(activePatch.modules_json).map((m: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/50 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-mono block">ID {m.id}</span>
                            <span className="font-bold text-slate-200">{m.model}</span>
                            <span className="text-xs text-slate-400 ml-2">by {m.plugin}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {m.params && Object.keys(m.params).length > 0 && (
                              <span>{Object.keys(m.params).length} custom parameters</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cables routing */}
                  <div className="glass rounded-2xl p-6 border border-slate-900">
                    <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-violet-400" />
                      <span>Signal Cables ({parseJSON(activePatch.cables_json).length})</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      {parseJSON(activePatch.cables_json).map((c: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 flex items-center justify-between">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">From Out</span>
                            <strong className="text-cyan-400">Mod {c.output_module_id}</strong>
                            <span className="text-slate-300 block">Port {c.output_port_id}</span>
                          </div>
                          <div className="text-slate-500">➔</div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">To In</span>
                            <strong className="text-violet-400">Mod {c.input_module_id}</strong>
                            <span className="text-slate-300 block">Port {c.input_port_id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidecar instructions & OSC Map (1 col) */}
                <div className="space-y-6">
                  {/* OSC address map */}
                  <div className="glass rounded-2xl p-6 border border-slate-900">
                    <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5 text-violet-400" />
                      <span>OSC Address Map</span>
                    </h3>
                    
                    {activePatch.osc_address_map && Object.keys(parseJSON(activePatch.osc_address_map)).length > 0 ? (
                      <div className="space-y-3 font-mono text-xs">
                        {Object.entries(parseJSON(activePatch.osc_address_map)).map(([addr, mapping]: [string, any]) => (
                          <div key={addr} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/40">
                            <span className="text-cyan-400 block break-all font-semibold">{addr}</span>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                              <span>Module {mapping.module_id}</span>
                              <span>Param {mapping.param_id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No OSC address bindings generated for this patch.</p>
                    )}
                  </div>

                  {/* Sidecar instructions */}
                  {activePatch.sidecar_md && (
                    <div className="glass rounded-2xl p-6 border border-slate-900">
                      <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-violet-400" />
                        <span>Performance notes</span>
                      </h3>
                      <div className="prose prose-invert prose-xs text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/40 p-4 rounded-xl border border-slate-900">
                        {activePatch.sidecar_md}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE: CATALOG                              */}
          {/* ========================================== */}
          {currentPage === "catalog" && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Modules Catalog</h2>
                  <p className="text-sm text-slate-400">Curated set of 49 free VCV community library modules split 50/50 generative/performance.</p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap gap-4 items-center bg-slate-900 p-4 rounded-xl border border-slate-800 justify-between">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 w-72">
                  <Search className="w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search by brand, slug, name..." 
                    value={catalogQuery}
                    onChange={e => setCatalogQuery(e.target.value)}
                    className="bg-transparent text-sm w-full focus:outline-none text-slate-200"
                  />
                </div>

                <div className="flex gap-4">
                  <select 
                    value={catalogTag} 
                    onChange={e => setCatalogTag(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none"
                  >
                    <option value="">All functions</option>
                    <option value="osc">Oscillator</option>
                    <option value="filter">Filter</option>
                    <option value="amp">Amplifier</option>
                    <option value="envelope">Envelope</option>
                    <option value="random">Random/Clock</option>
                    <option value="sequencer">Sequencer</option>
                    <option value="fx">Effects</option>
                    <option value="mixer">Mixer</option>
                  </select>

                  <select 
                    value={catalogPersona} 
                    onChange={e => setCatalogPersona(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none"
                  >
                    <option value="">All personas</option>
                    <option value="generative">Generative</option>
                    <option value="performance">Performance</option>
                  </select>
                </div>
              </div>

              {/* Grid of modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalog
                  .filter(m => {
                    const matchesQuery = !catalogQuery || m.display_name.toLowerCase().includes(catalogQuery.toLowerCase()) || (m.brand && m.brand.toLowerCase().includes(catalogQuery.toLowerCase())) || m.model_slug.toLowerCase().includes(catalogQuery.toLowerCase());
                    const matchesTag = !catalogTag || m.function_tags.includes(catalogTag);
                    const matchesPersona = !catalogPersona || m.persona_tags.includes(catalogPersona);
                    return matchesQuery && matchesTag && matchesPersona;
                  })
                  .map((m, idx) => (
                    <div key={idx} className="glass rounded-xl p-5 border border-slate-900 flex flex-col justify-between hover:border-slate-800 transition-all h-60">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] text-violet-400 font-semibold tracking-wide uppercase">{m.brand || "VCV"}</span>
                            <h4 className="font-bold text-slate-100 mt-0.5">{m.display_name}</h4>
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 font-mono">{m.plugin_slug}</span>
                        </div>
                        
                        <p className="text-xs text-slate-400 mt-3 line-clamp-3">{m.notes || "Free VCV Library module."}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-900/50 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {m.function_tags.map(t => (
                            <span key={t} className="text-[9px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800/40">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Inputs: {m.inputs?.length || 0} | Outputs: {m.outputs?.length || 0}</span>
                          <a 
                            href={`https://library.vcvrack.com/${m.plugin_slug}/${m.model_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                          >
                            <span>Sub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE: MODULES (VCV LIBRARY)                */}
          {/* ========================================== */}
          {currentPage === "modules" && (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">VCV Library & Sideloads</h2>
                <p className="text-sm text-slate-400">Verify installed library packages, log sideloaded plugins, and manage github packages.</p>
              </div>

              {/* Sideload form */}
              <div className="glass rounded-2xl p-6 border border-slate-900">
                <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-violet-400" />
                  <span>Sideload VCV Plugin</span>
                </h3>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!sideloadUrl) return;
                  if (!sideloadConfirm) {
                    setSideloadConfirm(true);
                    return;
                  }
                  setIsSideloading(true);
                  fetch("/api/catalog", { // Uses sideload action
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ operation: "sideload", url: sideloadUrl })
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        showNotification("Sideload successfully registered! Relaunch Rack.");
                        setSideloadUrl("");
                        setSideloadConfirm(false);
                      } else {
                        showNotification(data.error || "Sideload failed", "error");
                      }
                    })
                    .catch(() => showNotification("Network error", "error"))
                    .finally(() => setIsSideloading(false));
                }} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Headless installation of library plugins is not supported by VCV Rack API. However, you can sideload community builds by uploading a <strong>GitHub release .vcvplugin</strong> URL directly to the Rack plugins directory.
                  </p>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Release URL (.vcvplugin)</label>
                    <input 
                      type="url" 
                      placeholder="https://github.com/brand/plugin/releases/download/v1.0.0/plugin-win-x64.vcvplugin" 
                      value={sideloadUrl}
                      onChange={e => setSideloadUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                      required
                    />
                  </div>

                  {sideloadConfirm && (
                    <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg text-xs text-amber-300">
                      <strong>Caution:</strong> Stage library plugins from trusted GitHub repositories only. Installing unverified binaries could compromise your system. Proceed?
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all"
                    >
                      {isSideloading ? "Sideloading..." : sideloadConfirm ? "Confirm & Sideload" : "Sideload Plugin"}
                    </button>
                    {sideloadConfirm && (
                      <button 
                        type="button" 
                        onClick={() => setSideloadConfirm(false)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE: JOBS                                 */}
          {/* ========================================== */}
          {currentPage === "jobs" && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Agentic Workflows</h2>
                  <p className="text-sm text-slate-400">Launch autonomous agent composition runs via the sampling loop.</p>
                </div>
              </div>

              {/* Start new job */}
              <div className="glass rounded-2xl p-6 border border-slate-900">
                <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <span>Start Autonomous Synthesis</span>
                </h3>

                <form onSubmit={handleCreateJob} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Brief Description (Prompt)</label>
                    <textarea 
                      placeholder="e.g. slow ambient drone, two detuned voices, filtered noise swells, big reverb" 
                      rows={3}
                      value={newJobBrief}
                      onChange={e => setNewJobBrief(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Aesthetic Persona</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewJobPersona("generative")}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                          newJobPersona === "generative" 
                            ? "bg-violet-950/50 border-violet-500 text-violet-300 shadow-md shadow-violet-500/5" 
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        Generative
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJobPersona("performance")}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                          newJobPersona === "performance" 
                            ? "bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/5" 
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        Performance
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isCreatingJob}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingJob ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Starting job...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Launch Agentic Loop</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Jobs History list */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Job History</h3>
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="glass rounded-xl p-5 border border-slate-900 flex justify-between items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">ID: {job.id}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            job.persona === "generative" ? "bg-violet-950 text-violet-300 border border-violet-800/30" : "bg-emerald-950 text-emerald-300 border border-emerald-800/30"
                          }`}>
                            {job.persona}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 mt-2">{job.brief}</p>
                        {job.error && (
                          <p className="text-xs text-rose-400 mt-1">Error: {job.error}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 text-right">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          job.status === "complete" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" :
                          job.status === "failed" ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" :
                          "bg-slate-900 text-slate-400 border border-slate-800"
                        }`}>
                          {job.status}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{job.iterations} iterations</span>
                        </div>
                        {job.result_patch_id && (
                          <button 
                            onClick={() => {
                              setSelectedPatchId(job.result_patch_id!);
                              setCurrentPage("patch-detail");
                            }}
                            className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
                          >
                            View Patch →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
