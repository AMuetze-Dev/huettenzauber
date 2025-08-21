import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ProductProvider,
  useProduct,
  Item,
  ItemVariant,
  Category,
} from "../../context/ProductContext";
import { usePersistentCart } from "../../context/PersistentCartContext";
import { ThemeContext } from "../../App";
import * as MdIcons from "react-icons/md";
import CartModal from "../../components/modals/CartModal.component";
import styles from "./order.module.css";

// === TYPES ===
interface OrderContentProps {
  selectedCategoryId?: number | null;
  onCategoryChange?: (categoryId: number) => void;
}

// === VARIANT COMPONENT ===
interface VariantItemProps {
  item: Item;
  variant: ItemVariant;
  currentQuantity: number;
  onAdd: () => void;
  onRemove: () => void;
  formatPrice: (price: number) => string;
}

const VariantItem: React.FC<VariantItemProps> = ({
  item,
  variant,
  currentQuantity,
  onAdd,
  onRemove,
  formatPrice,
}) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = React.useRef<NodeJS.Timeout>();

  const handleStart = React.useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      setLongPressTriggered(false);

      timeout.current = setTimeout(() => {
        if (currentQuantity > 0) {
          onRemove();
          setLongPressTriggered(true);
        }
      }, 500);
    },
    [onRemove, currentQuantity]
  );

  const handleEnd = React.useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      if (!longPressTriggered) {
        onAdd();
      }
      setLongPressTriggered(false);
    },
    [onAdd, longPressTriggered]
  );

  const handleLeave = React.useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    setLongPressTriggered(false);
  }, []);

  return (
    <div
      className={`${styles.variantCompact} ${
        currentQuantity > 0 ? styles.inCart : ""
      }`}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onMouseUp={handleEnd}
      onTouchEnd={handleEnd}
      onMouseLeave={handleLeave}
    >
      <div className={styles.variantContent}>
        <div className={styles.variantInfo}>
          <span className={styles.variantName}>
            {variant.name || "Standard"}
          </span>
          <span className={styles.variantPrice}>
            {formatPrice(variant.price)}
          </span>
        </div>

        {currentQuantity > 0 && (
          <div className={styles.quantityBadge}>
            <span>{currentQuantity}</span>
          </div>
        )}
      </div>

      <div className={styles.touchHint}>
        {currentQuantity === 0 ? (
          <span>Tippen zum Hinzufügen</span>
        ) : (
          <span>Tippen: +1 | Lang: -1</span>
        )}
      </div>
    </div>
  );
};

// === MAIN COMPONENT ===
const OrderContent: React.FC<OrderContentProps> = ({
  selectedCategoryId: propCategoryId,
}) => {
  const productCtx = useProduct();
  const cart = usePersistentCart();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const [internalCategoryId, setInternalCategoryId] = useState<number | null>(
    null
  );
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // Use prop categoryId if provided, otherwise use internal state
  const selectedCategoryId = propCategoryId ?? internalCategoryId;

  // Auto-select first category when categories load (only if no prop provided)
  useEffect(() => {
    if (
      productCtx?.categories.length &&
      !selectedCategoryId &&
      !propCategoryId
    ) {
      setInternalCategoryId(productCtx.categories[0].id);
    }
  }, [productCtx?.categories, selectedCategoryId, propCategoryId]);

  if (!productCtx) {
    return <div className={styles.loading}>Lade Daten...</div>;
  }

  const { categories, items } = productCtx;

  // Filter items by selected category
  const filteredItems = selectedCategoryId
    ? items.filter((item: Item) => item.category_id === selectedCategoryId)
    : [];

  const selectedCategory = categories.find(
    (cat: Category) => cat.id === selectedCategoryId
  );

  const handleAddToCart = (item: Item, variant: ItemVariant) => {
    const categoryName = selectedCategory?.name || "Unbekannt";

    cart.addItem({
      stockItemId: item.id,
      variantId: variant.id,
      name: item.name,
      variantName: variant.name || undefined,
      price: variant.price,
      categoryId: item.category_id,
      categoryName,
      depositAmount: item.deposit_amount, // Pfand hinzufügen
    });
  };

  const handleVariantAdd = (item: Item, variant: ItemVariant) => {
    handleAddToCart(item, variant);
  };

  const handleVariantRemove = (item: Item, variant: ItemVariant) => {
    const itemId = `${item.id}-${variant.id}`;
    cart.decreaseQuantity(itemId);
  };

  const handleGoToBilling = () => {
    navigate("/billing");
  };

  const handleCheckout = () => {
    // TODO: Implement backend order submission
    console.log("Order confirmed:", cart.state);
    // Here you would typically:
    // 1. Send order to backend via BillContext/API
    // 2. Generate receipt
    // 3. Clear cart (already done in modal)

    setIsCartModalOpen(false);
    navigate("/billing");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <div className={styles.container}>
      {/* Main Content - Items */}
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>{selectedCategory?.name || "Kategorie wählen"}</h1>
          <p>{filteredItems.length} Artikel verfügbar</p>
        </div>

        {filteredItems.length === 0 ? (
          <div className={styles.emptyState}>
            <MdIcons.MdShoppingCart size={64} />
            <h3>Keine Artikel gefunden</h3>
            <p>
              {selectedCategoryId
                ? "In dieser Kategorie sind keine Artikel verfügbar."
                : "Wähle eine Kategorie aus der Sidebar."}
            </p>
          </div>
        ) : (
          <div className={styles.itemGrid}>
            {filteredItems.map((item: Item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <h3>{item.name}</h3>
                </div>

                <div className={styles.variants}>
                  {item.item_variants.map((variant: ItemVariant) => {
                    const currentQuantity = cart.getItemQuantity(
                      item.id,
                      variant.id
                    );

                    return (
                      <VariantItem
                        key={variant.id}
                        item={item}
                        variant={variant}
                        currentQuantity={currentQuantity}
                        onAdd={() => handleVariantAdd(item, variant)}
                        onRemove={() => handleVariantRemove(item, variant)}
                        formatPrice={formatPrice}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
      />

      {/* Cart Button - Fixed bottom right */}
      {cart.state.items.length > 0 && selectedCategoryId && (
        <div className={styles.cartFloating}>
          <button
            className={styles.cartButton}
            onClick={() => setIsCartModalOpen(true)}
            title="Warenkorb anzeigen und bearbeiten"
          >
            <div className={styles.cartIcon}>
              <MdIcons.MdShoppingCart size={24} />
              <span className={styles.cartBadge}>{cart.state.totalItems}</span>
            </div>
            <div className={styles.cartInfo}>
              <span className={styles.cartItemCount}>
                {cart.state.totalItems} Artikel
              </span>
              <span className={styles.cartTotal}>
                {formatPrice(
                  cart.state.totalAmount + cart.state.totalDepositAmount
                )}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        onCheckoutComplete={handleCheckout}
      />
    </div>
  );
};

// === WRAPPER WITH PROVIDERS ===
interface OrderPageProps {
  selectedCategoryId?: number | null;
  onCategoryChange?: (categoryId: number) => void;
}

const OrderPage: React.FC<OrderPageProps> = ({
  selectedCategoryId,
  onCategoryChange,
}) => {
  return (
    <ProductProvider>
      <OrderContent
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={onCategoryChange}
      />
    </ProductProvider>
  );
};

export default OrderPage;
