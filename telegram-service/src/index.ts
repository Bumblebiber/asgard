import * as fs from "node:fs";
import * as path from "node:path";
import type { TelegramConfig } from "./types.js";
import { Watcher } from "./watcher.js";
import { TelegramBot } from "./bot.js";

/** Load .env file from given directory (simple key=value parser, no dependency) */
function loadEnv(dir: string): void {
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function loadConfig(): TelegramConfig {
  // Load .env from CWD and script dir
  loadEnv(process.cwd());
  loadEnv(path.join(path.dirname(new URL(import.meta.url).pathname), ".."));

  // Search for config: env var, then CWD, then script dir
  const candidates = [
    process.env.COUNCIL_TELEGRAM_CONFIG,
    path.join(process.cwd(), "telegram.config.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "telegram.config.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[Config] Loading: ${p}`);
      const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
      const config = raw as TelegramConfig;

      // .env overrides empty botToken in config
      if (!config.botToken && process.env.TELEGRAM_BOT_TOKEN) {
        config.botToken = process.env.TELEGRAM_BOT_TOKEN;
      }

      return config;
    }
  }

  console.error("[Config] No telegram.config.json found.");
  console.error("  Set COUNCIL_TELEGRAM_CONFIG env var or place it in CWD.");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("=== Das Althing — Telegram Service ===\n");

  const config = loadConfig();

  // Validate
  if (!config.botToken) {
    console.error("[Config] botToken is empty. Get one from @BotFather on Telegram.");
    process.exit(1);
  }

  if (!config.projectDir) {
    console.error("[Config] projectDir is empty. Set the path to the Council project.");
    process.exit(1);
  }

  if (!fs.existsSync(config.projectDir)) {
    console.error(`[Config] projectDir does not exist: ${config.projectDir}`);
    process.exit(1);
  }

  console.log(`[Config] Project: ${config.projectDir}`);
  console.log(`[Config] Poll interval: ${config.pollIntervalMs}ms`);
  console.log(`[Config] Owner chat ID: ${config.ownerChatId || "(auto-detect on /start)"}`);

  // Create bot and watcher
  const bot = new TelegramBot(config);

  const watcher = new Watcher(config, (event) => {
    console.log(`[Event] ${event.type}${("agent" in event && event.agent) ? ` — ${event.agent.id}` : ""}`);
    bot.handleEvent(event).catch((err) => {
      console.error(`[Event] Handler error: ${err}`);
    });
  });

  bot.setWatcher(watcher);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Shutdown] Stopping...");
    watcher.stop();
    await bot.stop();
    console.log("[Shutdown] Done.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start both
  watcher.start();
  console.log("[Watcher] Monitoring state.json + responses/");

  await bot.start();
}

main().catch((err) => {
  console.error(`[Fatal] ${err}`);
  process.exit(1);
});
