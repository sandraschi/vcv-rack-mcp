import { create } from "zustand";

export interface RackStatus {
  rack_installed: boolean;
  rack_exe: string;
  rack_user_dir: string;
  rack_user_dir_exists: boolean;
  plugins_dir: string;
  plugins_dir_exists: boolean;
  installed_plugins_count: number;
  installed_plugins: string[];
  running: boolean;
  pids: number[];
}

export interface LlmProvider {
  id: string;
  name: string;
  port: number;
  url: string;
  available: boolean;
  models: string[];
}

export interface GpuInfo {
  index: number;
  name: string;
  total_mb: number;
  used_mb: number;
  free_mb: number;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface AppState {
  backendState: "connecting" | "connected" | "offline";
  rack: RackStatus | null;
  providers: LlmProvider[];
  selectedProvider: string;
  selectedModel: string;
  gpus: GpuInfo[];
  logsOpen: boolean;
  toast: ToastState | null;
  darkMode: boolean;

  setBackendState: (s: "connecting" | "connected" | "offline") => void;
  fetchRackStatus: () => Promise<void>;
  startRack: (patchId?: string) => Promise<void>;
  stopRack: () => Promise<void>;
  fetchLlm: () => Promise<void>;
  setSelectedProvider: (p: string) => void;
  setSelectedModel: (m: string) => void;
  setLogsOpen: (open: boolean) => void;
  toggleTheme: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  backendState: "connecting",
  rack: null,
  providers: [],
  selectedProvider: localStorage.getItem("llm_provider") || "",
  selectedModel: localStorage.getItem("llm_model") || "",
  gpus: [],
  logsOpen: false,
  toast: null,
  darkMode: localStorage.getItem("theme_mode") !== "light",

  setBackendState: (s) => set({ backendState: s }),

  showToast: (message, type = "success") => {
    set({ toast: { message, type } });
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, 4500);
  },

  fetchRackStatus: async () => {
    try {
      const res = await fetch("/api/rack/status");
      if (!res.ok) throw new Error("status failed");
      const data = await res.json();
      set({ rack: data, backendState: "connected" });
    } catch {
      set({ backendState: "offline" });
    }
  },

  startRack: async (patchId?: string) => {
    try {
      const res = await fetch("/api/rack/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchId ? { patch_id: patchId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        get().showToast(data.message || "VCV Rack launched", "success");
        setTimeout(() => get().fetchRackStatus(), 800);
      } else {
        get().showToast(data.error || "Failed to launch VCV Rack", "error");
      }
    } catch {
      get().showToast("Failed to reach backend", "error");
    }
  },

  stopRack: async () => {
    try {
      const res = await fetch("/api/rack/stop", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        get().showToast(data.message || "VCV Rack stopped", "info");
        setTimeout(() => get().fetchRackStatus(), 500);
      } else {
        get().showToast(data.error || "Failed to stop VCV Rack", "error");
      }
    } catch {
      get().showToast("Failed to reach backend", "error");
    }
  },

  fetchLlm: async () => {
    try {
      const [provRes, gpuRes] = await Promise.all([
        fetch("/api/llm/providers"),
        fetch("/api/llm/gpus"),
      ]);
      const provData = await provRes.json();
      const gpuData = await gpuRes.json();
      const providers: LlmProvider[] = provData.providers || [];
      const available = providers.filter((p) => p.available);

      let chosenProvider = get().selectedProvider;
      if (!available.some((p) => p.id === chosenProvider)) {
        chosenProvider = available[0]?.id || "";
      }

      const activeProv = available.find((p) => p.id === chosenProvider);
      const models = activeProv?.models || [];
      let chosenModel = get().selectedModel;
      if (!models.includes(chosenModel)) {
        chosenModel = models[0] || "";
      }

      if (chosenProvider) localStorage.setItem("llm_provider", chosenProvider);
      if (chosenModel) localStorage.setItem("llm_model", chosenModel);

      set({
        providers,
        selectedProvider: chosenProvider,
        selectedModel: chosenModel,
        gpus: gpuData.gpus || [],
      });
    } catch {
      // non-fatal
    }
  },

  setSelectedProvider: (p) => {
    localStorage.setItem("llm_provider", p);
    const prov = get().providers.find((x) => x.id === p);
    const nextModel = prov?.models?.[0] || "";
    if (nextModel) localStorage.setItem("llm_model", nextModel);
    set({ selectedProvider: p, selectedModel: nextModel });
  },

  setSelectedModel: (m) => {
    localStorage.setItem("llm_model", m);
    set({ selectedModel: m });
  },

  setLogsOpen: (open) => set({ logsOpen: open }),

  toggleTheme: () => {
    const next = !get().darkMode;
    localStorage.setItem("theme_mode", next ? "dark" : "light");
    document.documentElement.classList.toggle("light-invert", !next);
    set({ darkMode: next });
  },
}));
