/** One line in the audit trail. */
export interface AuditRecord {
  sequence: number;
  action: string;
  subjectId: string;
  actor: string;
  details: string;
  atMinute: number;
}

/**
 * The append-only record of what the service did to which booking.
 *
 * The service calls `record` from inside the operation being recorded. Records
 * are numbered from 1 in the order they were written, and nothing edits or
 * removes one afterwards.
 */
export class AuditTrail {
  private readonly records: AuditRecord[] = [];

  record(action: string, subjectId: string, actor: string, details: string, atMinute: number): void {
    this.records.push({
      sequence: this.records.length + 1,
      action,
      subjectId,
      actor,
      details,
      atMinute,
    });
  }

  /** Every record, oldest first. */
  all(): AuditRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  /** Records about one booking, oldest first. */
  forSubject(subjectId: string): AuditRecord[] {
    return this.all().filter((record) => record.subjectId === subjectId);
  }

  size(): number {
    return this.records.length;
  }
}
