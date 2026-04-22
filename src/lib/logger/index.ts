type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  const { level, message, context, data, timestamp } = entry;
  const prefix = context ? `[${context}]` : "";
  const base = `${timestamp} ${level.toUpperCase()} ${prefix} ${message}`;
  return data ? `${base} ${JSON.stringify(data)}` : base;
}

function log(level: LogLevel, message: string, context?: string, data?: unknown) {
  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatLog(entry);

  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  info: (message: string, context?: string, data?: unknown) =>
    log("info", message, context, data),
  warn: (message: string, context?: string, data?: unknown) =>
    log("warn", message, context, data),
  error: (message: string, context?: string, data?: unknown) =>
    log("error", message, context, data),
  debug: (message: string, context?: string, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      log("debug", message, context, data);
    }
  },
};
