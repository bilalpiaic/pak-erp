export const USER_ROLES = ["ADMIN", "USER"] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];

export type UserDTO = {
  id: string;
  username: string;
  displayName: string;
  role: UserRoleValue;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserInput = {
  username: string;
  password?: string;
  displayName: string;
  role: UserRoleValue;
  isActive?: boolean;
  isDemo?: boolean;
};

export type UserListQuery = {
  search?: string;
  active?: "all" | "active" | "inactive";
  role?: string;
};
