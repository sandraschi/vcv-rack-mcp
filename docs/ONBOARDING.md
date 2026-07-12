# Onboarding — VCV Rack for vcv-rack-mcp

This server drives an installed VCV Rack 2. On Goliath it is already present:

```
C:\Program Files\VCV\Rack2Free\Rack.exe   (Rack 2 Free edition)
```

New machine / new user? Do this ONCE before TODO Phase 0:

1. **Install** VCV Rack 2 Free from https://vcvrack.com/Rack (free; no purchase needed for this server — the Free edition covers everything except plugin/DAW hosting).
2. **Run Rack once** so it creates its user directory (location varies by Rack version — recent versions use `%LOCALAPPDATA%\Rack2`, older ones `Documents\Rack2`; check Help → Open user folder inside Rack and record the actual path in `docs/VCV_JSON_SCHEMA.md` during Phase 0 recon). The `plugins/` subfolder there is what `vcv_catalog.verify_installed` scans.
3. **Create a free VCV account** and log in inside Rack (Library menu). Community modules install by subscribing on https://library.vcvrack.com, then restarting Rack — they download on launch. No account = Fundamental modules only.
4. **Subscribe the catalog plugin set** — see `docs/CATALOG_WISHLIST.md` once Phase 1 produces it (Phase 0 needs only Fundamental plus the two OSC bridge candidates).
5. **Audio**: open Rack, add/confirm an AUDIO module targeting the machine's output device, confirm you hear the template patch. If Rack is silent, everything downstream is unverifiable.

Notes:
- **Free vs Pro:** Rack 2 Free runs standalone only. Plugin/DAW hosting (the deferred render lane) requires Rack **Pro** (paid) or **Cardinal** (FOSS fork, free) — owner decision, see PRD §3.
- Rack should be **closed** while the server writes patch files, or patches opened as new tabs — see PRD §8 (autosave clobber risk).
