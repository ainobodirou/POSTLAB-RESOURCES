import { normalizePosts } from './feedAdapter';
import { Post } from './types';

const names = [
  ['Avery Cole', 'averybuilds', true],
  ['Noah Tran', 'noahloops', false],
  ['Mila Foster', 'milaonmobile', true],
  ['Jordan Lee', 'jordandesigns', false],
  ['Sofia Patel', 'sofiaships', true],
  ['Theo Wright', 'theoresearch', false],
  ['Nina Rossi', 'ninamakes', true],
  ['Kai Bennett', 'kainotes', false],
] as const;

const topics = [
  'Sharing a fast prototype flow for testing engagement actions before the backend exists.',
  'Trying a mobile-first pass first this time and it is saving a lot of layout rework.',
  'A reminder that good mock data should include uneven post lengths and different media combinations.',
  'Design detail I keep coming back to: hover states matter more when the rest of the interface is calm.',
  'Built a small feed demo today that feels familiar without chasing pixel-perfect cloning.',
  'If a timeline is going to feel alive, the timestamps and counts need enough variation to look believable.',
  'Keeping the data model simple now so a JSON upload step can plug in later without repainting the app.',
  'Prototype rule: if the action feels clickable, it should actually do something, even if state is local only.',
  'Testing how a light theme changes perception of density in a feed-heavy layout.',
  'One of the easiest wins for a mock social surface is giving every post a slightly different voice.',
];

const links = [
  {
    url: 'https://example.com/design-systems',
    label: 'Design systems notes for feed-heavy products',
    domain: 'example.com',
  },
  {
    url: 'https://example.com/mobile-layouts',
    label: 'Responsive layout checklist for mobile-first feeds',
    domain: 'example.com',
  },
  {
    url: 'https://example.com/prototype-data',
    label: 'How to shape mock data for future imports',
    domain: 'example.com',
  },
  {
    url: 'https://example.com/link-preview',
    label: 'Why consistent link cards improve scan speed',
    domain: 'example.com',
  },
];

const gradients = [
  'linear-gradient(135deg, #1d9bf0, #7c5cff)',
  'linear-gradient(135deg, #18b67e, #0f7d77)',
  'linear-gradient(135deg, #ff7a18, #ff3d71)',
  'linear-gradient(135deg, #5166f7, #18c4c1)',
];

const mockPostRecords = Array.from({ length: 40 }, (_, index) => {
  const [name, handle, verified] = names[index % names.length];
  const topic = topics[index % topics.length];
  const link = index % 3 === 0 ? links[index % links.length] : undefined;
  const media =
    index % 4 === 0
      ? {
          kind: 'gradient',
          alt: `Abstract preview ${index + 1}`,
          accent: gradients[index % gradients.length],
        }
      : undefined;

  return {
    id: `post-${index + 1}`,
    author: {
      name,
      handle: `@${handle}`,
      avatarSeed: name,
      verified,
    },
    content: `${topic} ${index % 5 === 0 ? 'Adding one longer sentence here so the timeline includes denser cards and wraps naturally on smaller screens.' : 'Keeping this one concise so the feed rhythm stays varied.'}`,
    timestampLabel: `${(index % 12) + 1}h`,
    source: index % 2 === 0 ? 'Web App' : 'Mobile',
    media,
    link,
    counts: {
      replies: 3 + index * 2,
      reposts: 12 + index * 3,
      likes: 48 + index * 7,
      views: 500 + index * 133,
    },
    flags: {
      liked: index % 7 === 0,
      reposted: index % 9 === 0,
    },
  };
});

export function getMockPosts(): Post[] {
  return normalizePosts(mockPostRecords);
}
