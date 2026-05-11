import { Post } from './types';

type RawAuthor = {
  name?: unknown;
  handle?: unknown;
  avatarSeed?: unknown;
  verified?: unknown;
};

type RawCounts = {
  replies?: unknown;
  reposts?: unknown;
  likes?: unknown;
  views?: unknown;
};

type RawMedia = {
  kind?: unknown;
  alt?: unknown;
  src?: unknown;
  accent?: unknown;
};

type RawLink = {
  url?: unknown;
  label?: unknown;
  domain?: unknown;
};

type RawPost = {
  id?: unknown;
  author?: RawAuthor;
  content?: unknown;
  timestampLabel?: unknown;
  source?: unknown;
  media?: RawMedia;
  link?: RawLink;
  counts?: RawCounts;
  flags?: {
    liked?: unknown;
    reposted?: unknown;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object record.');
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Expected ${fieldName} to be a non-empty string.`);
  }

  return value;
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${fieldName} to be a boolean.`);
  }

  return value;
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`Expected ${fieldName} to be a non-negative number.`);
  }

  return value;
}

function normalizePost(raw: unknown): Post {
  const record = asRecord(raw) as RawPost;
  const authorRecord = asRecord(record.author);
  const countsRecord = asRecord(record.counts);

  const post: Post = {
    id: asString(record.id, 'id'),
    author: {
      name: asString(authorRecord.name, 'author.name'),
      handle: asString(authorRecord.handle, 'author.handle'),
      avatarSeed: asString(authorRecord.avatarSeed, 'author.avatarSeed'),
      verified:
        authorRecord.verified === undefined
          ? false
          : asBoolean(authorRecord.verified, 'author.verified'),
    },
    content: asString(record.content, 'content'),
    timestampLabel: asString(record.timestampLabel, 'timestampLabel'),
    source:
      record.source === undefined
        ? undefined
        : asString(record.source, 'source'),
    counts: {
      replies: asNumber(countsRecord.replies, 'counts.replies'),
      reposts: asNumber(countsRecord.reposts, 'counts.reposts'),
      likes: asNumber(countsRecord.likes, 'counts.likes'),
      views: asNumber(countsRecord.views, 'counts.views'),
    },
    flags: {
      liked:
        record.flags?.liked === undefined
          ? false
          : asBoolean(record.flags.liked, 'flags.liked'),
      reposted:
        record.flags?.reposted === undefined
          ? false
          : asBoolean(record.flags.reposted, 'flags.reposted'),
    },
  };

  if (record.media !== undefined) {
    const mediaRecord = asRecord(record.media);
    const kind = asString(mediaRecord.kind, 'media.kind');

    if (kind !== 'image' && kind !== 'gradient') {
      throw new Error('Expected media.kind to be "image" or "gradient".');
    }

    post.media = {
      kind,
      alt: asString(mediaRecord.alt, 'media.alt'),
      src:
        mediaRecord.src === undefined
          ? undefined
          : asString(mediaRecord.src, 'media.src'),
      accent:
        mediaRecord.accent === undefined
          ? undefined
          : asString(mediaRecord.accent, 'media.accent'),
    };
  }

  if (record.link !== undefined) {
    const linkRecord = asRecord(record.link);
    post.link = {
      url: asString(linkRecord.url, 'link.url'),
      label: asString(linkRecord.label, 'link.label'),
      domain: asString(linkRecord.domain, 'link.domain'),
    };
  }

  return post;
}

export function normalizePosts(raw: unknown): Post[] {
  if (!Array.isArray(raw)) {
    throw new Error('Expected an array of posts.');
  }

  return raw.map(normalizePost);
}
