import { ConfidentialClientApplication } from "@azure/msal-node";
import fs from "fs";
import path from "path";

interface EmailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
}

interface EmailAttachment {
  name: string;
  contentType: string;
  content: string;
  isInline?: boolean;
  contentId?: string;
}

interface SendEmailParams {
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

export class EmailService {
  private config: EmailConfig | null = null;
  private msalClient: ConfidentialClientApplication | null = null;

  private logosPaths = {
    gruppen: path.join(process.cwd(), "attached_assets", "gruppen_1765573676765.png"),
    zerobox: path.join(process.cwd(), "attached_assets", "zerobox_1765573676765.png"),
    firewall365: path.join(process.cwd(), "attached_assets", "firewall365_1765573676765.png"),
    gsecdo: path.join(process.cwd(), "attached_assets", "gsecdo_1765573676765.png"),
  };

  constructor() {
    const tenantId = process.env.M365_TENANT_ID;
    const clientId = process.env.M365_CLIENT_ID;
    const clientSecret = process.env.M365_CLIENT_SECRET;
    const senderEmail = process.env.M365_SENDER_EMAIL;

    if (tenantId && clientId && clientSecret && senderEmail) {
      this.config = { tenantId, clientId, clientSecret, senderEmail };
      this.msalClient = new ConfidentialClientApplication({
        auth: {
          clientId,
          clientSecret,
          authority: `https://login.microsoftonline.com/${tenantId}`,
        },
      });
    }
  }

  isConfigured(): boolean {
    return this.config !== null && this.msalClient !== null;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.msalClient) {
      throw new Error("Email service not configured");
    }

    const result = await this.msalClient.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token");
    }

    return result.accessToken;
  }

  private getLogoBase64(logoKey: keyof typeof this.logosPaths): string | null {
    const logoPath = this.logosPaths[logoKey];
    if (fs.existsSync(logoPath)) {
      try {
        const buffer = fs.readFileSync(logoPath);
        return buffer.toString("base64");
      } catch (e) {
        console.warn(`Could not load logo: ${logoKey}`);
      }
    }
    return null;
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    if (!this.isConfigured() || !this.config) {
      throw new Error("Email service not configured. Please set M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, and M365_SENDER_EMAIL");
    }

    const accessToken = await this.getAccessToken();

    const attachments = params.attachments?.map((att) => {
      if (att.isInline && att.contentId) {
        return {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.content,
          isInline: true,
          contentId: att.contentId,
        };
      }
      return {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.content,
      };
    });

    const message = {
      message: {
        subject: params.subject,
        body: {
          contentType: "HTML",
          content: params.htmlBody,
        },
        toRecipients: params.to.map((email) => ({
          emailAddress: { address: email },
        })),
        attachments,
      },
      saveToSentItems: true,
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${this.config.senderEmail}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${response.statusText} - ${errorText}`);
    }
  }

  async sendReportEmail(
    recipients: string[],
    companyName: string,
    pdfBuffer: Buffer,
    reportDate: Date
  ): Promise<void> {
    const formattedDate = reportDate.toLocaleDateString("pt-BR");
    const subject = `Relatorio de Backup - ${companyName} - ${formattedDate}`;

    const htmlBody = this.generateEmailBody(companyName, formattedDate);

    const attachments: EmailAttachment[] = [
      {
        name: `Relatorio_Backup_${companyName.replace(/\s+/g, "_")}_${formattedDate.replace(/\//g, "-")}.pdf`,
        contentType: "application/pdf",
        content: pdfBuffer.toString("base64"),
      },
    ];

    const logoKeys: (keyof typeof this.logosPaths)[] = ["gruppen", "zerobox", "firewall365", "gsecdo"];
    for (const key of logoKeys) {
      const base64 = this.getLogoBase64(key);
      if (base64) {
        attachments.push({
          name: `${key}.png`,
          contentType: "image/png",
          content: base64,
          isInline: true,
          contentId: key,
        });
      }
    }

    await this.sendEmail({
      to: recipients,
      subject,
      htmlBody,
      attachments,
    });
  }

  private generateEmailBody(companyName: string, date: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header with Logos -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 25px 20px; text-align: center;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
          <tr>
            <td align="center">
              <img src="cid:gruppen" alt="Gruppen" style="height: 35px; margin: 0 8px;" />
              <img src="cid:zerobox" alt="Zerobox" style="height: 35px; margin: 0 8px;" />
              <img src="cid:firewall365" alt="Firewall365" style="height: 35px; margin: 0 8px;" />
              <img src="cid:gsecdo" alt="GSecDo" style="height: 35px; margin: 0 8px;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 40px;">
        <p style="color: #1a1a1a; font-size: 18px; line-height: 1.6; margin: 0 0 25px 0;">
          Prezado(a) Cliente,
        </p>
        
        <p style="color: #444444; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
          E com grande satisfacao que apresentamos o <strong>Relatorio de Backup</strong> da sua empresa <strong>${companyName}</strong>, referente a data <strong>${date}</strong>.
        </p>

        <p style="color: #444444; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
          Este documento foi elaborado pela nossa equipe tecnica e contem informacoes detalhadas sobre o status dos seus backups, incluindo:
        </p>

        <ul style="color: #444444; font-size: 15px; line-height: 1.8; margin: 0 0 25px 20px; padding: 0;">
          <li>Metricas gerais de backup (total, taxa de sucesso, jobs ativos)</li>
          <li>Status de saude da infraestrutura de backup</li>
          <li>Utilizacao dos repositorios de armazenamento</li>
          <li>Dados protegidos (VMs, computadores, Microsoft 365)</li>
          <li>Eventuais falhas que requerem atencao</li>
        </ul>

        <p style="color: #444444; font-size: 15px; line-height: 1.7; margin: 0 0 30px 0;">
          Recomendamos a leitura atenta do relatorio em anexo. Caso identifique alguma inconsistencia ou tenha duvidas sobre os dados apresentados, nossa equipe de suporte esta a disposicao para auxiliar.
        </p>

        <!-- Attachment Notice -->
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom: 30px;">
          <tr>
            <td style="padding: 20px; background-color: #e8f5e9; border-radius: 8px; border-left: 4px solid #00B336;">
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #1a1a1a; font-weight: 600;">
                Relatorio em PDF anexo
              </p>
              <p style="margin: 0; font-size: 13px; color: #666666;">
                Abra o arquivo PDF em anexo para visualizar o relatorio completo com graficos e detalhes.
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #444444; font-size: 15px; line-height: 1.7; margin: 0 0 10px 0;">
          Atenciosamente,
        </p>
        <p style="color: #1a1a1a; font-size: 15px; font-weight: 600; margin: 0;">
          Equipe Gruppen IT Security
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="color: #666666; font-size: 12px; margin: 0 0 8px 0;">
          Enviado pela plataforma de BaaS da <strong>Gruppen IT Security</strong>
        </p>
        <p style="color: #888888; font-size: 11px; margin: 0;">
          As informacoes contidas neste e-mail sao confidenciais e destinadas exclusivamente ao destinatario.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}

export const emailService = new EmailService();
