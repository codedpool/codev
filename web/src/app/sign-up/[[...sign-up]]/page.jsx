import { SignUp } from '@clerk/nextjs';
import AuthShell from '../../auth-shell';

export const metadata = { title: 'Create account' };

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  );
}
