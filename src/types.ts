export type Theme = 'dark' | 'light';
export type OnboardingStep =
  | 'instructions'
  | 'confirmed'
  | 'creatingId'
  | 'idAssigned'
  | 'feed';

export interface ParticipantSession {
  participantId: string;
  participantCode: number;
  postbackUrl?: string;
}

export interface Author {
  name: string;
  handle: string;
  avatarSeed: string;
  verified?: boolean;
}

export interface PostCounts {
  replies: number;
  reposts: number;
  likes: number;
  views: number;
}

export interface PostMedia {
  kind: 'image' | 'gradient';
  alt: string;
  src?: string;
  accent?: string;
}

export interface PostLink {
  url: string;
  label: string;
  domain: string;
}

export interface PostFlags {
  liked: boolean;
  reposted: boolean;
}

export interface Post {
  id: string;
  persisted?: boolean;
  author: Author;
  content: string;
  timestampLabel: string;
  source?: string;
  media?: PostMedia;
  link?: PostLink;
  counts: PostCounts;
  flags: PostFlags;
}

export interface ParticipantProfileRow {
  participant_id: string;
  interests: string[] | null;
  task_id: number;
  survey_id: string;
  created_at: string | null;
}

export interface ParticipantPostLikeRow {
  id: string;
  participant_id: string;
  post_id: string;
  liked: boolean;
  liked_at: string | null;
}

export interface ParticipantPostRepostRow {
  id: string;
  participant_id: string;
  post_id: string;
  reposted: boolean;
  reposted_at: string | null;
}

export interface FeedsetRow {
  id: string;
  participant_id: string;
  feed: string[];
  created_at: string | null;
}

export interface PostRow {
  post_id: string;
  author_name: string;
  content: string;
  topic: string | null;
  image_id: string | null;
  created_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      participant_post_likes: {
        Row: ParticipantPostLikeRow;
        Insert: {
          id?: string;
          participant_id: string;
          post_id: string;
          liked?: boolean;
          liked_at?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          post_id?: string;
          liked?: boolean;
          liked_at?: string | null;
        };
      };
      participant_post_reposts: {
        Row: ParticipantPostRepostRow;
        Insert: {
          id?: string;
          participant_id: string;
          post_id: string;
          reposted?: boolean;
          reposted_at?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          post_id?: string;
          reposted?: boolean;
          reposted_at?: string | null;
        };
      };
      feedset: {
        Row: FeedsetRow;
        Insert: {
          id?: string;
          participant_id: string;
          feed: string[];
          created_at?: string | null;
        };
        Update: {
          id?: string;
          participant_id?: string;
          feed?: string[];
          created_at?: string | null;
        };
      };
      participant_profiles: {
        Row: ParticipantProfileRow;
        Insert: {
          participant_id?: string;
          interests?: string[] | null;
          task_id: number;
          survey_id: string;
          created_at?: string | null;
        };
        Update: {
          participant_id?: string;
          interests?: string[] | null;
          task_id?: number;
          survey_id?: string;
          created_at?: string | null;
        };
      };
      posts: {
        Row: PostRow;
        Insert: {
          post_id?: string;
          author_name: string;
          content: string;
          topic?: string | null;
          image_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          post_id?: string;
          author_name?: string;
          content?: string;
          topic?: string | null;
          image_id?: string | null;
          created_at?: string | null;
        };
      };
    };
  };
}
