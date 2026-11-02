import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Sends emails through the SMTP server in `SMTP_URL` (for example
 * `smtps://user:password@smtp.tem.scaleway.com:465`), from `MAIL_FROM`. Without `SMTP_URL`, in
 * development, the whole email is written to the log so reset links can be followed. In
 * production it is not: an email holds a reset link, which must never sit in a log.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly from = process.env.MAIL_FROM ?? "Blue Court <no-reply@localhost>";
  private readonly transport =
    process.env.SMTP_URL === undefined || process.env.SMTP_URL === ""
      ? undefined
      : createTransport(process.env.SMTP_URL);

  constructor() {
    if (this.transport === undefined && isProduction) {
      this.logger.warn("SMTP_URL is not set: password reset emails will not be sent.");
    }
  }

  async send(mail: Mail): Promise<void> {
    if (this.transport !== undefined) {
      await this.transport.sendMail({ from: this.from, ...mail });
    } else if (isProduction) {
      this.logger.error(`SMTP_URL is not set; email "${mail.subject}" to ${mail.to} not sent`);
    } else {
      this.logger.log(`SMTP_URL is not set; email to ${mail.to}: ${mail.subject}\n${mail.text}`);
    }
  }
}
