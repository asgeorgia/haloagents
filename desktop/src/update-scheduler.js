const DAY = 24 * 60 * 60 * 1000;
const RETRY = 60 * 60 * 1000;

function createUpdateScheduler({ check, readLastCheck, writeLastCheck, now = Date.now, interval = setInterval, clear = clearInterval, onError = () => {} }) {
  let inFlight = false;
  let retryAfter = 0;
  let timer;
  async function run(force = false) {
    if (inFlight || (!force && now() < retryAfter)) return false;
    const last = Number(readLastCheck()) || 0;
    if (!force && last > 0 && now() >= last && now() - last < DAY) return false;
    inFlight = true;
    try {
      await check();
      writeLastCheck(now());
      retryAfter = 0;
      return true;
    } catch (error) {
      retryAfter = now() + RETRY;
      onError(error);
      return false;
    } finally {
      inFlight = false;
    }
  }
  return {
    run,
    start() { if (!timer) timer = interval(() => void run(), 60 * 1000); void run(); },
    stop() { if (timer) clear(timer); timer = undefined; },
  };
}

module.exports = { createUpdateScheduler, DAY, RETRY };