CREATE TABLE attendance (id text PRIMARY KEY, status text NOT NULL, academic_year_id text NOT NULL, secret text);
CREATE TABLE attendance_history (id text PRIMARY KEY, attendance_id text NOT NULL, old_status text, new_status text NOT NULL);
INSERT INTO sync_installations VALUES ('installation-1','epoch-1');
