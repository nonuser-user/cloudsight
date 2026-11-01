-- ===========================================================================
-- CloudSight — MySQL schema
-- ===========================================================================
-- Run once to create the database and tables:
--   mysql -u root -p < schema.sql
-- Or, if your DB user can't CREATE DATABASE, create it manually first and run
-- only the table DDL.

CREATE DATABASE IF NOT EXISTS cloudsight
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cloudsight;

-- --------------------------------------------------------------------------
-- Users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL UNIQUE,
  password_hash VARBINARY(255) NOT NULL,          -- bcrypt hash stored as binary
  initials      VARCHAR(4)    NOT NULL DEFAULT '',
  plan          VARCHAR(60)   NOT NULL DEFAULT 'Free · 15 GB',
  role          VARCHAR(80)   NOT NULL DEFAULT 'Student',
  institution   VARCHAR(160) NOT NULL DEFAULT '',
  student_id    VARCHAR(40)  NOT NULL DEFAULT '',
  phone         VARCHAR(40)  NOT NULL DEFAULT '',
  two_factor    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Files (metadata; bytes live in Cloudflare R2, keyed by r2_key)
CREATE TABLE IF NOT EXISTS files (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'def',  -- img/doc/vid/aud/zip/code/folder/def
  size_bytes  BIGINT       NOT NULL DEFAULT 0,
  directory   VARCHAR(160) NOT NULL DEFAULT '/',     -- folder path, e.g. /projects
  r2_key      VARCHAR(255) NOT NULL DEFAULT '',
  owner       VARCHAR(120) NOT NULL DEFAULT 'You',
  shared      TINYINT(1)   NOT NULL DEFAULT 0,
  starred     TINYINT(1)   NOT NULL DEFAULT 0,
  status      VARCHAR(20)  NOT NULL DEFAULT 'Synced',  -- Synced/Uploading/Failed
  modified    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_files_user_modified (user_id, modified),
  INDEX idx_files_user_size (user_id, size_bytes),
  INDEX idx_files_user_type (user_id, type),
  INDEX idx_files_user_dir (user_id, directory)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------------
-- Monthly storage snapshots (history for growth + ML prediction)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_snapshots (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  snapshot_date DATE NOT NULL,
  used_gb       DECIMAL(8,2) NOT NULL DEFAULT 0,
  uploaded_gb   DECIMAL(8,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_snap_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_snap_user_date (user_id, snapshot_date),
  INDEX idx_snap_user_date (user_id, snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
