const DEFAULT_TIME_ZONE = "Africa/Cairo";

const dateTimeFormatterCache = new Map();

const getFormatter = (timeZone) => {
  const key = timeZone || DEFAULT_TIME_ZONE;
  if (!dateTimeFormatterCache.has(key)) {
    dateTimeFormatterCache.set(
      key,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: key,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        weekday: "short",
      }),
    );
  }
  return dateTimeFormatterCache.get(key);
};

const getZonedParts = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
};

const getTimeZoneOffsetMs = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
};

const zonedTimeToUtc = (components, timeZone = DEFAULT_TIME_ZONE) => {
  const guess = new Date(
    Date.UTC(
      components.year,
      components.month - 1,
      components.day,
      components.hour || 0,
      components.minute || 0,
      components.second || 0,
      0,
    ),
  );
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
};

const addDaysUtc = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const weekdayToIndex = (weekday) => {
  const normalized = String(weekday || "").slice(0, 3).toLowerCase();
  if (normalized === "mon") return 0;
  if (normalized === "tue") return 1;
  if (normalized === "wed") return 2;
  if (normalized === "thu") return 3;
  if (normalized === "fri") return 4;
  if (normalized === "sat") return 5;
  return 6;
};

const getWindowForPeriod = (period, referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  if (period === "all-time") {
    return {
      windowStart: new Date(0),
      windowEnd: new Date("2100-01-01T00:00:00.000Z"),
    };
  }

  const parts = getZonedParts(referenceDate, timeZone);

  if (period === "monthly") {
    const start = zonedTimeToUtc(
      {
        year: parts.year,
        month: parts.month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    );
    const nextMonthYear = parts.month === 12 ? parts.year + 1 : parts.year;
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const end = zonedTimeToUtc(
      {
        year: nextMonthYear,
        month: nextMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    );
    return { windowStart: start, windowEnd: end };
  }

  const daysFromMonday = weekdayToIndex(parts.weekday);
  const weekStartUtc = zonedTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
  const windowStart = addDaysUtc(weekStartUtc, -daysFromMonday);
  const windowEnd = addDaysUtc(windowStart, 7);
  return { windowStart, windowEnd };
};

const getPreviousWindowForPeriod = (period, referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const { windowStart } = getWindowForPeriod(period, referenceDate, timeZone);
  const previousReference = new Date(windowStart.getTime() - 1000);
  return getWindowForPeriod(period, previousReference, timeZone);
};

const shortDateFormatterCache = new Map();
const monthFormatterCache = new Map();

const getShortDateFormatter = (timeZone = DEFAULT_TIME_ZONE) => {
  if (!shortDateFormatterCache.has(timeZone)) {
    shortDateFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        day: "2-digit",
        month: "short",
      }),
    );
  }

  return shortDateFormatterCache.get(timeZone);
};

const getMonthFormatter = (timeZone = DEFAULT_TIME_ZONE) => {
  if (!monthFormatterCache.has(timeZone)) {
    monthFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        month: "long",
        year: "numeric",
      }),
    );
  }

  return monthFormatterCache.get(timeZone);
};

const formatWindowLabel = (period, windowStart, windowEnd, timeZone = DEFAULT_TIME_ZONE) => {
  if (!(windowStart instanceof Date) || Number.isNaN(windowStart.getTime())) {
    return "";
  }

  if (period === "all-time") return "All Time";

  if (period === "monthly") {
    return getMonthFormatter(timeZone).format(windowStart);
  }

  const inclusiveEnd = new Date(windowEnd.getTime() - 1000);
  const shortDateFormatter = getShortDateFormatter(timeZone);
  return `${shortDateFormatter.format(windowStart)} - ${shortDateFormatter.format(inclusiveEnd)}`;
};

const toDayKey = (date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

module.exports = {
  DEFAULT_TIME_ZONE,
  formatWindowLabel,
  getPreviousWindowForPeriod,
  getWindowForPeriod,
  getZonedParts,
  toDayKey,
};
