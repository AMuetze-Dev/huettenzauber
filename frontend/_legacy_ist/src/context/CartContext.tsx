import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
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
  | { type: "CLEAR_CART" }
  | { type: "INCREASE_QUANTITY"; payload: { id: string } }
  | { type: "DECREASE_QUANTITY"; payload: { id: string } };

// === REDUCER ===
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "ADD_ITEM": {
      const { stockItemId, variantId, ...itemData } = action.payload;
      const id = `${stockItemId}-${variantId}`;

      const existingItemIndex = state.items.findIndex((item) => item.id === id);

      if (existingItemIndex >= 0) {
        // Item exists, increase quantity
        const newItems = [...state.items];
        newItems[existingItemIndex] = {
          ...newItems[existingItemIndex],
          quantity: newItems[existingItemIndex].quantity + 1,
        };

        return {
          ...state,
          items: newItems,
          totalAmount: calculateTotal(newItems),
          totalItems: calculateTotalItems(newItems),
          totalDepositAmount: calculateTotalDeposit(newItems),
        };
      } else {
        // New item
        const newItem: CartItem = {
          id,
          stockItemId,
          variantId,
          ...itemData,
          quantity: 1,
        };

        const newItems = [...state.items, newItem];

        return {
          ...state,
          items: newItems,
          totalAmount: calculateTotal(newItems),
          totalItems: calculateTotalItems(newItems),
          totalDepositAmount: calculateTotalDeposit(newItems),
        };
      }
    }

    case "REMOVE_ITEM": {
      const newItems = state.items.filter(
        (item) => item.id !== action.payload.id
      );

      return {
        ...state,
        items: newItems,
        totalAmount: calculateTotal(newItems),
        totalItems: calculateTotalItems(newItems),
        totalDepositAmount: calculateTotalDeposit(newItems),
      };
    }

    case "UPDATE_QUANTITY": {
      const { id, quantity } = action.payload;

      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        const newItems = state.items.filter((item) => item.id !== id);
        return {
          ...state,
          items: newItems,
          totalAmount: calculateTotal(newItems),
          totalItems: calculateTotalItems(newItems),
          totalDepositAmount: calculateTotalDeposit(newItems),
        };
      }

      const newItems = state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      );

      return {
        ...state,
        items: newItems,
        totalAmount: calculateTotal(newItems),
        totalItems: calculateTotalItems(newItems),
        totalDepositAmount: calculateTotalDeposit(newItems),
      };
    }

    case "INCREASE_QUANTITY": {
      const newItems = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );

      return {
        ...state,
        items: newItems,
        totalAmount: calculateTotal(newItems),
        totalItems: calculateTotalItems(newItems),
        totalDepositAmount: calculateTotalDeposit(newItems),
      };
    }

    case "DECREASE_QUANTITY": {
      const { id } = action.payload;
      const item = state.items.find((item) => item.id === id);

      if (!item) return state;

      if (item.quantity <= 1) {
        // Remove item if quantity would become 0
        const newItems = state.items.filter((item) => item.id !== id);
        return {
          ...state,
          items: newItems,
          totalAmount: calculateTotal(newItems),
          totalItems: calculateTotalItems(newItems),
          totalDepositAmount: calculateTotalDeposit(newItems),
        };
      }

      const newItems = state.items.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity - 1 } : item
      );

      return {
        ...state,
        items: newItems,
        totalAmount: calculateTotal(newItems),
        totalItems: calculateTotalItems(newItems),
        totalDepositAmount: calculateTotalDeposit(newItems),
      };
    }

    case "CLEAR_CART":
      return {
        items: [],
        totalAmount: 0,
        totalItems: 0,
        totalDepositAmount: 0,
      };

    default:
      return state;
  }
};

// === HELPER FUNCTIONS ===
const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

const calculateTotalItems = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.quantity, 0);
};

const calculateTotalDeposit = (items: CartItem[]): number => {
  return items.reduce(
    (total, item) => total + (item.depositAmount || 0) * item.quantity,
    0
  );
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

// === PROVIDER ===
interface CartProviderProps {
  children: React.ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    totalAmount: 0,
    totalItems: 0,
    totalDepositAmount: 0,
  });

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
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
