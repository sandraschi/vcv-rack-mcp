import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useAppStore } from "../store/app";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "vcv_rack_chat_history";

export function Chat() {
  const { selectedProvider, selectedModel, providers } = useAppStore();
  const [skillPrompt, setSkillPrompt] = useState(
    "You are an expert VCV Rack 2 modular synthesizer patch designer using vcv-rack-mcp."
  );
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills/vcv-rack-mcp")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.content) setSkillPrompt(d.content);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const hasAvailableProvider = providers.some((p) => p.available);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedProvider || !selectedModel) return;
    const nextMsgs: ChatMsg[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMsgs);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          messages: [{ role: "system", content: skillPrompt }, ...nextMsgs],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...nextMsgs, { role: "assistant", content: data.reply || "" }]);
      } else {
        setError(data.error || "Chat request failed");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-10rem)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            AI Patch Assistant
          </h2>
          <p className="text-xs text-slate-400">
            {selectedProvider && selectedModel
              ? `Using ${selectedProvider} / ${selectedModel} (skill-grounded)`
              : "No local LLM selected — configure Ollama or LM Studio in Settings."}
          </p>
        </div>
        <button
          onClick={() => setMessages([])}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {!hasAvailableProvider && (
        <div className="rounded-xl p-4 bg-amber-950/40 border border-amber-700/40 text-amber-200 text-xs flex items-center justify-between">
          <span>Install and start Ollama or LM Studio to enable local AI chat.</span>
          <Link to="/settings" className="underline font-semibold">
            Open Settings →
          </Link>
        </div>
      )}

      <div className="flex-1 glass rounded-xl p-4 border border-slate-800 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-12">
            Ask for a VCV Rack 2 patch idea, module routing, or OSC performance mapping.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-violet-950/50 border border-violet-800/40 ml-12 text-slate-100"
                  : "bg-slate-900/70 border border-slate-800 mr-12 text-slate-200"
              }`}
            >
              <div className="text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                {m.role}
              </div>
              {m.content}
            </div>
          ))
        )}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/50 text-rose-200 text-xs">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about modules, generative patches, or OSC maps..."
          disabled={!selectedModel || sending}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!selectedModel || sending || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
