import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Clock, Play, RefreshCw } from "lucide-react";
import { useAppStore } from "../store/app";

interface Job {
  id: string;
  brief: string;
  persona?: string;
  iterations: number;
  max_iterations: number;
  status: string;
  result_patch_id?: string;
  error?: string;
  created_at: string;
}

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [brief, setBrief] = useState("");
  const [persona, setPersona] = useState("generative");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useAppStore();

  const load = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.success) setJobs(data.jobs || []);
    } catch {
      // handled globally
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), persona }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Agentic job started", "success");
        setBrief("");
        load();
      } else {
        showToast(data.error || "Failed to start job", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Start Agentic Patch Workflow
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the patch (e.g. slow ambient drone, two detuned voices, big reverb)"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
            required
          />
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            <option value="generative">Generative</option>
            <option value="performance">Performance</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Workflow
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Job History ({jobs.length})
        </h3>
        {jobs.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">
            No agentic jobs recorded yet.
          </div>
        ) : (
          jobs.map((j) => (
            <div
              key={j.id}
              className="glass rounded-xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{j.id}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      j.status === "complete"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700/40"
                        : j.status === "failed"
                        ? "bg-rose-950 text-rose-300 border border-rose-700/40"
                        : "bg-amber-950 text-amber-300 border border-amber-700/40"
                    }`}
                  >
                    {j.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {j.iterations}/{j.max_iterations} iterations
                  </span>
                </div>
                <p className="text-sm text-slate-200">{j.brief}</p>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {j.created_at}
                </div>
              </div>
              {j.result_patch_id && (
                <Link
                  to={`/depot/${j.result_patch_id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-violet-600 text-xs font-semibold text-white"
                >
                  Inspect Patch →
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
