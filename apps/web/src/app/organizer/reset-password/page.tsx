import { connection } from "next/server";
import { publicApiUrl } from "@/lib/api";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  // Rendered per request, so the API address comes from the running server's environment.
  await connection();
  return <ResetPasswordForm apiUrl={publicApiUrl()} />;
}
