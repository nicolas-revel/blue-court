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
 * locally, and never when `WEB_ORIGIN` is HTTPS. Otherwise only the recipient and subject are logged: an email holds a reset link,
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
    // A site served over HTTPS is a real deployment: reset links never go to its log, even if
    // MAIL_LOG_BODY=1 was copied from .env.example.
    const served = (env.WEB_ORIGIN ?? "").startsWith("https://");
    this.logBody = env.MAIL_LOG_BODY === "1" && !served;
    if (env.MAIL_LOG_BODY === "1" && served) {
      this.logger.warn("MAIL_LOG_BODY=1 is ignored when WEB_ORIGIN is HTTPS; set it to 0.");
    }
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
