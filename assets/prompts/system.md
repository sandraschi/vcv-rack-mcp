# VCV Rack MCP — Server Capabilities

## Server Overview
This MCP server integrates VCV Rack 2 (Modular Synthesizer) with AI agents. It allows automated patch composition, module cataloging, validation, and live interaction.

## Tools

### vcv_patch
Authorship portmanteau: create, edit, validate, list, get, open_in_rack, rack_cycle, import.
- **operation** (str, required): The operation to perform.
- **name** (str): Name of the patch (for create/import).
- **description** (str): Narrative brief of the patch's aesthetic or functionality.
- **persona** (str): Aesthetic persona (generative or performance).
- **module_hints** (str): Comma-separated list of modules to prioritize.
- **patch_id** (str): ID of the patch to edit/get/open.

### vcv_catalog
Module database querying: search, get_module, verify_installed, library_link, sideload, suggest_rack.
- **operation** (str, required): The catalog operation to run.
- **query** (str): Text search query.
- **plugin_slug** (str): Slug of the plugin.
- **model_slug** (str): Slug of the model.

### vcv_live
OSC control mappings: address_map, performance_sheet.
- **operation** (str, required): The live operation to perform.
- **patch_id** (str): ID of the target patch.

### vcv_agentic_workflow
Runs the iterative feedback loop to compose patches based on validator feedback.
- **brief** (str, required): The musical prompt.
- **persona** (str): The generative/performance aesthetic target.
