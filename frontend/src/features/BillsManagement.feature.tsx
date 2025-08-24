import React, { useState, useEffect } from 'react';
import { useBill } from '../context/BillContext';
import { ItemVariant, useProduct } from '../context/ProductContext';
import styles from './BillsManagement.module.css';

interface BillsManagementProps {}

const BillsManagement: React.FC<BillsManagementProps> = () => {
	const { bills, reloadBills, deleteBill, isShowingDeleted, switchReloadWithDeleted } = useBill();
	const { items } = useProduct();
	const [selectedBill, setSelectedBill] = useState<number | null>(null);

	useEffect(() => {
		reloadBills();
		// Debug: Ausgabe der geladenen Bills
		console.log('Bills loaded:', bills);
		if (bills.length > 0) {
			console.log('First bill items:', bills[0].items);
			if (bills[0].items.length > 0) {
				console.log('First item details:', bills[0].items[0]);
			}
		}
	}, [reloadBills, bills]);

	const getItemVariant = (variantId: number): ItemVariant | undefined => {
		for (const item of items) {
			const variant = item.item_variants?.find((v: any) => v.id === variantId);
			if (variant) {
				return variant;
			}
		}
		return undefined;
	};

	// Hilfsfunktion um den korrekten Preis zu ermitteln
	const getItemPrice = (billItem: any): number => {
		// Priorisiere gespeicherten Preis aus der Rechnung
		if (billItem.item_price !== undefined && billItem.item_price !== null && !isNaN(billItem.item_price)) {
			console.log(`Using stored price for variant ${billItem.item_variant_id}: ${billItem.item_price}`);
			return billItem.item_price;
		}

		// Fallback: Preis aus der aktuellen ItemVariant
		const variant = getItemVariant(billItem.item_variant_id);
		if (variant && variant.price !== undefined && variant.price !== null && !isNaN(variant.price)) {
			console.log(`Using variant price for variant ${billItem.item_variant_id}: ${variant.price} (no stored price available)`);
			return variant.price;
		}

		// Letzter Fallback: 0
		console.warn(`No price available for variant ${billItem.item_variant_id}, using 0`);
		return 0;
	};

	// Hilfsfunktion um Item-Name aus variant_id zu bekommen
	const getItemName = (variantId: number): string => {
		for (const item of items) {
			const variant = item.item_variants?.find((v: any) => v.id === variantId);
			if (variant) {
				const hasMultipleVariants = item.item_variants.length > 1;
				const isStandardVariant = variant.name === 'Standard' || variant.name === '1.0' || variant.name === 'Default' || !variant.name;

				if (hasMultipleVariants && !isStandardVariant) {
					return `${item.name} - ${variant.name}`;
				} else {
					return item.name;
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

	const formatDate = (dateString: string): string => {
		return new Date(dateString).toLocaleDateString('de-DE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const calculateBillTotal = (bill: any): number => {
		return bill.items.reduce((sum: number, item: any) => {
			const price = getItemPrice(item);
			const quantity = item.item_quantity || 0;
			return sum + price * quantity;
		}, 0);
	};

	const handleDeleteBill = async (billId: number) => {
		if (window.confirm('Möchten Sie diese Rechnung wirklich löschen?')) {
			await deleteBill(billId);
		}
	};

	const toggleBillDetails = (billId: number) => {
		setSelectedBill(selectedBill === billId ? null : billId);
	};

	return (
		<div className={styles.pageLayout}>
			<header className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Rechnungsübersicht</h1>
				<p className={styles.pageSubtitle}>Alle Rechnungen verwalten und Lagerbestand befüllen</p>
			</header>

			<div className={styles.billsManagement}>
				{/* Header with controls */}
				<div className={styles.controlsHeader}>
					<div className={styles.toggleControls}>
						<label className={styles.toggleLabel}>
							<input type="checkbox" checked={isShowingDeleted} onChange={switchReloadWithDeleted} className={styles.toggleCheckbox} />
							<span className={styles.toggleSlider}></span>
							Gelöschte Rechnungen anzeigen
						</label>
					</div>

					<div className={styles.statsInfo}>
						<span className={styles.billCount}>
							{bills.length} {bills.length === 1 ? 'Rechnung' : 'Rechnungen'}
						</span>
					</div>
				</div>

				{/* Bills List */}
				<div className={styles.billsList}>
					{bills.length === 0 ? (
						<div className={styles.emptyState}>
							<h3>Keine Rechnungen vorhanden</h3>
							<p>Es wurden noch keine Rechnungen erstellt.</p>
						</div>
					) : (
						bills.map((bill) => (
							<div key={bill.id} className={`${styles.billCard} ${bill.is_deleted ? styles.deletedBill : ''}`}>
								<div className={styles.billHeader}>
									<div className={styles.billInfo}>
										<h3>
											Rechnung #{bill.id}
											{bill.is_deleted && <span className={styles.deletedLabel}>GELÖSCHT</span>}
										</h3>
										<p className={styles.billDate}>{formatDate(bill.date)}</p>
									</div>

									<div className={styles.billTotals}>
										<div className={styles.totalAmount}>{formatCurrency(calculateBillTotal(bill))}</div>
										<div className={styles.itemCount}>
											{bill.items.length} {bill.items.length === 1 ? 'Artikel' : 'Artikel'}
										</div>
									</div>

									<div className={styles.billActions}>
										<button onClick={() => toggleBillDetails(bill.id)} className={styles.detailsButton}>
											{selectedBill === bill.id ? 'Weniger' : 'Details'}
										</button>

										{!bill.is_deleted && (
											<button onClick={() => handleDeleteBill(bill.id)} className={styles.deleteButton}>
												Löschen
											</button>
										)}
									</div>
								</div>

								{/* Bill Details */}
								{selectedBill === bill.id && (
									<div className={styles.billDetails}>
										<div className={styles.itemsGrid}>
											<div className={styles.gridHeader}>
												<span>Artikel</span>
												<span>Menge</span>
												<span>Einzelpreis</span>
												<span>Gesamt</span>
											</div>

											{bill.items.map((item: any, index: number) => {
												const itemPrice = getItemPrice(item);
												const itemQuantity = item.item_quantity || 0;
												const itemTotal = itemPrice * itemQuantity;

												return (
													<div key={index} className={styles.billItem}>
														<span className={styles.itemName}>{getItemName(item.item_variant_id)}</span>
														<span className={styles.itemQuantity}>{itemQuantity}x</span>
														<span className={styles.itemPrice}>{formatCurrency(itemPrice)}</span>
														<span className={styles.itemTotal}>{formatCurrency(itemTotal)}</span>
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
};

export default BillsManagement;
