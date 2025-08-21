import styles from "./CardGrid.module.css";

type CardGridLayoutProps = {
  cards: React.ReactNode[];
  addCard?: React.ReactNode;
};

export default function CardGridLayout({
  cards,
  addCard,
}: CardGridLayoutProps) {
  return (
    <div className={styles.grid}>
      {cards}
      {addCard}
    </div>
  );
}
