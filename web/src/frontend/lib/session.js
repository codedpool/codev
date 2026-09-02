'use client';
// Session adapter over Clerk so UI components don't depend on the auth vendor.
import { useMemo } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';

export function useSession() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  return useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress || null;
    const name = user?.fullName || user?.username || email || 'Guest';
    return {
      isLoading: !isLoaded,
      isAuthenticated: !!isSignedIn,
      user: user ? { id: user.id, name, nickname: user.username || null, email, picture: user.imageUrl || null } : null,
      signIn: () => clerk.redirectToSignIn({ redirectUrl: window.location.pathname }),
      signOut: () => clerk.signOut({ redirectUrl: '/' }),
      openProfile: () => clerk.openUserProfile(),
    };
  }, [isLoaded, isSignedIn, user, clerk]);
}
