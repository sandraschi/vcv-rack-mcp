import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Cpu,
  FileText,
  LayoutGrid,
  List,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "../store/app";

interface Patch {
  id: string;
  name: string;
  slug: string;
  persona: string;
  description: string;
  version: number;
  modules_json: any[] | string;
  cables_json: any[] | string;
  sidecar_md?: string;
  osc_address_map?: any;
  validation_status: string;
  updated_at?: string;
}

const parseJSON = (field: any) => {
  if (typeof field === "string") {
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  }
  return field || [];
};

const PAGE_SIZE = 20;

export function Depot() {
  const { patchId } = useParams();
  if (patchId) return <PatchDetail patchId={patchId} />;
  return <DepotList />;
}

function DepotList() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [search, setSearch] = useState("");
  const [personaFilter, setPersonaFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("depot_view") as "grid" | "list") || "grid"
  );

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPersona, setNewPersona] = useState("generative");
  const [newHints, setNewHints] = useState("");
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();
  const { showToast, startRack } = useAppStore();

  const load = async () => {
    try {
      const res = await fetch("/api/patches?limit=200");
      const data = await res.json();
      if (data.success) setPatches(data.patches || []);
    } catch {
      // handled globally
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = patches.filter((p) => {
      if (personaFilter !== "all" && p.persona !== personaFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.updated_at || "").localeCompare(a.updated_at || "");
    });
    return list;
  }, [patches, search, personaFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          persona: newPersona,
          module_hints: newHints || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Patch "${newName}" created`, "success");
        setNewName("");
        setNewDesc("");
        setNewHints("");
        navigate(`/depot/${data.patch_id}`);
      } else {
        showToast(data.error || "Creation failed", "error");
      }
    } catch {
      showToast("Error communicating with server", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleView = (m: "grid" | "list") => {
    setViewMode(m);
    localStorage.setItem("depot_view", m);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search patches..."
                className="bg-transparent text-sm w-full focus:outline-none text-slate-100"
              />
            </div>
            <select
              value={personaFilter}
              onChange={(e) => {
                setPersonaFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
            >
              <option value="all">All personas</option>
              <option value="generative">Generative</option>
              <option value="performance">Performance</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "updated" | "name");
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
            >
              <option value="updated">Newest first</option>
              <option value="name">Name A-Z</option>
            </select>
            <span className="text-xs text-slate-400">
              {filtered.length} of {patches.length}
            </span>
            <div className="flex border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleView("grid")}
                className={`p-1.5 ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-400"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleView("list")}
                className={`p-1.5 ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-400"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {paged.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">
              No patches match your filter. Use the Compose form to generate one.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paged.map((p) => {
                const mCount = parseJSON(p.modules_json).length;
                const cCount = parseJSON(p.cables_json).length;
                return (
                  <div
                    key={p.id}
                    className="glass rounded-xl p-4 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-3"
                  >
                    <Link to={`/depot/${p.id}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-100 hover:text-violet-400 truncate">
                          {p.name}
                        </h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/40 capitalize shrink-0">
                          {p.persona}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">
                        {p.description || "No description provided."}
                      </p>
                    </Link>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {mCount} modules • {cCount} cables • v{p.version}
                      </span>
                      <button
                        onClick={() => startRack(p.id)}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-violet-600 text-slate-200 hover:text-white inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Open in Rack
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {paged.map((p) => (
                <div
                  key={p.id}
                  className="glass rounded-lg p-3 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <Link to={`/depot/${p.id}`} className="min-w-0 flex-1">
                    <div className="font-medium text-slate-100 hover:text-violet-400 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.persona} • v{p.version} • {p.validation_status}
                    </div>
                  </Link>
                  <button
                    onClick={() => startRack(p.id)}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-violet-600 text-slate-200 hover:text-white text-xs inline-flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Compose Patch */}
        <div className="glass rounded-2xl p-5 border border-slate-800 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="font-bold text-slate-100">Compose Patch</h3>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Patch Name</label>
              <input
                type="text"
                placeholder="e.g. Ambient Reverb Swell"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Tone, modulation, signal flow..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Persona</label>
              <div className="grid grid-cols-2 gap-2">
                {["generative", "performance"].map((per) => (
                  <button
                    key={per}
                    type="button"
                    onClick={() => setNewPersona(per)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border capitalize ${
                      newPersona === per
                        ? "bg-violet-950/60 border-violet-500 text-violet-200"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    {per}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Module Hints (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Bogaudio LFO, Valley Plateau"
                value={newHints}
                onChange={(e) => setNewHints(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? "Generating..." : "Generate .vcv Patch"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PatchDetail({ patchId }: { patchId: string }) {
  const [patch, setPatch] = useState<Patch | null>(null);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<any[] | null>(null);
  const { startRack, showToast } = useAppStore();

  const load = async () => {
    const res = await fetch(`/api/patches/${patchId}`);
    const data = await res.json();
    if (data.success) setPatch(data.patch);
  };

  useEffect(() => {
    load();
  }, [patchId]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/patches/${patchId}/validate`, { method: "POST" });
      const data = await res.json();
      setReport(data.report || []);
      showToast(data.valid ? "Patch validation passed" : "Patch validation flagged issues", data.valid ? "success" : "error");
      load();
    } finally {
      setValidating(false);
    }
  };

  if (!patch) return <div className="text-sm text-slate-400">Loading patch...</div>;

  const modules = parseJSON(patch.modules_json);
  const cables = parseJSON(patch.cables_json);
  const oscMap = parseJSON(patch.osc_address_map);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link to="/depot" className="text-xs text-slate-300 hover:text-white inline-block">
        ← Back to Patch Depot
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{patch.name}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/40 capitalize">
              {patch.persona}
            </span>
            <span className="text-xs text-slate-400">v{patch.version}</span>
          </div>
          <p className="text-sm text-slate-300 mt-1">{patch.description}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium inline-flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            {validating ? "Validating..." : "Validate"}
          </button>
          <button
            onClick={() => startRack(patch.id)}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Open in Rack
          </button>
        </div>
      </div>

      <div
        className={`glass rounded-xl p-4 border flex items-center gap-3 ${
          patch.validation_status === "passed"
            ? "border-emerald-500/40 text-emerald-300"
            : "border-slate-800 text-slate-300"
        }`}
      >
        {patch.validation_status === "passed" ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        )}
        <div className="text-sm">
          Validation status: <strong className="capitalize">{patch.validation_status}</strong>
        </div>
      </div>

      {report && report.length > 0 && (
        <div className="glass rounded-xl p-4 border border-slate-800 space-y-1.5 text-xs">
          {report.map((r, i) => (
            <div key={i} className="text-slate-300 font-mono">
              [{r.severity || "info"}] {r.message || JSON.stringify(r)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-xl p-5 border border-slate-800">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              Modules ({modules.length})
            </h3>
            <div className="space-y-2">
              {modules.map((m: any, i: number) => (
                <div
                  key={i}
                  className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-sm"
                >
                  <div>
                    <span className="text-xs text-slate-400 font-mono mr-2">#{m.id}</span>
                    <span className="font-semibold text-slate-100">{m.model}</span>
                    <span className="text-xs text-slate-400 ml-2">({m.plugin})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-5 border border-slate-800">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              Cables ({cables.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
              {cables.map((c: any, i: number) => (
                <div
                  key={i}
                  className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between"
                >
                  <span className="text-cyan-300">
                    Mod {c.output_module_id ?? c.outputModuleId}:Out{" "}
                    {c.output_port_id ?? c.outputId}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="text-violet-300">
                    Mod {c.input_module_id ?? c.inputModuleId}:In{" "}
                    {c.input_port_id ?? c.inputId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-xl p-5 border border-slate-800">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-violet-400" />
              OSC Address Map
            </h3>
            {oscMap && Object.keys(oscMap).length > 0 ? (
              <div className="space-y-2 font-mono text-xs">
                {Object.entries(oscMap).map(([addr, mapping]: [string, any]) => (
                  <div key={addr} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-cyan-300 break-all">{addr}</div>
                    <div className="text-slate-400 mt-1">
                      Mod {mapping.module_id} • Param {mapping.param_id}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No OSC bindings generated.</p>
            )}
          </div>

          {patch.sidecar_md && (
            <div className="glass rounded-xl p-5 border border-slate-800">
              <h3 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                Performance Notes
              </h3>
              <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {patch.sidecar_md}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
