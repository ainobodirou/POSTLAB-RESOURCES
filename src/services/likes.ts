import { getSupabaseClient } from '../lib/supabase';

export async function getParticipantLikes(
  participantId: string,
): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('participant_post_likes')
    .select('post_id')
    .eq('participant_id', participantId);

  if (error) {
    throw new Error(`Unable to load likes: ${error.message}`);
  }

  return new Set(data.map((row) => row.post_id));
}

export async function setParticipantPostLike(
  participantId: string,
  postId: string,
  liked: boolean,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (liked) {
    const { data, error } = await supabase
      .from('participant_post_likes')
      .select('id')
      .eq('participant_id', participantId)
      .eq('post_id', postId);

    if (error) {
      throw new Error(`Unable to check like state: ${error.message}`);
    }

    if (data.length === 0) {
      const { error: insertError } = await supabase
        .from('participant_post_likes')
        .insert({
          participant_id: participantId,
          post_id: postId,
          liked: true,
        });

      if (insertError) {
        throw new Error(`Unable to save like: ${insertError.message}`);
      }
    }

    return;
  }

  const { error } = await supabase
    .from('participant_post_likes')
    .delete()
    .eq('participant_id', participantId)
    .eq('post_id', postId);

  if (error) {
    throw new Error(`Unable to remove like: ${error.message}`);
  }
}
