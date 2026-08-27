import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/server/profile";
import { isProfileComplete } from "@/lib/types";

export const Route = createFileRoute("/desk")({
  component: DeskLayout,
});

function DeskLayout() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });

  if (isPending || (user && profileQuery.isPending)) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="h-10 w-40 animate-pulse rounded-sm bg-raised" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!profileQuery.data) return <Navigate to="/onboarding" />;

  const complete = isProfileComplete(profileQuery.data);
  const onSettings = pathname.startsWith("/desk/settings");
  if (!complete && !onSettings) {
    return <Navigate to="/desk/settings" />;
  }

  return <AppShell profile={profileQuery.data} />;
}
