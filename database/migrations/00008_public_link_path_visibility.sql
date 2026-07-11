-- migrate:up
-- Independent public/private for random-token path vs custom-slug path.

ALTER TABLE public_ranking_links
  ADD COLUMN token_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN slug_enabled boolean NOT NULL DEFAULT true;

UPDATE public_ranking_links
SET token_enabled = is_enabled,
    slug_enabled = is_enabled;

-- migrate:down
ALTER TABLE public_ranking_links
  DROP COLUMN token_enabled,
  DROP COLUMN slug_enabled;
