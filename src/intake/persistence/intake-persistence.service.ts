import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import type { IntakeTriageRecord } from '../../triage/triage.types';

@Injectable()
export class IntakePersistenceService {
  private readonly logger = new Logger(IntakePersistenceService.name);

  constructor(private readonly config: ConfigService) {}

  private resolvePath(): string {
    const rel =
      this.config.get<string>('intake.jsonPath') ?? 'data/intake-records.json';
    return path.resolve(process.cwd(), rel);
  }

  /**
   * Appends the record to a JSON array file on disk.
   * The file is created if it does not exist; the directory is created recursively.
   * Disabled via INTAKE_JSON_DISABLED=true (used in e2e tests that do not exercise intake).
   */
  async persistRecord(record: IntakeTriageRecord): Promise<void> {
    const enabled = this.config.get<boolean>('intake.jsonPersistEnabled');
    if (enabled === false) {
      return;
    }

    const filePath = this.resolvePath();
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });

    let records: IntakeTriageRecord[] = [];
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      records = Array.isArray(parsed) ? (parsed as IntakeTriageRecord[]) : [];
    } catch {
      // File does not exist yet or is not valid JSON — start fresh.
      records = [];
    }

    records.push(record);
    await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    this.logger.log(`Record appended to ${filePath}`);
  }
}
