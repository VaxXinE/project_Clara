"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

type DashboardUserContextValue = {
  currentUser: CurrentUser | null;
  syncCurrentUser: (user: CurrentUser | null) => void;
};

const DashboardUserContext = createContext<DashboardUserContextValue | null>(
  null
);

function areUsersEquivalent(
  currentUser: CurrentUser | null,
  nextUser: CurrentUser | null
) {
  if (currentUser === nextUser) {
    return true;
  }

  if (!currentUser || !nextUser) {
    return false;
  }

  return (
    currentUser.id === nextUser.id &&
    currentUser.role === nextUser.role &&
    currentUser.name === nextUser.name &&
    currentUser.email === nextUser.email &&
    currentUser.organization_id === nextUser.organization_id &&
    currentUser.organization_name === nextUser.organization_name
  );
}

export function DashboardUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (currentUser) {
      return;
    }

    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        if (isMounted) {
          setCurrentUser(me);
        }
      } catch {
        // Dashboard layout already protects anonymous access.
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const value = useMemo<DashboardUserContextValue>(
    () => ({
      currentUser,
      syncCurrentUser(nextUser) {
        setCurrentUser((previousUser) =>
          areUsersEquivalent(previousUser, nextUser) ? previousUser : nextUser
        );
      },
    }),
    [currentUser]
  );

  return (
    <DashboardUserContext.Provider value={value}>
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}
