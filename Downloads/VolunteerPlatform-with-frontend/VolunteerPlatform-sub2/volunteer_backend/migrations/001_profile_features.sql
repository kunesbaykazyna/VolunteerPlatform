ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
