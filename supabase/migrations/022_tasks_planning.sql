-- Task planning horizon (Today / Next / Later / Backlog) and manual sort order

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planning TEXT DEFAULT 'backlog'
    CHECK (planning IN ('today', 'next', 'later', 'backlog'));

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_planning ON public.tasks(user_id, planning, sort_order);
