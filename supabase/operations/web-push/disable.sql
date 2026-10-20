-- Review and authorize the exact environment before execution. Keeps inbox intact.
update public.web_push_transport set enabled=false where environment=:'environment';
-- Separately disable the named Cron job and WEB_PUSH_ENABLED Edge flag.
