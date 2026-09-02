import Link from 'next/link';
import { Logo } from '@/frontend/ui';

export default function AuthShell({ children }) {
  return (
    <div className="page page-scroll" style={{ minHeight: '100vh' }}>
      <nav className="page__nav">
        <Link href="/" aria-label="Codev home"><Logo /></Link>
      </nav>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8vh 16px 40px' }}>{children}</div>
    </div>
  );
}
