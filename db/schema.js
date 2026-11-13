import {sqliteTable, text, integer, index, primaryKey} from 'drizzle-orm/sqlite-core';

// Match the schema used by local Wrangler migrations. Table-level primary keys
// preserve SQLite's existing nullability for single text primary-key columns.
export const accounts = sqliteTable('accounts', {
  id: text('id'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  recoveryHash: text('recovery_hash').notNull(),
  profileJson: text('profile_json').notNull(),
  learnerJson: text('learner_json').notNull(),
  importsJson: text('imports_json').notNull().default('[]'),
  revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, table => [primaryKey({columns: [table.id]})]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash'),
  accountId: text('account_id').notNull().references(() => accounts.id, {onDelete: 'cascade'}),
  expiresAt: integer('expires_at').notNull(),
}, table => [
  primaryKey({columns: [table.tokenHash]}),
  index('sessions_account').on(table.accountId),
  index('sessions_expiry').on(table.expiresAt),
]);

export const operations = sqliteTable('operations', {
  accountId: text('account_id').notNull().references(() => accounts.id, {onDelete: 'cascade'}),
  operationId: text('operation_id').notNull(),
  requestHash: text('request_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [primaryKey({columns: [table.accountId, table.operationId]})]);

export const authLimits = sqliteTable('auth_limits', {
  key: text('key'),
  windowStart: integer('window_start').notNull(),
  attempts: integer('attempts').notNull(),
}, table => [primaryKey({columns: [table.key]})]);
