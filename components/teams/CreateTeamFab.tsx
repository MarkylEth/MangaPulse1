'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CreateTeamButton from './CreateTeamButton';

export default function CreateTeamFab() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data } = await sb.auth.getUser();
      setAuthed(!!data.user);
    })();
  }, []);

  if (!authed) return null;

  return <CreateTeamButton className="fixed bottom-5 right-5 z-50 shadow-lg" />;
}
