import React from "react";
import { usePersistentCart } from "../../context/PersistentCartContext";
import { useProduct } from "../../context/ProductContext";
import styles from "./billing.module.css";

const BillingPage: React.FC = () => {
  const { state } = usePersistentCart();
  const { items } = useProduct();

  // Hilfsfunktion um Item-Name zu bekommen
  const getItemName = (stockItemId: number, variantId: number): string => {
    for (const item of items) {
      if (item.id === stockItemId) {
        const variant = item.item_variants?.find(
          (v: any) => v.id === variantId
        );
        if (variant) {
          return `${item.name} - ${variant.name}`;
        }
      }
    }
    return "Unbekanntes Item";
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className={styles.customerDisplay}>
      <header className={styles.displayHeader}>
        <div className={styles.logoArea}>
          <h1>Hüttenzauber</h1>
        </div>
        <div className={styles.orderStatus}>
          <span className={styles.statusLabel}>Aktuelle Bestellung</span>
          <span className={styles.itemCount}>
            {state.items.length}{" "}
            {state.items.length === 1 ? "Artikel" : "Artikel"}
          </span>
        </div>
      </header>

      <main className={styles.displayContent}>
        {state.items.length === 0 ? (
          <div className={styles.emptyDisplay}>
            <h2>Willkommen!</h2>
            <p>
              Ihre Bestellung wird hier angezeigt, sobald Artikel hinzugefügt
              werden.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.itemsDisplay}>
              <h2>Ihre Bestellung</h2>
              <div className={styles.itemsList}>
                {state.items.map((item, index) => (
                  <div key={index} className={styles.displayItem}>
                    <div className={styles.itemName}>
                      {getItemName(item.stockItemId, item.variantId)}
                    </div>
                    <div className={styles.itemQuantity}>{item.quantity}x</div>
                    <div className={styles.itemPrice}>
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.totalDisplay}>
              <div className={styles.subtotal}>
                <span>Zwischensumme:</span>
                <span>{formatCurrency(state.totalAmount)}</span>
              </div>
              {state.totalDepositAmount > 0 && (
                <div className={styles.totalRow}>
                  <span>Pfand:</span>
                  <span>{formatCurrency(state.totalDepositAmount)}</span>
                </div>
              )}
              <div className={styles.grandTotal}>
                <span>Gesamtsumme:</span>
                <span>
                  {formatCurrency(state.totalAmount + state.totalDepositAmount)}
                </span>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className={styles.displayFooter}>
        <p>Vielen Dank für Ihren Besuch!</p>
      </footer>
    </div>
  );
};

export default BillingPage;
