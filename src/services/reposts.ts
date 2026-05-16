import { getSupabaseClient } from '../lib/supabase';

export async function getParticipantReposts(
  participantId: string,
): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('participant_post_reposts')
    .select('post_id')
    .eq('participant_id', participantId);

  if (error) {
    throw new Error(`Unable to load reposts: ${error.message}`);
  }

  return new Set(data.map((row) => row.post_id));
}

export async function setParticipantPostRepost(
  participantId: string,
  postId: string,
  reposted: boolean,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (reposted) {
    const { error } = await supabase
      .from('participant_post_reposts')
      .upsert(
        {
          participant_id: participantId,
          post_id: postId,
          reposted: true,
        },
        {
          onConflict: 'participant_id,post_id',
        },
      );

    if (error) {
      throw new Error(`Unable to save repost: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase
    .from('participant_post_reposts')
    .delete()
    .eq('participant_id', participantId)
    .eq('post_id', postId);

  if (error) {
    throw new Error(`Unable to remove repost: ${error.message}`);
  }
}
