import React, { useEffect, useRef } from 'react';
import { usePersistentCart } from '../../context/PersistentCartContext';
import { useProduct } from '../../context/ProductContext';
import styles from './billing.module.css';

const BillingPage: React.FC = () => {
	const { state } = usePersistentCart();
	const { items } = useProduct();
	const itemsListRef = useRef<HTMLDivElement>(null);

	// Auto-scroll nach unten bei Cart-Updates
	useEffect(() => {
		if (itemsListRef.current && state.items.length > 0) {
			// Verwende requestAnimationFrame für smooth scrolling
			requestAnimationFrame(() => {
				itemsListRef.current?.scrollTo({
					top: itemsListRef.current.scrollHeight,
					behavior: 'smooth',
				});
			});
		}
	}, [state.totalAmount, state.totalItems, state.totalDepositAmount, state.depositReturn]);

	// Hilfsfunktion um Item-Name zu bekommen
	const getItemName = (stockItemId: number, variantId: number): string => {
		for (const item of items) {
			if (item.id === stockItemId) {
				const variant = item.item_variants?.find((v: any) => v.id === variantId);
				if (variant) {
					// Prüfe ob es mehrere Varianten gibt oder ob der Variantenname aussagekräftig ist
					const hasMultipleVariants = item.item_variants.length > 1;
					const isStandardVariant = variant.name === 'Standard' || variant.name === '1.0' || variant.name === 'Default' || !variant.name;

					// Zeige Variantennamen nur bei mehreren Varianten oder aussagekräftigen Namen
					if (hasMultipleVariants && !isStandardVariant) {
						return `${item.name} - ${variant.name}`;
					} else {
						return item.name;
					}
				}
			}
		}
		return 'Unbekanntes Item';
	};

	const formatCurrency = (amount: number): string => {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
		}).format(amount);
	};

	return (
		<div className={styles.customerDisplay}>
			<main className={styles.displayContent}>
				{state.items.length === 0 ? (
					<div className={styles.emptyDisplay}>
						<h2>Willkommen!</h2>
						<p>Ihre Bestellung wird hier angezeigt, sobald Artikel hinzugefügt werden.</p>
					</div>
				) : (
					<>
						<div className={styles.itemsDisplay}>
							<div className={styles.itemsList} ref={itemsListRef}>
								{state.items.map((item, index) => (
									<div key={index} className={styles.displayItem}>
										<div className={styles.itemName}>{getItemName(item.stockItemId, item.variantId)}</div>
										<div className={styles.itemQuantity}>{item.quantity}x</div>
										<div className={styles.itemPrice}>{formatCurrency(item.price * item.quantity)}</div>
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
							{state.depositReturn && state.depositReturn.totalReturn > 0 && (
								<div className={styles.totalRow} style={{ color: '#4caf50' }}>
									<span>Pfandrückgabe ({state.depositReturn.quantity} Stück):</span>
									<span>- {formatCurrency(state.depositReturn.totalReturn)}</span>
								</div>
							)}
							<div className={styles.grandTotal}>
								<span>Gesamtsumme:</span>
								<span>{formatCurrency(state.totalAmount + state.totalDepositAmount - (state.depositReturn?.totalReturn || 0))}</span>
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	);
};

export default BillingPage;
