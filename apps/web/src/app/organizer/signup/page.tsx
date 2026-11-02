import { redirect } from "next/navigation";
import { currentOrganizer, publicApiUrl } from "@/lib/api";
import { AuthForm } from "../auth-form";

export default async function SignupPage() {
  if ((await currentOrganizer()) !== null) redirect("/organizer");
  return <AuthForm mode="signup" apiUrl={publicApiUrl()} />;
}
