import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function Home() {
  const t = useTranslations("home");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Blue Court</h1>
      <p className="text-xl">{t("tagline")}</p>
      <p className="text-muted-foreground">{t("intro")}</p>
      <div>
        <Button size="lg" disabled>
          {t("start")}
        </Button>
      </div>
    </main>
  );
}
