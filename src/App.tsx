import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  Check,
  CircleEllipsis,
  Compass,
  Heart,
  Home,
  Image,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Search,
  Share,
  Smile,
  User,
  X,
} from 'lucide-react';
import { clearParticipantSession, readParticipantSession, writeParticipantSession } from './lib/participantStorage';
import { getMockPosts } from './mockFeed';
import { getParticipantLikes, setParticipantPostLike } from './services/likes';
import { createParticipantSession, getParticipantById } from './services/participants';
import { loadPosts } from './services/posts';
import { OnboardingStep, ParticipantSession, Post, Theme } from './types';

type NavItem = {
  label: string;
  icon: typeof Home;
  active?: boolean;
  badge?: string;
};

const navItems: NavItem[] = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Explore', icon: Compass },
  { label: 'Notifications', icon: Bell, badge: '20+' },
  { label: 'Messages', icon: Mail },
  { label: 'Bookmarks', icon: Bookmark },
  { label: 'Profile', icon: User },
  { label: 'More', icon: CircleEllipsis },
];

const newsItems = [
  {
    title: "Real Madrid Fans Petition for Mbappe's Exit Amid Poor Season",
    meta: '3 days ago - Sports - 206.4K posts',
  },
  {
    title: 'BTS Reunites for Chaotic Foot Volleyball in TRIP EP.3',
    meta: '2 days ago - Other - 287.7K posts',
  },
  {
    title: "Man City Draw 3-3 with Everton, Boosting Arsenal's Five-Point Lead",
    meta: '3 days ago - Sports - 309.5K posts',
  },
];

const trends = [
  { label: '#mafsnl', meta: 'Trending in Netherlands' },
  { label: '#6mei', meta: 'Trending in Netherlands' },
  { label: 'Prototype testing', meta: '8,914 posts' },
  { label: 'Social media research', meta: '4,286 posts' },
];

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return `${value}`;
}

function makeAvatarStyle(seed: string): string {
  const palette = ['#8aa0ae', '#bf6b63', '#557aa5', '#a2825c', '#7e8b62'];
  const index = seed.length % palette.length;
  return `linear-gradient(135deg, ${palette[index]}, #d8e1e7)`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

function applyLikedPostIds(posts: Post[], likedPostIds: Set<string>): Post[] {
  return posts.map((post) => {
    const liked = likedPostIds.has(post.id);

    return {
      ...post,
      flags: { ...post.flags, liked },
      counts: {
        ...post.counts,
        likes:
          liked && !post.flags.liked ? post.counts.likes + 1 : post.counts.likes,
      },
    };
  });
}

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [participantSession, setParticipantSession] = useState<ParticipantSession | null>(
    () => readParticipantSession(),
  );
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() =>
    readParticipantSession() ? 'idAssigned' : 'instructions',
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => readParticipantSession() !== null,
  );
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!participantSession) {
      setIsRestoringSession(false);
      return;
    }

    const session = participantSession;
    let cancelled = false;

    async function restoreSession() {
      try {
        const participantProfile = await getParticipantById(session.participantId);

        if (cancelled) {
          return;
        }

        if (!participantProfile) {
          clearParticipantSession();
          setParticipantSession(null);
          setOnboardingStep('instructions');
          setOnboardingError(
            'Your saved participant session is no longer available. Please generate a new ID.',
          );
          return;
        }

        setOnboardingStep('idAssigned');
      } catch (error) {
        if (!cancelled) {
          setOnboardingError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [participantSession]);

  useEffect(() => {
    if (onboardingStep !== 'feed') {
      return;
    }

    let cancelled = false;

    async function hydrateFeed() {
      setIsFeedLoading(true);
      setFeedNotice(null);

      try {
        const feedResult = await loadPosts();
        let nextPosts = feedResult.posts;

        if (participantSession) {
          const likedPostIds = await getParticipantLikes(
            participantSession.participantId,
          );
          nextPosts = applyLikedPostIds(nextPosts, likedPostIds);
        }

        if (cancelled) {
          return;
        }

        setPosts(nextPosts);
        setFeedNotice(feedResult.fallbackMessage ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPosts(getMockPosts().map((post) => ({ ...post, persisted: false })));
        setFeedNotice(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsFeedLoading(false);
        }
      }
    }

    void hydrateFeed();

    return () => {
      cancelled = true;
    };
  }, [onboardingStep, participantSession]);

  function updatePost(postId: string, updater: (post: Post) => Post) {
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? updater(post) : post)),
    );
  }

  async function onLike(postId: string) {
    const targetPost = posts.find((post) => post.id === postId);

    if (!targetPost) {
      return;
    }

    const liked = !targetPost.flags.liked;

    updatePost(postId, (post) => ({
      ...post,
      flags: { ...post.flags, liked },
      counts: {
        ...post.counts,
        likes: liked ? post.counts.likes + 1 : Math.max(0, post.counts.likes - 1),
      },
    }));

    if (!participantSession || !targetPost.persisted) {
      setFeedNotice(
        'This feed item is using fallback data, so the like state only lives in the current session.',
      );
      return;
    }

    try {
      await setParticipantPostLike(participantSession.participantId, postId, liked);
    } catch (error) {
      updatePost(postId, (post) => ({
        ...post,
        flags: { ...post.flags, liked: !liked },
        counts: {
          ...post.counts,
          likes: liked ? Math.max(0, post.counts.likes - 1) : post.counts.likes + 1,
        },
      }));
      setFeedNotice(getErrorMessage(error));
    }
  }

  function onRepost(postId: string) {
    updatePost(postId, (post) => {
      const reposted = !post.flags.reposted;

      return {
        ...post,
        flags: { ...post.flags, reposted },
        counts: {
          ...post.counts,
          reposts: reposted ? post.counts.reposts + 1 : post.counts.reposts - 1,
        },
      };
    });
  }

  function onComment(postId: string) {
    setOpenReplyId((currentId) => (currentId === postId ? null : postId));
  }

  function submitComment(postId: string) {
    updatePost(postId, (post) => ({
      ...post,
      counts: {
        ...post.counts,
        replies: post.counts.replies + 1,
      },
    }));
    setOpenReplyId(null);
  }

  async function handleGenerateParticipant() {
    setOnboardingError(null);
    setOnboardingStep('creatingId');

    try {
      const session = await createParticipantSession();
      writeParticipantSession(session);
      setParticipantSession(session);
      setOnboardingStep('idAssigned');
    } catch (error) {
      setOnboardingError(getErrorMessage(error));
      setOnboardingStep('confirmed');
    }
  }

  function renderOnboarding() {
    const hasAcknowledged = onboardingStep !== 'instructions';
    const hasParticipantId =
      onboardingStep === 'idAssigned' || onboardingStep === 'feed';

    return (
      <main className="landing-page">
        <section className="landing-shell" aria-labelledby="landing-title">
          <div className="landing-topbar">
            <a className="x-logo landing-logo" href="#" aria-label="X home">
              <X size={34} strokeWidth={2.4} />
            </a>
            <div className="theme-switch onboarding-theme" aria-label="Theme controls">
              <button
                type="button"
                className={theme === 'light' ? 'is-selected' : ''}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'is-selected' : ''}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="landing-card">
            <span className="landing-eyebrow">Participant onboarding</span>
            <h1 id="landing-title">Welcome to the study feed.</h1>
            <p>
              Read the study instructions carefully before continuing. Once you confirm,
              the app will generate your participant ID, store it in Supabase, and use it
              for your interaction data in this session.
            </p>

            {participantSession ? (
              <div className="participant-code-shell" aria-live="polite">
                <span>Your participant ID</span>
                <strong>{participantSession.participantCode}</strong>
              </div>
            ) : null}

            {onboardingError ? (
              <p className="status-banner is-error">{onboardingError}</p>
            ) : null}

            {isRestoringSession ? (
              <p className="status-banner">Restoring your saved participant session…</p>
            ) : null}

            <div className="landing-actions">
              {onboardingStep === 'instructions' ? (
                <button
                  className="continue-button"
                  type="button"
                  onClick={() => {
                    setOnboardingError(null);
                    setOnboardingStep('confirmed');
                  }}
                >
                  I've read instructions
                </button>
              ) : null}

              {hasAcknowledged && !hasParticipantId ? (
                <button
                  className="continue-button"
                  type="button"
                  disabled={onboardingStep === 'creatingId' || isRestoringSession}
                  onClick={() => void handleGenerateParticipant()}
                >
                  {onboardingStep === 'creatingId' ? 'Generating ID…' : 'Generate ID'}
                </button>
              ) : null}

              {hasParticipantId ? (
                <button
                  className="continue-button"
                  type="button"
                  onClick={() => {
                    setOnboardingError(null);
                    setOnboardingStep('feed');
                  }}
                >
                  To feed
                  <ArrowRight size={19} />
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (onboardingStep !== 'feed') {
    return renderOnboarding();
  }

  return (
    <div className="app-shell">
      <aside className="left-sidebar">
        <div className="left-sidebar-inner">
          <a className="x-logo" href="#" aria-label="X home">
            <X size={32} strokeWidth={2.4} />
          </a>

          <nav className="sidebar-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className={`nav-item ${item.active ? 'is-active' : ''}`}
                  type="button"
                >
                  <span className="nav-icon-wrap">
                    <Icon size={26} strokeWidth={item.active ? 3 : 2.25} />
                    {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button className="primary-post-button" type="button">
            Post
          </button>

          <div className="theme-switch" aria-label="Theme controls">
            <button
              type="button"
              className={theme === 'light' ? 'is-selected' : ''}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'is-selected' : ''}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>
      </aside>

      <main className="timeline-panel">
        <header className="timeline-tabs">
          <button
            type="button"
            className={activeTab === 'for-you' ? 'is-active' : ''}
            onClick={() => setActiveTab('for-you')}
          >
            For you
          </button>
          <button
            type="button"
            className={activeTab === 'following' ? 'is-active' : ''}
            onClick={() => setActiveTab('following')}
          >
            Following
          </button>
        </header>

        <section className="composer-card" aria-label="Compose post">
          <div className="avatar avatar-large" aria-hidden="true">
            <User size={26} />
          </div>
          <div className="composer-content">
            <textarea
              rows={2}
              placeholder="What's happening?"
              aria-label="Compose a post"
            />
            <div className="composer-footer">
              <div className="composer-tools" aria-label="Post tools">
                <button type="button" aria-label="Add image">
                  <Image size={18} />
                </button>
                <button type="button" aria-label="Add GIF">
                  GIF
                </button>
                <button type="button" aria-label="Add poll">
                  <BarChart3 size={18} />
                </button>
                <button type="button" aria-label="Add emoji">
                  <Smile size={18} />
                </button>
                <button type="button" aria-label="Add location">
                  <MapPin size={18} />
                </button>
              </div>
              <button className="composer-post-button" type="button">
                Post
              </button>
            </div>
          </div>
        </section>

        <section className="view-card">
          <button className="post-more" type="button" aria-label="More options">
            <MoreHorizontal size={20} />
          </button>
          <h1>Participant #{participantSession?.participantCode}</h1>
          <p>
            Your participant ID is now attached to any like interactions that are backed by
            Supabase. The rest of the interface remains available as a frontend prototype.
          </p>
          <button
            className="black-pill"
            type="button"
            onClick={() => {
              clearParticipantSession();
              setParticipantSession(null);
              setPosts([]);
              setOnboardingStep('instructions');
              setFeedNotice(null);
              setOnboardingError(null);
            }}
          >
            Reset participant
          </button>
        </section>

        {feedNotice ? <p className="feed-status">{feedNotice}</p> : null}
        {isFeedLoading ? <p className="feed-status">Loading feed…</p> : null}

        <section className="feed-list" aria-label="Scrollable feed">
          {posts.map((post, index) => {
            const replyOpen = openReplyId === post.id;

            return (
              <article key={post.id} className="post-card">
                {index % 5 === 0 ? (
                  <div className="repost-line">
                    <Repeat2 size={15} />
                    <span>Research Lab reposted</span>
                  </div>
                ) : null}

                <div className="post-grid">
                  <div
                    className="avatar"
                    aria-hidden="true"
                    style={{ backgroundImage: makeAvatarStyle(post.author.avatarSeed) }}
                  >
                    {post.author.name[0]}
                  </div>

                  <div className="post-body">
                    <header className="post-header">
                      <div className="post-author-row">
                        <strong>{post.author.name}</strong>
                        {post.author.verified ? (
                          <span className="verified-badge" aria-label="Verified account">
                            <Check size={15} strokeWidth={3} />
                          </span>
                        ) : null}
                        <span>{post.author.handle}</span>
                        <span>-</span>
                        <span>{post.timestampLabel}</span>
                      </div>
                      <button className="icon-button" type="button" aria-label="More options">
                        <MoreHorizontal size={19} />
                      </button>
                    </header>

                    <p className="post-content">{post.content}</p>

                    {post.media ? (
                      <div
                        className={`post-media ${post.media.kind === 'image' ? 'is-image' : ''}`}
                        aria-label={post.media.alt}
                        style={{
                          background:
                            post.media.kind === 'gradient' ? post.media.accent : undefined,
                        }}
                      >
                        {post.media.kind === 'image' && post.media.src ? (
                          <img
                            src={post.media.src}
                            alt={post.media.alt}
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {post.link ? (
                      <a
                        className="link-card"
                        href={post.link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>{post.link.domain}</span>
                        <strong>{post.link.label}</strong>
                      </a>
                    ) : null}

                    <div className="post-actions" role="group" aria-label="Post engagement actions">
                      <button
                        className={`engagement-button ${replyOpen ? 'reply-active' : ''}`}
                        type="button"
                        onClick={() => onComment(post.id)}
                        aria-label="Comment"
                      >
                        <MessageCircle size={18} />
                        <span>{formatCount(post.counts.replies)}</span>
                      </button>
                      <button
                        className={`engagement-button ${post.flags.reposted ? 'repost-active' : ''}`}
                        type="button"
                        onClick={() => onRepost(post.id)}
                        aria-label="Repost"
                      >
                        <Repeat2 size={18} />
                        <span>{formatCount(post.counts.reposts)}</span>
                      </button>
                      <button
                        className={`engagement-button ${post.flags.liked ? 'like-active' : ''}`}
                        type="button"
                        onClick={() => void onLike(post.id)}
                        aria-label="Like"
                      >
                        <Heart size={18} fill={post.flags.liked ? 'currentColor' : 'none'} />
                        <span>{formatCount(post.counts.likes)}</span>
                      </button>
                      <div
                        className="engagement-button as-readonly"
                        aria-label={`${post.counts.views} views`}
                      >
                        <BarChart3 size={18} />
                        <span>{formatCount(post.counts.views)}</span>
                      </div>
                      <button className="engagement-button share-button" type="button" aria-label="Share">
                        <Share size={18} />
                      </button>
                    </div>

                    {replyOpen ? (
                      <div className="reply-box">
                        <textarea
                          rows={3}
                          defaultValue={`Replying to ${post.author.handle}`}
                          aria-label={`Reply to ${post.author.name}`}
                        />
                        <div className="reply-actions">
                          <button
                            className="plain-button"
                            type="button"
                            onClick={() => setOpenReplyId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="reply-submit"
                            type="button"
                            onClick={() => submitComment(post.id)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <aside className="right-rail">
        <div className="right-rail-inner">
          <label className="search-shell">
            <Search size={18} />
            <input type="search" placeholder="Search" aria-label="Search" />
          </label>

          <section className="rail-card premium-card">
            <div className="premium-heading">
              <h2>Study flow active</h2>
              <span>Live</span>
            </div>
            <p>
              Participant onboarding is now backed by Supabase, and likes are persisted
              against the current participant profile.
            </p>
            <button className="blue-pill" type="button">
              Review session
            </button>
          </section>

          <section className="rail-card news-card">
            <div className="rail-heading">
              <h2>Today's News</h2>
              <button type="button" aria-label="Dismiss news">
                <X size={18} />
              </button>
            </div>
            {newsItems.map((item) => (
              <button className="news-item" type="button" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </button>
            ))}
          </section>

          <section className="rail-card trends-card">
            <h2>What's happening</h2>
            {trends.map((trend) => (
              <button key={trend.label} className="trend-item" type="button">
                <span>{trend.meta}</span>
                <strong>{trend.label}</strong>
                <MoreHorizontal size={18} />
              </button>
            ))}
          </section>
        </div>
      </aside>
    </div>
  );
}

export default App;
