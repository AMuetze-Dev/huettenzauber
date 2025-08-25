import React, { useState } from 'react';
import { usePersistentCart, CartItem } from '../../context/PersistentCartContext';
import { useBill } from '../../context/BillContext';
import * as MdIcons from 'react-icons/md';
import styles from './CartModal.module.css';

interface CartModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCheckoutComplete?: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose, onCheckoutComplete }) => {
	const cart = usePersistentCart();
	const billContext = useBill();
	const [receivedAmount, setReceivedAmount] = useState<string>('');

	// Automatisierte Pfandrückgabe - Initialisierung aus Cart-Context
	const [depositReturnPrice, setDepositReturnPrice] = useState<string>(localStorage.getItem('depositReturnPrice') || '2.00');
	const [depositReturnCount, setDepositReturnCount] = useState<number>(cart.state.depositReturn?.quantity || 0);

	const [isProcessing, setIsProcessing] = useState(false);

	// Initialisiere depositReturnCount aus Cart-Context beim Öffnen
	React.useEffect(() => {
		if (isOpen && cart.state.depositReturn) {
			setDepositReturnCount(cart.state.depositReturn.quantity);
			setDepositReturnPrice(cart.state.depositReturn.pricePerItem.toString());
		}
	}, [isOpen, cart.state.depositReturn]);

	// Speichere Pfandpreis im localStorage bei Änderung
	React.useEffect(() => {
		localStorage.setItem('depositReturnPrice', depositReturnPrice);
	}, [depositReturnPrice]);

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
		}).format(price);
	};

	const handleQuantityChange = (itemId: string, newQuantity: number) => {
		// Live-Update: Direkt im Cart, aber Artikel mit 0 werden nicht entfernt
		const quantity = Math.max(0, newQuantity);
		if (quantity === 0) {
			// Setze auf 0, aber entferne nicht
			cart.updateQuantity(itemId, 0);
		} else {
			cart.updateQuantity(itemId, quantity);
		}
	};

	const handleRemoveItem = (itemId: string) => {
		// Sofort entfernen bei explizitem Löschen
		cart.removeItem(itemId);
	};

	const cleanupZeroQuantityItems = () => {
		// Entferne alle Artikel mit Anzahl 0 beim Schließen/Abschließen
		cart.cleanupZeroQuantity();
	};

	const calculateTotalWithChanges = () => {
		return cart.state.items.reduce((total: number, item: CartItem) => {
			return total + item.price * item.quantity;
		}, 0);
	};

	const handleClose = () => {
		// Cleanup: Entferne Artikel mit Anzahl 0 beim Schließen
		cleanupZeroQuantityItems();
		onClose();
	};

	const calculateChange = (): number => {
		const received = parseFloat(receivedAmount) || 0;
		const depositReturn = (parseFloat(depositReturnPrice) || 0) * depositReturnCount;
		const totalWithDeposit = calculateTotalWithChanges() + cart.state.totalDepositAmount;
		return received + depositReturn - totalWithDeposit;
	};

	const getTotalToPay = (): number => {
		const depositReturn = (parseFloat(depositReturnPrice) || 0) * depositReturnCount;
		return calculateTotalWithChanges() + cart.state.totalDepositAmount - depositReturn;
	};

	const getTotalDepositReturn = (): number => {
		return (parseFloat(depositReturnPrice) || 0) * depositReturnCount;
	};

	const handleConfirmOrder = async () => {
		if (isProcessing) return;

		setIsProcessing(true);
		try {
			// Cleanup: Entferne Artikel mit Anzahl 0 vor dem Checkout
			cleanupZeroQuantityItems();

			// Erstelle Bill im Backend
			const billItems = cart.state.items
				.filter((item) => item.quantity > 0) // Nur Artikel mit Anzahl > 0
				.map((item) => ({
					item_variant_id: item.variantId,
					item_quantity: item.quantity,
				}));

			await billContext.addBill({
				date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
				items: billItems,
			});

			// Erfolg - leere Warenkorb und schließe Modal
			cart.clearCart();
			onClose();
			if (onCheckoutComplete) {
				onCheckoutComplete();
			}
		} catch (error) {
			console.error('Fehler beim Erstellen der Bestellung:', error);
			alert('Fehler beim Erstellen der Bestellung. Bitte versuchen Sie es erneut.');
		} finally {
			setIsProcessing(false);
		}
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
					<button className={styles.closeBtn} onClick={handleClose} aria-label="Modal schließen">
						<MdIcons.MdClose size={24} />
					</button>
				</div>

				<div className={styles.content}>
					{cart.state.items.length === 0 ? (
						<div className={styles.emptyCart}>
							<MdIcons.MdShoppingCartCheckout size={64} />
							<h3>Warenkorb ist leer</h3>
							<p>Füge Artikel aus den Kategorien hinzu, um eine Bestellung zu erstellen.</p>
						</div>
					) : (
						<>
							{/* LINKE SPALTE: Artikelverwaltung */}
							<div className={styles.leftColumn}>
								<div className={styles.leftHeader}>
									<h3>
										<MdIcons.MdList size={20} />
										Artikel im Warenkorb ({cart.state.items.length})
									</h3>
								</div>
								<div className={styles.cartItemsContainer}>
									<div className={styles.cartItems}>
										{cart.state.items.map((item: CartItem) => {
											const currentQuantity = item.quantity;
											const isMarkedForRemoval = currentQuantity === 0;

											return (
												<div key={item.id} className={`${styles.cartItem} ${isMarkedForRemoval ? styles.markedForRemoval : ''}`}>
													<div className={styles.itemRow}>
														<div className={styles.itemInfo}>
															<span className={styles.itemName}>{item.name}</span>
															{item.variantName && <span className={styles.variant}>({item.variantName})</span>}
														</div>

														<div className={styles.countingControls}>
															<button onClick={() => handleQuantityChange(item.id, currentQuantity - 1)} className={styles.countingBtn} disabled={currentQuantity <= 0}>
																<MdIcons.MdRemove size={14} />
															</button>

															<span className={styles.countingDisplay}>{currentQuantity}</span>

															<button onClick={() => handleQuantityChange(item.id, currentQuantity + 1)} className={styles.countingBtn}>
																<MdIcons.MdAdd size={14} />
															</button>
														</div>

														<div className={styles.priceInfo}>
															<span className={styles.unitPrice}>{formatPrice(item.price)}</span>
															<span className={styles.totalPrice}>{formatPrice(item.price * currentQuantity)}</span>
														</div>

														<button onClick={() => handleRemoveItem(item.id)} className={styles.removeBtn} title="Artikel entfernen">
															<MdIcons.MdDelete size={20} />
														</button>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>

							{/* RECHTE SPALTE: Berechnungen und Aktionen */}
							<div className={styles.rightColumn}>
								{/* Pfandrückgabe */}
								<div className={styles.rightColumnCard}>
									<h4>
										<MdIcons.MdRecycling size={18} />
										Pfandrückgabe
									</h4>
									<div className={styles.depositSection}>
										<div className={styles.gridRow}>
											<span className={styles.gridLabel}>Pfandrückgabe:</span>
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: 'var(--spacing-sm)',
												}}
											>
												<div className={styles.priceInput}>
													<input
														type="number"
														step="0.01"
														min="0"
														value={depositReturnPrice}
														onChange={(e) => {
															const newPrice = e.target.value;
															setDepositReturnPrice(newPrice);
															// Sofort im Cart-Context aktualisieren
															const pricePerItem = parseFloat(newPrice) || 0;
															if (pricePerItem > 0 && depositReturnCount > 0) {
																cart.setDepositReturn(pricePerItem, depositReturnCount);
															} else if (depositReturnCount === 0 || pricePerItem === 0) {
																cart.setDepositReturn(0, 0);
															}
														}}
														placeholder="2,00"
														className={styles.priceField}
													/>
													<span>€</span>
												</div>

												<span className={styles.multiplySymbol}>×</span>

												<div className={styles.countingControls}>
													<button
														onClick={() => {
															const newCount = Math.max(0, depositReturnCount - 1);
															setDepositReturnCount(newCount);
															// Sofort im Cart-Context aktualisieren
															const pricePerItem = parseFloat(depositReturnPrice) || 0;
															if (pricePerItem > 0 && newCount > 0) {
																cart.setDepositReturn(pricePerItem, newCount);
															} else if (newCount === 0) {
																cart.setDepositReturn(0, 0);
															}
														}}
														className={styles.countingBtn}
														disabled={depositReturnCount <= 0}
													>
														<MdIcons.MdRemove size={14} />
													</button>

													<span className={styles.countingDisplay}>{depositReturnCount}</span>

													<button
														onClick={() => {
															const newCount = depositReturnCount + 1;
															setDepositReturnCount(newCount);
															// Sofort im Cart-Context aktualisieren
															const pricePerItem = parseFloat(depositReturnPrice) || 0;
															if (pricePerItem > 0) {
																cart.setDepositReturn(pricePerItem, newCount);
															}
														}}
														className={styles.countingBtn}
													>
														<MdIcons.MdAdd size={14} />
													</button>
												</div>

												<span className={styles.gridValue + ' ' + styles.success}>{formatPrice(getTotalDepositReturn())}</span>
											</div>
										</div>
									</div>
								</div>

								{/* Preisberechnung */}
								<div className={styles.rightColumnCard}>
									<h4>
										<MdIcons.MdCalculate size={18} />
										Preisberechnung
									</h4>
									<div className={styles.priceCalculationSection}>
										<div className={styles.summary}>
											<div className={styles.gridRow}>
												<span className={styles.gridLabel}>Artikelpreis:</span>
												<span className={styles.gridValue}>{formatPrice(calculateTotalWithChanges())}</span>
											</div>
											{cart.state.totalDepositAmount > 0 && (
												<div className={styles.gridRow}>
													<span className={styles.gridLabel}>Pfand:</span>
													<span className={styles.gridValue}>{formatPrice(cart.state.totalDepositAmount)}</span>
												</div>
											)}
											<div className={styles.gridRow + ' ' + styles.bordered}>
												<span className={styles.gridLabel}>{getTotalDepositReturn() > 0 ? 'Zu zahlen:' : 'Gesamtbetrag:'}</span>
												<span className={styles.gridValue + ' ' + styles.large}>{formatPrice(getTotalDepositReturn() > 0 ? getTotalToPay() : calculateTotalWithChanges() + cart.state.totalDepositAmount)}</span>
											</div>
										</div>
									</div>
								</div>

								{/* Rückgeldrechner */}
								<div className={styles.rightColumnCard}>
									<h4>
										<MdIcons.MdCalculate size={18} />
										Rückgeldrechner
									</h4>
									<div className={styles.changeCalculatorSection}>
										<div className={styles.gridRow}>
											<span className={styles.gridLabel}>Erhaltener Betrag:</span>
											<div className={styles.gridValue}>
												<div className={styles.amountInput}>
													<input type="number" step="0.01" min="0" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} placeholder="0,00" className={styles.changeField} />
													<span>€</span>
												</div>
											</div>
										</div>
										<div className={styles.gridRow + ' ' + styles.bordered}>
											<span className={styles.gridLabel}>Rückgeld:</span>
											<span className={styles.gridValue + ' ' + styles.large}>
												<span className={calculateChange() >= 0 ? styles.positive : styles.negative}>
													{formatPrice(Math.abs(calculateChange()))}
													{calculateChange() < 0 && ' (fehlt)'}
												</span>
											</span>
										</div>
									</div>
								</div>

								{/* Aktionen */}
								<div className={styles.rightColumnCard}>
									<div className={styles.actions}>
										<button onClick={handleConfirmOrder} className={styles.checkoutBtn} disabled={isProcessing}>
											<MdIcons.MdShoppingCartCheckout size={20} />
											{isProcessing ? 'Wird verarbeitet...' : 'Bestellung abschließen'}
										</button>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default CartModal;
