"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type CurrentUserValue = {
  username: string | null;
  displayName: string | null;
  role: string | null;
  isAdmin: boolean;
  isDemo: boolean;
};

const CurrentUserContext = createContext<CurrentUserValue>({
  username: null,
  displayName: null,
  role: null,
  isAdmin: false,
  isDemo: false,
});

type CurrentUserProviderProps = {
  username?: string | null;
  displayName?: string | null;
  role?: string | null;
  isDemo?: boolean;
  children: ReactNode;
};

export function CurrentUserProvider({
  username = null,
  displayName = null,
  role = null,
  isDemo = false,
  children,
}: CurrentUserProviderProps) {
  const value = useMemo<CurrentUserValue>(
    () => ({
      username,
      displayName,
      role,
      isAdmin: role === "ADMIN",
      isDemo,
    }),
    [username, displayName, role, isDemo],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  return useContext(CurrentUserContext);
}
