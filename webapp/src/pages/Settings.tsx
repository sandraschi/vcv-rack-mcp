import React, { useEffect, useState } from "react";
import { CheckCircle, Cpu, RefreshCw, Server, Settings as SettingsIcon, XCircle } from "lucide-react";
import { useAppStore } from "../store/app";

export function Settings() {
  const {
    rack,
    backendState,
    providers,
    selectedProvider,
    selectedModel,
    gpus,
    fetchRackStatus,
    fetchLlm,
    setSelectedProvider,
    setSelectedModel,
    showToast,
  } = useAppStore();

  const [rackExe, setRackExe] = useState("");
  const [rackUserDir, setRackUserDir] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rack) {
      setRackExe(rack.rack_exe || "");
      setRackUserDir(rack.rack_user_dir || "");
    }
  }, [rack]);

  const handleSavePaths = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/rack/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rack_exe: rackExe, rack_user_dir: rackUserDir }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("VCV Rack paths updated", "success");
        fetchRackStatus();
      } else {
        showToast("Failed to update paths", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const activeProv = providers.find((p) => p.id === selectedProvider);
  const models = activeProv?.models || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Backend Health */}
      <section className="glass rounded-xl p-5 border border-slate-800 space-y-3">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
          <Server className="w-5 h-5 text-violet-400" />
          Backend Health
        </h2>
        <div className="flex items-center justify-between text-sm bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <span>vcv-rack-mcp API (127.0.0.1:10916)</span>
          <span
            className={`font-semibold ${
              backendState === "connected" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {backendState}
          </span>
        </div>
      </section>

      {/* VCV Rack 2 Configuration */}
      <section className="glass rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-violet-400" />
            VCV Rack 2 Paths
          </h2>
          <span className="text-xs text-slate-400">
            {rack?.rack_installed ? "Executable found" : "Executable missing"}
          </span>
        </div>
        <form onSubmit={handleSavePaths} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Rack Executable (RACK_EXE)
            </label>
            <input
              type="text"
              value={rackExe}
              onChange={(e) => setRackExe(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Rack User Directory (RACK_USER_DIR)
            </label>
            <input
              type="text"
              value={rackUserDir}
              onChange={(e) => setRackUserDir(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
            />
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Detected Plugins Dir: {rack?.plugins_dir || "—"} ({rack?.installed_plugins_count ?? 0} plugins)
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
          >
            {saving ? "Saving..." : "Apply Paths"}
          </button>
        </form>
      </section>

      {/* Local Intelligence Integration */}
      <section className="glass rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-violet-400" />
            Local Intelligence (LLM Providers)
          </h2>
          <button
            onClick={() => fetchLlm()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-probe
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-100">{p.name}</div>
                <div className="text-xs text-slate-400 font-mono">:{p.port}</div>
              </div>
              {p.available ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  Detected ({p.models.length})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <XCircle className="w-4 h-4" />
                  Not found
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Provider</label>
            <select
              data-testid="llm-provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              {providers.some((p) => p.available) ? (
                providers
                  .filter((p) => p.available)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.models.length} models)
                    </option>
                  ))
              ) : (
                <option value="" disabled>
                  No local LLM detected
                </option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Model</label>
            <select
              data-testid="llm-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={models.length === 0}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              ) : (
                <option value="">No models available</option>
              )}
            </select>
          </div>
        </div>

        {gpus.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="text-xs font-semibold text-slate-300">Detected GPUs</div>
            {gpus.map((g) => (
              <div key={g.index} className="text-xs text-slate-300 font-mono">
                GPU {g.index}: {g.name} — {g.free_mb} MB free / {g.total_mb} MB total
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
