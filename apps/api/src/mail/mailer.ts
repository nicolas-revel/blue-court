import { Injectable, Logger } from "@nestjs/common";
import { createTransport } from "nodemailer";

export interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/**
 * Sends emails through the SMTP server in `SMTP_URL` (for example
 * `smtps://user:password@smtp.tem.scaleway.com:465`), from `MAIL_FROM`. Without `SMTP_URL`, the
 * whole email is written to the log only with `MAIL_LOG_BODY=1`, so reset links can be followed
 * locally. Otherwise only the recipient and subject are logged: an email holds a reset link,
 * which must never sit in a server log, so logging it takes an explicit opt-in.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly from: string;
  private readonly transport: ReturnType<typeof createTransport> | undefined;
  private readonly logBody: boolean;

  constructor() {
    const env = process.env;
    this.from = env.MAIL_FROM ?? "Blue Court <no-reply@localhost>";
    this.transport =
      env.SMTP_URL === undefined || env.SMTP_URL === "" ? undefined : createTransport(env.SMTP_URL);
    this.logBody = env.MAIL_LOG_BODY === "1";
    if (this.transport === undefined && !this.logBody) {
      this.logger.warn("SMTP_URL is not set: password reset emails will not be sent.");
    }
  }

  async send(mail: Mail): Promise<void> {
    if (this.transport !== undefined) {
      await this.transport.sendMail({ from: this.from, ...mail });
    } else if (this.logBody) {
      this.logger.log(`SMTP_URL is not set; email to ${mail.to}: ${mail.subject}\n${mail.text}`);
    } else {
      this.logger.error(`SMTP_URL is not set; email "${mail.subject}" to ${mail.to} not sent`);
    }
  }
}
