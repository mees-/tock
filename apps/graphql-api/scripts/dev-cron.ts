// wrangler dev doesn't fire Cron Triggers, so trigger the scheduled handler every minute.
const DEV_WORKER_URL = "http://localhost:4000"
const MINUTE_MS = 60_000

async function trigger(minuteStart: number) {
  try {
    const url = `${DEV_WORKER_URL}/cdn-cgi/local/scheduled?cron=*+*+*+*+*&time=${minuteStart}`
    const res = await fetch(url)
    if (!res.ok) console.error(`Scheduled trigger failed: ${res.status}`)
  } catch (err) {
    console.error("Scheduled trigger failed, is wrangler dev running?", err)
  }
}

function scheduleNext() {
  const nextMinute = Math.ceil((Date.now() + 1) / MINUTE_MS) * MINUTE_MS
  setTimeout(async () => {
    scheduleNext()
    await trigger(nextMinute)
  }, nextMinute - Date.now())
}

scheduleNext()
console.log(`Triggering scheduled handler on ${DEV_WORKER_URL} every minute`)
