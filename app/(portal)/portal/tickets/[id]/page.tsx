import { PortalTicketDetailClient } from './_components/portal-ticket-detail-client';

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalTicketDetailClient ticketId={id} />;
}
