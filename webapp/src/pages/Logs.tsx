import { useEffect, useState } from "react";
import { RefreshCw, Terminal } from "lucide-react";

interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  logger: string;
  kind: string;
  message: string;
}

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState("");

  const load = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (level) params.set("level", level);
    if (kind) params.set("kind", kind);
    try {
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) setLogs(data.logs || []);
    } catch {
      // handled globally
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [level, kind]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-violet-400" />
          Server & Tool Call Logs
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="">All levels</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="">All kinds</option>
            <option value="system">system</option>
            <option value="tool_call">tool_call</option>
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-1.5 max-h-[70vh] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-slate-400 py-8 text-center">No log entries recorded yet.</div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="flex gap-3 border-b border-slate-900 pb-1">
              <span className="text-slate-500 shrink-0">{l.timestamp}</span>
              <span
                className={`shrink-0 w-14 ${
                  l.level === "ERROR"
                    ? "text-rose-400"
                    : l.level === "WARNING"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {l.level}
              </span>
              <span className="text-violet-400 shrink-0">[{l.kind}]</span>
              <span className="text-slate-200 break-all">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
