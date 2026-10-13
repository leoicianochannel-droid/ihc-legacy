/** Sanity-test the admin metrics queries — surfaces any SQL errors fast. */
import {
  getOverviewMetrics,
  getDailyActivityCounts,
  getActivityBreakdown,
  getSignupsByDay,
  getCommunityPulse,
} from "../lib/admin-metrics";

async function main() {
  console.log("→ getOverviewMetrics");
  console.log(await getOverviewMetrics());
  console.log("→ getDailyActivityCounts(30)");
  console.log(`(returned ${(await getDailyActivityCounts(30)).length} rows)`);
  console.log("→ getActivityBreakdown(30)");
  console.log(await getActivityBreakdown(30));
  console.log("→ getSignupsByDay(30)");
  console.log(`(returned ${(await getSignupsByDay(30)).length} rows)`);
  console.log("→ getCommunityPulse");
  console.log(await getCommunityPulse());
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
