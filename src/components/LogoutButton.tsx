'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('[LogoutButton] logout request failed:', err);
    }
    router.push('/login');
  }

  return (
    <Button variant="secondary" loading={loading} disabled={loading} onClick={handleLogout}>
      Log out
    </Button>
  );
}
