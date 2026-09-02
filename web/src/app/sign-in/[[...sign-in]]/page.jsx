import { SignIn } from '@clerk/nextjs';
import AuthShell from '../../auth-shell';

export const metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  );
}
