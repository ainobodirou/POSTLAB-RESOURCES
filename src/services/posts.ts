import { getMockPosts } from '../mockFeed';
import { getSupabaseClient } from '../lib/supabase';
import type { Post, PostRow } from '../types';

interface FeedLoadResult {
  posts: Post[];
  fallbackMessage?: string;
}

const POST_IMAGES_BUCKET = 'content_images';

function formatRelativeTime(dateValue: string | null): string {
  if (!dateValue) {
    return 'now';
  }

  const createdAt = new Date(dateValue);
  const elapsedMilliseconds = Date.now() - createdAt.getTime();

  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return 'now';
  }

  const elapsedHours = Math.floor(elapsedMilliseconds / (1000 * 60 * 60));

  if (elapsedHours < 1) {
    const elapsedMinutes = Math.max(
      1,
      Math.floor(elapsedMilliseconds / (1000 * 60)),
    );
    return `${elapsedMinutes}m`;
  }

  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d`;
}

function buildHandle(authorName: string): string {
  return `@${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'participant'}`;
}

function buildCounts(index: number) {
  return {
    replies: 2 + index * 2,
    reposts: 8 + index * 3,
    likes: 20 + index * 5,
    views: 240 + index * 121,
  };
}

function normalizeStoragePath(imageId: string): string {
  return imageId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${POST_IMAGES_BUCKET}/`, 'i'), '');
}

function getPostImageUrl(imageId: string | null): string | undefined {
  if (!imageId?.trim()) {
    return undefined;
  }

  if (/^https?:\/\//i.test(imageId)) {
    return encodeURI(imageId.trim());
  }

  const normalizedPath = normalizeStoragePath(imageId);
  const supabase = getSupabaseClient();
  const { data } = supabase.storage
    .from(POST_IMAGES_BUCKET)
    .getPublicUrl(normalizedPath);

  return encodeURI(data.publicUrl);
}

function mapRowToPost(row: PostRow, index: number): Post {
  const imageSource = getPostImageUrl(row.image_id);

  return {
    id: row.post_id,
    persisted: true,
    author: {
      name: row.author_name,
      handle: buildHandle(row.author_name),
      avatarSeed: row.author_name,
      verified: index % 3 === 0,
    },
    content: row.content,
    timestampLabel: formatRelativeTime(row.created_at),
    source: row.topic ?? 'Supabase',
    media: imageSource
      ? {
          kind: 'image',
          alt: row.topic ?? `Post image from ${row.author_name}`,
          src: imageSource,
        }
      : undefined,
    counts: buildCounts(index),
    flags: {
      liked: false,
      reposted: false,
    },
  };
}

export async function loadPosts(): Promise<FeedLoadResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    return {
      posts: getMockPosts().map((post) => ({ ...post, persisted: false })),
      fallbackMessage:
        'Supabase posts could not be loaded, so the feed is showing local fallback data.',
    };
  }

  if (data.length === 0) {
    return {
      posts: getMockPosts().map((post) => ({ ...post, persisted: false })),
      fallbackMessage:
        'No posts are available in Supabase yet, so the feed is showing local fallback data.',
    };
  }

  return {
    posts: data.map(mapRowToPost),
  };
}
