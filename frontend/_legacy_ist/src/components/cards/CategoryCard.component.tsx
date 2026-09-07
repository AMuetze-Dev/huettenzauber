import * as MdIcons from "react-icons/md";
import styles from "./CategoryCard.module.css";

interface Category {
  id: number;
  name: string;
  icon: string;
}

type CategoryCardProps = {
  id: number;
  name: string;
  icon: string;
  onDragStart?: (category: Category) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
};

export default function CategoryCard({
  id,
  name,
  icon,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: CategoryCardProps) {
  const IconComponent = (MdIcons as any)[icon] || MdIcons.MdCategory;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id.toString());
    onDragStart?.({ id, name, icon });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    onDragEnd?.();
  };

  return (
    <div
      className={`${styles.viewContainer} ${isDragging ? styles.dragging : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.iconContainer}>
        <IconComponent size={32} />
      </div>
      <h3 className={styles.categoryName}>{name}</h3>
    </div>
  );
}
