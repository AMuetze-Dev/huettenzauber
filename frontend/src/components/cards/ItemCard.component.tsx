import { MdDragIndicator } from "react-icons/md";
import { Item } from "../../context/ProductContext";
import styles from "./ItemCard.module.css";

type ItemCardProps = Item & {
  onEdit?: () => void;
  onDragStart?: (item: Item) => void;
  isDragging?: boolean;
};

export default function ItemCard({
  id,
  name,
  category_id,
  item_variants,
  onEdit,
  onDragStart,
  isDragging = false,
}: ItemCardProps) {
  const handleClick = () => {
    onEdit?.();
  };

  // For display purposes, always show as simple (clean look)
  // Calculate total price range or use single variant
  const hasVariants = item_variants.length > 1;
  const firstVariant = item_variants[0];

  let displayPrice = "";
  let displaySteps = "";

  if (hasVariants) {
    const prices = item_variants.map((v) => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      displayPrice = `${minPrice.toFixed(2)}€`;
    } else {
      displayPrice = `${minPrice.toFixed(2)}€ - ${maxPrice.toFixed(2)}€`;
    }

    // Check if all variants have same steps
    const steps = item_variants.map((v) => v.bill_steps);
    const uniqueSteps = Array.from(new Set(steps));
    if (uniqueSteps.length === 1 && uniqueSteps[0] !== 1) {
      displaySteps = `${uniqueSteps[0]}er Schritte`;
    } else if (uniqueSteps.length > 1) {
      displaySteps = "Verschiedene Schritte";
    }
  } else {
    displayPrice = `${firstVariant.price.toFixed(2)}€`;
    if (firstVariant.bill_steps !== 1) {
      displaySteps = `${firstVariant.bill_steps}er Schritte`;
    }
  }

  return (
    <div
      className={`${styles.itemCard} ${isDragging ? styles.dragging : ""} ${
        styles.simpleItem
      }`}
      draggable
      onDragStart={() =>
        onDragStart?.({ id, name, category_id, item_variants })
      }
      onClick={handleClick}
    >
      <div className={styles.dragHandle}>
        <MdDragIndicator size={16} />
      </div>

      <div className={styles.itemContent}>
        <div className={styles.itemHeader}>
          <h3 className={styles.itemName}>{name || "Unbenannter Artikel"}</h3>
          <div className={styles.simplePriceContainer}>
            <span className={styles.simplePrice}>{displayPrice}</span>
            {displaySteps && (
              <span className={styles.simpleSteps}>{displaySteps}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
