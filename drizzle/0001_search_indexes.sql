-- Enable pg_trgm for fast fuzzy/substring matching across titles, repo names, notes, and refs
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- Full-text search GIN index on contributions (title + description + proposed_solution + reproduction_steps)
CREATE INDEX IF NOT EXISTS contributions_fts_idx
  ON contributions
  USING GIN (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(proposed_solution, '') || ' ' ||
      coalesce(reproduction_steps, '')
    )
  );
--> statement-breakpoint

-- Trigram indexes for fast substring/prefix matching
CREATE INDEX IF NOT EXISTS contributions_title_trgm_idx
  ON contributions USING GIN (title gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS repositories_full_name_trgm_idx
  ON repositories USING GIN (full_name gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contribution_notes_content_fts_idx
  ON contribution_notes
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS github_references_title_trgm_idx
  ON github_references USING GIN (title gin_trgm_ops);
