/**
 * The cart.
 *
 * Lives entirely on the device. The server has no cart concept at all - an
 * order is created in one shot at checkout, with stock reserved atomically at
 * that moment. So a cart is a local intention, not a reservation: nothing is
 * held for you until you actually check out.
 *
 * That is worth knowing, because it means an item CAN sell out between adding
 * it and paying. The server answers that with a 409 naming the item, and
 * checkout surfaces it.
 *
 * Persisted to AsyncStorage so closing the app does not empty the basket.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "shoptrace.cart";

export type CartLine = {
  productId: string;
  name: string;
  brand?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category: string;
  /** Kept so checkout can group by shop and show where each item comes from. */
  shopId: string;
  shopName: string;
  /** The stock we last saw, so the cart can warn before checkout does. */
  stockCount: number;
  /** How much that figure could be trusted when it went in the cart. */
  stockConfidence?: "fresh" | "aging" | "stale";
  needsConfirmation?: boolean;
};

type CartValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Shop ids in the cart - a multi-shop basket splits into sub-orders. */
  shopCount: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
};

const CartContext = createContext<CartValue | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_KEY);
        if (raw) setLines(JSON.parse(raw));
      } catch {
        // A corrupt cart is not worth crashing over - start empty.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, hydrated]);

  const add = useCallback(
    (line: Omit<CartLine, "quantity">, quantity = 1) => {
      setLines((current) => {
        const existing = current.find((l) => l.productId === line.productId);

        if (existing) {
          // Adding the same product again tops up the quantity rather than
          // creating a second line - the server merges duplicates anyway.
          return current.map((l) =>
            l.productId === line.productId
              ? {
                  ...l,
                  ...line,
                  quantity: Math.min(l.quantity + quantity, line.stockCount),
                }
              : l,
          );
        }

        return [...current, { ...line, quantity }];
      });
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.productId !== productId)
        : current.map((l) =>
            l.productId === productId
              ? { ...l, quantity: Math.min(quantity, l.stockCount) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((current) => current.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal =
      Math.round(
        lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100,
      ) / 100;
    const shopCount = new Set(lines.map((l) => l.shopId)).size;

    return {
      lines,
      count,
      subtotal,
      shopCount,
      add,
      setQuantity,
      remove,
      clear,
      has: (productId: string) => lines.some((l) => l.productId === productId),
    };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
};
