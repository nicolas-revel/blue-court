import { myTournaments } from "@/lib/api";
import { TournamentList } from "./tournament-list";

export default async function OrganizerHome() {
  return <TournamentList tournaments={await myTournaments()} />;
}
