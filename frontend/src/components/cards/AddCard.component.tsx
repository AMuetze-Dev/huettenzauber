import { MdAdd } from "react-icons/md";
import style from "./AddCard.module.css";

type AddCardProps = {
  onAdd: () => void;
};

export default function AddCard({ onAdd }: AddCardProps) {
  return (
    <button className={style.addButton} type="button" onClick={onAdd}>
      <MdAdd size={50} />
    </button>
  );
}
