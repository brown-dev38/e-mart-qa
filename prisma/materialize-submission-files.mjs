import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { snapshotQualityFile, removeQualityFile } from "../lib/quality-document-files.ts";

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL), log: [] });
try {
  const rows = await prisma.docs_qa_submissions.findMany({ where: { source: "LEGACY_PENDING", file_sha256: null } });
  let captured = 0;
  for (const row of rows) {
    let copy;
    try {
      copy = await snapshotQualityFile(row.file_path);
      const result = await prisma.docs_qa_submissions.updateMany({
        where: { id: row.id, file_sha256: null, source: "LEGACY_PENDING" },
        data: { ...copy, captured_at: new Date() },
      });
      if (result.count) captured++;
      else await removeQualityFile(copy.file_path);
    } catch {
      if (copy) await removeQualityFile(copy.file_path);
      console.error(`Unable to capture legacy pending submission #${row.id}; restore its source file and rerun.`);
      process.exitCode = 1;
    }
  }
  console.log(`Captured ${captured} of ${rows.length} legacy pending submissions.`);
} finally { await prisma.$disconnect(); }
