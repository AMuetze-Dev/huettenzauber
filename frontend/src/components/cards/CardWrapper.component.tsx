import { ReactNode, useState } from "react";
import { MdEdit, MdClose, MdSave, MdDelete } from "react-icons/md";
import ConfirmModal from "../modals/ConfirmModal.component";
import styles from "./CardWrapper.module.css";

type CardWrapperProps<T = any> = {
  children: (mode: "edit" | "view") => ReactNode;
  isEditing: boolean;
  editLocked?: boolean;
  onRequestEdit?: () => void;
  onRequestView?: () => void;
  onSaveAction?: (item: T) => void | Promise<void>;
  onDeleteAction?: (id: number) => void | Promise<void>;
  item?: T;
  itemId?: number;
};

export default function CardWrapper<T = any>({
  children,
  isEditing,
  editLocked = false,
  onRequestEdit,
  onRequestView,
  onSaveAction,
  onDeleteAction,
  item,
  itemId,
}: CardWrapperProps<T>) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (onDeleteAction && itemId !== undefined) {
      onDeleteAction(itemId);
    }
    setShowDeleteModal(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };
  return (
    <div className={styles.cardWrapper}>
      {children(isEditing ? "edit" : "view")}

      {/* Action buttons */}
      {isEditing ? (
        <div className={styles.iconBtnGroup}>
          {onSaveAction && item && (
            <button
              type="button"
              title="Speichern"
              className={styles.iconBtn}
              onClick={() => onSaveAction(item)}
            >
              <MdSave size={20} />
            </button>
          )}
          {onRequestView && (
            <button
              type="button"
              title="Abbrechen"
              className={styles.iconBtn}
              onClick={onRequestView}
            >
              <MdClose size={20} />
            </button>
          )}
        </div>
      ) : (
        <div className={styles.iconBtnGroup}>
          {onRequestEdit && !editLocked && (
            <button
              type="button"
              title="Bearbeiten"
              className={styles.iconBtn + " .icon"}
              onClick={onRequestEdit}
            >
              <MdEdit size={20} />
            </button>
          )}
          {onDeleteAction && itemId !== undefined && itemId !== -999 && (
            <button
              type="button"
              title="Löschen"
              className={styles.iconBtn + " .icon"}
              onClick={handleDeleteClick}
            >
              <MdDelete size={20} />
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Element löschen"
        message="Möchten Sie dieses Element wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Löschen"
        cancelText="Abbrechen"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
