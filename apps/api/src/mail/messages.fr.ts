/**
 * Email texts, in French like the rest of the product UI (the web app's `messages/fr.json`).
 * Another language adds a sibling file with the same functions.
 */
export const resetMail = ({
  name,
  link,
  minutes,
}: {
  name: string;
  link: string;
  minutes: number;
}) => ({
  subject: "Blue Court : réinitialiser votre mot de passe",
  text: [
    `Bonjour ${name},`,
    "",
    "Pour choisir un nouveau mot de passe, ouvrez ce lien :",
    link,
    "",
    `Il fonctionne pendant ${minutes} minutes et une seule fois.`,
    "Si vous n'avez rien demandé, ignorez cet email : votre mot de passe ne change pas.",
  ].join("\n"),
});
