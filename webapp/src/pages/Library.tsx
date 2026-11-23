import React, { useEffect, useState } from "react";
import { CheckCircle, Cpu, RefreshCw, Upload, XCircle } from "lucide-react";
import { useAppStore } from "../store/app";

export function Library() {
  const { rack, fetchRackStatus, showToast } = useAppStore();
  const [missing, setMissing] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [sideloadUrl, setSideloadUrl] = useState("");
  const [sideloading, setSideloading] = useState(false);

  const checkInstalled = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/tools/vcv_catalog/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "verify_installed" }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
        setMissing(parsed.missing || []);
      }
      await fetchRackStatus();
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkInstalled();
  }, []);

  const handleSideload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sideloadUrl.trim()) return;
    setSideloading(true);
    try {
      const res = await fetch("/api/tools/vcv_catalog/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "sideload", url: sideloadUrl.trim() }),
      });
      const data = await res.json();
      const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      if (result?.success) {
        showToast(result.message || "Sideload staged", "success");
        setSideloadUrl("");
      } else {
        showToast(result?.error || data.error || "Sideload failed", "error");
      }
    } finally {
      setSideloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-400" />
              Installed VCV Rack 2 Plugins
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{rack?.plugins_dir}</p>
          </div>
          <button
            onClick={checkInstalled}
            disabled={checking}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
            Rescan
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(rack?.installed_plugins || []).map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-700/40 text-emerald-300 text-xs font-mono"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {slug}
            </span>
          ))}
          {(!rack?.installed_plugins || rack.installed_plugins.length === 0) && (
            <p className="text-xs text-slate-400">No installed plugin directories detected.</p>
          )}
        </div>

        {missing.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-amber-300">
              Catalog plugins not found locally ({missing.length}):
            </div>
            <div className="flex flex-wrap gap-2">
              {missing.map((slug) => (
                <a
                  key={slug}
                  href={`https://library.vcvrack.com/?query=${encodeURIComponent(slug)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-200 text-xs font-mono hover:bg-amber-900/40"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {slug}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GitHub Sideload */}
      <div className="glass rounded-xl p-5 border border-slate-800 space-y-3">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-violet-400" />
          GitHub .vcvplugin Sideload
        </h3>
        <p className="text-xs text-slate-400">
          Stage a GitHub release <code className="text-slate-200">.vcvplugin</code> URL for
          installation on next Rack restart.
        </p>
        <form onSubmit={handleSideload} className="flex gap-2">
          <input
            type="url"
            value={sideloadUrl}
            onChange={(e) => setSideloadUrl(e.target.value)}
            placeholder="https://github.com/org/repo/releases/download/.../plugin.vcvplugin"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
            required
          />
          <button
            type="submit"
            disabled={sideloading}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {sideloading ? "Staging..." : "Stage Sideload"}
          </button>
        </form>
      </div>
    </div>
  );
}
