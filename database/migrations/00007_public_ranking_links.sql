-- migrate:up
-- Store shareable path token so admins can re-display both random and slug URLs
-- without regenerating. One ranking link per workspace (create-once).
-- Legacy rows keep working via token_hash; plaintext token is filled on create/regenerate.

DELETE FROM public_ranking_links a
  USING public_ranking_links b
 WHERE a.workspace_id = b.workspace_id
   AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

ALTER TABLE public_ranking_links
  ADD COLUMN token text;

CREATE UNIQUE INDEX public_ranking_links_token_uidx
  ON public_ranking_links(token)
  WHERE token IS NOT NULL;

CREATE UNIQUE INDEX public_ranking_links_workspace_uidx
  ON public_ranking_links(workspace_id);

-- migrate:down
DROP INDEX public_ranking_links_workspace_uidx;
DROP INDEX public_ranking_links_token_uidx;
ALTER TABLE public_ranking_links DROP COLUMN token;
