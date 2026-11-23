import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Folder,
  Grid,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Music,
  Play,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useAppStore } from "../store/app";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/depot", label: "Patch Depot", icon: Folder },
  { to: "/catalog", label: "Modules Catalog", icon: BookOpen },
  { to: "/library", label: "VCV Library", icon: Cpu },
  { to: "/jobs", label: "Agentic Jobs", icon: Activity },
  { to: "/tools", label: "Tools Hub", icon: Wrench },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/apps", label: "Apps Hub", icon: Grid },
  { to: "/logs", label: "Logs", icon: Terminal },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/depot": "Patch Depot",
  "/catalog": "Modules Catalog",
  "/library": "VCV Library & Plugins",
  "/jobs": "Agentic Jobs",
  "/tools": "MCP Tools Hub",
  "/skills": "Agent Skills",
  "/chat": "AI Patch Assistant",
  "/apps": "Fleet Apps Hub",
  "/logs": "Server & Tool Logs",
  "/settings": "Settings",
  "/help": "Help & Diagnostics",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [quickLogs, setQuickLogs] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const {
    backendState,
    rack,
    toast,
    logsOpen,
    darkMode,
    fetchRackStatus,
    fetchLlm,
    startRack,
    stopRack,
    setLogsOpen,
    toggleTheme,
  } = useAppStore();

  useEffect(() => {
    fetchRackStatus();
    fetchLlm();
    const id = setInterval(fetchRackStatus, 8000);
    return () => clearInterval(id);
  }, [fetchRackStatus, fetchLlm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLogsOpen(!logsOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logsOpen, setLogsOpen]);

  useEffect(() => {
    if (!logsOpen) return;
    fetch("/api/logs?limit=100")
      .then((r) => r.json())
      .then((d) => setQuickLogs(d.logs || []))
      .catch(() => {});
  }, [logsOpen]);

  const title =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith("/depot/") ? "Patch Detail" : "VCV Rack MCP");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
            toast.type === "error"
              ? "bg-rose-950/95 text-rose-200 border-rose-500/50"
              : toast.type === "info"
              ? "bg-slate-900/95 text-slate-200 border-slate-700"
              : "bg-emerald-950/95 text-emerald-200 border-emerald-500/50"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Retractable Sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-60"
        } shrink-0 border-r border-slate-900 bg-slate-950/90 flex flex-col transition-all duration-200`}
      >
        {/* Brand + TOP Collapse Toggle (per WEBAPP_SOTA_STANDARDS II.1) */}
        <div className="h-14 px-3 border-b border-slate-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="text-sm font-bold text-slate-100 truncate">VCV Rack MCP</div>
                <div className="text-[11px] text-slate-400">v0.1.0</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-900 text-violet-400 border border-slate-800"
                      : "text-slate-300 hover:text-white hover:bg-slate-900/60"
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Connection status footer */}
        <div className="p-3 border-t border-slate-900 text-xs text-slate-400 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              backendState === "connected"
                ? "bg-emerald-500"
                : backendState === "connecting"
                ? "bg-amber-500 animate-pulse"
                : "bg-rose-500"
            }`}
          />
          {!collapsed && (
            <span className="truncate">
              Backend: {backendState === "connected" ? "Connected" : backendState}
            </span>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Topbar */}
        <header
          data-testid="topbar"
          className="h-14 border-b border-slate-900 bg-slate-950/85 backdrop-blur sticky top-0 z-30 px-5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 min-w-0">
            <h1 data-testid="topbar-title" className="text-base font-semibold text-slate-100 truncate">
              {title}
            </h1>

            {/* VCV Rack status & quick launch/stop */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  rack?.running
                    ? "bg-emerald-400 animate-pulse"
                    : rack?.rack_installed
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-xs text-slate-300">
                {rack?.running
                  ? `Rack Running (${rack.pids.join(", ")})`
                  : rack?.rack_installed
                  ? "Rack Ready"
                  : "Rack Not Found"}
              </span>
              {rack?.running ? (
                <button
                  onClick={() => stopRack()}
                  className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium"
                  data-testid="topbar-rack-stop"
                >
                  <Square className="w-3 h-3" />
                  Stop Rack
                </button>
              ) : (
                <button
                  onClick={() => startRack()}
                  disabled={!rack?.rack_installed}
                  className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium"
                  data-testid="topbar-rack-start"
                >
                  <Play className="w-3 h-3" />
                  Start Rack
                </button>
              )}
            </div>
          </div>

          {/* Right-side controls in canonical order: search, logs, help, theme, popout */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/catalog")}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
              title="Search Modules"
              data-testid="topbar-search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLogsOpen(true)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
              title="Logs (Ctrl+L)"
              data-testid="topbar-logs"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/help")}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
              title="Help"
              data-testid="topbar-help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
              title="Toggle theme"
              data-testid="topbar-theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900"
              title="Pop out"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>

        {/* One-line Footer */}
        <footer className="border-t border-slate-900 px-6 py-2.5 text-xs text-slate-400 flex items-center justify-between">
          <span>VCV Rack MCP — Autonomous VCV Rack 2 Patch Authorship</span>
          <span>API :10916 • UI :10917</span>
        </footer>
      </div>

      {/* Global Ctrl+L Logs Modal */}
      {logsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Terminal className="w-4 h-4 text-violet-400" />
                <span>Live Server Logs (Ctrl+L)</span>
              </div>
              <button
                onClick={() => setLogsOpen(false)}
                className="p-1 rounded hover:bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs space-y-1.5 flex-1">
              {quickLogs.length === 0 ? (
                <div className="text-slate-400">No log entries recorded yet.</div>
              ) : (
                quickLogs.map((l) => (
                  <div key={l.id} className="flex gap-3 border-b border-slate-900/70 pb-1">
                    <span className="text-slate-500 shrink-0">{l.timestamp}</span>
                    <span
                      className={`shrink-0 w-12 ${
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
        </div>
      )}
    </div>
  );
}
