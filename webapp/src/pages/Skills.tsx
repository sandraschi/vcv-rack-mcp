import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface SkillItem {
  name: string;
  uri: string;
}

export function Skills() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [active, setActive] = useState<string>("");
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        const list: SkillItem[] = d.skills || [];
        setSkills(list);
        if (list.length) setActive(list[0].name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    fetch(`/api/skills/${encodeURIComponent(active)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setContent(d.content || "");
      })
      .catch(() => {});
  }, [active]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          Agent Skills (SKILL.md)
        </h2>
        <p className="text-xs text-slate-400">
          Exposed as MCP resources (<code className="text-slate-300">skill://.../SKILL.md</code>) and used as the Chat system prompt.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          {skills.length === 0 ? (
            <div className="text-xs text-slate-400">No skills found.</div>
          ) : (
            skills.map((s) => (
              <button
                key={s.name}
                onClick={() => setActive(s.name)}
                className={`w-full text-left p-3 rounded-xl border text-sm ${
                  active === s.name
                    ? "bg-slate-900 border-violet-500 text-white"
                    : "glass border-slate-800 text-slate-300"
                }`}
              >
                <div className="font-semibold">{s.name}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate">{s.uri}</div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-3 glass rounded-xl p-6 border border-slate-800">
          <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
            {content || "Select a skill to view its SKILL.md."}
          </pre>
        </div>
      </div>
    </div>
  );
}
