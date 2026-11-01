import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_FEATURE_FLAGS,
  FeatureFlags,
  featureFlagService,
} from "@/services/featureFlagService";

export const FEATURE_FLAGS_QUERY_KEY = ["feature-flags"] as const;

/**
 * The admin-controlled feature switches, re-checked every minute while a
 * screen using them is open. Until the first answer arrives, or if it never
 * does, DEFAULT_FEATURE_FLAGS applies.
 */
export function useFeatureFlags(): FeatureFlags & { refresh: () => void } {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: featureFlagService.getFlags,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...data,
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY }),
  };
}
