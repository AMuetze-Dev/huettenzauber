import { MdDragIndicator, MdEdit, MdDelete } from "react-icons/md";
import { Item } from "../../context/ProductContext";
import styles from "./CompactItemCard.module.css";

type CompactItemCardProps = Item & {
  onEdit?: () => void;
  onDelete?: () => void;
  onDragStart?: (item: Item) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
};

export default function CompactItemCard({
  id,
  name,
  category_id,
  item_variants,
  deposit_amount,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: CompactItemCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id.toString());
    onDragStart?.({ id, name, category_id, item_variants });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    onDragEnd?.();
  };

  // Clean info tag system - price integrated as tag
  const hasVariants = item_variants && item_variants.length > 1;
  const firstVariant =
    item_variants && item_variants.length > 0 ? item_variants[0] : null;

  let priceTag = "";
  let infoTags: string[] = [];

  if (!firstVariant) {
    // No variants available
    priceTag = "Kein Preis";
    infoTags = ["Keine Varianten verfügbar"];
  } else if (hasVariants) {
    const prices = item_variants.map((v) => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    priceTag =
      minPrice === maxPrice
        ? `${minPrice.toFixed(2)}€`
        : `${minPrice.toFixed(2)}€ - ${maxPrice.toFixed(2)}€`;

    // Only show variant names if they exist and differ
    const uniqueVariantNames = item_variants
      .map((variant) => variant.name)
      .filter((name) => name && name.trim() !== "")
      .filter((name, index, arr) => arr.indexOf(name) === index); // unique only

    if (uniqueVariantNames.length > 0) {
      infoTags = uniqueVariantNames.slice(0, 2); // Max 2 variant names
      if (uniqueVariantNames.length > 2) {
        infoTags.push(`+${uniqueVariantNames.length - 2} weitere`);
      }
    } else {
      infoTags = [`${item_variants.length} Varianten`];
    }
  } else if (firstVariant) {
    priceTag = `${firstVariant.price.toFixed(2)}€`;
    // For single variants, only show name if it's meaningful
    if (
      firstVariant.name &&
      firstVariant.name.trim() !== "" &&
      firstVariant.name !== name
    ) {
      infoTags = [firstVariant.name];
    }
    // If no meaningful variant info, keep it clean (no tags)
  }

  // Add deposit info if available
  if (deposit_amount && deposit_amount > 0) {
    infoTags.push(`+ ${deposit_amount.toFixed(2)}€ Pfand`);
  }

  return (
    <article
      className={`${styles.compactCard} ${isDragging ? styles.dragging : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Drag Handle */}
      <div className={styles.dragHandle} title="Ziehen zum Verschieben">
        <MdDragIndicator size={24} />
      </div>

      {/* Main Content */}
      <div className={styles.cardContent}>
        <div className={styles.primaryInfo}>
          <h3 className={styles.itemName} title={name}>
            {name || "Unbenannter Artikel"}
          </h3>
        </div>

        {/* Clean Info Tags - Price + Variants */}
        <div className={styles.infoTags}>
          <span className={`${styles.infoTag} ${styles.price}`}>
            {priceTag}
          </span>
          {infoTags.map((tag, index) => (
            <span key={index} className={styles.infoTag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actionButtons}>
        <button
          className={styles.editButton}
          onClick={handleEditClick}
          title="Artikel bearbeiten"
          type="button"
        >
          <MdEdit size={20} />
        </button>
        <button
          className={styles.deleteButton}
          onClick={handleDeleteClick}
          title="Artikel löschen"
          type="button"
        >
          <MdDelete size={20} />
        </button>
      </div>
    </article>
  );
}
