import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CheckCircle,
  Cpu,
  Folder,
  Play,
  Plus,
  RefreshCw,
  Square,
  Wrench,
  XCircle,
} from "lucide-react";
import { useAppStore } from "../store/app";

interface DashboardData {
  kpis: {
    catalog_size: number;
    patches_count: number;
    jobs_count: number;
    tools_count: number;
    installed_plugins_count: number;
  };
  recent_patches: any[];
  osc_mcp_base: string;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { rack, startRack, stopRack, fetchRackStatus } = useAppStore();

  const load = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // handled by layout health indicator
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <section className="glass rounded-2xl p-6 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-950/70 border border-violet-700/40 text-violet-300 text-xs font-medium">
            VCV Rack 2 • Autonomous Patch Authorship
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Compose, validate, and launch modular synth patches
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl">
            Generate valid <code className="text-violet-300">.vcv</code> JSON patches from natural
            language, verify plugins against your local Rack 2 installation, and launch directly
            into VCV Rack.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            to="/depot"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
            data-testid="hero-compose-cta"
          >
            <Plus className="w-4 h-4" />
            Compose Patch
          </Link>
          {rack?.running ? (
            <button
              onClick={() => stopRack()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
              data-testid="hero-stop-rack"
            >
              <Square className="w-4 h-4" />
              Stop VCV Rack
            </button>
          ) : (
            <button
              onClick={() => startRack()}
              disabled={!rack?.rack_installed}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 text-white text-sm font-semibold"
              data-testid="hero-start-rack"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              Start VCV Rack
            </button>
          )}
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="Catalog Modules"
          value={kpis?.catalog_size ?? "—"}
          icon={<BookOpen className="w-4 h-4 text-violet-400" />}
          to="/catalog"
        />
        <KpiCard
          label="Saved Patches"
          value={kpis?.patches_count ?? "—"}
          icon={<Folder className="w-4 h-4 text-cyan-400" />}
          to="/depot"
        />
        <KpiCard
          label="Installed Plugins"
          value={kpis?.installed_plugins_count ?? rack?.installed_plugins_count ?? "—"}
          icon={<Cpu className="w-4 h-4 text-emerald-400" />}
          to="/library"
        />
        <KpiCard
          label="Agentic Jobs"
          value={kpis?.jobs_count ?? "—"}
          icon={<Activity className="w-4 h-4 text-amber-400" />}
          to="/jobs"
        />
        <KpiCard
          label="MCP Tools"
          value={kpis?.tools_count ?? "—"}
          icon={<Wrench className="w-4 h-4 text-indigo-400" />}
          to="/tools"
        />
      </section>

      {/* VCV Rack Runtime & Recent Patches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rack Runtime Panel */}
        <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">VCV Rack 2 Environment</h3>
            <button
              onClick={() => fetchRackStatus()}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-900"
              title="Refresh Rack status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <StatusRow
              ok={Boolean(rack?.rack_installed)}
              label="Executable"
              value={rack?.rack_exe || "Probing..."}
            />
            <StatusRow
              ok={Boolean(rack?.rack_user_dir_exists)}
              label="User Directory"
              value={rack?.rack_user_dir || "Probing..."}
            />
            <StatusRow
              ok={Boolean(rack?.plugins_dir_exists)}
              label="Plugins Folder"
              value={`${rack?.plugins_dir || "—"} (${rack?.installed_plugins_count ?? 0} plugins)`}
            />
            <StatusRow
              ok={Boolean(rack?.running)}
              label="Process State"
              value={
                rack?.running
                  ? `Running (PID: ${rack.pids.join(", ")})`
                  : "Not running"
              }
            />
          </div>
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => startRack()}
              disabled={!rack?.rack_installed}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Launch Rack.exe
            </button>
            <button
              onClick={() => stopRack()}
              disabled={!rack?.running}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              Stop Rack
            </button>
            <Link
              to="/settings"
              className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium"
            >
              Configure Paths
            </Link>
          </div>
        </div>

        {/* Recent Patches */}
        <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">Recent Patches</h3>
            <Link to="/depot" className="text-xs text-violet-400 hover:text-violet-300">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="text-xs text-slate-400">Loading patches...</div>
          ) : !data?.recent_patches?.length ? (
            <div className="text-xs text-slate-400 py-6 text-center">
              No patches in depot yet.{" "}
              <Link to="/depot" className="text-violet-400 underline">
                Compose your first patch
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent_patches.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800/70"
                >
                  <Link to={`/depot/${p.id}`} className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100 hover:text-violet-400 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.persona} • v{p.version} • {p.validation_status}
                    </div>
                  </Link>
                  <button
                    onClick={() => startRack(p.id)}
                    className="ml-3 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-violet-600 text-slate-200 hover:text-white text-xs font-medium inline-flex items-center gap-1"
                    title="Open in VCV Rack"
                  >
                    <Play className="w-3 h-3" />
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="glass rounded-xl p-4 border border-slate-800 hover:border-slate-700 transition-colors block"
    >
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </Link>
  );
}

function StatusRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
      <div className="flex items-center gap-2 shrink-0">
        {ok ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-rose-400" />
        )}
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <span className="text-slate-300 font-mono text-right break-all">{value}</span>
    </div>
  );
}
