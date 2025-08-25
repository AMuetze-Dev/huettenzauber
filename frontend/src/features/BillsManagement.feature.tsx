import React, { useState, useEffect, useCallback } from 'react';
import { useBill } from '../context/BillContext';
import { ItemVariant, useProduct } from '../context/ProductContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import styles from './BillsManagement.module.css';

interface BillsManagementProps {}

const BillsManagement: React.FC<BillsManagementProps> = () => {
	const { bills, reloadBills, deleteBill, isShowingDeleted, switchReloadWithDeleted } = useBill();
	const { items } = useProduct();
	const [selectedBill, setSelectedBill] = useState<number | null>(null);

	useEffect(() => {
		reloadBills();
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

	// Export-Funktionen
	const exportToPDF = useCallback(() => {
		const doc = new jsPDF();

		// Titel mit Branding-Farbe
		doc.setFontSize(20);
		doc.setTextColor(244, 184, 3); // Accent color #f4b803
		doc.text('Rechnungsübersicht', 20, 20);

		// Datum
		doc.setFontSize(10);
		doc.setTextColor(0, 0, 0); // Zurück zu schwarz
		doc.text(`Exportiert am: ${new Date().toLocaleDateString('de-DE')}`, 20, 30);

		// Tabellendaten vorbereiten
		const tableData: any[] = [];
		let grandTotal = 0;
		let deletedTotal = 0;

		bills.forEach((bill) => {
			let billTotal = 0;

			bill.items.forEach((item: any, index: number) => {
				const itemName = getItemName(item.item_variant_id);
				const itemPrice = getItemPrice(item);
				const itemVariant = getItemVariant(item.item_variant_id);
				const billSteps = itemVariant?.bill_steps || 1;
				const displayQuantity = item.item_quantity * billSteps;
				const itemTotal = itemPrice * item.item_quantity;
				billTotal += itemTotal;

				const row = [
					index === 0 ? `#${bill.id}` : '', // Rechnungsnummer nur bei erstem Item
					index === 0 ? new Date(bill.date).toLocaleDateString('de-DE') : '',
					itemName,
					displayQuantity.toString(),
					`${itemPrice.toFixed(2)} €`,
					`${itemTotal.toFixed(2)} €`,
					index === 0 && bill.is_deleted ? 'GELÖSCHT' : '', // Gelöscht-Status
				];

				tableData.push(row);
			});

			// Gesamtsumme für die Rechnung
			const totalRow = ['', '', `GESAMT${bill.is_deleted ? ' (GELÖSCHT)' : ''}:`, '', '', `${billTotal.toFixed(2)} €`, ''];
			tableData.push(totalRow);

			// Leerzeile zwischen Rechnungen
			const separatorRow = ['', '', '', '', '', '', ''];
			tableData.push(separatorRow);

			// Zu Gesamtsummen hinzufügen
			if (bill.is_deleted) {
				deletedTotal += billTotal;
			} else {
				grandTotal += billTotal;
			}
		});

		// Zusammenfassung am Ende
		tableData.push(['', '', '═══════════════', '', '', '', '']);
		tableData.push(['', '', 'ZUSAMMENFASSUNG:', '', '', '', '']);
		tableData.push(['', '', 'Gültige Rechnungen:', '', '', `${grandTotal.toFixed(2)} €`, '']);
		if (deletedTotal > 0) {
			tableData.push(['', '', 'Gelöschte Rechnungen:', '', '', `${deletedTotal.toFixed(2)} €`, '']);
		}
		tableData.push(['', '', 'GESAMTUMSATZ:', '', '', `${(grandTotal + deletedTotal).toFixed(2)} €`, '']);

		// Header
		const headers = ['Rechnung #', 'Datum', 'Artikel', 'Menge', 'Einzelpreis', 'Gesamt', 'Status'];

		// AutoTable mit Branding-Farben
		autoTable(doc, {
			head: [headers],
			body: tableData,
			startY: 40,
			styles: {
				fontSize: 8,
				cellPadding: 2,
			},
			headStyles: {
				fillColor: [244, 184, 3], // Accent color #f4b803
				textColor: [0, 0, 0], // Schwarz für bessere Lesbarkeit auf gelbem Hintergrund
				fontStyle: 'bold',
			},
			bodyStyles: {
				textColor: [0, 0, 0],
			},
			alternateRowStyles: {
				fillColor: [249, 250, 251], // Sehr helles Grau für abwechselnde Zeilen
			},
			didParseCell: function (data) {
				// Gelöschte Rechnungen rot hervorheben
				if (data.cell.text.length > 0 && (data.cell.text[0].includes('GELÖSCHT') || data.cell.text[0] === 'GELÖSCHT')) {
					data.cell.styles.fillColor = [220, 53, 69]; // Rot für gelöschte Einträge
					data.cell.styles.textColor = [255, 255, 255]; // Weißer Text auf rotem Hintergrund
					data.cell.styles.fontStyle = 'bold';
				}
				// Zeilen mit gelöschten Rechnungen komplett rot hervorheben
				bills.forEach((bill) => {
					if (bill.is_deleted && data.row.index < tableData.length) {
						const rowData = tableData[data.row.index];
						if (rowData[0] === `#${bill.id}` || (rowData[2] && rowData[2].includes('GELÖSCHT'))) {
							data.cell.styles.fillColor = [254, 243, 199]; // Helles Rot-Orange für gelöschte Rechnungszeilen
							if (data.cell.text[0] === 'GELÖSCHT') {
								data.cell.styles.fillColor = [220, 53, 69]; // Dunkelrot für Status-Spalte
								data.cell.styles.textColor = [255, 255, 255];
								data.cell.styles.fontStyle = 'bold';
							}
						}
					}
				});
			},
		});

		doc.save('rechnungsuebersicht.pdf');
	}, [bills, getItemName, getItemPrice, getItemVariant]);

	const exportToExcel = useCallback(() => {
		const data: any[] = [];
		let grandTotal = 0;
		let deletedTotal = 0;

		bills.forEach((bill) => {
			let billTotal = 0;

			bill.items.forEach((item: any, index: number) => {
				const itemName = getItemName(item.item_variant_id);
				const itemPrice = getItemPrice(item);
				const itemVariant = getItemVariant(item.item_variant_id);
				const billSteps = itemVariant?.bill_steps || 1;
				const displayQuantity = item.item_quantity * billSteps;
				const itemTotal = itemPrice * item.item_quantity;
				billTotal += itemTotal;

				const row: any = {
					'Rechnung #': index === 0 ? `#${bill.id}` : '',
					Datum: index === 0 ? new Date(bill.date).toLocaleDateString('de-DE') : '',
					Artikel: itemName,
					Menge: displayQuantity,
					Einzelpreis: itemPrice,
					Gesamt: itemTotal,
					Status: index === 0 && bill.is_deleted ? 'GELÖSCHT' : '',
				};

				data.push(row);
			});

			// Gesamtsumme für die Rechnung
			const totalRow: any = {
				'Rechnung #': '',
				Datum: '',
				Artikel: `GESAMT${bill.is_deleted ? ' (GELÖSCHT)' : ''}:`,
				Menge: '',
				Einzelpreis: '',
				Gesamt: billTotal,
				Status: '',
			};
			data.push(totalRow);

			// Leerzeile zwischen Rechnungen
			const separatorRow: any = {
				'Rechnung #': '',
				Datum: '',
				Artikel: '',
				Menge: '',
				Einzelpreis: '',
				Gesamt: '',
				Status: '',
			};
			data.push(separatorRow);

			// Zu Gesamtsummen hinzufügen
			if (bill.is_deleted) {
				deletedTotal += billTotal;
			} else {
				grandTotal += billTotal;
			}
		});

		// Zusammenfassung am Ende
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: '═══════════════',
			Menge: '',
			Einzelpreis: '',
			Gesamt: '',
			Status: '',
		});
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'ZUSAMMENFASSUNG:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: '',
			Status: '',
		});
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'Gültige Rechnungen:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: grandTotal,
			Status: '',
		});
		if (deletedTotal > 0) {
			data.push({
				'Rechnung #': '',
				Datum: '',
				Artikel: 'Gelöschte Rechnungen:',
				Menge: '',
				Einzelpreis: '',
				Gesamt: deletedTotal,
				Status: '',
			});
		}
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'GESAMTUMSATZ:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: grandTotal + deletedTotal,
			Status: '',
		});

		const ws = XLSX.utils.json_to_sheet(data);

		// Spaltenbreiten definieren
		const colWidths = [
			{ wch: 12 }, // Rechnung #
			{ wch: 12 }, // Datum
			{ wch: 30 }, // Artikel
			{ wch: 8 }, // Menge
			{ wch: 12 }, // Einzelpreis
			{ wch: 12 }, // Gesamt
			{ wch: 12 }, // Status
		];
		ws['!cols'] = colWidths;

		// Styling für gelöschte Rechnungen (rote Hintergrundfarbe)
		// Excel-spezifische Styles können über XLSX begrenzt angewendet werden
		// Für vollständige Formatierung würden wir eine erweiterte Library benötigen

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rechnungen');

		// Excel-Datei erstellen und herunterladen
		const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
		const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
		saveAs(blob, 'rechnungsuebersicht.xlsx');
	}, [bills, getItemName, getItemPrice, getItemVariant]);

	const exportToCSV = useCallback(() => {
		const data: any[] = [];
		let grandTotal = 0;
		let deletedTotal = 0;

		bills.forEach((bill) => {
			let billTotal = 0;

			bill.items.forEach((item: any, index: number) => {
				const itemName = getItemName(item.item_variant_id);
				const itemPrice = getItemPrice(item);
				const itemVariant = getItemVariant(item.item_variant_id);
				const billSteps = itemVariant?.bill_steps || 1;
				const displayQuantity = item.item_quantity * billSteps;
				const itemTotal = itemPrice * item.item_quantity;
				billTotal += itemTotal;

				const row: any = {
					'Rechnung #': index === 0 ? `#${bill.id}` : '',
					Datum: index === 0 ? new Date(bill.date).toLocaleDateString('de-DE') : '',
					Artikel: itemName,
					Menge: displayQuantity,
					Einzelpreis: itemPrice,
					Gesamt: itemTotal,
					Status: index === 0 && bill.is_deleted ? 'GELÖSCHT' : '',
				};

				data.push(row);
			});

			// Gesamtsumme für die Rechnung
			const totalRow: any = {
				'Rechnung #': '',
				Datum: '',
				Artikel: `GESAMT${bill.is_deleted ? ' (GELÖSCHT)' : ''}:`,
				Menge: '',
				Einzelpreis: '',
				Gesamt: billTotal,
				Status: '',
			};
			data.push(totalRow);

			// Leerzeile zwischen Rechnungen
			const separatorRow: any = {
				'Rechnung #': '',
				Datum: '',
				Artikel: '',
				Menge: '',
				Einzelpreis: '',
				Gesamt: '',
				Status: '',
			};
			data.push(separatorRow);

			// Zu Gesamtsummen hinzufügen
			if (bill.is_deleted) {
				deletedTotal += billTotal;
			} else {
				grandTotal += billTotal;
			}
		});

		// Zusammenfassung am Ende
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: '═══════════════',
			Menge: '',
			Einzelpreis: '',
			Gesamt: '',
			Status: '',
		});
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'ZUSAMMENFASSUNG:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: '',
			Status: '',
		});
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'Gültige Rechnungen:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: grandTotal,
			Status: '',
		});
		if (deletedTotal > 0) {
			data.push({
				'Rechnung #': '',
				Datum: '',
				Artikel: 'Gelöschte Rechnungen:',
				Menge: '',
				Einzelpreis: '',
				Gesamt: deletedTotal,
				Status: '',
			});
		}
		data.push({
			'Rechnung #': '',
			Datum: '',
			Artikel: 'GESAMTUMSATZ:',
			Menge: '',
			Einzelpreis: '',
			Gesamt: grandTotal + deletedTotal,
			Status: '',
		});

		const ws = XLSX.utils.json_to_sheet(data);
		const csv = XLSX.utils.sheet_to_csv(ws);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, 'rechnungsuebersicht.csv');
	}, [bills, getItemName, getItemPrice, getItemVariant]);

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

					<div className={styles.exportControls}>
						<button onClick={exportToPDF} className={styles.exportButton}>
							📄 PDF Export
						</button>
						<button onClick={exportToExcel} className={styles.exportButton}>
							📊 Excel Export
						</button>
						<button onClick={exportToCSV} className={styles.exportButton}>
							📋 CSV Export
						</button>
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
									</div>

									<div className={styles.billTotals}>
										<div className={styles.totalAmount}>{formatCurrency(calculateBillTotal(bill))}</div>
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
