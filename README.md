# Asgard

Lightweight multi-agent system built on the Althing orchestrator.

- **Heimdall** coordinates all tasks (flat hierarchy — no PL/DL)
- All 52 Norse mythology agents available as workers
- Quickstart skills: brainstorm, six hats, 6-3-5, disney method
- Claude Code + Telegram interface

## Requirements

- [Das Althing orchestrator](https://github.com/Bumblebiber/Althing) running as systemd service
- `claude` CLI, `gemini` CLI, or `opencode` installed
- Node.js 18+

## Setup

1. Clone this repo
2. Copy `.mcp.json.example` to `.mcp.json` and fill in your paths
3. Open in Claude Code: `claude` in the asgard directory
4. Spawn your first agent: `spawn_agent(Template: "BALDUR", ...)`

## Quickstart Skills

- `/brainstorm` — Multi-agent brainstorming (3–6 agents, multiple rounds)
- `/sixhats` — Six Thinking Hats
- `/635` — 6-3-5 Brainwriting
- `/disney` — Disney Creative Strategy
