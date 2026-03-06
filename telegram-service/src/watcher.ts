import * as fs from "node:fs";
import * as path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import type { AgentState, StateFile, TelegramConfig, WatcherEvent } from "./types.js";

type EventHandler = (event: WatcherEvent) => void;

export class Watcher {
  private config: TelegramConfig;
  private stateFile: string;
  private responsesDir: string;
  private devOutgoingDir: string;
  private previousAgents: Map<string, AgentState> = new Map();
  private seenFiles: Set<string> = new Set();
  private handler: EventHandler;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private fsWatcher: FSWatcher | null = null;
  private devWatcher: FSWatcher | null = null;

  constructor(config: TelegramConfig, handler: EventHandler) {
    this.config = config;
    this.stateFile = path.join(config.projectDir, "orchestrator", "state.json");
    this.responsesDir = path.join(config.projectDir, "responses");
    this.devOutgoingDir = path.join(config.projectDir, "dev_messages", "outgoing");
    this.handler = handler;
  }

  start(): void {
    // Initial state snapshot (no events on startup)
    this.loadState(true);

    // Index existing files so we don't fire events for old messages
    this.indexExistingFiles();

    // Poll state.json for agent status changes
    this.pollTimer = setInterval(() => this.loadState(false), this.config.pollIntervalMs);

    // Watch responses/ for new MSG files (create dir if missing)
    if (!fs.existsSync(this.responsesDir)) {
      fs.mkdirSync(this.responsesDir, { recursive: true });
    }
    this.fsWatcher = watch(this.responsesDir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    this.fsWatcher.on("add", (filePath) => this.onNewFile(filePath));
    this.fsWatcher.on("change", (filePath) => this.onFileChanged(filePath));

    // Watch dev_messages/outgoing/ for developer→Telegram bridge messages
    if (!fs.existsSync(this.devOutgoingDir)) {
      fs.mkdirSync(this.devOutgoingDir, { recursive: true });
    }
    this.devWatcher = watch(this.devOutgoingDir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    this.devWatcher.on("add", (filePath) => this.onDevMessage(filePath));
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    if (this.devWatcher) {
      this.devWatcher.close();
      this.devWatcher = null;
    }
  }

  /** Read state.json and detect status transitions */
  private loadState(initial: boolean): void {
    let state: StateFile;
    try {
      const raw = fs.readFileSync(this.stateFile, "utf-8");
      state = JSON.parse(raw) as StateFile;
    } catch {
      // state.json doesn't exist yet or is being rewritten — skip this tick
      return;
    }

    if (initial) {
      // Just snapshot, no events
      for (const agent of state.agents) {
        this.previousAgents.set(agent.id, { ...agent });
      }
      return;
    }

    const currentIds = new Set<string>();

    for (const agent of state.agents) {
      currentIds.add(agent.id);
      const prev = this.previousAgents.get(agent.id);

      if (!prev) {
        // New agent appeared
        if (agent.status === "busy" && this.config.notify.agentStarted) {
          this.handler({ type: "agent_started", agent });
        }
      } else if (prev.status !== agent.status) {
        // Status transition
        this.emitTransition(prev, agent);
      }

      this.previousAgents.set(agent.id, { ...agent });
    }

    // Agents that disappeared (went offline and were removed from state)
    for (const [id, prev] of this.previousAgents) {
      if (!currentIds.has(id) && prev.status !== "offline") {
        if (this.config.notify.agentFinished) {
          this.handler({ type: "agent_finished", agent: { ...prev, status: "offline" }, prevStatus: prev.status });
        }
        this.previousAgents.delete(id);
      }
    }
  }

  private emitTransition(prev: AgentState, current: AgentState): void {
    const notify = this.config.notify;

    if (current.status === "busy" && prev.status !== "busy" && notify.agentStarted) {
      this.handler({ type: "agent_started", agent: current });
    }

    if (current.status === "delegating" && prev.status !== "delegating") {
      this.handler({ type: "agent_delegating", agent: current });
    }

    if (current.status === "question" && prev.status !== "question" && (notify.question || notify.rueckfrage)) {
      this.handler({ type: "agent_question", agent: current });
    }

    if ((current.status === "offline" || current.status === "idle") && prev.status !== "offline" && prev.status !== "idle") {
      if (notify.agentFinished) {
        this.handler({ type: "agent_finished", agent: current, prevStatus: prev.status });
      }
    }
  }

  /** Index existing files in responses/ to avoid duplicate notifications */
  private indexExistingFiles(): void {
    if (!fs.existsSync(this.responsesDir)) return;
    try {
      const files = fs.readdirSync(this.responsesDir);
      for (const f of files) {
        this.seenFiles.add(path.join(this.responsesDir, f));
      }
    } catch {
      // ignore
    }
  }

  /** Handle new file appearing in responses/ */
  private onNewFile(filePath: string): void {
    if (this.seenFiles.has(filePath)) return;
    this.seenFiles.add(filePath);

    const basename = path.basename(filePath);
    this.classifyFile(basename, filePath);
  }

  /** Handle file content change (e.g. OUTPUT file filled after ACK) */
  private onFileChanged(filePath: string): void {
    const basename = path.basename(filePath);

    // Only care about OUTPUT files being filled (ACK → data transition)
    if (basename.endsWith("_OUTPUT.md")) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 0) {
          const match = basename.match(/^(.+)_OUTPUT\.md$/);
          if (match) {
            this.handler({
              type: "agent_output",
              agentId: "",
              requestId: match[1],
              filePath,
            });
          }
        }
      } catch {
        // file may have been moved/deleted
      }
    }
  }

  /** Classify a new file and emit the appropriate event */
  private classifyFile(basename: string, filePath: string): void {
    // MSG_CHILDREN_DONE_TO_{PARENT}.md
    const childrenDone = basename.match(/^MSG_CHILDREN_DONE_TO_(.+)\.md$/);
    if (childrenDone && this.config.notify.childrenDone) {
      const content = this.safeRead(filePath);
      this.handler({
        type: "children_done",
        parentId: childrenDone[1],
        filePath,
        content,
      });
      return;
    }

    // MSG_QUESTION_{FROM}_TO_{TO}.md
    const question = basename.match(/^MSG_QUESTION_(.+)_TO_(.+)\.md$/);
    if (question && (this.config.notify.question || this.config.notify.rueckfrage)) {
      const content = this.safeRead(filePath);
      this.handler({
        type: "question_msg",
        fromId: question[1],
        toId: question[2],
        filePath,
        content,
      });
      return;
    }

    // MSG_MILESTONE_*.md — Milestone reached
    const milestone = basename.match(/^MSG_MILESTONE_(.+)\.md$/);
    if (milestone) {
      const content = this.safeRead(filePath);
      this.handler({
        type: "milestone",
        name: milestone[1],
        filePath,
        content,
      });
      return;
    }

    // MSG_{*}_TO_USER.md — agent explicitly messaging the user
    const toUser = basename.match(/^MSG_(.+)_TO_USER\.md$/);
    if (toUser) {
      const content = this.safeRead(filePath);
      this.handler({
        type: "msg_to_user",
        fromId: toUser[1],
        filePath,
        content,
      });
      return;
    }
  }

  private safeRead(filePath: string): string {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return "(could not read file)";
    }
  }

  /** Handle new file in dev_messages/outgoing/ — developer bridge message */
  private onDevMessage(filePath: string): void {
    const basename = path.basename(filePath);
    if (!basename.endsWith(".md")) return;

    const content = this.safeRead(filePath);
    this.handler({ type: "dev_message", filePath, content });
  }

  /** Get current snapshot of all agents (for /status command) */
  getAgents(): AgentState[] {
    return Array.from(this.previousAgents.values());
  }
}
