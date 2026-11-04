# Third-party skills

These skills are installed unmodified from public repositories (all MIT licensed).

| Skill | Source | License |
| --- | --- | --- |
| `pixel-art-professional` | [willibrandon/pixel-plugin](https://github.com/willibrandon/pixel-plugin/tree/main/skills/pixel-art-professional) (`SKILL.md`, `dithering-patterns.md`, `reference.md`) | MIT © 2025 Brandon Williams |
| `pdf-export` | [d-padmanabhan/agent-engineering-handbook](https://github.com/d-padmanabhan/agent-engineering-handbook/tree/main/skills/pdf-export) | MIT © 2025-2026 Agent Engineering Handbook Contributors |
| `frontend-design-systems` | [composio-community/opencode-skills](https://github.com/composio-community/opencode-skills/tree/main/skills/frontend-design-systems) | MIT |

Notes for this project:
- `pixel-art-professional` references Aseprite MCP tools that are not part of Beadify. Its dithering
  and quantization techniques are implemented directly in `src/lib/patternEngine.ts`.
- `pdf-export` targets raster (html2canvas) PDFs. Beadify keeps vector PDFs and applies the skill's
  gotchas: font loading, bookmarks and the iOS user-gesture rules.
