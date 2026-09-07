import { MdAdd } from "react-icons/md";
import styles from "./CompactAddCard.module.css";

type CompactAddCardProps = {
  onAdd: () => void;
};

export default function CompactAddCard({ onAdd }: CompactAddCardProps) {
  return (
    <button
      className={styles.addCard}
      type="button"
      onClick={onAdd}
      title="Neuen Artikel hinzufügen"
    >
      <div className={styles.addIcon}>
        <MdAdd size={28} />
      </div>
      <div className={styles.addContent}>
        <span className={styles.addTitle}>Artikel hinzufügen</span>
        <span className={styles.addSubtitle}>Neuen Artikel erstellen</span>
      </div>
    </button>
  );
}
