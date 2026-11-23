import { useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import { useAppStore } from "../store/app";

type HelpTab = "overview" | "wrappee" | "api" | "troubleshoot" | "faq";

const TABS: { id: HelpTab; label: string; desc: string }[] = [
  { id: "overview", label: "Overview", desc: "Architecture & pages map" },
  { id: "wrappee", label: "VCV Rack 2", desc: "Wrapped app, paths & detection" },
  { id: "api", label: "API & Ports", desc: "Endpoints, env vars & service start" },
  { id: "troubleshoot", label: "Troubleshoot", desc: "Known incidents & fixes" },
  { id: "faq", label: "FAQ", desc: "Common questions" },
];

const ERROR_FIXES = [
  {
    symptom: "patch file not found at depot/<slug>.vcv",
    cause: "Fixed 2026-11-23: vcv_patch(create) and POST /api/patches wrote only to SQLite and never materialized the .vcv file on disk.",
    fix: "Upgrade to current server.py; create/edit/open_in_rack now write <depot>/<slug>.vcv automatically.",
  },
  {
    symptom: "verify_installed reports all plugins missing despite Rack 2 installed",
    cause: "Fixed 2026-11-23: config.py hardcoded %LOCALAPPDATA%\\Rack2Free\\plugins instead of %LOCALAPPDATA%\\Rack2\\plugins-win-x64.",
    fix: "Auto-detection in config.py now probes Rack2, Rack2Free, Rack2Pro and plugins-win-x64. Override in Settings if custom.",
  },
  {
    symptom: "No local LLM detected in Chat or Settings",
    cause: "Ollama (11434) or LM Studio (1234) is not running on 127.0.0.1.",
    fix: "Start Ollama or LM Studio, then click Re-probe in Settings.",
  },
];

const FAQS = [
  {
    q: "Where are my generated .vcv patches and SQLite database stored?",
    a: "Inside the repository's depot/ folder: each patch is saved as depot/<slug>.vcv and indexed in depot/patches.sqlite.",
  },
  {
    q: "How does vcv-rack-mcp find and start VCV Rack 2?",
    a: "config.py probes standard Windows/macOS/Linux Rack 2 paths (such as C:\\Program Files\\VCV\\Rack2Free\\Rack.exe) and %LOCALAPPDATA%\\Rack2. You can launch or stop Rack.exe from the topbar, Dashboard, or Patch Depot.",
  },
  {
    q: "How do MCP clients connect to this server?",
    a: "Use stdio via `uv run vcv-rack-mcp` or Streamable HTTP at http://127.0.0.1:10916/mcp.",
  },
  {
    q: "Where are server and tool call logs?",
    a: "Press Ctrl+L anywhere to open the live logs modal, or visit the Logs page (/logs) backed by GET /api/logs.",
  },
];

export function Help() {
  const [tab, setTab] = useState<HelpTab>("overview");
  const [query, setQuery] = useState("");
  const { rack } = useAppStore();

  const q = query.trim().toLowerCase();
  const filteredFixes = ERROR_FIXES.filter(
    (e) =>
      !q ||
      e.symptom.toLowerCase().includes(q) ||
      e.cause.toLowerCase().includes(q) ||
      e.fix.toLowerCase().includes(q)
  );
  const filteredFaqs = FAQS.filter(
    (f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-violet-400" />
          Help & Diagnostics
        </h2>
        <p className="text-xs text-slate-400">
          Architecture, VCV Rack 2 integration, API reference, and incident-grounded troubleshooting.
        </p>
      </div>

      {/* Horizontal Tab Bar */}
      <div
        data-testid="help-tabs"
        className="flex flex-wrap border-b border-slate-800 gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`help-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-left border-b-2 transition-colors ${
              tab === t.id
                ? "border-violet-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="text-sm font-semibold">{t.label}</div>
            <div className="text-[11px] text-slate-400">{t.desc}</div>
          </button>
        ))}
      </div>

      {(tab === "troubleshoot" || tab === "faq") && (
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            data-testid="help-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter entries..."
            className="bg-transparent text-sm w-full focus:outline-none text-slate-100"
          />
        </div>
      )}

      {tab === "overview" && (
        <div className="glass rounded-xl p-5 border border-slate-800 space-y-4 text-sm text-slate-300">
          <p>
            <strong>vcv-rack-mcp</strong> is a FastMCP 3 server + React console for generating,
            validating, and launching VCV Rack 2 (<code>.vcv</code>) patches from natural language.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-white">Backend API + MCP</div>
              <div className="font-mono text-slate-400 mt-1">127.0.0.1:10916 (/mcp, /api/*)</div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-white">Webapp UI</div>
              <div className="font-mono text-slate-400 mt-1">127.0.0.1:10917 (Vite + React)</div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="font-semibold text-white">Wrappee</div>
              <div className="font-mono text-slate-400 mt-1">VCV Rack 2 (Rack.exe)</div>
            </div>
          </div>
        </div>
      )}

      {tab === "wrappee" && (
        <div className="glass rounded-xl p-5 border border-slate-800 space-y-3 text-sm text-slate-300">
          <h3 className="font-semibold text-white">VCV Rack 2 (Local Desktop App)</h3>
          <ul className="space-y-2 text-xs font-mono bg-slate-900/60 p-4 rounded-lg border border-slate-800">
            <li>RACK_EXE: {rack?.rack_exe || "—"} ({rack?.rack_installed ? "FOUND" : "MISSING"})</li>
            <li>RACK_USER_DIR: {rack?.rack_user_dir || "—"} ({rack?.rack_user_dir_exists ? "FOUND" : "MISSING"})</li>
            <li>PLUGINS_DIR: {rack?.plugins_dir || "—"} ({rack?.installed_plugins_count ?? 0} plugins)</li>
            <li>STATE: {rack?.running ? `Running (PID ${rack.pids.join(", ")})` : "Stopped"}</li>
          </ul>
          <p className="text-xs text-slate-400">
            Control Rack via the topbar Start/Stop buttons, Dashboard, or <code>vcv_patch</code>{" "}
            operations (<code>open_in_rack</code>, <code>rack_start</code>, <code>rack_stop</code>).
          </p>
        </div>
      )}

      {tab === "api" && (
        <div className="glass rounded-xl p-5 border border-slate-800 space-y-4 text-xs">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Ports (WEBAPP_PORTS.md)</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Port</th>
                  <th className="py-2">Owner</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-200">
                <tr className="border-b border-slate-900">
                  <td className="py-2">10916</td>
                  <td>vcv-rack-mcp backend</td>
                  <td>Starlette + FastMCP (/mcp, /api/*, /health)</td>
                </tr>
                <tr>
                  <td className="py-2">10917</td>
                  <td>vcv-rack-mcp webapp</td>
                  <td>Vite dev server, proxies /api → 10916</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Key Endpoints</h3>
            <pre className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
{`GET  /health, /api/health, /api/status, /api/dashboard
GET  /api/rack/status | POST /api/rack/start, /api/rack/stop, /api/rack/config
GET  /api/patches | POST /api/patches | POST /api/patches/{id}/open, /validate
GET  /api/catalog | GET /api/jobs | POST /api/jobs
GET  /api/tools | POST /api/tools/{name}/run
GET  /api/skills | GET /api/skills/{name} | GET /api/logs
GET  /api/llm/providers, /api/llm/models, /api/llm/gpus | POST /api/llm/chat`}
            </pre>
          </div>
        </div>
      )}

      {tab === "troubleshoot" && (
        <div data-testid="help-fixes" className="space-y-3">
          {filteredFixes.map((e, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-slate-800 space-y-1.5 text-xs">
              <div className="font-semibold text-rose-300">Symptom: {e.symptom}</div>
              <div className="text-slate-300">Cause: {e.cause}</div>
              <div className="text-emerald-300">Fix: {e.fix}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "faq" && (
        <div data-testid="help-faq" className="space-y-3">
          {filteredFaqs.map((f, i) => (
            <div
              key={i}
              data-testid="faq-item"
              className="glass rounded-xl p-4 border border-slate-800 space-y-1"
            >
              <div className="text-sm font-semibold text-white">{f.q}</div>
              <div className="text-xs text-slate-300">{f.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
