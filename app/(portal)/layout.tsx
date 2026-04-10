import '@/app/globals.css';
import { Providers } from '@/components/providers';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
