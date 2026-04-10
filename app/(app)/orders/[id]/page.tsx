import { OrderDetailClient } from './_components/order-detail-client';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return <OrderDetailClient orderId={params?.id ?? ''} />;
}
