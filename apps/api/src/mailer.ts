import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/**
 * Sends emails through the SMTP server in `SMTP_URL` (for example
 * `smtps://user:password@smtp.tem.scaleway.com:465`), from `MAIL_FROM`. Without `SMTP_URL`, as in
 * local development, the email is written to the log instead.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly from = process.env.MAIL_FROM ?? "Blue Court <no-reply@localhost>";
  private readonly transport =
    process.env.SMTP_URL === undefined || process.env.SMTP_URL === ""
      ? undefined
      : createTransport(process.env.SMTP_URL);

  async send(mail: Mail): Promise<void> {
    if (this.transport === undefined) {
      this.logger.log(`SMTP_URL is not set; email to ${mail.to}: ${mail.subject}\n${mail.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, ...mail });
  }
}
