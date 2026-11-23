-- The integration suite migrates from scratch, so it gets its own database
-- rather than wiping the one a developer plays against.
CREATE DATABASE IF NOT EXISTS dragon_test;
GRANT ALL PRIVILEGES ON dragon_test.* TO 'dragon'@'%';
