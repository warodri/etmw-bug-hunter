import nodemailer, { Transporter } from 'nodemailer';

import { appConfig } from '../config/env';

/**
 * Login codes only. No newsletter, no attachments, no inbound mail: the smaller the surface, the
 * easier it is to trust an open-source server.
 */
export class EmailService {
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = appConfig.smtp.configured
      ? nodemailer.createTransport({
          host: appConfig.smtp.host,
          port: appConfig.smtp.port,
          secure: appConfig.smtp.secure,
          auth: { user: appConfig.smtp.user, pass: appConfig.smtp.pass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 15_000,
          greetingTimeout: 15_000,
          socketTimeout: 30_000
        })
      : null;
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  async sendLoginCode(toEmail: string, code: string): Promise<void> {
    if (!this.transporter) {
      if (appConfig.nodeEnv === 'production') {
        throw new Error('SMTP is not configured on the server.');
      }
      console.log(`[email] SMTP not configured; login code for ${toEmail} is ${code}`);
      return;
    }

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1d4ed8">ETMW Bug Hunter</h2>
        <p>Use this code to sign in to the Bug Hunter dashboard:</p>
        <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#1d4ed8;
          background:#eff6ff;border:1.5px dashed #60a5fa;border-radius:12px;padding:16px;text-align:center">
          ${code}
        </div>
        <p style="color:#64748b;font-size:13px">This code is valid for 10 minutes. If you did not request it, ignore this email.</p>
      </div>`;

    await this.transporter.sendMail({
      from: `"${appConfig.smtp.fromName}" <${appConfig.smtp.fromAddress}>`,
      to: toEmail,
      subject: `ETMW Bug Hunter login code: ${code}`,
      text: `Your ETMW Bug Hunter login code is: ${code}\n\nIt is valid for 10 minutes.`,
      html
    });
  }
}
