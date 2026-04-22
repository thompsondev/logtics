import nodemailer, { Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    if (env.NODE_ENV === "development" && !env.SMTP_USER) {
      // In development without SMTP credentials, log the email instead of sending
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      logger.info("Email service running in log-only mode (no SMTP configured)", "EmailService");
    } else {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
      });
    }

    return this.transporter;
  }

  async send(payload: EmailPayload): Promise<void> {
    const transport = this.getTransporter();

    const message = {
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? this.stripHtml(payload.html),
    };

    if (env.NODE_ENV === "development" && !env.SMTP_USER) {
      logger.info(
        `[EMAIL LOG] To: ${payload.to} | Subject: ${payload.subject}`,
        "EmailService",
      );
      return;
    }

    const info = await transport.sendMail(message);
    logger.info(`Email sent to ${payload.to} (id: ${info.messageId})`, "EmailService");
  }

  async verify(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      return true;
    } catch {
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
}

// Singleton
export const emailService = new EmailService();
