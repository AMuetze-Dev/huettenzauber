import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBill } from '../context/BillContext';
import { useProduct } from '../context/ProductContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import styles from './BillsStatistics.module.css';

// Chart.js registrieren
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface ItemConsumption {
	itemId: number;
	itemName: string;
	totalQuantity: number;
	totalRevenue: number;
	variantDetails: {
		variantId: number;
		variantName: string;
		quantity: number;
		revenue: number;
	}[];
}

interface BillsStatisticsProps {}

const BillsStatistics: React.FC<BillsStatisticsProps> = () => {
	const { bills, reloadBills } = useBill();
	const { items } = useProduct();
	const [activeView, setActiveView] = useState<'consumption' | 'charts'>('consumption');
	const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

	useEffect(() => {
		reloadBills();
	}, [reloadBills]);

	// Hilfsfunktionen aus BillsManagement
	const getItemVariant = useCallback(
		(variantId: number) => {
			for (const item of items) {
				const variant = item.item_variants?.find((v: any) => v.id === variantId);
				if (variant) {
					return { item, variant };
				}
			}
			return null;
		},
		[items]
	);

	const getItemPrice = useCallback(
		(billItem: any): number => {
			if (billItem.item_price !== undefined && billItem.item_price !== null && !isNaN(billItem.item_price)) {
				return billItem.item_price;
			}

			const result = getItemVariant(billItem.item_variant_id);
			if (result?.variant?.price !== undefined && result.variant.price !== null && !isNaN(result.variant.price)) {
				return result.variant.price;
			}

			return 0;
		},
		[getItemVariant]
	);

	// Berechnung der Verbrauchsstatistiken
	const consumptionData = useMemo((): ItemConsumption[] => {
		const itemMap = new Map<number, ItemConsumption>();

		// Alle nicht-gelöschten Rechnungen durchgehen
		bills
			.filter((bill) => !bill.is_deleted)
			.forEach((bill) => {
				bill.items.forEach((billItem) => {
					const itemVariantInfo = getItemVariant(billItem.item_variant_id);
					if (!itemVariantInfo) return;

					const { item, variant } = itemVariantInfo;
					const itemPrice = getItemPrice(billItem);
					const itemRevenue = itemPrice * billItem.item_quantity;

					// Item-Level Aggregation
					if (!itemMap.has(item.id)) {
						itemMap.set(item.id, {
							itemId: item.id,
							itemName: item.name,
							totalQuantity: 0,
							totalRevenue: 0,
							variantDetails: [],
						});
					}

					const consumption = itemMap.get(item.id)!;
					consumption.totalQuantity += billItem.item_quantity;
					consumption.totalRevenue += itemRevenue;

					// Variant-Level Details
					let variantDetail = consumption.variantDetails.find((vd) => vd.variantId === variant.id);
					if (!variantDetail) {
						variantDetail = {
							variantId: variant.id,
							variantName: variant.name || 'Standard',
							quantity: 0,
							revenue: 0,
						};
						consumption.variantDetails.push(variantDetail);
					}

					variantDetail.quantity += billItem.item_quantity;
					variantDetail.revenue += itemRevenue;
				});
			});

		return Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
	}, [bills, getItemPrice, getItemVariant]);

	// Chart-Daten vorbereiten
	const chartData = useMemo(() => {
		const labels = consumptionData.slice(0, 10).map((item) => item.itemName); // Top 10
		const quantities = consumptionData.slice(0, 10).map((item) => item.totalQuantity);

		const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'];

		return {
			labels,
			datasets: [
				{
					label: 'Verkaufte Menge',
					data: quantities,
					backgroundColor: colors,
					borderColor: colors.map((color) => color.replace('FF', 'CC')),
					borderWidth: 1,
				},
			],
		};
	}, [consumptionData]);

	const chartOptions = {
		responsive: true,
		plugins: {
			legend: {
				position: 'top' as const,
			},
			title: {
				display: true,
				text: 'Top 10 verkaufte Artikel',
			},
		},
		scales:
			chartType === 'bar'
				? {
						y: {
							beginAtZero: true,
						},
				  }
				: undefined,
	};

	const formatCurrency = (amount: number): string => {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
		}).format(amount);
	};

	const formatQuantity = (quantity: number): string => {
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}).format(quantity);
	};

	return (
		<div className={styles.pageLayout}>
			<header className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Verkaufsstatistiken</h1>
				<p className={styles.pageSubtitle}>Verbrauch und grafische Auswertung der verkauften Artikel</p>
			</header>

			{/* Navigation zwischen Ansichten */}
			<div className={styles.viewNavigation}>
				<button className={`${styles.viewButton} ${activeView === 'consumption' ? styles.active : ''}`} onClick={() => setActiveView('consumption')}>
					📊 Verbrauchsübersicht
				</button>
				<button className={`${styles.viewButton} ${activeView === 'charts' ? styles.active : ''}`} onClick={() => setActiveView('charts')}>
					📈 Grafische Auswertung
				</button>
			</div>

			{/* Verbrauchsübersicht */}
			{activeView === 'consumption' && (
				<div className={styles.consumptionView}>
					<div className={styles.statsHeader}>
						<h2>Artikelverbrauch (alle Varianten)</h2>
						<div className={styles.totalStats}>
							<span>Gesamt: {consumptionData.length} Artikel</span>
						</div>
					</div>

					<div className={styles.consumptionList}>
						{consumptionData.map((item, index) => (
							<div key={item.itemId} className={styles.consumptionItem}>
								<div className={styles.itemHeader}>
									<div className={styles.itemInfo}>
										<span className={styles.itemRank}>#{index + 1}</span>
										<h3 className={styles.itemName}>{item.itemName}</h3>
									</div>
									<div className={styles.itemTotals}>
										<div className={styles.totalQuantity}>{formatQuantity(item.totalQuantity)} verkauft</div>
										<div className={styles.totalRevenue}>{formatCurrency(item.totalRevenue)}</div>
									</div>
								</div>

								{/* Varianten-Details */}
								{item.variantDetails.length > 1 && (
									<div className={styles.variantDetails}>
										<h4>Varianten-Aufschlüsselung:</h4>
										<div className={styles.variantGrid}>
											{item.variantDetails
												.sort((a, b) => b.quantity - a.quantity)
												.map((variant) => (
													<div key={variant.variantId} className={styles.variantItem}>
														<span className={styles.variantName}>{variant.variantName}</span>
														<span className={styles.variantQuantity}>{formatQuantity(variant.quantity)}x</span>
														<span className={styles.variantRevenue}>{formatCurrency(variant.revenue)}</span>
													</div>
												))}
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Grafische Auswertung */}
			{activeView === 'charts' && (
				<div className={styles.chartsView}>
					<div className={styles.chartControls}>
						<h2>Grafische Auswertung - Top 10 Artikel</h2>
						<div className={styles.chartTypeToggle}>
							<button className={`${styles.chartTypeButton} ${chartType === 'bar' ? styles.active : ''}`} onClick={() => setChartType('bar')}>
								📊 Balkendiagramm
							</button>
							<button className={`${styles.chartTypeButton} ${chartType === 'pie' ? styles.active : ''}`} onClick={() => setChartType('pie')}>
								🥧 Kuchendiagramm
							</button>
						</div>
					</div>

					<div className={styles.chartContainer}>{chartType === 'bar' ? <Bar data={chartData} options={chartOptions} /> : <Pie data={chartData} options={chartOptions} />}</div>

					{/* Chart Legende/Zusatzinfo */}
					<div className={styles.chartLegend}>
						<h3>Top 10 meist verkaufte Artikel</h3>
						<div className={styles.legendGrid}>
							{consumptionData.slice(0, 10).map((item, index) => (
								<div key={item.itemId} className={styles.legendItem}>
									<span className={styles.legendRank}>#{index + 1}</span>
									<span className={styles.legendName}>{item.itemName}</span>
									<span className={styles.legendValue}>
										{formatQuantity(item.totalQuantity)} · {formatCurrency(item.totalRevenue)}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default BillsStatistics;
