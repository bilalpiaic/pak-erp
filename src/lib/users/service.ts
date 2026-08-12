import type { User } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import {
  USER_ROLES,
  type UserDTO,
  type UserInput,
  type UserListQuery,
  type UserRoleValue,
} from "./types";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,80}$/;

function toUserDTO(user: User): UserDTO {
  return serialize({
    id: user.id.toString(),
    username: user.username,
    displayName: user.displayName,
    role: user.role as UserRoleValue,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
}

export function validateUserInput(
  input: UserInput,
  options: { requirePassword: boolean },
): string[] {
  const errors: string[] = [];
  const username = input.username?.trim() ?? "";
  const displayName = input.displayName?.trim() ?? "";

  if (!username) errors.push("Username is required.");
  else if (!USERNAME_RE.test(username)) {
    errors.push(
      "Username must be 3–80 characters and use letters, numbers, dots, underscores, or hyphens.",
    );
  }

  if (!displayName) errors.push("Display name is required.");
  else if (displayName.length > 150) errors.push("Display name must be 150 characters or fewer.");

  if (!USER_ROLES.includes(input.role)) errors.push("Invalid role.");

  if (options.requirePassword) {
    if (!input.password) errors.push("Password is required.");
    else if (input.password.length < 8) errors.push("Password must be at least 8 characters.");
    else if (input.password.length > 200) errors.push("Password must be 200 characters or fewer.");
  } else if (input.password !== undefined && input.password !== "") {
    if (input.password.length < 8) errors.push("Password must be at least 8 characters.");
    else if (input.password.length > 200) errors.push("Password must be 200 characters or fewer.");
  }

  return errors;
}

export async function listUsers(query: UserListQuery = {}): Promise<{ users: UserDTO[] }> {
  const prisma = getPrisma();
  const search = query.search?.trim();
  const role =
    query.role && USER_ROLES.includes(query.role as UserRoleValue)
      ? (query.role as UserRoleValue)
      : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(query.active === "active" ? { isActive: true } : {}),
      ...(query.active === "inactive" ? { isActive: false } : {}),
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return { users: users.map(toUserDTO) };
}

export async function getUser(id: string): Promise<UserDTO | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: BigInt(id) } });
  return user ? toUserDTO(user) : null;
}

export async function createUser(input: UserInput): Promise<UserDTO> {
  const errors = validateUserInput(input, { requirePassword: true });
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  try {
    const user = await prisma.user.create({
      data: {
        username: input.username.trim().toLowerCase(),
        passwordHash: hashPassword(input.password!),
        displayName: input.displayName.trim(),
        role: input.role,
        isActive: input.isActive ?? true,
      },
    });
    return toUserDTO(user);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("A user with this username already exists.");
    }
    throw error;
  }
}

export async function updateUser(id: string, input: UserInput): Promise<UserDTO> {
  const errors = validateUserInput(input, { requirePassword: false });
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id: BigInt(id) } });
  if (!existing) throw new Error("User not found.");

  const nextRole = input.role;
  const nextActive = input.isActive ?? existing.isActive;

  if (existing.role === "ADMIN" && (nextRole !== "ADMIN" || !nextActive)) {
    await assertNotLastActiveAdmin(existing.id);
  }

  try {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: input.username.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        role: nextRole,
        isActive: nextActive,
        ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
      },
    });
    return toUserDTO(user);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("A user with this username already exists.");
    }
    throw error;
  }
}

export async function setUserActive(id: string, isActive: boolean): Promise<UserDTO> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id: BigInt(id) } });
  if (!existing) throw new Error("User not found.");

  if (existing.role === "ADMIN" && !isActive) {
    await assertNotLastActiveAdmin(existing.id);
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { isActive },
  });
  return toUserDTO(user);
}

export async function deleteUser(id: string, actorUserId?: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id: BigInt(id) } });
  if (!existing) throw new Error("User not found.");

  if (actorUserId && existing.id.toString() === actorUserId) {
    throw new Error("You cannot delete your own account.");
  }

  if (existing.role === "ADMIN" && existing.isActive) {
    await assertNotLastActiveAdmin(existing.id);
  }

  await prisma.user.delete({ where: { id: existing.id } });
}

async function assertNotLastActiveAdmin(excludeId: bigint): Promise<void> {
  const prisma = getPrisma();
  const otherAdmins = await prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      id: { not: excludeId },
    },
  });
  if (otherAdmins === 0) {
    throw new Error("Cannot remove or deactivate the last active admin.");
  }
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<UserDTO | null> {
  const prisma = getPrisma();
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) return null;

  const user = await prisma.user.findUnique({ where: { username: normalized } });
  if (!user || !user.isActive) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return toUserDTO(user);
}

export async function ensureSeedAdmin(): Promise<void> {
  const prisma = getPrisma();
  const count = await prisma.user.count();
  if (count > 0) return;

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: hashPassword("admin123"),
      displayName: "Administrator",
      role: "ADMIN",
      isActive: true,
    },
  });
}

/** Public login LOV — active usernames only (no secrets). */
export async function listActiveUsernamesForLogin(): Promise<
  { username: string; displayName: string }[]
> {
  await ensureSeedAdmin();
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { username: true, displayName: true },
    orderBy: [{ username: "asc" }],
  });
  return users.map((u) => ({
    username: u.username,
    displayName: u.displayName,
  }));
}
