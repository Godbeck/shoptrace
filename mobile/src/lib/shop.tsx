/**
 * The merchant's own shop, loaded once and shared by every merchant screen.
 *
 * This drives the onboarding gate. A merchant account on its own is not enough
 * to sell - there are three states, and the app has to respect all of them:
 *
 *   none      -> no shop registered yet, send them to the setup form
 *   pending   -> registered, waiting for an admin to verify it
 *   verified  -> the real merchant app
 *   suspended -> blocked, with the admin's reason shown
 *
 * That mirrors the server exactly: createProduct refuses with a 403 until the
 * shop is verified, and getNearbyShops filters on status, so an unverified
 * shop is invisible to customers.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, type ApiShop } from "./api";
import { useSession } from "./session";

export type ShopState = "loading" | "none" | "pending" | "verified" | "suspended";

type ShopValue = {
  shop: ApiShop | null;
  state: ShopState;
  error: string | null;
  reload: () => Promise<void>;
};

const ShopContext = createContext<ShopValue | null>(null);

export const ShopProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, signedIn } = useSession();
  const [shop, setShop] = useState<ApiShop | null>(null);
  const [state, setState] = useState<ShopState>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!signedIn || user?.role !== "merchant") {
      setShop(null);
      setState("none");
      return;
    }

    setError(null);
    try {
      const result = await api.get<{ shop: ApiShop }>("/shops/my-shop");
      setShop(result.shop);
      setState(result.shop.status);
    } catch (e) {
      // A 404 is the normal "no shop yet" answer, not a failure.
      if (e instanceof ApiError && e.status === 404) {
        setShop(null);
        setState("none");
      } else {
        setError(e instanceof ApiError ? e.message : "Could not load your shop");
        setState("none");
      }
    }
  }, [signedIn, user?.role]);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<ShopValue>(
    () => ({ shop, state, error, reload }),
    [shop, state, error, reload],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside a ShopProvider");
  return ctx;
};
