import { useState } from "react";
import CompactAddCard from "./CompactAddCard.component";

type CompactCardManagerProps<T> = {
  items: T[];
  CompactCardComponent: React.ComponentType<any>;
  onAdd: () => void; // Simplified - just triggers modal
  onEdit: (item: T) => void;
  onDelete: (id: number) => Promise<void> | void;
  onDragStart?: (item: T) => void;
  draggedItem?: T | null;
  Layout: React.ComponentType<{
    cards: React.ReactNode[];
    addCard?: React.ReactNode;
  }>;
};

export default function CompactCardManager<T extends { id: number }>({
  items,
  CompactCardComponent,
  onAdd,
  onEdit,
  onDelete,
  onDragStart,
  draggedItem,
  Layout,
}: CompactCardManagerProps<T>) {
  const cards = items.map((item) => (
    <CompactCardComponent
      key={item.id}
      {...item}
      onEdit={() => onEdit(item)}
      onDragStart={onDragStart}
      isDragging={draggedItem?.id === item.id}
    />
  ));

  const addCard = <CompactAddCard onAdd={onAdd} />;

  return <Layout cards={cards} addCard={addCard} />;
}
