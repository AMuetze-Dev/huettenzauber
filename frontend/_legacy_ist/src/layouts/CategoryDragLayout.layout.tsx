import { ReactNode, useState } from 'react';
import { MdAdd } from 'react-icons/md';
import * as MdIcons from 'react-icons/md';
import { Item } from '../context/ProductContext';
import type { Category } from '../context/ProductContext';
import styles from './CategoryDragLayout.module.css';

type CategoryDragLayoutProps = {
	categories: Category[];
	items: Item[];
	selectedCategoryId?: number | null;
	onCategorySelect?: (categoryId: number) => void;
	onCategoryDrop: (categoryId: number) => void;
	onItemReorder: (categoryId: number, reorderedItems: Item[]) => void;
	draggedItem: Item | null;
	children?: ReactNode;
};

export default function CategoryDragLayout({ categories, items, selectedCategoryId, onCategorySelect, onCategoryDrop, onItemReorder, draggedItem, children }: CategoryDragLayoutProps) {
	const [dragOverCategory, setDragOverCategory] = useState<number | null>(null);

	const getItemsByCategory = (categoryId: number) => {
		return items.filter((item) => item.category_id === categoryId);
	};

	const handleCategoryDragOver = (e: React.DragEvent, categoryId: number) => {
		e.preventDefault();
		setDragOverCategory(categoryId);
	};

	const handleCategoryDragLeave = () => {
		setDragOverCategory(null);
	};

	const handleCategoryDrop = (e: React.DragEvent, categoryId: number) => {
		e.preventDefault();
		setDragOverCategory(null);
		onCategoryDrop(categoryId);
	};

	return (
		<div className={styles.categoryDragLayout}>
			{/* Category Headers */}
			<div className={styles.categoryHeaders}>
				{categories.map((category) => {
					const IconComponent = MdIcons[category.icon as keyof typeof MdIcons] || MdIcons.MdCategory;
					const categoryItems = getItemsByCategory(category.id);
					const isDragOver = dragOverCategory === category.id;
					const isSelected = selectedCategoryId === category.id;

					return (
						<div
							key={category.id}
							className={`${styles.categoryHeader} ${isDragOver ? styles.dragOver : ''} ${isSelected ? styles.selected : ''}`}
							onClick={() => onCategorySelect?.(category.id)}
							onDragOver={(e) => handleCategoryDragOver(e, category.id)}
							onDragLeave={handleCategoryDragLeave}
							onDrop={(e) => handleCategoryDrop(e, category.id)}
						>
							<div className={styles.categoryInfo}>
								<IconComponent size={20} />
								<span className={styles.categoryName}>{category.name}</span>
								<span className={styles.itemCount}>{categoryItems.length}</span>
							</div>

							{/* Drop Indicator - mit pointer-events: none */}
							{isDragOver && (
								<div className={styles.dropIndicator}>
									<MdAdd size={16} />
									<span>Hier ablegen</span>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Render children if provided (for backward compatibility) */}
			{children && <div className={styles.childrenContainer}>{children}</div>}
		</div>
	);
}
