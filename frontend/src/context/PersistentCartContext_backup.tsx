import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";

// === TYPES ===
export interface CartItem {
  id: string; // unique identifier for cart item (stockItemId + variantId)
  stockItemId: number;
  variantId: number;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  categoryId: number;
  categoryName: string;
  depositAmount?: number; // Pfand pro Artikel
}

export interface CartState {
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
  totalDepositAmount: number; // Gesamter Pfandbetrag
}

// === ACTIONS ===
type CartAction =
  | { type: "ADD_ITEM"; payload: Omit<CartItem, "id" | "quantity"> }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "INCREASE_QUANTITY"; payload: { id: string } }
  | { type: "DECREASE_QUANTITY"; payload: { id: string } }
  | { type: "CLEAR_CART" }
  | { type: "LOAD_FROM_STORAGE"; payload: CartState };

// === REDUCER ===
const cartReducer = (state: CartState, action: CartAction): CartState => {
  let newState: CartState;

  switch (action.type) {
    case "LOAD_FROM_STORAGE":
      return action.payload;

    case "ADD_ITEM": {
      const id = `${action.payload.stockItemId}-${action.payload.variantId}`;
      const existingItem = state.items.find((item) => item.id === id);

      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        newItems = [
          ...state.items,
          {
            ...action.payload,
            id,
            quantity: 1,
          },
        ];
      }

      newState = {
        items: newItems,
        totalAmount: newItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      break;
    }

    case "REMOVE_ITEM": {
      const newItems = state.items.filter(
        (item) => item.id !== action.payload.id
      );
      newState = {
        items: newItems,
        totalAmount: newItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      break;
    }

    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        return cartReducer(state, {
          type: "REMOVE_ITEM",
          payload: { id: action.payload.id },
        });
      }

      const newItems = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );

      newState = {
        items: newItems,
        totalAmount: newItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      break;
    }

    case "INCREASE_QUANTITY": {
      const newItems = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );

      newState = {
        items: newItems,
        totalAmount: newItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      break;
    }

    case "DECREASE_QUANTITY": {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (!item || item.quantity <= 1) {
        return cartReducer(state, {
          type: "REMOVE_ITEM",
          payload: { id: action.payload.id },
        });
      }

      const newItems = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );

      newState = {
        items: newItems,
        totalAmount: newItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      break;
    }

    case "CLEAR_CART":
      newState = {
        items: [],
        totalAmount: 0,
        totalItems: 0,
      };
      break;

    default:
      return state;
  }

  // Speichere in localStorage nach jeder Änderung
  localStorage.setItem("huettenzauber_cart", JSON.stringify(newState));

  // Trigger custom event für Cross-Window-Synchronisation
  window.dispatchEvent(new CustomEvent("cartUpdated", { detail: newState }));

  return newState;
};

// === CONTEXT ===
interface CartContextType {
  state: CartState;
  addItem: (item: Omit<CartItem, "id" | "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  clearCart: () => void;
  getItemQuantity: (stockItemId: number, variantId: number) => number;
}

const CartContext = createContext<CartContextType | null>(null);

// === INITIAL STATE ===
const getInitialState = (): CartState => {
  try {
    const savedCart = localStorage.getItem("huettenzauber_cart");
    if (savedCart) {
      return JSON.parse(savedCart);
    }
  } catch (error) {
    console.error("Error loading cart from localStorage:", error);
  }

  return {
    items: [],
    totalAmount: 0,
    totalItems: 0,
  };
};

// === PROVIDER ===
export const PersistentCartProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, getInitialState());

  // Cross-Window-Synchronisation
  useEffect(() => {
    const handleStorageChange = () => {
      const savedCart = localStorage.getItem("huettenzauber_cart");
      if (savedCart) {
        try {
          const cartState = JSON.parse(savedCart);
          dispatch({ type: "LOAD_FROM_STORAGE", payload: cartState });
        } catch (error) {
          console.error("Error parsing cart from localStorage:", error);
        }
      }
    };

    const handleCartUpdate = (event: CustomEvent) => {
      dispatch({ type: "LOAD_FROM_STORAGE", payload: event.detail });
    };

    // Listen für storage events (andere Tabs)
    window.addEventListener("storage", handleStorageChange);

    // Listen für custom events (gleiches Fenster, andere Komponenten)
    window.addEventListener("cartUpdated", handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "cartUpdated",
        handleCartUpdate as EventListener
      );
    };
  }, []);

  // === ACTIONS ===
  const addItem = useCallback((item: Omit<CartItem, "id" | "quantity">) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: { id } });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } });
  }, []);

  const increaseQuantity = useCallback((id: string) => {
    dispatch({ type: "INCREASE_QUANTITY", payload: { id } });
  }, []);

  const decreaseQuantity = useCallback((id: string) => {
    dispatch({ type: "DECREASE_QUANTITY", payload: { id } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const getItemQuantity = useCallback(
    (stockItemId: number, variantId: number): number => {
      const id = `${stockItemId}-${variantId}`;
      const item = state.items.find((item) => item.id === id);
      return item ? item.quantity : 0;
    },
    [state.items]
  );

  const contextValue: CartContextType = {
    state,
    addItem,
    removeItem,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    getItemQuantity,
  };

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};

// === HOOK ===
export const usePersistentCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error(
      "usePersistentCart must be used within a PersistentCartProvider"
    );
  }
  return context;
};
