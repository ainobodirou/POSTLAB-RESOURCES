export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  surveyPlaceholderId: string;
}

function readEnvValue(
  value: string | undefined,
  keys: string[],
  fallback?: string,
): string {
  const normalized = value?.trim() || fallback?.trim();

  if (!normalized) {
    throw new Error(
      `Missing required environment variable. Checked: ${keys.join(', ')}.`,
    );
  }

  return normalized;
}

function readCandidateEnv(keys: string[], fallback?: string): string {
  const env = import.meta.env as unknown as Record<string, string | undefined>;

  for (const key of keys) {
    const value = env[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return readEnvValue(value, keys, fallback);
    }
  }

  return readEnvValue(undefined, keys, fallback);
}

export function getAppEnv(): AppEnv {
  return {
    supabaseUrl: readCandidateEnv(
      ['VITE_SUPABASE_URL', 'PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
    ),
    supabaseAnonKey: readCandidateEnv(
      [
        'VITE_SUPABASE_ANON_KEY',
        'VITE_SUPABASE_PUBLISHABLE_KEY',
        'PUBLIC_SUPABASE_ANON_KEY',
        'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_PUBLISHABLE_KEY',
      ],
    ),
    surveyPlaceholderId: readCandidateEnv(
      [
        'VITE_SUPABASE_SURVEY_PLACEHOLDER_ID',
        'PUBLIC_SUPABASE_SURVEY_PLACEHOLDER_ID',
        'SUPABASE_SURVEY_PLACEHOLDER_ID',
      ],
      '00000000-0000-0000-0000-000000000000',
    ),
  };
}
