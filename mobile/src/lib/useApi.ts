import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiError } from "./api";
import { useSession } from "./session";

/**
 * Where the customer is, for every geo query.
 *
 * The server requires latitude and longitude on product search, so something
 * has to supply them. Rather than adding a location permission prompt on
 * first launch, this uses the customer's DEFAULT SAVED ADDRESS - which they
 * set up in Profile and which checkout uses anyway.
 *
 * The fallback is Osu, Accra, so the app still shows something useful before
 * any address has been saved. Swapping this for expo-location later means
 * changing this one function.
 */
export const ACCRA = { latitude: 5.556, longitude: -0.1969 };

export const useCoords = () => {
  const { addresses } = useSession();
  const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];

  if (preferred?.location?.coordinates?.length === 2) {
    const [longitude, latitude] = preferred.location.coordinates;
    return { latitude, longitude, address: preferred };
  }
  return { ...ACCRA, address: undefined };
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Load something from the API, with loading and error state.
 *
 * `refetchOnFocus` matters more than it looks on this app: a customer watching
 * an order needs to see the merchant's status changes, and the cheapest way to
 * get that is to refetch whenever the screen comes back into view. Real-time
 * push would be the upgrade.
 */
export const useAsync = <T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: { refetchOnFocus?: boolean } = {},
): AsyncState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not load this right now",
      );
    } finally {
      setLoading(false);
    }
    // fn is intentionally not a dependency - callers pass an inline closure,
    // which would change identity on every render and loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  useEffect(() => {
    run();
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      if (options.refetchOnFocus) setNonce((n) => n + 1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.refetchOnFocus]),
  );

  return {
    data,
    loading,
    error,
    reload: () => setNonce((n) => n + 1),
  };
};
