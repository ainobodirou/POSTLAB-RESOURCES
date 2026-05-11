import type { ParticipantProfileRow, ParticipantSession } from '../types';
import { getAppEnv } from '../lib/env';
import { getSupabaseClient } from '../lib/supabase';

const PARTICIPANT_CODE_MIN = 1;
const PARTICIPANT_CODE_MAX = 20;

function shuffleCodes(codes: number[]): number[] {
  const nextCodes = [...codes];

  for (let index = nextCodes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentValue = nextCodes[index];

    nextCodes[index] = nextCodes[swapIndex];
    nextCodes[swapIndex] = currentValue;
  }

  return nextCodes;
}

export async function assignParticipantCode(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('participant_profiles')
    .select('task_id');

  if (error) {
    throw new Error(`Unable to fetch participant codes: ${error.message}`);
  }

  const usedCodes = new Set(
    data
      .map((row) => row.task_id)
      .filter(
        (value): value is number =>
          Number.isInteger(value) &&
          value >= PARTICIPANT_CODE_MIN &&
          value <= PARTICIPANT_CODE_MAX,
      ),
  );

  const availableCodes = shuffleCodes(
    Array.from(
      { length: PARTICIPANT_CODE_MAX - PARTICIPANT_CODE_MIN + 1 },
      (_, index) => PARTICIPANT_CODE_MIN + index,
    ).filter((value) => !usedCodes.has(value)),
  );

  if (availableCodes.length === 0) {
    throw new Error('No participant IDs are available right now.');
  }

  return availableCodes[0];
}

export async function createParticipantProfile(
  participantCode: number,
): Promise<ParticipantProfileRow> {
  const supabase = getSupabaseClient();
  const { surveyPlaceholderId } = getAppEnv();
  const { data, error } = await supabase
    .from('participant_profiles')
    .insert({
      task_id: participantCode,
      survey_id: surveyPlaceholderId,
      interests: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to create participant profile: ${error.message}`);
  }

  return data;
}

export async function createParticipantSession(): Promise<ParticipantSession> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const participantCode = await assignParticipantCode();
      const participantProfile = await createParticipantProfile(participantCode);

      return {
        participantId: participantProfile.participant_id,
        participantCode: participantProfile.task_id,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unable to create participant session.');
    }
  }

  throw lastError ?? new Error('Unable to create participant session.');
}

export async function getParticipantById(
  participantId: string,
): Promise<ParticipantProfileRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('participant_profiles')
    .select('*')
    .eq('participant_id', participantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load participant profile: ${error.message}`);
  }

  return data;
}
