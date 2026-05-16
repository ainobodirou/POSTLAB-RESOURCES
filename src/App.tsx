import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Heart,
  Image,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
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

type SessionModal = 'participant-created' | 'session-finished' | null;

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

function normalizeFallbackPosts(posts: Post[]): Post[] {
  return posts.map((post) => ({
    ...post,
    persisted: false,
    media: post.media?.kind === 'image' ? post.media : undefined,
    content: post.content.replace(/\\n/g, '\n'),
  }));
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

function getSafePostbackUrl(): string | undefined {
  const postbackUrl = new URLSearchParams(window.location.search).get('postbackUrl');

  if (!postbackUrl) {
    return undefined;
  }

  try {
    const url = new URL(postbackUrl);
    const isTrustedSurveyHost =
      url.hostname === 'utwente.nl' || url.hostname.endsWith('.utwente.nl');

    if (url.protocol === 'https:' && isTrustedSurveyHost) {
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [currentPostbackUrl] = useState(() => getSafePostbackUrl());
  const [participantSession, setParticipantSession] = useState<ParticipantSession | null>(
    () => {
      const storedSession = readParticipantSession();

      if (!storedSession || !currentPostbackUrl) {
        return storedSession;
      }

      return {
        ...storedSession,
        postbackUrl: currentPostbackUrl,
      };
    },
  );
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() =>
    readParticipantSession() ? 'idAssigned' : 'instructions',
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [failedImagePostIds, setFailedImagePostIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => readParticipantSession() !== null,
  );
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<SessionModal>(null);
  const [pendingLikeWrites, setPendingLikeWrites] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!currentPostbackUrl || !participantSession) {
      return;
    }

    const sessionWithPostback = {
      ...participantSession,
      postbackUrl: currentPostbackUrl,
    };

    if (participantSession.postbackUrl !== currentPostbackUrl) {
      setParticipantSession(sessionWithPostback);
    }

    writeParticipantSession(sessionWithPostback);
  }, [currentPostbackUrl, participantSession]);

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
        if (!participantSession) {
          throw new Error('Missing participant session for feed generation.');
        }

        const feedResult = await loadPosts(participantSession.participantId);
        let nextPosts = feedResult.posts;

        const likedPostIds = await getParticipantLikes(
          participantSession.participantId,
        );
        nextPosts = applyLikedPostIds(nextPosts, likedPostIds);

        if (cancelled) {
          return;
        }

        setPosts(nextPosts);
        setFailedImagePostIds(new Set());
        setFeedNotice(feedResult.fallbackMessage ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPosts(normalizeFallbackPosts(getMockPosts()));
        setFailedImagePostIds(new Set());
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
      setPendingLikeWrites((count) => count + 1);
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
    } finally {
      setPendingLikeWrites((count) => Math.max(0, count - 1));
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
      const createdSession = await createParticipantSession();
      const session = currentPostbackUrl
        ? { ...createdSession, postbackUrl: currentPostbackUrl }
        : createdSession;
      writeParticipantSession(session);
      setParticipantSession(session);
      setOnboardingStep('idAssigned');
      setActiveModal('participant-created');
    } catch (error) {
      setOnboardingError(getErrorMessage(error));
      setOnboardingStep('confirmed');
    }
  }

  function renderSessionModal() {
    if (!activeModal || !participantSession) {
      return null;
    }

    const isCreationModal = activeModal === 'participant-created';
    const postbackUrl = participantSession.postbackUrl;

    return (
      <div className="session-modal-backdrop" role="presentation">
        <section
          className="session-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-modal-title"
        >
          <span className="landing-eyebrow">
            {isCreationModal ? 'Participant ID assigned' : 'Thank you'}
          </span>
          <h2 id="session-modal-title">
            {isCreationModal ? 'Remember your participant ID.' : 'Thank you!'}
          </h2>
          {isCreationModal ? (
            <>
              <p>
                Your participant ID is <strong>#{participantSession.participantCode}</strong>. Please
                remember it because you will be asked for it later in the survey. You will also
                be reminded of it again at the end of the session.
              </p>
              <div className="participant-code-shell modal-code-shell" aria-live="polite">
                <span>Participant ID</span>
                <strong>{participantSession.participantCode}</strong>
              </div>
            </>
          ) : (
            <div className="debrief-copy">
              <p>
                Your participant ID is <strong>#{participantSession.participantCode}</strong>. Please
                remember it, as you will be asked to provide it in the survey.
              </p>
              <p>
                {postbackUrl
                  ? 'You can now return to the survey.'
                  : 'You can now close the task website.'}
              </p>
            </div>
          )}
          <div className="landing-actions">
            <button
              className="continue-button"
              type="button"
              onClick={() => {
                const closingCreationModal = activeModal === 'participant-created';
                setActiveModal(null);

                if (closingCreationModal) {
                  setOnboardingStep('feed');
                } else if (postbackUrl) {
                  window.location.assign(postbackUrl);
                } else {
                  setOnboardingStep('idAssigned');
                }
              }}
            >
              {isCreationModal
                ? 'To study environment'
                : postbackUrl
                  ? 'Return to survey'
                  : 'Close'}
            </button>
          </div>
        </section>
      </div>
    );
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
              You'll be presented with the simulated feed environment consisting of
              content on various topics. Please scroll through the feed and like the
              content that you enjoy, relate to, or that resonates with you in any other
              way. The engagement should be active and intentional, rather than forced or
              purely passive scrolling.
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
              <p className="status-banner">Restoring your saved participant session...</p>
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
                  {onboardingStep === 'creatingId' ? 'Generating ID...' : 'Generate ID'}
                </button>
              ) : null}

              {hasParticipantId ? (
                <button
                  className="continue-button"
                  type="button"
                  disabled={activeModal === 'participant-created'}
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
    return (
      <>
        {renderOnboarding()}
        {renderSessionModal()}
      </>
    );
  }

  return (
    <>
      <div className="feed-shell">
        <main className="timeline-panel feed-only-panel">
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

        {feedNotice ? <p className="feed-status">{feedNotice}</p> : null}
        {isFeedLoading ? <p className="feed-status">Loading feed...</p> : null}

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

                    {post.media && !failedImagePostIds.has(post.id) ? (
                      <div
                        className={`post-media ${post.media.kind === 'image' ? 'is-image' : ''}`}
                        aria-label={post.media.alt}
                      >
                        {post.media.kind === 'image' && post.media.src ? (
                          <img
                            src={post.media.src}
                            alt={post.media.alt}
                            loading="lazy"
                            onError={() =>
                              setFailedImagePostIds((currentIds) => {
                                const nextIds = new Set(currentIds);
                                nextIds.add(post.id);
                                return nextIds;
                              })
                            }
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

          <section className="feed-endcap" aria-label="Finish feed simulation">
            <p>
              You have reached the end of the simulated feed.
              {pendingLikeWrites > 0 ? ' Saving your latest interactions...' : ''}
            </p>
            <button
              className="continue-button"
              type="button"
              disabled={pendingLikeWrites > 0}
              onClick={() => {
                setActiveModal('session-finished');
              }}
            >
              Finish
            </button>
          </section>
        </section>
        </main>
      </div>
      {renderSessionModal()}
    </>
  );
}

export default App;
