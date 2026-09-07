import { MdDragIndicator, MdEdit, MdDelete } from 'react-icons/md';
import { Item } from '../../context/ProductContext';
import styles from './CompactItemCard.module.css';
import { useRef } from 'react';

type CompactItemCardProps = Item & {
	onEdit?: () => void;
	onDelete?: () => void;
	onDragStart?: (item: Item) => void;
	onDragEnd?: () => void;
	isDragging?: boolean;
};

export default function CompactItemCard({ id, name, category_id, item_variants, deposit_amount, onEdit, onDelete, onDragStart, onDragEnd, isDragging = false }: CompactItemCardProps) {
	const touchDragActive = useRef(false);
	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit?.();
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (window.confirm('Möchten Sie diesen Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
			onDelete?.();
		}
	};

	// Desktop drag events
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', id.toString());
		onDragStart?.({ id, name, category_id, item_variants });
	};
	const handleDragEnd = (e: React.DragEvent) => {
		onDragEnd?.();
	};

	// Touch drag events
	const handleTouchStart = (e: React.TouchEvent) => {
		touchDragActive.current = true;
		onDragStart?.({ id, name, category_id, item_variants });
	};
	const handleTouchMove = (e: React.TouchEvent) => {
		// Prevent scrolling while dragging
		if (touchDragActive.current) e.preventDefault();
		// Option: Hier könnte man die Position an Parent weitergeben
	};
	const handleTouchEnd = (e: React.TouchEvent) => {
		if (touchDragActive.current) {
			touchDragActive.current = false;
			onDragEnd?.();
		}
	};

	const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
		e.preventDefault();
	};

	const firstVariant = item_variants && item_variants.length > 0 ? item_variants[0] : null;
	const hasVariants = item_variants && item_variants.length > 1;
	let priceTag = '';
	let infoTags: string[] = [];

	if (!firstVariant) {
		priceTag = 'Kein Preis';
		infoTags = ['Keine Varianten verfügbar'];
	} else if (hasVariants) {
		const prices = item_variants.map((v) => v.price);
		const minPrice = Math.min(...prices);
		const maxPrice = Math.max(...prices);
		priceTag = minPrice === maxPrice ? `${minPrice.toFixed(2)}€` : `${minPrice.toFixed(2)}€ - ${maxPrice.toFixed(2)}€`;
		const uniqueVariantNames = item_variants
			.map((variant) => variant.name)
			.filter((name) => name && name.trim() !== '')
			.filter((name, index, arr) => arr.indexOf(name) === index);
		if (uniqueVariantNames.length > 0) {
			infoTags = uniqueVariantNames.slice(0, 2);
			if (uniqueVariantNames.length > 2) {
				infoTags.push(`+${uniqueVariantNames.length - 2} weitere`);
			}
		} else {
			infoTags = [`${item_variants.length} Varianten`];
		}
	} else {
		priceTag = `${firstVariant.price.toFixed(2)}€`;
		if (firstVariant.name && firstVariant.name.trim() !== '' && firstVariant.name !== name) {
			infoTags = [firstVariant.name];
		}
	}

	if (deposit_amount && deposit_amount > 0) {
		infoTags.push(`+ ${deposit_amount.toFixed(2)}€ Pfand`);
	}

	return (
		<article
			className={`${styles.compactCard} ${isDragging ? styles.dragging : ''}`}
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			// Touch events for the whole card (optional: only on drag handle)
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			{/* Drag Handle */}
			<div className={styles.dragHandle} title="Ziehen zum Verschieben" onContextMenu={handleContextMenu} onTouchStart={handleTouchStart}>
				<MdDragIndicator size={24} />
			</div>

			{/* Main Content */}
			<div className={styles.cardContent}>
				<div className={styles.primaryInfo}>
					<h3 className={styles.itemName} title={name}>
						{name || 'Unbenannter Artikel'}
					</h3>
				</div>

				{/* Clean Info Tags - Price + Variants */}
				<div className={styles.infoTags}>
					<span className={`${styles.infoTag} ${styles.price}`}>{priceTag}</span>
					{infoTags.map((tag, index) => (
						<span key={index} className={styles.infoTag}>
							{tag}
						</span>
					))}
				</div>
			</div>

			{/* Action Buttons */}
			<div className={styles.actionButtons}>
				<button className={styles.editButton} onClick={handleEditClick} title="Artikel bearbeiten" type="button">
					<MdEdit size={20} />
				</button>
				<button className={styles.deleteButton} onClick={handleDeleteClick} title="Artikel löschen" type="button">
					<MdDelete size={20} />
				</button>
			</div>
		</article>
	);
}
