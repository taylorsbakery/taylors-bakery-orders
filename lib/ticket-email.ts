/**
 * Ticket email utilities: outbound reply emails, new ticket alerts, and HTML templates.
 */

const BRAND_COLOR = '#1a1a3e';
const BRAND_NAME = "Taylor's Bakery";

// Parse ticket number from email subject for threading
// Matches patterns like [TK-260407-1234] or TK-260407-1234
export function extractTicketNumber(subject: string): string | null {
  const match = (subject || '').match(/\[?(TK-\d{6}-\d{4})\]?/i);
  return match ? match[1].toUpperCase() : null;
}

// Build subject line with ticket number for threading
export function buildTicketSubject(ticketNumber: string, originalSubject: string): string {
  return `Re: ${originalSubject} [${ticketNumber}]`;
}

// Send notification email helper
export async function sendTicketEmail(opts: {
  notificationId: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
}) {
  const appUrl = process.env.NEXTAUTH_URL || '';
  let senderEmail = 'noreply@mail.abacusai.app';
  try {
    if (appUrl) senderEmail = `noreply@${new URL(appUrl).hostname}`;
  } catch { /* fallback */ }

  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: opts.notificationId,
        subject: opts.subject,
        body: opts.htmlBody,
        is_html: true,
        recipient_email: opts.recipientEmail,
        sender_email: senderEmail,
        sender_alias: `${BRAND_NAME} Support`,
      }),
    });

    const result = await response.json();
    if (!result.success && !result.notification_disabled) {
      console.error('[Ticket Email] Send failed:', result.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Ticket Email] Error:', err);
    return false;
  }
}

// HTML template: Staff reply to customer
export function buildReplyEmailHtml(opts: {
  ticketNumber: string;
  staffName: string;
  replyContent: string;
  originalSubject: string;
  portalUrl: string;
  ticketId: string;
}) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
      <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: ${BRAND_COLOR}; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 600;">${BRAND_NAME}</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Support Team</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 8px;">
            <strong>${opts.staffName}</strong> replied to your ticket:
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 16px;">
            Ticket ${opts.ticketNumber} &mdash; ${opts.originalSubject}
          </p>
          
          <div style="background: #f0f4ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
            <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${opts.replyContent}</p>
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${opts.portalUrl}/portal/tickets/${opts.ticketId}" 
               style="display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 12px 32px; border-radius: 99px; text-decoration: none; font-size: 14px; font-weight: 500;">
              View &amp; Reply in Portal
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 16px 0 0;">
            You can also reply directly to this email and your response will be added to the ticket.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            ${BRAND_NAME} &bull; 6216 Allisonville Rd, Indianapolis, IN 46220 &bull; (317) 251-9575
          </p>
        </div>
      </div>
    </div>
  `;
}

// HTML template: New ticket alert for staff
export function buildNewTicketAlertHtml(opts: {
  ticketNumber: string;
  subject: string;
  description: string;
  contactName: string;
  contactEmail: string;
  category: string;
  priority: string;
  location: string | null;
  source: string;
  accountName: string | null;
  ticketId: string;
  adminUrl: string;
}) {
  const priorityColors: Record<string, string> = {
    urgent: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#6b7280',
  };
  const pColor = priorityColors[opts.priority] || '#6b7280';

  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
      <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: ${BRAND_COLOR}; padding: 20px 24px;">
          <h1 style="color: white; margin: 0; font-size: 16px;">\ud83c\udf9f\ufe0f New Support Ticket</h1>
        </div>
        
        <!-- Body -->
        <div style="padding: 24px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-family: monospace; color: #6b7280; font-size: 13px;">${opts.ticketNumber}</span>
            <span style="background: ${pColor}; color: white; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${opts.priority}</span>
          </div>
          
          <h2 style="color: #111827; font-size: 16px; margin: 0 0 16px;">${opts.subject}</h2>
          
          <table style="width: 100%; font-size: 13px; color: #4b5563;">
            <tr><td style="padding: 4px 12px 4px 0; font-weight: 600; width: 100px;">From</td><td>${opts.contactName} (${opts.contactEmail})</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Category</td><td style="text-transform: capitalize;">${opts.category.replace('_', ' ')}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Source</td><td style="text-transform: capitalize;">${opts.source}</td></tr>
            ${opts.location ? `<tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Location</td><td style="text-transform: capitalize;">${opts.location}</td></tr>` : ''}
            ${opts.accountName ? `<tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Account</td><td>${opts.accountName}</td></tr>` : ''}
          </table>
          
          <div style="background: #f3f4f6; padding: 14px; border-radius: 8px; margin: 16px 0;">
            <p style="color: #374151; font-size: 13px; line-height: 1.5; margin: 0; white-space: pre-wrap;">${(opts.description || '').substring(0, 500)}${(opts.description || '').length > 500 ? '...' : ''}</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${opts.adminUrl}/tickets/${opts.ticketId}" 
               style="display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 10px 28px; border-radius: 99px; text-decoration: none; font-size: 13px; font-weight: 500;">
              Open Ticket
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
