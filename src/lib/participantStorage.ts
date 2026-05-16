import type { ParticipantSession } from '../types';

const PARTICIPANT_STORAGE_KEY = 'postlab-participant-session';

export function readParticipantSession(): ParticipantSession | null {
  const storedValue = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<ParticipantSession>;

    if (
      typeof parsedValue.participantId === 'string' &&
      typeof parsedValue.participantCode === 'number'
    ) {
      return {
        participantId: parsedValue.participantId,
        participantCode: parsedValue.participantCode,
        postbackUrl:
          typeof parsedValue.postbackUrl === 'string'
            ? parsedValue.postbackUrl
            : undefined,
      };
    }
  } catch {
    window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
  }

  return null;
}

export function writeParticipantSession(session: ParticipantSession): void {
  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(session));
}

export function clearParticipantSession(): void {
  window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
}
