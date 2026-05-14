const formatMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return "";
  }
  return ` ${JSON.stringify(meta)}`;
};

const logger = {
  debug: (message, meta) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${message}${formatMeta(meta)}`);
    }
  },
  info: (message, meta) => console.log(`[INFO] ${message}${formatMeta(meta)}`),
  warn: (message, meta) => console.warn(`[WARN] ${message}${formatMeta(meta)}`),
  error: (message, meta) => console.error(`[ERROR] ${message}${formatMeta(meta)}`),
};

module.exports = logger;
