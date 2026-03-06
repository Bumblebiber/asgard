import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawn } from "node:child_process";
import { Bot, InlineKeyboard } from "grammy";
import type { AgentState, TelegramConfig, WatcherEvent } from "./types.js";
import type { Watcher } from "./watcher.js";
import { t, roleLabel, setLocale, getLocale, type Locale } from "./i18n.js";

const STATUS_EMOJI: Record<string, string> = {
  busy: "\u{1F7E2}",        // green circle
  delegating: "\u{1F7E1}",  // yellow circle
  question: "\u{2753}",     // question mark
  idle: "\u{26AA}",         // white circle
  offline: "\u{26AB}",      // black circle
};

export class TelegramBot {
  private bot: Bot;
  private config: TelegramConfig;
  private watcher: Watcher | null = null;
  private chatId: number | null;
  private responsesDir: string;
  private pendingBrainstorms = new Map<string, string>(); // id → topic
  private activeCreativeSessions = new Map<string, { statusMsgId: number; chatId: number }>();
  private activeInterview: { agentId: string; projectId: string; chatId: number } | null = null;
  private agentMessages = new Map<string, {
    messageId: number;
    statuses: string[];
    startTime: number;
    template: string;
    role: string;
    tool: string;
    model: string;
    taskSummary: string;
  }>();
  private pendingDevQuestions = new Map<number, string>(); // telegram message_id → question ID

  constructor(config: TelegramConfig) {
    this.config = config;
    // Read token from environment variable first, fallback to config
    const token = process.env.TELEGRAM_BOT_TOKEN || config.botToken;
    this.bot = new Bot(token);
    this.chatId = config.ownerChatId;
    this.responsesDir = path.join(config.projectDir, "responses");

    // Load persisted locale
    if ((config as any).locale === "de" || (config as any).locale === "en") {
      setLocale((config as any).locale as Locale);
    }

    this.registerCommands();
  }

  /** Check if orchestrator is running, start it if not. Returns true if running. */
  private ensureOrchestrator(): { running: boolean; started: boolean } {
    try {
      const status = execSync("systemctl --user is-active council-orchestrator 2>/dev/null", { encoding: "utf-8" }).trim();
      if (status === "active") {
        return { running: true, started: false };
      }
    } catch {
      // not active
    }

    // Try to start it
    try {
      execSync("systemctl --user start council-orchestrator", { timeout: 10000 });
      console.log("[Orchestrator] Started via systemd");
      return { running: true, started: true };
    } catch (err) {
      console.error(`[Orchestrator] Failed to start: ${err}`);
      return { running: false, started: false };
    }
  }

  /** Re-spawn HEIMDALL to continue the intake interview after user replied */
  private respawnInterviewAgent(): void {
    if (!this.activeInterview) return;
    const { projectId } = this.activeInterview;

    const reqId = `REQ_HEIMDALL_CONTINUE_${Date.now().toString(36)}`;
    const command = t("heimdall.continue_command", { projectId });

    const req = {
      Type: "LAUNCH_AGENT",
      Template: "HEIMDALL",
      Agent_ID: "HEIMDALL",
      Role: "al",
      Command: command,
      Cwd: path.join(this.config.projectDir, "Agents", "HEIMDALL"),
      Request_ID: reqId,
      Terminate_After: false,
      Depth: 1,
    };

    const reqFile = path.join(this.config.projectDir, `${reqId}.json`);
    fs.writeFileSync(reqFile, JSON.stringify(req, null, 2), "utf-8");
    console.log(`[Interview] Re-spawned HEIMDALL for ${projectId}: ${reqId}`);
  }

  setWatcher(watcher: Watcher): void {
    this.watcher = watcher;
  }

  private registerCommands(): void {
    // /start — register chat and show welcome
    this.bot.command("start", async (ctx) => {
      this.chatId = ctx.chat.id;
      this.saveOwnerChatId(ctx.chat.id);
      await ctx.reply(
        t("bot.welcome", { chatId: ctx.chat.id }) + "\n\n" +
        t("bot.commands_header") + "\n" +
        t("bot.cmd.project") + "\n" +
        t("bot.cmd.status") + "\n" +
        t("bot.cmd.status_detail") + "\n" +
        t("bot.cmd.msg") + "\n" +
        t("bot.cmd.cost") + "\n" +
        t("bot.cmd.lang") + "\n" +
        t("bot.cmd.help"),
        { parse_mode: "Markdown" },
      );
    });

    // /lang de|en — change language
    this.bot.command("lang", async (ctx) => {
      const arg = ctx.match?.trim().toLowerCase();
      if (arg === "de" || arg === "en") {
        setLocale(arg as Locale);
        this.saveLocale(arg as Locale);
        await ctx.reply(t("lang.changed"));
      } else {
        await ctx.reply(t("lang.usage"), { parse_mode: "Markdown" });
      }
    });

    // /cost — cost overview
    this.bot.command("cost", async (ctx) => {
      const stats = this.readCostStats();
      if (!stats) {
        await ctx.reply(t("cost.no_data"));
        return;
      }

      const modelLines = Object.entries(stats.byModel)
        .sort(([, a], [, b]) => b - a)
        .map(([model, cost]) => `  \`${model}\`: $${cost.toFixed(4)}`)
        .join("\n");

      const byTool = Object.entries(stats.byTool)
        .sort(([, a], [, b]) => b - a)
        .map(([tool, cost]) => `  ${tool}: $${cost.toFixed(4)}`)
        .join("\n");

      await ctx.reply(
        `${t("cost.title")}\n\n` +
        `${t("cost.total")} $${stats.totalCost.toFixed(4)}\n` +
        `${t("cost.agent_runs")} ${stats.agentCount}\n\n` +
        `${t("cost.by_model")}\n${modelLines || `  ${t("cost.none")}`}\n\n` +
        `${t("cost.by_tool")}\n${byTool || `  ${t("cost.none")}`}`,
        { parse_mode: "Markdown" },
      );
    });

    // /help
    this.bot.command("help", async (ctx) => {
      await ctx.reply(
        `${t("bot.commands_header")}\n\n` +
        `${t("bot.cmd.project")}\n` +
        `${t("help.project_example")}\n\n` +
        `${t("help.status_all")}\n` +
        `${t("help.status_detail")}\n\n` +
        `${t("bot.cmd.msg")}\n` +
        `${t("help.msg_example")}\n\n` +
        `${t("help.cost_desc")}\n\n` +
        `${t("bot.cmd.lang")}\n\n` +
        `${t("help.notifications_header")}\n` +
        `${t("help.notif.started")}\n` +
        `${t("help.notif.question")}\n` +
        `${t("help.notif.children")}\n` +
        `${t("help.notif.messages")}`,
        { parse_mode: "Markdown" },
      );
    });

    // /status [agent_id]
    this.bot.command("status", async (ctx) => {
      if (!this.watcher) {
        await ctx.reply(t("status.watcher_not_init"));
        return;
      }

      const args = ctx.match?.trim();
      const agents = this.watcher.getAgents();

      if (args) {
        // Specific agent
        const agent = agents.find((a) => a.id.toLowerCase() === args.toLowerCase());
        if (!agent) {
          await ctx.reply(t("status.agent_not_found", { id: args }), { parse_mode: "Markdown" });
          return;
        }
        await ctx.reply(this.formatAgentDetail(agent), { parse_mode: "Markdown" });
        return;
      }

      // All agents
      if (agents.length === 0) {
        await ctx.reply(t("status.no_agents"));
        return;
      }

      const lines = agents.map((a) => {
        const emoji = STATUS_EMOJI[a.status] || "\u{2B1C}";
        const role = a.role ? ` [${a.role.toUpperCase()}]` : "";
        const duration = a.busySince ? ` (${this.formatDuration(Date.now() - a.busySince)})` : "";
        return `${emoji} \`${a.id}\`${role} — ${a.status}${duration}`;
      });

      await ctx.reply(t("status.header", { count: agents.length }) + `\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    });

    // /msg <agent_id> <text>
    this.bot.command("msg", async (ctx) => {
      const text = ctx.match?.trim();
      if (!text) {
        await ctx.reply(t("msg.usage"), { parse_mode: "Markdown" });
        return;
      }

      const spaceIdx = text.indexOf(" ");
      if (spaceIdx === -1) {
        await ctx.reply(t("msg.usage"), { parse_mode: "Markdown" });
        return;
      }

      const agentId = text.substring(0, spaceIdx).toUpperCase();
      const message = text.substring(spaceIdx + 1).trim();

      if (!message) {
        await ctx.reply(t("msg.empty"));
        return;
      }

      // Write MSG file: responses/MSG_USER_TO_{AGENT_ID}.md
      const msgFile = path.join(this.responsesDir, `MSG_USER_TO_${agentId}.md`);
      const content = `${t("msg.file_header")}\n\n${message}\n\n**Timestamp**: ${new Date().toISOString()}\n`;

      try {
        fs.mkdirSync(this.responsesDir, { recursive: true });
        fs.writeFileSync(msgFile, content, "utf-8");
        await ctx.reply(t("msg.sent", { id: agentId }), { parse_mode: "Markdown" });
      } catch (err) {
        await ctx.reply(t("msg.error", { err: String(err) }));
      }
    });

    // /project <name> <description>
    this.bot.command("project", async (ctx) => {
      const text = ctx.match?.trim();
      if (!text) {
        await ctx.reply(t("project.usage"), { parse_mode: "Markdown" });
        return;
      }

      const spaceIdx = text.indexOf(" ");
      const projectName = spaceIdx === -1 ? text : text.substring(0, spaceIdx);
      const description = spaceIdx === -1 ? "" : text.substring(spaceIdx + 1).trim();

      // Validate name (alphanumeric + dash/underscore)
      if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
        await ctx.reply(t("project.invalid_name"));
        return;
      }

      const blueprintDir = path.join(this.config.projectDir, "Projects", "P0_Project_Blueprint_PL");
      const projectsDir = path.join(this.config.projectDir, "Projects");

      // Check Blueprint exists
      if (!fs.existsSync(blueprintDir)) {
        await ctx.reply(t("project.blueprint_missing"));
        return;
      }

      // Determine next project ID: P{N+1}_{NAME}_PL
      let maxN = 0;
      try {
        const existing = fs.readdirSync(projectsDir);
        for (const d of existing) {
          const m = d.match(/^P(\d+)_/);
          if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
        }
      } catch { /* projectsDir may not exist yet */ }
      const projectId = `P${maxN + 1}_${projectName}_PL`;
      const projectDir = path.join(projectsDir, projectId);

      // Check project doesn't already exist
      if (fs.existsSync(projectDir)) {
        await ctx.reply(t("project.exists", { name: projectId }), { parse_mode: "Markdown" });
        return;
      }

      try {
        // 1. Create project directory and copy Blueprint
        fs.mkdirSync(projectsDir, { recursive: true });
        execSync(`cp -r "${blueprintDir}" "${projectDir}"`, { timeout: 10000 });

        // 2. Create responses/ in project
        fs.mkdirSync(path.join(projectDir, "responses"), { recursive: true });

        // 3. Write REQ to spawn HEIMDALL for intake interview
        const requestId = `REQ_HEIMDALL_${projectId}_${Date.now().toString(36)}`;
        const heimdallCommand = t("heimdall.spawn_command", {
          projectId,
          projectName,
          description: description || "—",
          chatId: String(ctx.chat.id),
        });

        const req = {
          Type: "LAUNCH_AGENT",
          Template: "HEIMDALL",
          Agent_ID: "HEIMDALL",
          Role: "al",
          Command: heimdallCommand,
          Cwd: path.join(this.config.projectDir, "Agents", "HEIMDALL"),
          Request_ID: requestId,
          Terminate_After: false,
          Depth: 1,
        };

        const reqFile = path.join(this.config.projectDir, `${requestId}.json`);
        fs.writeFileSync(reqFile, JSON.stringify(req, null, 2), "utf-8");

        // 4. Set active interview state — plain text messages will be routed to HEIMDALL
        this.activeInterview = { agentId: "HEIMDALL", projectId, chatId: ctx.chat.id };

        // 5. Ensure orchestrator is running
        const orch = this.ensureOrchestrator();
        const orchStatus = orch.started ? t("project.orch_started")
          : orch.running ? t("project.orch_running")
          : t("project.orch_failed");

        await ctx.reply(
          `${t("project.created_title", { name: projectId })}\n\n` +
          `${t("project.blueprint_copied", { name: projectId })}\n` +
          `${orchStatus}\n\n` +
          (description ? `${t("project.description")} ${description}\n\n` : "") +
          t("project.heimdall_spawned"),
          { parse_mode: "Markdown" },
        );

        console.log(`[Project] Created: ${projectId} → ${projectDir}, spawning HEIMDALL for intake`);
      } catch (err) {
        await ctx.reply(t("project.error", { err: String(err) }));
        console.error(`[Project] Error: ${err}`);
      }
    });

    // /dev <message> — send a message to Claude Code (developer bridge)
    this.bot.command("dev", async (ctx) => {
      if (ctx.chat.id !== this.chatId) return; // owner only

      const message = ctx.match?.trim();
      if (!message) {
        await ctx.reply("Usage: `/dev <message>`\n\nSend a message to the running Claude Code session.", { parse_mode: "Markdown" });
        return;
      }

      const thinking = await ctx.reply("⏳ Claude is thinking...");

      try {
        const response = await this.runClaude(message);
        // Edit the "thinking" message, or send new message if too long
        const truncated = response.length > 4000
          ? response.substring(0, 3900) + "\n\n_(response truncated)_"
          : response;

        await this.bot.api.editMessageText(ctx.chat.id, thinking.message_id, truncated || "_(no response)_");
      } catch (err) {
        await this.bot.api.editMessageText(ctx.chat.id, thinking.message_id, `❌ Error: ${err}`);
      }
    });

    // /brainstorm <topic> — quick brainstorm with cheap models
    this.bot.command("brainstorm", async (ctx) => {
      if (ctx.chat.id !== this.chatId) return;

      const topic = ctx.match?.trim();
      if (!topic) {
        await ctx.reply(
          "Usage: `/brainstorm <topic>`\n\nStarte eine schnelle Expertenrunde mit günstigen Modellen.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      const id = Date.now().toString(36);
      this.pendingBrainstorms.set(id, topic);

      // Auto-expire after 5 minutes
      setTimeout(() => this.pendingBrainstorms.delete(id), 5 * 60 * 1000);

      const kb = new InlineKeyboard()
        .text("⚡ Schnell — 3 Agenten, 1 Runde", `bs:${id}:3:1`).row()
        .text("✅ Standard — 4 Agenten, 2 Runden", `bs:${id}:4:2`).row()
        .text("🔍 Gründlich — 5 Agenten, 3 Runden", `bs:${id}:5:3`).row()
        .text("🏛 Tiefgang — 6 Agenten, 4 Runden", `bs:${id}:6:4`);

      await ctx.reply(
        `🧠 *Brainstorm*\n\nThema: _${this.escapeMarkdown(topic)}_\n\nWähle den Modus:`,
        { parse_mode: "Markdown", reply_markup: kb },
      );
    });

    // Callback: brainstorm mode selected
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (!data.startsWith("bs:")) {
        await ctx.answerCallbackQuery();
        return;
      }

      const parts = data.split(":");
      const id = parts[1];
      const agentCount = parseInt(parts[2], 10);
      const rounds = parseInt(parts[3], 10);

      const topic = this.pendingBrainstorms.get(id);
      if (!topic) {
        await ctx.answerCallbackQuery("Session abgelaufen — bitte /brainstorm erneut starten.");
        return;
      }
      this.pendingBrainstorms.delete(id);

      const chatId = ctx.chat?.id ?? this.chatId!;
      const modeLabel = agentCount <= 3 ? "Schnell" : agentCount <= 4 ? "Standard" : agentCount <= 5 ? "Gründlich" : "Tiefgang";

      await ctx.answerCallbackQuery("Brainstorm gestartet!");
      const statusMsg = await ctx.editMessageText(
        `🧠 *Brainstorm gestartet*\n\nThema: _${this.escapeMarkdown(topic)}_\nModus: ${modeLabel} (${agentCount} Agenten, ${rounds} Runden)\n\n⏳ SKALD koordiniert die Session...`,
        { parse_mode: "Markdown" },
      );
      const statusMsgId = (statusMsg && typeof statusMsg === "object" && "message_id" in statusMsg)
        ? (statusMsg as { message_id: number }).message_id
        : ctx.callbackQuery.message?.message_id;

      this.spawnSkald("Quickstart_Brainstorm", topic, `${agentCount} Agenten, ${rounds} Runden`, id, chatId, statusMsgId!);
    });

    // /hats <topic> — Six Thinking Hats (6 parallel agents)
    this.bot.command("hats", async (ctx) => {
      if (ctx.chat.id !== this.chatId) return;
      const topic = ctx.match?.trim();
      if (!topic) {
        await ctx.reply(
          "Usage: `/hats <thema>`\n\nAnalysiert dein Thema mit Edward de Bono's *Six Thinking Hats* — 6 Agenten, 6 Perspektiven, parallel.",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const sessionId = Date.now().toString(36);
      const statusMsg = await ctx.reply(
        `🎩 *Six Thinking Hats*\n\nThema: _${this.escapeMarkdown(topic)}_\n\n⏳ SKALD koordiniert die Session...`,
        { parse_mode: "Markdown" },
      );
      this.spawnSkald("Quickstart_Six_Thinking_Hats", topic, "6 Agenten parallel", sessionId, ctx.chat.id, statusMsg.message_id);
    });

    // /disney <topic> — Walt Disney Method (Dreamer → Realist → Critic)
    this.bot.command("disney", async (ctx) => {
      if (ctx.chat.id !== this.chatId) return;
      const topic = ctx.match?.trim();
      if (!topic) {
        await ctx.reply(
          "Usage: `/disney <thema>`\n\nAnalysiert dein Thema mit der *Walt Disney Methode* — Dreamer → Realist → Critic, sequenziell.",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const sessionId = Date.now().toString(36);
      const statusMsg = await ctx.reply(
        `🎬 *Walt Disney Method*\n\nThema: _${this.escapeMarkdown(topic)}_\n\n⏳ SKALD koordiniert die Session...`,
        { parse_mode: "Markdown" },
      );
      this.spawnSkald("Quickstart_Disney_Method", topic, "Dreamer → Realist → Critic", sessionId, ctx.chat.id, statusMsg.message_id);
    });

    // /635 <topic> — Brainwriting 6-3-5
    this.bot.command("635", async (ctx) => {
      if (ctx.chat.id !== this.chatId) return;
      const topic = ctx.match?.trim();
      if (!topic) {
        await ctx.reply(
          "Usage: `/635 <thema>`\n\nBrainwriting *6-3-5* — 6 Agenten, 3 Ideen, 5 Runden mit zirkulärer Weitergabe.",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const sessionId = Date.now().toString(36);
      const statusMsg = await ctx.reply(
        `📝 *Brainwriting 6-3-5*\n\nThema: _${this.escapeMarkdown(topic)}_\n\n⏳ SKALD koordiniert die Session...`,
        { parse_mode: "Markdown" },
      );
      this.spawnSkald("Quickstart_635", topic, "6 Agenten, 3 Ideen, 5 Runden", sessionId, ctx.chat.id, statusMsg.message_id);
    });

    // Catch-all: plain text from owner = dev message (shorthand for /dev)
    this.bot.on("message:text", async (ctx) => {
      // Auto-register chat ID if not set
      if (!this.chatId) {
        this.chatId = ctx.chat.id;
        this.saveOwnerChatId(ctx.chat.id);
      }

      // Non-owner: ignore
      if (ctx.chat.id !== this.chatId) return;

      const message = ctx.message.text.trim();

      // Dev-ask reply routing: user replied to a question from Claude Code
      const replyTo = ctx.message.reply_to_message?.message_id;
      if (replyTo && this.pendingDevQuestions.has(replyTo)) {
        const questionId = this.pendingDevQuestions.get(replyTo)!;
        this.pendingDevQuestions.delete(replyTo);
        const incomingDir = path.join(this.config.projectDir, "dev_messages", "incoming");
        const replyFile = path.join(incomingDir, `${questionId}_reply.md`);
        try {
          fs.mkdirSync(incomingDir, { recursive: true });
          fs.writeFileSync(replyFile, message, "utf-8");
          await ctx.reply("\u{2705} Reply sent to Claude Code.");
          console.log(`[DevBridge] Reply written: ${questionId}_reply.md`);
        } catch (err) {
          await ctx.reply(`\u{274C} Failed to route reply: ${err}`);
        }
        return;
      }

      // Active interview — route plain text to HEIMDALL and re-spawn
      if (this.activeInterview && this.activeInterview.chatId === ctx.chat.id) {
        const heimdallDir = path.join(this.config.projectDir, "Agents", "HEIMDALL");
        const heimdallResponsesDir = path.join(heimdallDir, "responses");
        const msgFile = path.join(heimdallResponsesDir, "MSG_USER_TO_HEIMDALL.md");
        const content = `## Antwort\n\n${message}\n\n**Timestamp**: ${new Date().toISOString()}\n`;
        try {
          fs.mkdirSync(heimdallResponsesDir, { recursive: true });
          fs.writeFileSync(msgFile, content, "utf-8");
          await ctx.reply(t("project.interview_routing"), { parse_mode: "Markdown" });
          // Re-spawn HEIMDALL to process the answer and ask the next question
          this.respawnInterviewAgent();
        } catch (err) {
          await ctx.reply(`❌ Fehler beim Weiterleiten: ${err}`);
        }
        return;
      }

      // Owner plain text → forward to Claude Code
      const thinking = await ctx.reply("⏳ Claude is thinking...");

      try {
        const response = await this.runClaude(message);
        const truncated = response.length > 4000
          ? response.substring(0, 3900) + "\n\n_(response truncated)_"
          : response;
        await this.bot.api.editMessageText(ctx.chat.id, thinking.message_id, truncated || "_(no response)_");
      } catch (err) {
        await this.bot.api.editMessageText(ctx.chat.id, thinking.message_id, `❌ Error: ${err}`);
      }
    });
  }

  /** Handle a watcher event — send notification to owner */
  async handleEvent(event: WatcherEvent): Promise<void> {
    if (!this.chatId) return;

    let text = "";

    switch (event.type) {
      case "agent_started":
        // Don't notify for individual worker starts — too noisy
        if (event.agent.role === "worker") return;
        // Suppress HEIMDALL restart notifications during active interview — too noisy
        if (this.activeInterview && event.agent.id.startsWith(this.activeInterview.agentId)) return;
        // SKALD creative sessions already have a status message from the command handler
        if (this.activeCreativeSessions.has(event.agent.id)) return;
        {
          const tracked = {
            messageId: 0,
            statuses: ["busy"],
            startTime: Date.now(),
            template: event.agent.template || event.agent.id,
            role: event.agent.role,
            tool: event.agent.tool,
            model: event.agent.model,
            taskSummary: event.agent.taskSummary || "",
          };
          this.agentMessages.set(event.agent.id, tracked);
          const msg = this.formatTrackedAgentMessage(event.agent.id, tracked);
          await this.sendOrEditAgentMessage(event.agent.id, msg);
        }
        return;

      case "agent_finished":
        // Check if this is HEIMDALL finishing an intake interview
        if (this.activeInterview && event.agent.id === this.activeInterview.agentId) {
          const { projectId } = this.activeInterview;
          const heimdallDir = path.join(this.config.projectDir, "Agents", "HEIMDALL");
          const reportPath = path.join(heimdallDir, `INTAKE_REPORT_${projectId}.md`);

          if (fs.existsSync(reportPath)) {
            // Interview complete — HEIMDALL wrote the intake report
            this.activeInterview = null;
            await this.bot.api.sendMessage(this.chatId!,
              t("project.interview_complete", { projectId }),
              { parse_mode: "Markdown" },
            ).catch(() => {});
          } else {
            // Check if HEIMDALL has a question for the user
            const questionFile = path.join(heimdallDir, "responses", "MSG_QUESTION_HEIMDALL_TO_USER.md");
            if (fs.existsSync(questionFile)) {
              const question = fs.readFileSync(questionFile, "utf-8").trim();
              try { fs.unlinkSync(questionFile); } catch { /* ignore */ }
              // Forward question to user — keep activeInterview active
              try {
                await this.bot.api.sendMessage(this.chatId!, question, { parse_mode: "Markdown" });
              } catch {
                await this.bot.api.sendMessage(this.chatId!, question).catch(() => {});
              }
              console.log(`[Interview] Forwarded HEIMDALL question for ${projectId}`);
            } else {
              // No report, no question — interview failed
              this.activeInterview = null;
              await this.bot.api.sendMessage(this.chatId!,
                t("project.interview_aborted"),
                { parse_mode: "Markdown" },
              ).catch(() => {});
            }
          }
          return;
        }
        // Check if this is a SKALD creative session finishing
        const creativeSession = this.activeCreativeSessions.get(event.agent.id);
        if (creativeSession) {
          this.activeCreativeSessions.delete(event.agent.id);
          this.agentMessages.delete(event.agent.id);
          await this.bot.api.deleteMessage(creativeSession.chatId, creativeSession.statusMsgId).catch(() => {});
          return;
        }
        // Only report PL/AL completion, workers are too granular
        if (event.agent.role === "worker") return;
        {
          const tracked = this.agentMessages.get(event.agent.id);
          if (tracked) {
            tracked.statuses.push("offline");
            const msg = this.formatTrackedAgentMessage(event.agent.id, tracked);
            await this.sendOrEditAgentMessage(event.agent.id, msg);
            this.agentMessages.delete(event.agent.id);
          } else {
            const name = event.agent.template || event.agent.id;
            const idSuffix = name !== event.agent.id ? `  _(${event.agent.id})_` : "";
            const msg = `${STATUS_EMOJI.offline} ${t("event.agent_finished")} \`${name}\`${idSuffix}\n` +
              `${t("event.role")} ${roleLabel(event.agent.role)}`;
            try {
              await this.bot.api.sendMessage(this.chatId!, msg, { parse_mode: "Markdown" });
            } catch {
              await this.bot.api.sendMessage(this.chatId!, msg).catch(() => {});
            }
          }
        }
        return;

      case "agent_delegating":
        {
          const tracked = this.agentMessages.get(event.agent.id);
          if (tracked) {
            tracked.statuses.push("delegating");
            const extra = t("event.waiting_children", { count: event.agent.childAgentIds.length });
            const msg = this.formatTrackedAgentMessage(event.agent.id, tracked, extra);
            await this.sendOrEditAgentMessage(event.agent.id, msg);
          } else {
            const name = event.agent.template || event.agent.id;
            const msg = `${STATUS_EMOJI.delegating} ${t("event.agent_delegating")} \`${name}\`\n` +
              t("event.waiting_children", { count: event.agent.childAgentIds.length });
            try {
              await this.bot.api.sendMessage(this.chatId!, msg, { parse_mode: "Markdown" });
            } catch {
              await this.bot.api.sendMessage(this.chatId!, msg).catch(() => {});
            }
          }
        }
        return;

      case "agent_question":
        {
          const tracked = this.agentMessages.get(event.agent.id);
          if (tracked) {
            tracked.statuses.push("question");
            const extra = t("event.question_detail");
            const msg = this.formatTrackedAgentMessage(event.agent.id, tracked, extra);
            await this.sendOrEditAgentMessage(event.agent.id, msg);
          } else {
            const name = event.agent.template || event.agent.id;
            const msg = `${STATUS_EMOJI.question} ${t("event.question_from")} \`${name}\`\n` +
              t("event.question_detail");
            try {
              await this.bot.api.sendMessage(this.chatId!, msg, { parse_mode: "Markdown" });
            } catch {
              await this.bot.api.sendMessage(this.chatId!, msg).catch(() => {});
            }
          }
        }
        return;

      case "milestone":
        text = `\u{1F3C6} ${t("event.milestone")} \`${event.name}\`\n\n` +
          `${this.escapeMarkdown(this.truncate(event.content, 1000))}`;
        break;

      case "children_done":
        text = `\u{2705} ${t("event.phase_done")} \`${event.parentId}\`\n` +
          `${this.escapeMarkdown(this.truncate(event.content, 500))}`;
        break;

      case "question_msg": {
        const preview = this.extractQuestion(event.content);
        text = `${STATUS_EMOJI.question} ${t("event.question_msg")} \`${event.fromId}\` \u{2192} \`${event.toId}\`\n\n` +
          `${this.escapeMarkdown(preview)}\n\n` +
          `${t("event.reply_via")} \`/msg ${event.toId} <${getLocale() === "de" ? "Antwort" : "reply"}>\``;
        break;
      }

      case "msg_to_user":
        text = `\u{1F4E8} ${t("event.msg_from")} \`${event.fromId}\`:\n\n${this.escapeMarkdown(this.truncate(event.content, 1000))}`;
        break;

      case "agent_output":
        // Don't notify for every output — too noisy
        return;

      case "dev_message":
        {
          const basename = path.basename(event.filePath);
          const isQuestion = basename.includes("_question");
          const prefix = isQuestion ? "\u{2753} *Dev Question:*\n\n" : "\u{1F4AC} *Dev:*\n\n";
          const content = event.content.trim();
          const truncated = content.length > 3500
            ? content.substring(0, 3400) + "\n\n_(truncated)_"
            : content;

          try {
            const sent = await this.bot.api.sendMessage(
              this.chatId!,
              prefix + truncated,
              {
                parse_mode: "Markdown",
                ...(isQuestion ? { reply_markup: { force_reply: true, selective: true } } : {}),
              },
            );

            // Track question messages for reply routing
            if (isQuestion) {
              const idMatch = basename.match(/^(.+)_question\.md$/);
              if (idMatch) {
                this.pendingDevQuestions.set(sent.message_id, idMatch[1]);
                // Auto-expire after 35 minutes (slightly over the 30min poll timeout)
                setTimeout(() => this.pendingDevQuestions.delete(sent.message_id), 35 * 60 * 1000);
              }
            }
          } catch {
            await this.bot.api.sendMessage(this.chatId!, prefix + truncated).catch(() => {});
          }

          // Delete the outgoing file after sending
          try { fs.unlinkSync(event.filePath); } catch { /* ignore */ }
        }
        return;

      default:
        return;
    }

    // Agent events are handled inline above and return early.
    // Only non-agent events (milestone, children_done, question_msg, msg_to_user) reach here.
    if (!text) return;

    try {
      await this.bot.api.sendMessage(this.chatId, text, { parse_mode: "Markdown" });
    } catch (err) {
      console.error(`[Telegram] Markdown parse failed, retrying as plain text: ${err}`);
      // Fallback: Send without Markdown parsing when content is problematic
      try {
        await this.bot.api.sendMessage(this.chatId, text);
      } catch (err2) {
        console.error(`[Telegram] Failed to send message (plain): ${err2}`);
      }
    }
  }

  async start(): Promise<void> {
    console.log("[Telegram] Starting bot...");

    // Drop old polling sessions to avoid 409 Conflict
    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      console.log("[Telegram] Webhook/pending updates cleared.");
    } catch (err) {
      console.warn(`[Telegram] deleteWebhook failed (ignored): ${err}`);
    }

    // Retry loop: on 409 Conflict (previous long-poll not yet expired),
    // wait and retry instead of crashing — avoids the restart death spiral
    let retryDelay = 15_000;
    while (true) {
      try {
        await this.bot.start({
          drop_pending_updates: true,
          onStart: () => {
            console.log("[Telegram] Bot is running.");
            retryDelay = 15_000; // reset on successful start
            if (this.chatId) {
              this.bot.api.sendMessage(this.chatId, t("bot.started"), { parse_mode: "Markdown" }).catch(() => {});
            }
          },
        });
        break; // clean exit (e.g. bot.stop() called)
      } catch (err: any) {
        if (err?.error_code === 409) {
          console.warn(`[Telegram] 409 Conflict — another poll active. Retrying in ${retryDelay / 1000}s...`);
          await new Promise(r => setTimeout(r, retryDelay));
          retryDelay = Math.min(retryDelay * 2, 60_000); // max 60s backoff
        } else {
          throw err; // re-throw unexpected errors
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.chatId) {
      try {
        await this.bot.api.sendMessage(this.chatId, t("bot.stopped"), { parse_mode: "Markdown" });
      } catch { /* ignore */ }
    }
    this.bot.stop();
  }

  /**
   * Run `claude -p "<message>" --continue` non-interactively in the project dir.
   * Returns the full response text. Rejects on non-zero exit or timeout.
   */
  private runClaude(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max

      // Use repo root (one level above Althing_CEO) — matches the interactive session's CWD
      const repoRoot = path.resolve(this.config.projectDir, "..");
      // Remove CLAUDECODE env var — prevents "nested session" error when bot runs inside Claude
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const proc = spawn("claude", ["-p", message, "--continue", "--dangerously-skip-permissions"], {
        cwd: repoRoot,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("Claude timed out after 15 minutes"));
      }, TIMEOUT_MS);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 || stdout.trim()) {
          resolve(stdout.trim() || stderr.trim());
        } else {
          reject(new Error(`claude exited with code ${code}: ${stderr.trim().substring(0, 200)}`));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to launch claude: ${err.message}`));
      });
    });
  }

  /** Spawn SKALD as creative coordinator for a Quickstart session */
  private spawnSkald(
    skill: "Quickstart_Brainstorm" | "Quickstart_Six_Thinking_Hats" | "Quickstart_Disney_Method" | "Quickstart_635",
    topic: string,
    details: string,
    sessionId: string,
    chatId: number,
    statusMsgId: number,
  ): void {
    this.ensureOrchestrator();
    const agentId = `SKALD_${sessionId}`;
    const msgFile = `responses/MSG_${agentId}_TO_USER.md`;

    const command = [
      "Du bist SKALD, der Kreativtechnik-Koordinator des Althing.",
      "",
      "Fuehre folgende Kreativsession durch:",
      `Thema: ${topic}`,
      `Details: ${details}`,
      "",
      "Lies und befolge den Skill:",
      `  skills/${skill}/SKILL.md`,
      "",
      "Am Ende:",
      "1. Bewerte die Ergebnisse als Kreativexperte: Was sind die wichtigsten Erkenntnisse?",
      "2. Welche Ideen sind am vielversprechendsten und warum?",
      `3. Schreibe deine vollstaendige Synthese + Bewertung nach: ${msgFile}`,
      "   Format: Markdown, max. 600 Woerter, direkt lesbar in Telegram.",
    ].join("\n");

    const req = {
      Type: "LAUNCH_AGENT",
      Template: "SKALD",
      Agent_ID: agentId,
      Role: "al",
      Command: command,
      Cwd: this.config.projectDir,
      Request_ID: `REQ_${agentId}`,
      Terminate_After: true,
      Depth: 1,
    };

    const reqFile = path.join(this.config.projectDir, `REQ_${agentId}.json`);
    fs.writeFileSync(reqFile, JSON.stringify(req, null, 2), "utf-8");
    this.activeCreativeSessions.set(agentId, { statusMsgId, chatId });
    console.log(`[Creative] Spawned SKALD as ${agentId} for ${skill}`);
  }

  /** Format a unified status message for a tracked agent */
  private formatTrackedAgentMessage(
    agentId: string,
    info: { template: string; role: string; tool: string; model: string; taskSummary: string; statuses: string[]; startTime: number },
    extra?: string,
  ): string {
    const current = info.statuses[info.statuses.length - 1];
    const emoji = STATUS_EMOJI[current] || "\u{2B1C}";
    const name = info.template;
    const idSuffix = name !== agentId ? `  _(${agentId})_` : "";
    const taskLine = info.taskSummary ? `\nTask: ${info.taskSummary}` : "";
    const statusTrail = info.statuses.map(s => STATUS_EMOJI[s] || s).join(" \u{2192} ");

    const elapsed = Date.now() - info.startTime;
    const runtime = elapsed > 2000 ? `\n\u{23F1} ${this.formatDuration(elapsed)}` : "";

    let text = `${emoji} \`${name}\`${idSuffix}\n` +
      `${t("event.role")} ${roleLabel(info.role)}` +
      `${taskLine}\n` +
      `Tool: ${info.tool} / ${info.model}\n` +
      statusTrail +
      runtime;

    if (extra) text += `\n${extra}`;
    return text;
  }

  /** Send a new message or edit an existing tracked agent message */
  private async sendOrEditAgentMessage(agentId: string, text: string): Promise<void> {
    if (!this.chatId) return;
    const tracked = this.agentMessages.get(agentId);
    if (tracked && tracked.messageId) {
      try {
        await this.bot.api.editMessageText(this.chatId, tracked.messageId, text, { parse_mode: "Markdown" });
        return;
      } catch {
        // Edit failed (message deleted or too old) — fall through to send new
      }
    }

    try {
      const sent = await this.bot.api.sendMessage(this.chatId, text, { parse_mode: "Markdown" });
      if (tracked) tracked.messageId = sent.message_id;
    } catch {
      try {
        const sent = await this.bot.api.sendMessage(this.chatId, text);
        if (tracked) tracked.messageId = sent.message_id;
      } catch (err) {
        console.error(`[Telegram] Failed to send agent message: ${err}`);
      }
    }
  }

  private formatAgentDetail(a: AgentState): string {
    const emoji = STATUS_EMOJI[a.status] || "\u{2B1C}";
    const duration = a.busySince ? this.formatDuration(Date.now() - a.busySince) : "—";
    const children = a.childAgentIds.length > 0 ? a.childAgentIds.join(", ") : t("detail.none");

    return `${emoji} *${a.id}*\n\n` +
      `${t("detail.status")} ${a.status}\n` +
      `${t("detail.role")} ${roleLabel(a.role)}\n` +
      `${t("detail.tool")} ${a.tool}\n` +
      `${t("detail.model")} ${a.model}\n` +
      `${t("detail.pid")} ${a.pid || "—"}\n` +
      `${t("detail.duration")} ${duration}\n` +
      `${t("detail.request")} \`${a.currentRequestId}\`\n` +
      `${t("detail.depth")} ${a.depth}\n` +
      `${t("detail.spawned_by")} ${a.spawnedBy || "—"}\n` +
      `${t("detail.report_to")} ${a.reportTo || "—"}\n` +
      `${t("detail.children")} ${children}`;
  }

  private formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + `\n\n${t("misc.truncated")}`;
  }

  /** Escape special characters for Telegram Markdown (v1) */
  private escapeMarkdown(text: string): string {
    return text
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[");
  }

  private extractQuestion(content: string): string {
    // Try to extract the question section — supports both German and English markers
    const match = content.match(/##\s*(Rueckfrage|Question)\s*\n([\s\S]*?)(?:\n\*\*Status|$)/i);
    if (match) return match[2].trim();
    return this.truncate(content, 500);
  }

  private readCostStats(): { totalCost: number; agentCount: number; byModel: Record<string, number>; byTool: Record<string, number> } | null {
    const logFile = path.join(this.config.projectDir, "orchestrator", "logs", "cost_tracking.jsonl");
    if (!fs.existsSync(logFile)) return null;

    try {
      const lines = fs.readFileSync(logFile, "utf-8").trim().split("\n");
      const byModel: Record<string, number> = {};
      const byTool: Record<string, number> = {};
      let totalCost = 0;
      let count = 0;

      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          totalCost += entry.estimated_cost_usd || 0;
          count++;
          byModel[entry.model] = (byModel[entry.model] || 0) + (entry.estimated_cost_usd || 0);
          byTool[entry.tool] = (byTool[entry.tool] || 0) + (entry.estimated_cost_usd || 0);
        } catch { /* skip */ }
      }

      if (count === 0) return null;
      return { totalCost, agentCount: count, byModel, byTool };
    } catch {
      return null;
    }
  }

  /** Send a long message, splitting at paragraph boundaries if > 4000 chars */
  private async sendLongMessage(chatId: number, text: string, parseMode?: "Markdown" | "HTML"): Promise<void> {
    const MAX_LEN = 4000;
    if (text.length <= MAX_LEN) {
      await this.bot.api.sendMessage(chatId, text, parseMode ? { parse_mode: parseMode } : undefined);
      return;
    }

    // Split at paragraph boundaries (double newline)
    const paragraphs = text.split("\n\n");
    let chunk = "";

    for (const para of paragraphs) {
      if (chunk.length + para.length + 2 > MAX_LEN && chunk.length > 0) {
        await this.bot.api.sendMessage(chatId, chunk.trim(), parseMode ? { parse_mode: parseMode } : undefined);
        chunk = "";
      }
      chunk += (chunk ? "\n\n" : "") + para;
    }

    if (chunk.trim()) {
      await this.bot.api.sendMessage(chatId, chunk.trim(), parseMode ? { parse_mode: parseMode } : undefined);
    }
  }

  private saveOwnerChatId(chatId: number): void {
    const configPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "telegram.config.json");
    try {
      const candidates = [
        path.join(this.config.projectDir, "telegram-service", "telegram.config.json"),
        configPath,
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
          raw.ownerChatId = chatId;
          fs.writeFileSync(p, JSON.stringify(raw, null, 2) + "\n", "utf-8");
          console.log(`[Telegram] Owner chat ID saved: ${chatId}`);
          return;
        }
      }
    } catch (err) {
      console.error(`[Telegram] Could not save chat ID: ${err}`);
    }
  }

  private saveLocale(locale: Locale): void {
    const candidates = [
      path.join(this.config.projectDir, "telegram-service", "telegram.config.json"),
      path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "telegram.config.json"),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
          raw.locale = locale;
          fs.writeFileSync(p, JSON.stringify(raw, null, 2) + "\n", "utf-8");
          console.log(`[Telegram] Locale saved: ${locale}`);
          return;
        }
      } catch (err) {
        console.error(`[Telegram] Could not save locale: ${err}`);
      }
    }
  }
}
