import { TicketDetailClient } from './_components/ticket-detail-client';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailClient ticketId={id} />;
}
