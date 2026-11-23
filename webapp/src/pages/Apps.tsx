import { useEffect, useState } from "react";
import { ExternalLink, Grid } from "lucide-react";

export function Apps() {
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((d) => setApps(d.apps || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Grid className="w-5 h-5 text-violet-400" />
          Fleet Apps Hub
        </h2>
        <p className="text-xs text-slate-400">
          Registered MCP webapps from <code>fleet-registry.json</code>.
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">
          No fleet registry entries discovered.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.slice(0, 30).map((a, idx) => (
            <div key={a.name || idx} className="glass rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">{a.name}</span>
                {a.frontend_port && (
                  <a
                    href={`http://127.0.0.1:${a.frontend_port}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
                  >
                    :{a.frontend_port} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {a.description && <p className="text-xs text-slate-400 line-clamp-2">{a.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
