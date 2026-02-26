import { builder } from "../builder"

export interface StatsPayload {
  totalJobs: number
  activeJobs: number
  totalRunsToday: number
  successRateLast24h: number
  avgDurationLast24h: number | null
}

export const StatsRef = builder.objectRef<StatsPayload>("Stats").implement({
  fields: t => ({
    totalJobs: t.exposeInt("totalJobs", { nullable: false }),
    activeJobs: t.exposeInt("activeJobs", { nullable: false }),
    totalRunsToday: t.exposeInt("totalRunsToday", { nullable: false }),
    successRateLast24h: t.exposeFloat("successRateLast24h", {
      nullable: false,
    }),
    avgDurationLast24h: t.exposeFloat("avgDurationLast24h", {
      nullable: true,
    }),
  }),
})
