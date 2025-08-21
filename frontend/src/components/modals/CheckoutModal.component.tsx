import React, { useState } from "react";
import { usePersistentCart } from "../../context/PersistentCartContext";
import { useBill } from "../../context/BillContext";
import * as MdIcons from "react-icons/md";
import styles from "./CheckoutModal.module.css";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const cart = usePersistentCart();
  const billContext = useBill();
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [showChangeCalculator, setShowChangeCalculator] = useState(false);
  const [depositReturnAmount, setDepositReturnAmount] = useState<string>("");
  const [showDepositReturn, setShowDepositReturn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const calculateChange = (): number => {
    const received = parseFloat(receivedAmount) || 0;
    const depositReturn = parseFloat(depositReturnAmount) || 0;
    const totalWithDeposit =
      cart.state.totalAmount + cart.state.totalDepositAmount;
    return received + depositReturn - totalWithDeposit;
  };

  const getTotalToPay = (): number => {
    const depositReturn = parseFloat(depositReturnAmount) || 0;
    return (
      cart.state.totalAmount + cart.state.totalDepositAmount - depositReturn
    );
  };

  const handleConfirmOrder = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      // Erstelle Bill im Backend
      const billItems = cart.state.items.map((item) => ({
        item_variant_id: item.variantId,
        item_quantity: item.quantity,
      }));

      await billContext.addBill({
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        items: billItems,
      });

      // Erfolg - rufe onConfirm auf und schließe Modal
      onConfirm();
      onClose();
      cart.clearCart();
    } catch (error) {
      console.error("Fehler beim Erstellen der Bestellung:", error);
      // Hier könnte man einen Toast oder eine andere Fehlermeldung anzeigen
      alert(
        "Fehler beim Erstellen der Bestellung. Bitte versuchen Sie es erneut."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent modal from closing when clicking on the overlay
    e.stopPropagation();
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent event bubbling to overlay
    e.stopPropagation();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={handleModalClick}>
        <div className={styles.header}>
          <h2>Bestellung abschließen</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <MdIcons.MdClose size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Order Summary */}
          <div className={styles.orderSummary}>
            <h3>Bestellübersicht</h3>
            <div className={styles.itemsList}>
              {cart.state.items.map((item) => (
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>
                      {item.name}
                      {item.variantName && ` (${item.variantName})`}
                    </span>
                    <span className={styles.itemQuantity}>
                      {item.quantity}x
                    </span>
                  </div>
                  <span className={styles.itemPrice}>
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.totalSection}>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Artikelsumme:</span>
                <span className={styles.totalAmount}>
                  {formatPrice(cart.state.totalAmount)}
                </span>
              </div>
              {cart.state.totalDepositAmount > 0 && (
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Pfand:</span>
                  <span className={styles.totalAmount}>
                    {formatPrice(cart.state.totalDepositAmount)}
                  </span>
                </div>
              )}
              <div className={styles.totalRow + " " + styles.grandTotal}>
                <span className={styles.totalLabel}>Gesamtbetrag:</span>
                <span className={styles.totalAmount}>
                  {formatPrice(
                    cart.state.totalAmount + cart.state.totalDepositAmount
                  )}
                </span>
              </div>
              {showDepositReturn && parseFloat(depositReturnAmount) > 0 && (
                <>
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>Pfandrückgabe:</span>
                    <span
                      className={styles.totalAmount}
                      style={{ color: "var(--color-success, #10b981)" }}
                    >
                      - {formatPrice(parseFloat(depositReturnAmount))}
                    </span>
                  </div>
                  <div className={styles.totalRow + " " + styles.grandTotal}>
                    <span className={styles.totalLabel}>Zu zahlen:</span>
                    <span className={styles.totalAmount}>
                      {formatPrice(getTotalToPay())}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Change Calculator (Optional) */}
          <div className={styles.changeCalculator}>
            <div className={styles.calculatorHeader}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showChangeCalculator}
                  onChange={(e) => setShowChangeCalculator(e.target.checked)}
                />
                Rückgeldrechner
              </label>
            </div>

            {showChangeCalculator && (
              <div className={styles.calculatorContent}>
                <div className={styles.inputGroup}>
                  <label htmlFor="receivedAmount">Erhaltener Betrag:</label>
                  <div className={styles.amountInput}>
                    <input
                      id="receivedAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      placeholder="0,00"
                    />
                    <span className={styles.currency}>€</span>
                  </div>
                </div>

                {receivedAmount && parseFloat(receivedAmount) > 0 && (
                  <div className={styles.changeResult}>
                    <div className={styles.changeInfo}>
                      <span>Zu zahlender Betrag:</span>
                      <span>{formatPrice(getTotalToPay())}</span>
                    </div>
                    <div className={styles.changeInfo}>
                      <span>Erhaltener Betrag:</span>
                      <span>{formatPrice(parseFloat(receivedAmount))}</span>
                    </div>
                    <div className={styles.changeAmount}>
                      <span>Rückgeld:</span>
                      <span
                        className={
                          calculateChange() >= 0
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {formatPrice(Math.abs(calculateChange()))}
                        {calculateChange() < 0 && " (fehlt)"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deposit Return (Optional) */}
          <div className={styles.changeCalculator}>
            <div className={styles.calculatorHeader}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showDepositReturn}
                  onChange={(e) => setShowDepositReturn(e.target.checked)}
                />
                Pfandrückgabe
              </label>
            </div>

            {showDepositReturn && (
              <div className={styles.calculatorContent}>
                <div className={styles.inputGroup}>
                  <label htmlFor="depositReturnAmount">
                    Pfandrückgabe-Betrag:
                  </label>
                  <div className={styles.amountInput}>
                    <input
                      id="depositReturnAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={depositReturnAmount}
                      onChange={(e) => setDepositReturnAmount(e.target.value)}
                      placeholder="0,00"
                    />
                    <span className={styles.currency}>€</span>
                  </div>
                </div>

                {depositReturnAmount && parseFloat(depositReturnAmount) > 0 && (
                  <div className={styles.changeResult}>
                    <div className={styles.changeInfo}>
                      <span>Ursprünglicher Betrag:</span>
                      <span>
                        {formatPrice(
                          cart.state.totalAmount + cart.state.totalDepositAmount
                        )}
                      </span>
                    </div>
                    <div className={styles.changeInfo}>
                      <span>Pfandrückgabe:</span>
                      <span style={{ color: "var(--color-success, #10b981)" }}>
                        - {formatPrice(parseFloat(depositReturnAmount))}
                      </span>
                    </div>
                    <div className={styles.changeAmount}>
                      <span>Zu zahlen:</span>
                      <span className={styles.positive}>
                        {formatPrice(getTotalToPay())}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            <MdIcons.MdCancel size={20} />
            Abbrechen
          </button>
          <button
            className={styles.confirmButton}
            onClick={handleConfirmOrder}
            disabled={
              isProcessing || (showChangeCalculator && calculateChange() < 0)
            }
          >
            {isProcessing ? (
              <>
                <MdIcons.MdHourglassTop size={20} />
                Wird verarbeitet...
              </>
            ) : (
              <>
                <MdIcons.MdCheck size={20} />
                Bestellung bestätigen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
