import { connection } from "next/server";
import { publicApiUrl } from "@/lib/api";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  // Rendered per request, so the API address comes from the running server's environment.
  await connection();
  return <ForgotPasswordForm apiUrl={publicApiUrl()} />;
}
