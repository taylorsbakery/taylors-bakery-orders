// Pre-built CRM email templates for Taylor's Bakery

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'follow_up' | 'reengagement' | 'seasonal' | 'appreciation' | 'promotion';
  icon: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'post_delivery_checkin',
    name: 'Post-Delivery Check-In',
    category: 'follow_up',
    icon: '📦',
    description: 'Follow up after a delivery to ensure satisfaction',
    subjectTemplate: "How was everything, {{accountName}}?",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Baked Fresh, Delivered with Care</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We just wanted to check in and make sure everything went well with your recent order. Your satisfaction means everything to us!</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">If there's anything that wasn't quite right, or if there's something else we can help with, please don't hesitate to reach out. We're always here for you.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Is there anything else coming up that we can help with? We'd love to be part of your next event or order.</p>
    <p style="color: #444; line-height: 1.6;">Warmly,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
  {
    id: 'free_donut_drop',
    name: 'Free Donut Drop 🍩',
    category: 'appreciation',
    icon: '🍩',
    description: 'Surprise them with a complimentary donut delivery',
    subjectTemplate: "🍩 Surprise! Free donuts headed your way, {{accountName}}",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">A Little Something Sweet</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We appreciate your business so much that we wanted to do something special — <strong>a complimentary dozen of our freshly baked donuts</strong> is on its way to your team!</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">No strings attached, just our way of saying thank you for being an amazing customer. We hope your team enjoys them!</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">While we're at it — if you ever need catering for meetings, events, or just a treat for the office, we'd love to help.</p>
    <p style="color: #444; line-height: 1.6;">Enjoy!<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
  {
    id: 'we_miss_you',
    name: 'We Miss You!',
    category: 'reengagement',
    icon: '💛',
    description: 'Re-engage a customer who hasn\'t ordered in a while',
    subjectTemplate: "We miss you, {{accountName}}! Here's something special",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">We've Been Thinking About You</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">It's been a little while since your last order, and we wanted to reach out. We hope everything is going well!</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We'd love to welcome you back with <strong>10% off your next order</strong>. Whether it's for an upcoming meeting, a team celebration, or just because — we've got you covered.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Just mention this email when you place your order and the discount is yours.</p>
    <p style="color: #444; line-height: 1.6;">Looking forward to baking for you again,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
  {
    id: 'seasonal_holiday',
    name: 'Holiday / Seasonal Promo',
    category: 'seasonal',
    icon: '🎄',
    description: 'Seasonal promotion for holiday ordering',
    subjectTemplate: "🎉 Holiday ordering is open, {{accountName}}! Let's plan ahead",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Holiday Season Is Here!</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">The holiday season is just around the corner, and we're already gearing up for our busiest time of year!</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We wanted to give our favorite commercial partners a <strong>head start on holiday ordering</strong>. Whether it's holiday party platters, client gift boxes, employee appreciation treats, or festive cakes — we can handle it all.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;"><strong>Early orders get priority scheduling and a 5% discount!</strong></p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Let us know what you're thinking and we'll make it happen.</p>
    <p style="color: #444; line-height: 1.6;">Happy holidays,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
  {
    id: 'new_product_announcement',
    name: 'New Product Launch',
    category: 'promotion',
    icon: '✨',
    description: 'Announce a new product or menu item',
    subjectTemplate: "✨ Something new from Taylor's Bakery, {{accountName}}!",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Fresh Off The Menu</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We're excited to share something new with you! We've been working on some delicious additions to our menu, and as one of our valued commercial partners, you get first dibs.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">We think your team would love trying these out. <strong>We'd be happy to send over a complimentary sample</strong> so you can taste the quality for yourself before adding it to your regular order.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Just let us know and we'll arrange a delivery!</p>
    <p style="color: #444; line-height: 1.6;">Cheers,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
  {
    id: 'meeting_catering',
    name: 'Meeting Catering Offer',
    category: 'promotion',
    icon: '☕',
    description: 'Offer catering services for their meetings/events',
    subjectTemplate: "Let us cater your next meeting, {{accountName}}! ☕",
    bodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #D97706, #B45309); padding: 30px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Taylor's Bakery</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Make Your Next Meeting Memorable</p>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Hi {{contactName}},</h2>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Got a big meeting, team lunch, or client visit coming up? Let us take the food off your plate (and put it on theirs 😄).</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Our <strong>meeting catering packages</strong> include breakfast pastry platters, sandwich trays, cookie and brownie assortments, and custom cake options — all delivered fresh to your door.</p>
    <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">As a valued commercial partner, you'll get <strong>priority delivery times and bulk pricing</strong>. Let us know what you need!</p>
    <p style="color: #444; line-height: 1.6;">Talk soon,<br/><strong>The Taylor's Bakery Team</strong></p>
  </div>
  <div style="background: #f8f4f0; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e0db;">
    <p style="color: #888; font-size: 12px; margin: 0;">Taylor's Bakery &bull; 6216 Allisonville Rd, Indianapolis, IN 46220</p>
  </div>
</div>`,
  },
];

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}
