import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import bcrypt from "bcrypt";

test(
  "create and update a user with unique login credentials",
  { skip: process.env.RUN_DB_TESTS !== "1" },
  async () => {
    await import("dotenv/config");
    const root = fileURLToPath(new URL("../", import.meta.url));
    const hook = registerHooks({
      resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          return next(
            pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href,
            context,
          );
        }
        if (
          specifier.startsWith(".") &&
          context.parentURL?.startsWith(pathToFileURL(root).href)
        ) {
          const url = new URL(specifier, context.parentURL);
          if (
            !path.extname(url.pathname) &&
            existsSync(fileURLToPath(url) + ".ts")
          ) {
            return next(url.href + ".ts", context);
          }
        }
        return next(specifier, context);
      },
    });
    const { prisma } = await import("../lib/prisma.ts");
    const { saveDirectoryUser } = await import("../lib/user-directory.ts");
    const marker = `verify-user-${crypto.randomUUID()}`;
    const email = `${marker}@example.test`;
    const password = "Initial-Password-123";

    try {
      const role = await prisma.role.findFirstOrThrow({
        where: { is_active: true },
        orderBy: { id: "asc" },
      });
      const base = {
        username: marker,
        email,
        firstname: "ทดสอบ",
        lastname: "เพิ่มผู้ใช้งาน",
        role_id: role.id,
        is_active: true,
        password,
      };

      assert.equal(
        (await saveDirectoryUser({
          ...base,
          confirm_password: "รหัสผ่านไม่ตรงกัน",
        })).ok,
        false,
      );
      assert.equal(
        (await saveDirectoryUser({
          ...base,
          password: "short",
          confirm_password: "short",
        })).ok,
        false,
      );

      const created = await saveDirectoryUser({
        ...base,
        confirm_password: password,
      });
      assert.equal(created.ok, true, JSON.stringify(created));

      const user = await prisma.users.findUniqueOrThrow({
        where: { username: marker },
      });
      assert.equal(user.email, email);
      assert.equal(user.must_change_password, true);
      assert.equal(user.is_active, true);
      assert.ok(user.password_hash);
      assert.equal(await bcrypt.compare(password, user.password_hash), true);

      assert.equal(
        (await saveDirectoryUser({
          ...base,
          email: `${marker}-other@example.test`,
          confirm_password: password,
        })).ok,
        false,
      );
      assert.equal(
        (await saveDirectoryUser({
          ...base,
          username: `${marker}-other`,
          confirm_password: password,
        })).ok,
        false,
      );

      const updated = await saveDirectoryUser({
        id: user.id,
        username: marker,
        email,
        firstname: "แก้ไขแล้ว",
        lastname: "เพิ่มผู้ใช้งาน",
        role_id: role.id,
        is_active: false,
        password: "",
        confirm_password: "",
      });
      assert.equal(updated.ok, true, JSON.stringify(updated));

      const afterUpdate = await prisma.users.findUniqueOrThrow({
        where: { id: user.id },
      });
      assert.equal(afterUpdate.firstname, "แก้ไขแล้ว");
      assert.equal(afterUpdate.is_active, false);
      assert.equal(afterUpdate.password_hash, user.password_hash);
    } finally {
      await prisma.users.deleteMany({
        where: { username: { startsWith: marker } },
      });
      await prisma.$disconnect();
      hook.deregister();
    }
  },
);
