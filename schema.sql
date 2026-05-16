-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- This file reflects the application contract used by the frontend:
-- - participant_id is the internal generated identifier
-- - task_id stores the visible participant code from 1 to 20
-- - survey_id remains required and is populated with a shared placeholder UUID

CREATE TABLE public.participant_post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  post_id uuid NOT NULL,
  liked boolean NOT NULL DEFAULT true,
  liked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participant_post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT participant_post_likes_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participant_profiles(participant_id),
  CONSTRAINT participant_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id)
);

CREATE TABLE public.participant_post_reposts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  post_id uuid NOT NULL,
  reposted boolean NOT NULL DEFAULT true,
  reposted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participant_post_reposts_pkey PRIMARY KEY (id),
  CONSTRAINT participant_post_reposts_participant_post_key UNIQUE (participant_id, post_id),
  CONSTRAINT participant_post_reposts_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participant_profiles(participant_id),
  CONSTRAINT participant_post_reposts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id)
);

CREATE TABLE public.feedset (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  feed uuid[] NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedset_pkey PRIMARY KEY (id),
  CONSTRAINT feedset_participant_id_key UNIQUE (participant_id),
  CONSTRAINT feedset_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participant_profiles(participant_id)
);

CREATE TABLE public.participant_profiles (
  participant_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  interests text[] NULL,
  task_id integer NOT NULL,
  survey_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participant_profiles_pkey PRIMARY KEY (participant_id),
  CONSTRAINT participant_profiles_task_id_key UNIQUE (task_id),
  CONSTRAINT fk_survey FOREIGN KEY (survey_id) REFERENCES public.participant_surveys(survey_id)
);

CREATE TABLE public.participant_surveys (
  survey_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participant_surveys_pkey PRIMARY KEY (survey_id)
);

CREATE TABLE public.posts (
  post_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  author_name text NOT NULL,
  content text NOT NULL,
  topic text,
  image_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT posts_pkey PRIMARY KEY (post_id)
);
