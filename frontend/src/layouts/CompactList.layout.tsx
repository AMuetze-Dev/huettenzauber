import styles from "./CompactList.module.css";

type CompactListLayoutProps = {
  cards: React.ReactNode[];
  addCard?: React.ReactNode;
};

export default function CompactListLayout({
  cards,
  addCard,
}: CompactListLayoutProps) {
  return (
    <div className={styles.container}>
      {addCard && <div className={styles.addCardContainer}>{addCard}</div>}
      <div className={styles.list}>{cards}</div>
    </div>
  );
}
