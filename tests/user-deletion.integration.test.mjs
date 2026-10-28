import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("user deletion checks live admin permissions and serializes competing deletions", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
  await import("dotenv/config");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href, context);
    if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href)) {
      const url = new URL(specifier, context.parentURL);
      if (!path.extname(url.pathname) && existsSync(fileURLToPath(url) + ".ts")) return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  } });
  const { prisma } = await import("../lib/prisma.ts");
  const { deleteDirectoryUser } = await import("../lib/user-directory.ts");
  const marker = `delete-user-${crypto.randomUUID()}`;
  const roles = [], users = [];
  try {
    for (const [name, is_active] of [["admin", true], ["user", true], ["admin", false]]) {
      roles.push(await prisma.role.create({ data: { name, is_active, created_at: new Date(), updated_at: new Date() } }));
    }
    for (const [index, role, is_active] of [[0, roles[0], true], [1, roles[0], true], [2, roles[1], true], [3, roles[0], false], [4, roles[2], true], [5, roles[1], true]]) {
      users.push(await prisma.users.create({ data: { username: `${marker}-${index}`, role_id: role.id, is_active, created_at: new Date(), updated_at: new Date() } }));
    }
    const [first, second, member, disabled, disabledRole, victim] = users;
    for (const actor of [member, disabled, disabledRole]) assert.equal((await deleteDirectoryUser(victim.id, String(actor.id))).ok, false);
    assert.equal((await deleteDirectoryUser(first.id, String(first.id))).ok, false);
    for (const id of [null, true, [], "1", -1, 0, NaN, 2_147_483_648]) assert.equal((await deleteDirectoryUser(id, String(first.id))).ok, false);
    assert.equal((await deleteDirectoryUser(victim.id, "invalid")).ok, false);
    const deletes = await Promise.all([deleteDirectoryUser(victim.id, String(first.id)), deleteDirectoryUser(victim.id, String(second.id))]);
    assert.equal(deletes.filter(result => result.ok).length, 1, "only one deletion of the same account commits");
    assert.equal(await prisma.audit_logs.count({ where: { entity_type: "USER", entity_id: String(victim.id), action: "DELETE" } }), 1);
    const competing = await Promise.all([deleteDirectoryUser(second.id, String(first.id)), deleteDirectoryUser(first.id, String(second.id))]);
    assert.equal(competing.filter(result => result.ok).length, 1, "two admins cannot delete each other simultaneously");
    assert.equal(await prisma.users.count({ where: { id: { in: [first.id, second.id] } } }), 1);
    const deletedActor = await prisma.users.findUnique({ where: { id: first.id } }) ? second : first;
    assert.equal((await deleteDirectoryUser(member.id, String(deletedActor.id))).ok, false);
    assert.ok(await prisma.users.findUnique({ where: { id: member.id } }));
  } finally {
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: users.map(user => String(user.id)) } } });
    await prisma.users.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.role.deleteMany({ where: { id: { in: roles.map(role => role.id) } } });
    await prisma.$disconnect(); hook.deregister();
  }
});
