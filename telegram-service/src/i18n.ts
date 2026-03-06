// Simple i18n system for the Telegram bot — no external dependencies.
// Supports "de" (German) and "en" (English) with parameterized strings.

export type Locale = "de" | "en";

let currentLocale: Locale = "en";

const translations: Record<string, Record<Locale, string>> = {
  // ── Roles ──
  "role.ceo": { de: "CEO", en: "CEO" },
  "role.pl": { de: "PL (Projektleiter)", en: "PL (Project Lead)" },
  "role.al": { de: "AL (Abteilungsleiter)", en: "AL (Department Lead)" },
  "role.worker": { de: "Worker", en: "Worker" },

  // ── /start & /help ──
  "bot.welcome": {
    de: "*Das Althing* — Telegram Bridge aktiv\n\nChat-ID registriert: `{chatId}`",
    en: "*Das Althing* — Telegram Bridge active\n\nChat ID registered: `{chatId}`",
  },
  "bot.commands_header": { de: "*Befehle:*", en: "*Commands:*" },
  "bot.cmd.project": {
    de: "/project <Name> <Beschreibung> — Neues Projekt starten",
    en: "/project <Name> <Description> — Start new project",
  },
  "bot.cmd.status": { de: "/status — Alle Agents anzeigen", en: "/status — Show all agents" },
  "bot.cmd.status_detail": { de: "/status <ID> — Details zu einem Agent", en: "/status <ID> — Agent details" },
  "bot.cmd.msg": { de: "/msg <ID> <Text> — Nachricht an Agent senden", en: "/msg <ID> <Text> — Send message to agent" },
  "bot.cmd.cost": { de: "/cost — Kosten-Uebersicht", en: "/cost — Cost overview" },
  "bot.cmd.help": { de: "/help — Diese Hilfe anzeigen", en: "/help — Show this help" },
  "bot.cmd.lang": { de: "/lang de|en — Sprache aendern", en: "/lang de|en — Change language" },

  // ── /help extended ──
  "help.project_example": {
    de: "  Beispiel: `/project WebShop Online-Shop mit Warenkorb`",
    en: "  Example: `/project WebShop Online shop with cart`",
  },
  "help.status_all": { de: "/status — Alle laufenden Agents", en: "/status — All running agents" },
  "help.status_detail": { de: "/status <ID> — Detail-Status eines Agents", en: "/status <ID> — Detailed agent status" },
  "help.msg_example": {
    de: "  Beispiel: `/msg AL_PLANNING Nutze JWT statt OAuth`",
    en: "  Example: `/msg AL_PLANNING Use JWT instead of OAuth`",
  },
  "help.cost_desc": {
    de: "/cost — Kosten-Uebersicht (Gesamt + nach Modell/Tool)",
    en: "/cost — Cost overview (total + by model/tool)",
  },
  "help.notifications_header": { de: "*Automatische Benachrichtigungen:*", en: "*Automatic notifications:*" },
  "help.notif.started": { de: "\u2022 Agent gestartet / fertig", en: "\u2022 Agent started / finished" },
  "help.notif.question": { de: "\u2022 Rueckfragen von Workern", en: "\u2022 Questions from workers" },
  "help.notif.children": { de: "\u2022 CHILDREN_DONE (Kinder fertig)", en: "\u2022 CHILDREN_DONE (children finished)" },
  "help.notif.messages": { de: "\u2022 Direkte Nachrichten von Agents", en: "\u2022 Direct messages from agents" },

  // ── /cost ──
  "cost.no_data": { de: "Noch keine Kosten-Daten vorhanden.", en: "No cost data available yet." },
  "cost.title": { de: "\uD83D\uDCB0 *Kosten-Uebersicht*", en: "\uD83D\uDCB0 *Cost Overview*" },
  "cost.total": { de: "*Gesamt:*", en: "*Total:*" },
  "cost.agent_runs": { de: "*Agent-Runs:*", en: "*Agent runs:*" },
  "cost.by_model": { de: "*Nach Modell:*", en: "*By model:*" },
  "cost.by_tool": { de: "*Nach Tool:*", en: "*By tool:*" },
  "cost.none": { de: "(keine)", en: "(none)" },

  // ── /status ──
  "status.watcher_not_init": { de: "Watcher nicht initialisiert.", en: "Watcher not initialized." },
  "status.agent_not_found": { de: "Agent `{id}` nicht gefunden.", en: "Agent `{id}` not found." },
  "status.no_agents": { de: "Keine Agents aktiv.", en: "No agents active." },
  "status.header": { de: "*Agents ({count}):*", en: "*Agents ({count}):*" },

  // ── Agent detail ──
  "detail.status": { de: "*Status:*", en: "*Status:*" },
  "detail.role": { de: "*Rolle:*", en: "*Role:*" },
  "detail.tool": { de: "*Tool:*", en: "*Tool:*" },
  "detail.model": { de: "*Modell:*", en: "*Model:*" },
  "detail.pid": { de: "*PID:*", en: "*PID:*" },
  "detail.duration": { de: "*Laufzeit:*", en: "*Duration:*" },
  "detail.request": { de: "*Request:*", en: "*Request:*" },
  "detail.depth": { de: "*Depth:*", en: "*Depth:*" },
  "detail.spawned_by": { de: "*SpawnedBy:*", en: "*SpawnedBy:*" },
  "detail.report_to": { de: "*ReportTo:*", en: "*ReportTo:*" },
  "detail.children": { de: "*Kinder:*", en: "*Children:*" },
  "detail.none": { de: "keine", en: "none" },

  // ── /msg ──
  "msg.usage": { de: "Nutzung: `/msg <AGENT_ID> <Nachricht>`", en: "Usage: `/msg <AGENT_ID> <message>`" },
  "msg.empty": { de: "Nachricht darf nicht leer sein.", en: "Message must not be empty." },
  "msg.file_header": { de: "# Nachricht von User (via Telegram)", en: "# Message from user (via Telegram)" },
  "msg.sent": { de: "Nachricht an `{id}` gesendet.", en: "Message sent to `{id}`." },
  "msg.error": { de: "Fehler beim Senden: {err}", en: "Error sending: {err}" },

  // ── /project ──
  "project.usage": {
    de: "*Nutzung:* `/project <Name> <Beschreibung>`\n\nBeispiel:\n`/project WebShop Online-Shop mit Warenkorb und Checkout`",
    en: "*Usage:* `/project <Name> <Description>`\n\nExample:\n`/project WebShop Online shop with cart and checkout`",
  },
  "project.invalid_name": {
    de: "Projektname darf nur Buchstaben, Zahlen, - und _ enthalten.",
    en: "Project name may only contain letters, numbers, - and _.",
  },
  "project.blueprint_missing": {
    de: "Fehler: Projects/Project\\_Blueprint/ nicht gefunden.",
    en: "Error: Projects/Project\\_Blueprint/ not found.",
  },
  "project.exists": { de: "Projekt `{name}` existiert bereits.", en: "Project `{name}` already exists." },
  "project.created_title": {
    de: "\uD83C\uDFD7\uFE0F *Projekt \"{name}\" erstellt!*",
    en: "\uD83C\uDFD7\uFE0F *Project \"{name}\" created!*",
  },
  "project.blueprint_copied": {
    de: "\u2705 Blueprint kopiert nach `Projects/{name}/`",
    en: "\u2705 Blueprint copied to `Projects/{name}/`",
  },
  "project.ceo_created": {
    de: "\u2705 CEO-Request geschrieben: `{id}`",
    en: "\u2705 CEO request written: `{id}`",
  },
  "project.orch_started": {
    de: "\uD83D\uDD04 Orchestrator wurde gestartet",
    en: "\uD83D\uDD04 Orchestrator was started",
  },
  "project.orch_running": {
    de: "\u2705 Orchestrator laeuft bereits",
    en: "\u2705 Orchestrator already running",
  },
  "project.orch_failed": {
    de: "\u26A0\uFE0F Orchestrator konnte nicht gestartet werden — starte ihn manuell",
    en: "\u26A0\uFE0F Orchestrator could not be started — start it manually",
  },
  "project.description": { de: "*Beschreibung:*", en: "*Description:*" },
  "project.track": { de: "Verfolge den Fortschritt mit /status", en: "Track progress with /status" },
  "project.error": { de: "Fehler beim Erstellen: {err}", en: "Error creating project: {err}" },

  // ── Event notifications ──
  "event.agent_started": { de: "*Agent gestartet:*", en: "*Agent started:*" },
  "event.role": { de: "Rolle:", en: "Role:" },
  "event.agent_finished": { de: "*Agent fertig:*", en: "*Agent finished:*" },
  "event.agent_delegating": { de: "*Agent delegiert:*", en: "*Agent delegating:*" },
  "event.waiting_children": {
    de: "Wartet auf {count} Kind-Agent(s)",
    en: "Waiting for {count} child agent(s)",
  },
  "event.question_from": { de: "*Rueckfrage von:*", en: "*Question from:*" },
  "event.question_detail": {
    de: "Agent hat eine Frage — Details im Output.",
    en: "Agent has a question — see output for details.",
  },
  "event.milestone": { de: "*MEILENSTEIN ERREICHT:*", en: "*MILESTONE REACHED:*" },
  "event.phase_done": { de: "*Phase abgeschlossen:*", en: "*Phase completed:*" },
  "event.question_msg": { de: "*Rueckfrage:*", en: "*Question:*" },
  "event.reply_via": { de: "_Antwort via:_", en: "_Reply via:_" },
  "event.msg_from": { de: "*Nachricht von*", en: "*Message from*" },

  // ── Start/stop ──
  "bot.started": {
    de: "\uD83C\uDFDB\uFE0F *Das Althing* — Telegram Bridge gestartet.",
    en: "\uD83C\uDFDB\uFE0F *Das Althing* — Telegram Bridge started.",
  },
  "bot.stopped": {
    de: "\uD83D\uDED1 *Das Althing* — Telegram Bridge gestoppt.",
    en: "\uD83D\uDED1 *Das Althing* — Telegram Bridge stopped.",
  },

  // ── Misc ──
  "misc.truncated": { de: "_(gekuerzt)_", en: "_(truncated)_" },
  "misc.use_commands": {
    de: "Nutze Befehle um mit dem Council zu interagieren.\nTippe /help fuer eine Uebersicht.",
    en: "Use commands to interact with the Council.\nType /help for an overview.",
  },

  // ── /lang ──
  "lang.changed": { de: "Sprache auf Deutsch gesetzt.", en: "Language set to English." },
  "lang.usage": { de: "Nutzung: `/lang de` oder `/lang en`", en: "Usage: `/lang de` or `/lang en`" },

  // ── CEO spawn command (sent to agent system) ──
  "ceo.spawn_command": {
    de: [
      'Du bist der CEO fuer das Projekt "{name}".',
      "{description}",
      "Dein Arbeitsverzeichnis ist: {cwd}",
      "",
      "Deine Aufgaben:",
      "1. Lies CONTEXT.md in deinem Arbeitsverzeichnis",
      "2. Analysiere die Projektbeschreibung",
      "3. Spawne einen Projektleiter (PL) fuer das Projekt",
      "4. Schreibe deinen Delegations-Bericht nach responses/{reqId}_OUTPUT.md",
      "",
      "Wenn du Rueckfragen an den User hast, schreibe eine Datei responses/MSG_{agentId}_TO_USER.md mit deiner Frage.",
    ].join("\n"),
    en: [
      'You are the CEO for the project "{name}".',
      "{description}",
      "Your working directory is: {cwd}",
      "",
      "Your tasks:",
      "1. Read CONTEXT.md in your working directory",
      "2. Analyze the project description",
      "3. Spawn a Project Lead (PL) for the project",
      "4. Write your delegation report to responses/{reqId}_OUTPUT.md",
      "",
      "If you have questions for the user, write a file responses/MSG_{agentId}_TO_USER.md with your question.",
    ].join("\n"),
  },
  "ceo.description_prefix": {
    de: "\nProjektbeschreibung vom User: ",
    en: "\nProject description from user: ",
  },

  // ── HEIMDALL intake interview ──
  "project.heimdall_spawned": {
    de: "\uD83E\uDDD1\u200D\uD83D\uDCBC *HEIMDALL gestartet* — das Interview beginnt gleich.\n\nAntworte einfach mit Text — ich leite deine Antworten direkt an HEIMDALL weiter.",
    en: "\uD83E\uDDD1\u200D\uD83D\uDCBC *HEIMDALL started* — the interview will begin shortly.\n\nJust reply with text — I will forward your answers directly to HEIMDALL.",
  },
  "project.interview_routing": {
    de: "_(→ HEIMDALL)_",
    en: "_(→ HEIMDALL)_",
  },
  "project.interview_complete": {
    de: "\u2705 *Interview abgeschlossen* — Projekt `{projectId}`\n\nHEIMDALL hat den Intake-Bericht geschrieben. ODIN uebernimmt und assigned den Projektleiter.",
    en: "\u2705 *Interview complete* — Project `{projectId}`\n\nHEIMDALL has written the intake report. ODIN will assign the Project Lead.",
  },
  "project.interview_aborted": {
    de: "\u26A0\uFE0F Interview unerwartet beendet — kein Intake-Report gefunden. Bitte erneut mit /project versuchen.",
    en: "\u26A0\uFE0F Interview ended unexpectedly — no intake report found. Please try again with /project.",
  },
  "heimdall.continue_command": {
    de: [
      "Setze das Intake-Interview fort.",
      "",
      "Projekt-ID: {projectId}",
      "",
      "Der Kunde hat auf deine Frage geantwortet.",
      "1. Lies die Antwort aus responses/MSG_USER_TO_HEIMDALL.md",
      "2. Lies deinen bisherigen Fortschritt aus deiner letzten Output-Datei (REQ_HEIMDALL_{projectId}_OUTPUT.md)",
      "3. Aktualisiere die Output-Datei mit der neuen Antwort",
      "4. Stelle die naechste Frage — schreibe sie nach responses/MSG_QUESTION_HEIMDALL_TO_USER.md",
      "",
      "Wenn alle Fragen beantwortet sind:",
      "1. Schreibe INTAKE_REPORT_{projectId}.md in dein Arbeitsverzeichnis",
      "2. Benachrichtige ODIN: send_message('ODIN', 'Intake abgeschlossen fuer {projectId}. Report: Agents/HEIMDALL/INTAKE_REPORT_{projectId}.md')",
    ].join("\n"),
    en: [
      "Continue the intake interview.",
      "",
      "Project ID: {projectId}",
      "",
      "The customer has answered your last question.",
      "1. Read the answer from responses/MSG_USER_TO_HEIMDALL.md",
      "2. Read your interview progress from your last output file (REQ_HEIMDALL_{projectId}_OUTPUT.md)",
      "3. Update the output file with the new answer",
      "4. Ask the next question — write it to responses/MSG_QUESTION_HEIMDALL_TO_USER.md",
      "",
      "When all questions are answered:",
      "1. Write INTAKE_REPORT_{projectId}.md to your working directory",
      "2. Notify ODIN: send_message('ODIN', 'Intake complete for {projectId}. Report: Agents/HEIMDALL/INTAKE_REPORT_{projectId}.md')",
    ].join("\n"),
  },
  "heimdall.spawn_command": {
    de: [
      "Ein neues Projekt wurde angefragt.",
      "",
      "Projekt-ID: {projectId}",
      "Projektname: {projectName}",
      "Kurzbeschreibung: {description}",
      "",
      "Kanal: telegram",
      "Chat-ID: {chatId}",
      "",
      "Bitte fuehre jetzt das Intake-Interview mit dem Kunden durch.",
      "Verwende den /intake-interview Skill. Stelle die Fragen eine nach der anderen.",
      "Schreibe deine Fragen als MSG_QUESTION_HEIMDALL_TO_USER.md Dateien in responses/",
      "damit der Telegram-Bot sie weiterleiten kann.",
      "",
      "Wenn das Interview abgeschlossen ist:",
      "1. Schreibe INTAKE_REPORT_{projectId}.md in dein Arbeitsverzeichnis",
      "2. Benachrichtige ODIN: send_message('ODIN', 'Intake abgeschlossen fuer {projectId}. Report: Agents/HEIMDALL/INTAKE_REPORT_{projectId}.md')",
    ].join("\n"),
    en: [
      "A new project has been requested.",
      "",
      "Project ID: {projectId}",
      "Project Name: {projectName}",
      "Initial description: {description}",
      "",
      "Channel: telegram",
      "Chat ID: {chatId}",
      "",
      "Please conduct the intake interview with the customer now.",
      "Use the /intake-interview skill. Ask questions one at a time.",
      "Write your questions as MSG_QUESTION_HEIMDALL_TO_USER.md files in responses/",
      "so the Telegram bot can forward them.",
      "",
      "When the interview is complete:",
      "1. Write INTAKE_REPORT_{projectId}.md to your working directory",
      "2. Notify ODIN: send_message('ODIN', 'Intake complete for {projectId}. Report: Agents/HEIMDALL/INTAKE_REPORT_{projectId}.md')",
    ].join("\n"),
  },
};

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key, optionally replacing `{param}` placeholders.
 * Falls back to English, then to the raw key.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const entry = translations[key];
  let msg = entry?.[currentLocale] || entry?.["en"] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replaceAll(`{${k}}`, String(v));
    }
  }
  return msg;
}

/** Get the role label for the current locale */
export function roleLabel(role: string): string {
  return t(`role.${role}`) || role;
}
