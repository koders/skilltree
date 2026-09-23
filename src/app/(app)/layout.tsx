import { TopBar, type TopBarStats } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { getAppData } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // error.tsx doesn't wrap the layout of its own segment, so a failed load (Supabase
  // paused, bad key, migrations not run) must not throw here: the bar goes without
  // stats, and the page, which awaits the same cached getAppData(), throws into
  // (app)/error.tsx with its database hints and Try again.
  const stats = await getAppData().then(
    ({ state, activeQuest }): TopBarStats => ({
      level: state.xp.level,
      totalXp: Math.round(state.xp.total),
      nextLevelAt: state.xp.nextLevelAt,
      progressToNext: state.xp.progressToNext,
      weeklyStreak: state.xp.weeklyStreak,
      thisWeekMinutes: state.xp.thisWeekMinutes,
      weekTargetMinutes: activeQuest?.thisWeek?.targetMinutes ?? null,
    }),
    () => null,
  );
  return (
    <ToastProvider>
      <TopBar stats={stats} />
      <main>{children}</main>
    </ToastProvider>
  );
}
