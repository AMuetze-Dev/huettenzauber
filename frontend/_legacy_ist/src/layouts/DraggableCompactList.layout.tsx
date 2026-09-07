import React, { useState, useRef } from 'react';
import { Item } from '../context/ProductContext';
import styles from './DraggableCompactList.module.css';

type DraggableCompactListLayoutProps = {
	items: Item[];
	addCard?: React.ReactNode;
	CompactCardComponent: React.ComponentType<any>;
	onEdit: (item: Item) => void;
	onDelete: (id: number) => void;
	onDragStart: (item: Item) => void;
	onDragEnd?: () => void;
	onItemReorder: (categoryId: number, reorderedItems: Item[]) => void;
	draggedItem: Item | null;
	selectedCategoryId: number | null;
};

export default function DraggableCompactListLayout({ items, addCard, CompactCardComponent, onEdit, onDelete, onDragStart, onDragEnd, onItemReorder, draggedItem, selectedCategoryId }: DraggableCompactListLayoutProps) {
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [isDragActive, setIsDragActive] = useState(false);
	const dragCounter = useRef(0);

	const handleDragStart = (item: Item) => {
		setIsDragActive(true);
		onDragStart(item);
	};

	const handleDragEnd = () => {
		setIsDragActive(false);
		setDragOverIndex(null);
		dragCounter.current = 0;
		onDragEnd?.();
	};

	// Desktop drag events
	const handleDragEnter = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		dragCounter.current++;
		setDragOverIndex(index);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		dragCounter.current--;
		if (dragCounter.current === 0) {
			setDragOverIndex(null);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	};

	const handleDrop = (e: React.DragEvent, targetIndex: number) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounter.current = 0;
		setDragOverIndex(null);
		if (!draggedItem || !selectedCategoryId) return;
		const draggedIndex = items.findIndex((item) => item.id === draggedItem.id);
		if (draggedIndex === -1) return;
		let actualTargetIndex = targetIndex;
		if (draggedIndex < targetIndex) {
			actualTargetIndex = targetIndex - 1;
		}
		if (draggedIndex === actualTargetIndex) return;
		const reorderedItems = [...items];
		const [movedItem] = reorderedItems.splice(draggedIndex, 1);
		reorderedItems.splice(actualTargetIndex, 0, movedItem);
		onItemReorder(selectedCategoryId, reorderedItems);
	};

	// Touch/pointer events for drop zones
	const handlePointerEnter = (index: number) => {
		if (isDragActive) setDragOverIndex(index);
	};
	const handlePointerLeave = () => {
		if (isDragActive) setDragOverIndex(null);
	};
	const handlePointerUp = (targetIndex: number) => {
		if (!isDragActive) return;
		if (!draggedItem || !selectedCategoryId) {
			setIsDragActive(false);
			setDragOverIndex(null);
			return;
		}
		const draggedIndex = items.findIndex((item) => item.id === draggedItem.id);
		if (draggedIndex === -1) {
			setIsDragActive(false);
			setDragOverIndex(null);
			return;
		}
		let actualTargetIndex = targetIndex;
		if (draggedIndex < targetIndex) {
			actualTargetIndex = targetIndex - 1;
		}
		if (draggedIndex === actualTargetIndex) {
			setIsDragActive(false);
			setDragOverIndex(null);
			return;
		}
		const reorderedItems = [...items];
		const [movedItem] = reorderedItems.splice(draggedIndex, 1);
		reorderedItems.splice(actualTargetIndex, 0, movedItem);
		setDragOverIndex(null);
		onItemReorder(selectedCategoryId, reorderedItems);
		setIsDragActive(false);
	};

	return (
		<div className={`${styles.container} ${isDragActive ? styles.dragActive : ''}`}>
			{addCard && <div className={styles.addCardContainer}>{addCard}</div>}

			<div className={styles.list}>
				{items.map((item, index) => (
					<React.Fragment key={item.id}>
						{/* Drop zone before item */}
						<div
							className={`${styles.dropZone} ${dragOverIndex === index ? styles.dropZoneActive : ''}`}
							onDragEnter={(e) => handleDragEnter(e, index)}
							onDragLeave={handleDragLeave}
							onDragOver={handleDragOver}
							onDrop={(e) => handleDrop(e, index)}
							onPointerEnter={() => handlePointerEnter(index)}
							onPointerLeave={handlePointerLeave}
							onPointerUp={() => handlePointerUp(index)}
							style={{ touchAction: 'none' }}
						>
							{dragOverIndex === index && isDragActive && (
								<div className={styles.dropIndicator}>
									<div className={styles.dropLine} />
									<span className={styles.dropText}>Hier ablegen</span>
								</div>
							)}
						</div>

						{/* The actual item card */}
						<div className={styles.itemContainer}>
							<CompactCardComponent {...item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} onDragStart={() => handleDragStart(item)} onDragEnd={handleDragEnd} isDragging={draggedItem?.id === item.id} />
						</div>
					</React.Fragment>
				))}

				{/* Drop zone at the end */}
				<div
					className={`${styles.dropZone} ${styles.endDropZone} ${dragOverIndex === items.length ? styles.dropZoneActive : ''}`}
					onDragEnter={(e) => handleDragEnter(e, items.length)}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={(e) => handleDrop(e, items.length)}
					onPointerEnter={() => handlePointerEnter(items.length)}
					onPointerLeave={handlePointerLeave}
					onPointerUp={() => handlePointerUp(items.length)}
					style={{ touchAction: 'none' }}
				>
					{dragOverIndex === items.length && isDragActive && (
						<div className={styles.dropIndicator}>
							<div className={styles.dropLine} />
							<span className={styles.dropText}>Hier ablegen</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
