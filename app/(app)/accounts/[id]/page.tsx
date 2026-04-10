import { AccountDetailClient } from './_components/account-detail-client';

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  return <AccountDetailClient accountId={params?.id ?? ''} />;
}
