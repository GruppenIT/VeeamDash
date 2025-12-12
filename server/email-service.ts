import { ConfidentialClientApplication } from "@azure/msal-node";

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

  async sendEmail(params: SendEmailParams): Promise<void> {
    if (!this.isConfigured() || !this.config) {
      throw new Error("Email service not configured. Please set M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, and M365_SENDER_EMAIL");
    }

    const accessToken = await this.getAccessToken();

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
        attachments: params.attachments?.map((att) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.content,
        })),
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
    const subject = `Relatório de Backup - ${companyName} - ${formattedDate}`;

    const htmlBody = this.generateEmailBody(companyName, formattedDate);

    await this.sendEmail({
      to: recipients,
      subject,
      htmlBody,
      attachments: [
        {
          name: `Relatorio_Backup_${companyName.replace(/\s+/g, "_")}_${formattedDate.replace(/\//g, "-")}.pdf`,
          contentType: "application/pdf",
          content: pdfBuffer.toString("base64"),
        },
      ],
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
    <!-- Header -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 30px 40px; text-align: center;">
        <h1 style="color: #00B336; margin: 0; font-size: 24px; font-weight: 600;">
          Veeam VSPC Dashboard
        </h1>
        <p style="color: #888888; margin: 10px 0 0 0; font-size: 14px;">
          Relatório Automático de Backup
        </p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 40px;">
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
          Relatório de Backup
        </h2>
        
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom: 30px;">
          <tr>
            <td style="padding: 15px 20px; background-color: #f8f9fa; border-left: 4px solid #00B336; border-radius: 4px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                Cliente
              </p>
              <p style="margin: 0; font-size: 18px; color: #1a1a1a; font-weight: 600;">
                ${companyName}
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom: 30px;">
          <tr>
            <td style="padding: 15px 20px; background-color: #f8f9fa; border-left: 4px solid #00B336; border-radius: 4px;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                Data do Relatório
              </p>
              <p style="margin: 0; font-size: 18px; color: #1a1a1a; font-weight: 600;">
                ${date}
              </p>
            </td>
          </tr>
        </table>

        <p style="color: #444444; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Olá,
        </p>
        <p style="color: #444444; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Segue em anexo o relatório de backup gerado automaticamente para o cliente <strong>${companyName}</strong>.
        </p>
        <p style="color: #444444; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
          O relatório contém informações detalhadas sobre o status dos backups, 
          repositórios de armazenamento, dados protegidos e eventuais falhas recentes.
        </p>

        <!-- Attachment Notice -->
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom: 30px;">
          <tr>
            <td style="padding: 20px; background-color: #e8f5e9; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #2e7d32;">
                📎 Relatório em PDF anexo
              </p>
              <p style="margin: 0; font-size: 12px; color: #666666;">
                Abra o arquivo PDF em anexo para ver o relatório completo
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 30px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="color: #888888; font-size: 12px; margin: 0 0 10px 0;">
          Este é um e-mail automático enviado pelo Veeam VSPC Dashboard.
        </p>
        <p style="color: #888888; font-size: 12px; margin: 0;">
          As informações contidas neste e-mail são confidenciais.
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
