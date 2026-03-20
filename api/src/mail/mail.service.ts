import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST   ?? 'smtp.informat.cl',
      port:   parseInt(process.env.MAIL_PORT ?? '587'),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER     ?? '',
        pass: process.env.MAIL_PASSWORD ?? '',
      },
    });
  }

  async sendInviteEmail(opts: {
    to:         string;
    toName:     string;
    adminName:  string;
    tenantName: string;
    modulesList: string;
    inviteUrl:  string;
  }): Promise<void> {
    const from = process.env.MAIL_FROM ?? 'I-NET Intelligence <noreply@informat.cl>';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:40px;margin:0">
  <div style="background:white;padding:32px;border-radius:10px;max-width:500px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#1e3a5f;font-size:22px;margin:0">I-NET Intelligence</h1>
      <p style="color:#64748b;font-size:13px;margin:4px 0 0">Portal de Análisis de Datos</p>
    </div>
    <h2 style="color:#1e293b;font-size:18px">Hola ${opts.toName},</h2>
    <p style="color:#475569;line-height:1.6">
      <strong>${opts.adminName}</strong> te ha invitado a acceder al portal de análisis de datos de
      <strong>${opts.tenantName}</strong>.
    </p>
    <p style="color:#475569;line-height:1.6">
      Tendrás acceso a los siguientes módulos:<br>
      <strong style="color:#3b82f6">${opts.modulesList}</strong>
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${opts.inviteUrl}"
         style="background:#3b82f6;color:white;padding:14px 32px;border-radius:8px;
                text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Activar mi cuenta →
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center">
      Este link expira en 48 horas. Si no solicitaste esta invitación, puedes ignorar este email.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#94a3b8;font-size:11px;text-align:center">
      I-NET Intelligence · Powered by Informat
    </p>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from,
        to:      `${opts.toName} <${opts.to}>`,
        subject: `Invitación a I-NET Intelligence — ${opts.tenantName}`,
        html,
      });
      this.logger.log(`Invite email sent to ${opts.to}`);
    } catch (err) {
      // In demo/dev: log the invite URL instead of failing
      this.logger.warn(`Email send failed (printing invite URL for dev): ${opts.inviteUrl}`);
      this.logger.error(err);
    }
  }

  async sendPasswordResetEmail(opts: {
    to:       string;
    toName:   string;
    resetUrl: string;
  }): Promise<void> {
    const from = process.env.MAIL_FROM ?? 'I-NET Intelligence <noreply@informat.cl>';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:40px;margin:0">
  <div style="background:white;padding:32px;border-radius:10px;max-width:500px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#1e3a5f;font-size:22px;margin:0">I-NET Intelligence</h1>
      <p style="color:#64748b;font-size:13px;margin:4px 0 0">Portal de Análisis de Datos</p>
    </div>
    <h2 style="color:#1e293b;font-size:18px">Hola ${opts.toName},</h2>
    <p style="color:#475569;line-height:1.6">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en I-NET Intelligence.
    </p>
    <p style="color:#475569;line-height:1.6">
      Haz clic en el botón a continuación para crear una nueva contraseña:
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${opts.resetUrl}"
         style="background:#3b82f6;color:white;padding:14px 32px;border-radius:8px;
                text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Restablecer contraseña →
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center">
      Este link expira en <strong>1 hora</strong>. Si no solicitaste este cambio, puedes ignorar
      este email — tu contraseña no será modificada.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#94a3b8;font-size:11px;text-align:center">
      I-NET Intelligence · Powered by Informat
    </p>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from,
        to:      `${opts.toName} <${opts.to}>`,
        subject: 'Restablece tu contraseña — I-NET Intelligence',
        html,
      });
      this.logger.log(`Password reset email sent to ${opts.to}`);
    } catch (err) {
      // In demo/dev: log the reset URL instead of failing
      this.logger.warn(`Email send failed (printing reset URL for dev): ${opts.resetUrl}`);
      this.logger.error(err);
    }
  }
}
