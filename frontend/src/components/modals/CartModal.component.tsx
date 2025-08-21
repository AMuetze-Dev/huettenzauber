import React, { useState } from "react";
import {
  usePersistentCart,
  CartItem,
} from "../../context/PersistentCartContext";
import * as MdIcons from "react-icons/md";
import styles from "./CartModal.module.css";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose }) => {
  const cart = usePersistentCart();
  const [localQuantities, setLocalQuantities] = useState<
    Record<string, number>
  >({});

  // Initialize local quantities when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const quantities: Record<string, number> = {};
      cart.state.items.forEach((item: CartItem) => {
        quantities[item.id] = item.quantity;
      });
      setLocalQuantities(quantities);
    }
  }, [isOpen, cart.state.items]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setLocalQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, newQuantity),
    }));
  };

  const handleSave = () => {
    // Update cart with new quantities
    cart.state.items.forEach((item: CartItem) => {
      const newQuantity = localQuantities[item.id] ?? item.quantity;

      if (newQuantity === 0) {
        // Remove item if quantity is 0
        cart.removeItem(item.id);
      } else if (newQuantity !== item.quantity) {
        // Update quantity if changed
        cart.updateQuantity(item.id, newQuantity);
      }
    });

    onClose();
  };

  const handleRemoveItem = (itemId: string) => {
    setLocalQuantities((prev) => ({
      ...prev,
      [itemId]: 0,
    }));
  };

  const calculateTotalWithChanges = () => {
    return cart.state.items.reduce((total: number, item: CartItem) => {
      const quantity = localQuantities[item.id] ?? item.quantity;
      return total + item.price * quantity;
    }, 0);
  };

  const getTotalItemsWithChanges = () => {
    return cart.state.items.reduce((total: number, item: CartItem) => {
      const quantity = localQuantities[item.id] ?? item.quantity;
      return total + quantity;
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            <MdIcons.MdShoppingCart size={24} />
            Warenkorb bearbeiten
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Modal schließen"
          >
            <MdIcons.MdClose size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {cart.state.items.length === 0 ? (
            <div className={styles.emptyCart}>
              <MdIcons.MdShoppingCartCheckout size={64} />
              <h3>Warenkorb ist leer</h3>
              <p>
                Füge Artikel aus den Kategorien hinzu, um eine Bestellung zu
                erstellen.
              </p>
            </div>
          ) : (
            <div className={styles.cartItems}>
              {cart.state.items.map((item: CartItem) => {
                const currentQuantity =
                  localQuantities[item.id] ?? item.quantity;
                const isMarkedForRemoval = currentQuantity === 0;

                return (
                  <div
                    key={item.id}
                    className={`${styles.cartItem} ${
                      isMarkedForRemoval ? styles.markedForRemoval : ""
                    }`}
                  >
                    <div className={styles.itemInfo}>
                      <div className={styles.itemDetails}>
                        <h4>{item.name}</h4>
                        {item.variantName && (
                          <span className={styles.variant}>
                            {item.variantName}
                          </span>
                        )}
                        <span className={styles.category}>
                          {item.categoryName}
                        </span>
                      </div>
                      <div className={styles.priceInfo}>
                        <span className={styles.unitPrice}>
                          {formatPrice(item.price)} / Stück
                        </span>
                        <span className={styles.totalPrice}>
                          {formatPrice(item.price * currentQuantity)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.controls}>
                      <div className={styles.quantityControls}>
                        <button
                          onClick={() =>
                            handleQuantityChange(item.id, currentQuantity - 1)
                          }
                          className={styles.quantityBtn}
                          disabled={currentQuantity <= 0}
                        >
                          <MdIcons.MdRemove size={16} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={currentQuantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              item.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className={styles.quantityInput}
                        />

                        <button
                          onClick={() =>
                            handleQuantityChange(item.id, currentQuantity + 1)
                          }
                          className={styles.quantityBtn}
                        >
                          <MdIcons.MdAdd size={16} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className={styles.removeBtn}
                        title="Artikel entfernen"
                      >
                        <MdIcons.MdDelete size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.state.items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Artikel gesamt:</span>
                <span>{getTotalItemsWithChanges()}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Artikelpreis:</span>
                <span className={styles.totalAmount}>
                  {formatPrice(calculateTotalWithChanges())}
                </span>
              </div>
              {cart.state.totalDepositAmount > 0 && (
                <div className={styles.summaryRow}>
                  <span>Pfand:</span>
                  <span className={styles.totalAmount}>
                    {formatPrice(cart.state.totalDepositAmount)}
                  </span>
                </div>
              )}
              <div className={styles.summaryRow + " " + styles.grandTotal}>
                <span>Gesamtbetrag:</span>
                <span className={styles.totalAmount}>
                  {formatPrice(
                    calculateTotalWithChanges() + cart.state.totalDepositAmount
                  )}
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <button onClick={onClose} className={styles.cancelBtn}>
                Abbrechen
              </button>
              <button onClick={handleSave} className={styles.saveBtn}>
                <MdIcons.MdSave size={20} />
                Warenkorb aktualisieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartModal;
