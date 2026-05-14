import { getMockPosts } from '../mockFeed';
import { getSupabaseClient } from '../lib/supabase';
import type { Post, PostRow } from '../types';

interface FeedLoadResult {
  posts: Post[];
  fallbackMessage?: string;
}

const POST_IMAGES_BUCKET = 'content_images';

function shufflePosts(posts: Post[]): Post[] {
  const nextPosts = [...posts];

  for (let index = nextPosts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentPost = nextPosts[index];

    nextPosts[index] = nextPosts[swapIndex];
    nextPosts[swapIndex] = currentPost;
  }

  return nextPosts;
}

function distributePosts(posts: Post[]): Post[] {
  const shuffledPosts = shufflePosts(posts);
  const imagePosts = shuffledPosts.filter((post) => post.media?.kind === 'image');
  const textPosts = shuffledPosts.filter((post) => !post.media);
  const interleavedPosts: Post[] = [];
  let preferImages = imagePosts.length >= textPosts.length;

  while (imagePosts.length > 0 || textPosts.length > 0) {
    const preferredPosts = preferImages ? imagePosts : textPosts;
    const fallbackPosts = preferImages ? textPosts : imagePosts;

    if (preferredPosts.length > 0) {
      interleavedPosts.push(preferredPosts.shift()!);
    } else if (fallbackPosts.length > 0) {
      interleavedPosts.push(fallbackPosts.shift()!);
    }

    preferImages = !preferImages;
  }

  for (let index = 1; index < interleavedPosts.length; index += 1) {
    const currentPost = interleavedPosts[index];
    const previousPost = interleavedPosts[index - 1];

    if (
      currentPost.source === previousPost.source ||
      currentPost.author.name === previousPost.author.name
    ) {
      const swapIndex = interleavedPosts.findIndex(
        (post, candidateIndex) =>
          candidateIndex > index &&
          post.source !== previousPost.source &&
          post.author.name !== previousPost.author.name,
      );

      if (swapIndex > index) {
        interleavedPosts[index] = interleavedPosts[swapIndex];
        interleavedPosts[swapIndex] = currentPost;
      }
    }
  }

  return interleavedPosts;
}

function stripPlaceholderMedia(posts: Post[]): Post[] {
  return distributePosts(
    posts.map((post) => ({
      ...post,
      media: post.media?.kind === 'image' ? post.media : undefined,
      content: post.content.replace(/\\n/g, '\n'),
    })),
  );
}

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
    content: row.content.replace(/\\n/g, '\n'),
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
      posts: stripPlaceholderMedia(
        getMockPosts().map((post) => ({ ...post, persisted: false })),
      ),
      fallbackMessage:
        'Supabase posts could not be loaded, so the feed is showing local fallback data.',
    };
  }

  if (data.length === 0) {
    return {
      posts: stripPlaceholderMedia(
        getMockPosts().map((post) => ({ ...post, persisted: false })),
      ),
      fallbackMessage:
        'No posts are available in Supabase yet, so the feed is showing local fallback data.',
    };
  }

  return {
    posts: distributePosts(data.map(mapRowToPost)),
  };
}
