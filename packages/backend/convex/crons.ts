import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("Resume interrupted account deletions", { minutes: 10 }, internal.accountDeletion.resume, {});
crons.interval(
  "Remove expired private speech uploads",
  { hours: 1 },
  internal.speech.sweepOrphans,
  {},
);
export default crons;
