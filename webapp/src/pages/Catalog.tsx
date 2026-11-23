import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LayoutGrid, List, Search } from "lucide-react";

interface ModuleEntry {
  plugin_slug: string;
  model_slug: string;
  display_name: string;
  brand?: string;
  function_tags: string[];
  persona_tags: string[];
  inputs?: any[];
  outputs?: any[];
  notes?: string;
}

const PAGE_SIZE = 20;

export function Catalog() {
  const [modules, setModules] = useState<ModuleEntry[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [persona, setPersona] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "brand">("name");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("catalog_view") as "grid" | "list") || "grid"
  );

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setModules(d.modules || []);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = modules.filter((m) => {
      if (tag && !m.function_tags.includes(tag)) return false;
      if (persona && !m.persona_tags.includes(persona)) return false;
      if (!q) return true;
      return (
        m.display_name.toLowerCase().includes(q) ||
        (m.brand || "").toLowerCase().includes(q) ||
        m.model_slug.toLowerCase().includes(q) ||
        m.plugin_slug.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => {
      if (sortBy === "brand") return (a.brand || "VCV").localeCompare(b.brand || "VCV");
      return a.display_name.localeCompare(b.display_name);
    });
    return list;
  }, [modules, query, tag, persona, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleView = (m: "grid" | "list") => {
    setViewMode(m);
    localStorage.setItem("catalog_view", m);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by brand, slug, name..."
            className="bg-transparent text-sm w-full focus:outline-none text-slate-100"
          />
        </div>
        <select
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
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
          value={persona}
          onChange={(e) => {
            setPersona(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
        >
          <option value="">All personas</option>
          <option value="generative">Generative</option>
          <option value="performance">Performance</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "brand")}
          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-200"
        >
          <option value="name">Sort: Name</option>
          <option value="brand">Sort: Brand</option>
        </select>
        <span className="text-xs text-slate-400">
          {filtered.length} of {modules.length}
        </span>
        <div className="flex border border-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleView("grid")}
            className={`p-1.5 ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-400"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleView("list")}
            className={`p-1.5 ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-400"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.map((m) => (
            <div
              key={`${m.plugin_slug}/${m.model_slug}`}
              className="glass rounded-xl p-4 border border-slate-800 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-xs text-violet-400 font-semibold uppercase">
                      {m.brand || "VCV"}
                    </span>
                    <h3 className="font-bold text-slate-100">{m.display_name}</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{m.plugin_slug}</span>
                </div>
                <p className="text-xs text-slate-300 mt-2 line-clamp-3">
                  {m.notes || "Free VCV Library module."}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/70 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {m.function_tags.map((t) => (
                    <span
                      key={t}
                      className="text-[11px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>
                    In: {m.inputs?.length || 0} | Out: {m.outputs?.length || 0}
                  </span>
                  <a
                    href={`https://library.vcvrack.com/${m.plugin_slug}/${m.model_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
                  >
                    Library <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((m) => (
            <div
              key={`${m.plugin_slug}/${m.model_slug}`}
              className="glass rounded-lg p-3 border border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <span className="font-semibold text-slate-100">{m.display_name}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">
                  {m.plugin_slug}/{m.model_slug}
                </span>
                <div className="text-xs text-slate-400 truncate">{m.notes}</div>
              </div>
              <a
                href={`https://library.vcvrack.com/${m.plugin_slug}/${m.model_slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 shrink-0 inline-flex items-center gap-1"
              >
                Library <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
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
  );
}
