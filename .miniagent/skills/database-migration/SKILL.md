---
name: database-migration
description: Use when the user needs to create database migrations, modify database schema, write SQL scripts, or manage database changes. Provides migration patterns for adding/dropping tables and columns, creating indexes, and writing reversible migrations. Triggers on database migration, schema change, or SQL script creation requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 数据库迁移
  - database migration
  - 修改表结构
  - alter table
  - 创建索引
  - create index
  - schema change
  - 数据库变更
  - 修改数据库
  - add column
---

# Database Migration Skill

Database migration following best practices for schema evolution.

## Migration Principles

1. **Never modify existing data** - Add new columns, backfill, then switch
2. **Always reversible** - Provide both up and down migrations
3. **Add, don't change** - New column with default, migrate data, remove old
4. **Index after data** - Create index after populating data
5. **Test both directions** - Test up and down before merging

## Common Migrations

### Add Column

```sql
-- UP
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- DOWN
ALTER TABLE users DROP COLUMN email_verified;
```

### Add Table

```sql
-- UP
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- DOWN
DROP TABLE IF EXISTS audit_logs;
```

### Rename Column (Safe Approach)

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Step 2: Backfill data (in application code or script)
UPDATE users SET full_name = name;

-- Step 3: Update application to use new column
-- (deploy application changes first)

-- Step 4: Remove old column (in a later migration)
ALTER TABLE users DROP COLUMN name;
```

### Add Index

```sql
-- UP
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- DOWN
DROP INDEX IF EXISTS idx_users_email;
```

## Migration Checklist

- [ ] Migration is reversible (up and down both work)
- [ ] Default values set for new columns
- [ ] Foreign key constraints added
- [ ] Indexes added for query patterns
- [ ] No data loss in the migration
- [ ] Tested on staging environment
- [ ] Rollback plan documented
