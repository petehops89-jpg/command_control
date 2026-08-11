'use strict';

/**
 * audit-log.js
 *
 * Minimal append-only audit trail. Every component (Gate, Auth,
 * Worker) writes here independently, per the trust model diagram in
 * the assessment (point 10/13). This in-memory version is for the
 * demo — production should append to a write-once store (e.g. Cloud
 * Logging with retention lock, or an append-only DB table with no
 * UPDATE/DELETE grants for the app's service account).
 */

class AuditLog {
  constructor() {
    this._entries = [];
  }

  record(component, event, details = {}) {
    this._entries.push({
      ts: new Date().toISOString(),
      component,
      event,
      ...details,
    });
  }

  all() {
    return this._entries.slice();
  }
}

module.exports = { AuditLog };
