CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id SERIAL PRIMARY KEY,
  project_name VARCHAR(160) NOT NULL,
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  assign_date DATE NOT NULL,
  deadline DATE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_task_types (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  task_type VARCHAR(80) NOT NULL
);
