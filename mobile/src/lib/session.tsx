/**
 * Session: real auth against the server, plus in-app notifications.
 *
 * The token is kept in AsyncStorage so a reload does not sign you out, and it
 * is handed to the api client on every change so requests carry it
 * automatically.
 *
 * The OTP is still LOCAL. There is no SMS provider, and the server's auth is
 * email plus password - so the code is generated on the device and shown in
 * the notification banner. It gates the phone-signup flow in the UI without
 * pretending the server verified anything.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api,
  ApiError,
  setAuthToken,
  type ApiAddress,
  type ApiPaymentMethod,
  type ApiUser,
} from "./api";

const TOKEN_KEY = "shoptrace.token";

export type Role = "customer" | "merchant";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  code?: string;
  tone?: "info" | "success" | "error";
};

type SessionValue = {
  ready: boolean;
  signedIn: boolean;
  user: ApiUser | null;
  /** Which surface is showing. A merchant can look at the customer side. */
  surface: Role;
  setSurface: (role: Role) => void;

  signIn: (email: string, password: string) => Promise<ApiUser>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: Role;
  }) => Promise<ApiUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;

  addresses: ApiAddress[];
  paymentMethods: ApiPaymentMethod[];
  loadProfile: () => Promise<void>;

  pendingOtp: string | null;
  requestOtp: (phone: string) => string;
  verifyOtp: (code: string) => boolean;

  notification: AppNotification | null;
  notify: (n: Omit<AppNotification, "id">) => void;
  /** Turns any thrown ApiError into a readable banner. */
  notifyError: (error: unknown, fallback?: string) => void;
  dismiss: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [surface, setSurface] = useState<Role>("customer");
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ApiPaymentMethod[]>([]);
  const [pendingOtp, setPendingOtp] = useState<string | null>(null);
  const [notification, setNotification] = useState<AppNotification | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------------------------- notifications */

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotification(null);
  }, []);

  const notify = useCallback((n: Omit<AppNotification, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setNotification({ ...n, id: String(Date.now()) });
    // An OTP stays up longer - it has to be read and typed.
    timer.current = setTimeout(
      () => setNotification(null),
      n.code ? 20000 : 4000,
    );
  }, []);

  const notifyError = useCallback(
    (error: unknown, fallback = "Something went wrong") => {
      const message =
        error instanceof ApiError ? error.message : (error as Error)?.message;
      notify({ title: message || fallback, tone: "error" });
    },
    [notify],
  );

  /* ------------------------------------------------------ profile */

  const loadProfile = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        api.get<{ addresses: ApiAddress[] }>("/auth/me/addresses"),
        api.get<{ paymentMethods: ApiPaymentMethod[] }>(
          "/auth/me/payment-methods",
        ),
      ]);
      setAddresses(a.addresses ?? []);
      setPaymentMethods(p.paymentMethods ?? []);
    } catch {
      // Not fatal - the profile screen shows its own empty state.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get<ApiUser>("/auth/me");
    setUser((current) => ({ ...me, token: current?.token }));
  }, []);

  /* --------------------------------------------------------- auth */

  const adopt = useCallback(
    async (account: ApiUser) => {
      setAuthToken(account.token ?? null);
      setUser(account);
      setSurface(account.role === "merchant" ? "merchant" : "customer");

      if (account.token) {
        await AsyncStorage.setItem(TOKEN_KEY, account.token);
      }
      await loadProfile();
    },
    [loadProfile],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const account = await api.post<ApiUser>("/auth/login", {
        email: email.trim(),
        password,
      });
      await adopt(account);
      return account;
    },
    [adopt],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      password: string;
      role: Role;
    }) => {
      const account = await api.post<ApiUser>("/auth/register", {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        password: input.password,
        role: input.role,
      });
      await adopt(account);
      return account;
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setAddresses([]);
    setPaymentMethods([]);
    setSurface("customer");
    await AsyncStorage.removeItem(TOKEN_KEY);
  }, []);

  /* Restore a saved session on launch. */
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const me = await api.get<ApiUser>("/auth/me");
          setUser({ ...me, token });
          setSurface(me.role === "merchant" ? "merchant" : "customer");
          await loadProfile();
        }
      } catch {
        // An expired or rejected token just means signed out.
        setAuthToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setReady(true);
      }
    })();
  }, [loadProfile]);

  /* ---------------------------------------------------------- otp */

  const requestOtp = useCallback(
    (phone: string) => {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setPendingOtp(code);

      notify({
        title: "Your ShopTrace code",
        body: `Sent to ${phone}. No SMS provider is connected yet, so it appears here instead.`,
        code,
      });

      return code;
    },
    [notify],
  );

  const verifyOtp = useCallback(
    (code: string) => code.length === 6 && code === pendingOtp,
    [pendingOtp],
  );

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      signedIn: Boolean(user),
      user,
      surface,
      setSurface,
      signIn,
      register,
      signOut,
      refreshUser,
      addresses,
      paymentMethods,
      loadProfile,
      pendingOtp,
      requestOtp,
      verifyOtp,
      notification,
      notify,
      notifyError,
      dismiss,
    }),
    [
      ready,
      user,
      surface,
      signIn,
      register,
      signOut,
      refreshUser,
      addresses,
      paymentMethods,
      loadProfile,
      pendingOtp,
      requestOtp,
      verifyOtp,
      notification,
      notify,
      notifyError,
      dismiss,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside a SessionProvider");
  return ctx;
};
