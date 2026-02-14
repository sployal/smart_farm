'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type Role = 'admin' | 'gardener' | 'user' | null;

interface UseRoleReturn {
  role: Role;
  loading: boolean;
  uid: string | null;
  email: string | null;
}

/**
 * Subscribes to the current user's Firestore document and returns their role in real-time.
 *
 * Usage:
 *   const { role, loading } = useRole();
 *   if (loading) return <Spinner />;
 *   if (role !== 'admin') redirect('/dashboard');
 */
export function useRole(): UseRoleReturn {
  const [role,    setRole]    = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [uid,     setUid]     = useState<string | null>(null);
  const [email,   setEmail]   = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        setRole(null);
        setUid(null);
        setEmail(null);
        setLoading(false);
        return;
      }

      setUid(user.uid);
      setEmail(user.email);

      // Subscribe to the user's Firestore document for real-time role updates
      const userRef  = doc(db, 'users', user.uid);
      const unsubDoc = onSnapshot(
        userRef,
        snap => {
          if (snap.exists()) {
            setRole((snap.data().role as Role) ?? 'user');
          } else {
            // Document not yet written — treat as plain user
            setRole('user');
          }
          setLoading(false);
        },
        () => {
          // Permission denied or other error — default to user
          setRole('user');
          setLoading(false);
        },
      );

      // Clean up Firestore listener when auth state changes again
      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  return { role, loading, uid, email };
}