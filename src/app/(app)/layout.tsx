import { TopBar } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { getAppData } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { state, activeQuest } = await getAppData();
  const xp = state.xp;
  return (
    <ToastProvider>
      <TopBar
        stats={{
          level: xp.level,
          totalXp: Math.round(xp.total),
          nextLevelAt: xp.nextLevelAt,
          progressToNext: xp.progressToNext,
          weeklyStreak: xp.weeklyStreak,
          thisWeekMinutes: xp.thisWeekMinutes,
          weekTargetMinutes: activeQuest?.thisWeek?.targetMinutes ?? null,
        }}
      />
      <main>{children}</main>
    </ToastProvider>
  );
}
