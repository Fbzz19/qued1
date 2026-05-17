/*
  # Enable live social updates

  Adds the social tables used by reviews, replies, likes, and notifications to
  Supabase Realtime so other open screens can update without a manual refresh.
*/

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY[
    'reviews',
    'ratings',
    'review_likes',
    'review_comments',
    'comment_likes',
    'notifications'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN undefined_object THEN
        NULL;
    END;
  END LOOP;
END $$;
