ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS applications_open boolean NOT NULL DEFAULT true;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS cancellation_reason text;
