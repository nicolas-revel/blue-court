import { redirect } from "next/navigation";
import { currentOrganizer, publicApiUrl } from "@/lib/api";
import { AuthForm } from "../auth-form";

export default async function LoginPage() {
  if ((await currentOrganizer()) !== null) redirect("/organizer");
  return <AuthForm mode="login" apiUrl={publicApiUrl()} />;
}
