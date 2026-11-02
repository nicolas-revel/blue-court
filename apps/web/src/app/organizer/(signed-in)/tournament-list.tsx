import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { TournamentSummary } from "@/lib/api";

export function TournamentList({ tournaments }: { tournaments: readonly TournamentSummary[] }) {
  const t = useTranslations("organizer");
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("tournaments")}</h1>
      {tournaments.length === 0 ? (
        <p className="text-muted-foreground">{t("noTournament")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tournaments.map((tournament) => (
            <li key={tournament.id} className="rounded-md border border-input px-4 py-3">
              {tournament.name}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button size="lg" disabled>
          {t("create")}
        </Button>
      </div>
    </main>
  );
}
