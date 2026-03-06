// Minimal types for telegram-service — decoupled from orchestrator

export interface TelegramConfig {
  botToken: string;
  ownerChatId: number | null;
  projectDir: string;
  pollIntervalMs: number;
  locale?: "de" | "en";
  notify: {
    agentStarted: boolean;
    agentFinished: boolean;
    question: boolean;    // Config field for question notifications (formerly "rueckfrage")
    rueckfrage?: boolean; // Backward-compat alias
    childrenDone: boolean;
    errors: boolean;
  };
}

// Mirrors orchestrator's Agent — only fields we need
export interface AgentState {
  id: string;
  status: "offline" | "busy" | "delegating" | "question" | "idle" | "continuing";
  pid: number;
  tool: string;
  model: string;
  role: string;
  busySince: number;
  currentRequestId: string;
  responsesDir: string;
  spawnedBy: string;
  reportTo: string;
  childAgentIds: string[];
  depth: number;
  template: string;
  taskSummary: string;
}

export interface StateFile {
  version: string;
  timestamp: string;
  agents: AgentState[];
}

export type WatcherEvent =
  | { type: "agent_started"; agent: AgentState }
  | { type: "agent_finished"; agent: AgentState; prevStatus: string }
  | { type: "agent_delegating"; agent: AgentState }
  | { type: "agent_question"; agent: AgentState }
  | { type: "children_done"; parentId: string; filePath: string; content: string }
  | { type: "question_msg"; fromId: string; toId: string; filePath: string; content: string }
  | { type: "msg_to_user"; fromId: string; filePath: string; content: string }
  | { type: "milestone"; name: string; filePath: string; content: string }
  | { type: "agent_output"; agentId: string; requestId: string; filePath: string }
  | { type: "interview_complete"; projectId: string; friggId: string }
  | { type: "dev_message"; filePath: string; content: string };
