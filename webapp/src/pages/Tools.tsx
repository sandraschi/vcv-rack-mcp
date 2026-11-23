import { useEffect, useMemo, useState } from "react";
import { Play, Search, Wrench } from "lucide-react";

interface ToolMeta {
  name: string;
  description: string;
  parameters: {
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: Record<string, any>;
  is_portmanteau?: boolean;
}

export function Tools() {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ToolMeta | null>(null);
  const [argsJson, setArgsJson] = useState("{}");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTools(d.tools || []);
          if (d.tools?.length) setSelected(d.tools[0]);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [tools, search]);

  const handleSelect = (t: ToolMeta) => {
    setSelected(t);
    setOutput(null);
    const props = t.parameters?.properties || {};
    const sample: Record<string, any> = {};
    for (const [k, v] of Object.entries(props)) {
      if (t.parameters?.required?.includes(k)) {
        sample[k] = v.default ?? (v.type === "integer" ? 0 : "");
      }
    }
    setArgsJson(JSON.stringify(sample, null, 2));
  };

  const handleRun = async () => {
    if (!selected) return;
    setRunning(true);
    setOutput(null);
    try {
      const parsed = argsJson.trim() ? JSON.parse(argsJson) : {};
      const res = await fetch(`/api/tools/${encodeURIComponent(selected.name)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setOutput(`Error: ${e?.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">MCP Tools Hub</h2>
          <p className="text-xs text-slate-400">
            Dynamically introspected from FastMCP ({filtered.length} of {tools.length} tools).
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tools..."
            className="bg-transparent text-sm w-full focus:outline-none text-slate-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {filtered.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelect(t)}
              className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                selected?.name === t.name
                  ? "bg-slate-900 border-violet-500/70"
                  : "glass border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-slate-100">{t.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    t.is_portmanteau
                      ? "bg-violet-950 text-violet-300 border border-violet-700/50"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {t.is_portmanteau ? "Portmanteau" : "Solo"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-violet-400" />
                  {selected.name}
                </h3>
                <button
                  onClick={handleRun}
                  disabled={running}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {running ? "Running..." : "Run Tool"}
                </button>
              </div>

              <pre className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                {selected.description}
              </pre>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1.5">
                  Arguments (JSON)
                </div>
                <textarea
                  rows={5}
                  value={argsJson}
                  onChange={(e) => setArgsJson(e.target.value)}
                  className="w-full font-mono text-xs bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1.5">
                  Parameter Schema
                </div>
                <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 max-h-48 overflow-y-auto">
                  {JSON.stringify(selected.parameters, null, 2)}
                </pre>
              </div>

              {output !== null && (
                <div>
                  <div className="text-xs font-semibold text-emerald-300 mb-1.5">Result</div>
                  <pre className="text-xs font-mono text-emerald-200 bg-slate-950 p-3 rounded-lg border border-emerald-800/40 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {output}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="glass rounded-xl p-8 text-sm text-slate-400">
              Select a tool to inspect its schema and execute it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
