import React, { useState } from "react";
import styles from "./CategoryGrid.module.css";

interface CategoryGridProps {
  cards: React.ReactNode[];
  onReorder?: (newOrder: number[]) => void;
}

export default function CategoryGrid({ cards, onReorder }: CategoryGridProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    const draggedId = parseInt(e.dataTransfer.getData("text/plain"));

    // Find current index of dragged item
    const dragIndex = cards.findIndex((card: any) => {
      return card.key && card.key.toString() === draggedId.toString();
    });

    if (dragIndex === -1 || dragIndex === dropIndex) return;

    // Create new order array
    const newOrder: number[] = [];
    const reorderedCards = [...cards];

    // Remove dragged item
    const [draggedCard] = reorderedCards.splice(dragIndex, 1);

    // Insert at new position
    reorderedCards.splice(dropIndex, 0, draggedCard);

    // Extract IDs for new order (excluding add card)
    reorderedCards.forEach((card: any) => {
      if (card.key && card.key !== "add-card" && !isNaN(parseInt(card.key))) {
        newOrder.push(parseInt(card.key));
      }
    });

    onReorder?.(newOrder);
  };

  return (
    <div className={styles.categoryGrid}>
      {cards.map((card, index) => (
        <div
          key={`grid-item-${index}`}
          className={`${styles.gridItem} ${
            dragOverIndex === index ? styles.dragOver : ""
          }`}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
        >
          {card}
        </div>
      ))}
    </div>
  );
}
