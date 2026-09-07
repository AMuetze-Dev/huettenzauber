import { MdWarning, MdCheck, MdClose } from "react-icons/md";
import BaseModal from "./BaseModal.component";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Löschen",
  cancelText = "Abbrechen",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      inputContent={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-lg)",
            padding: "var(--spacing-xl) 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor:
                "var(--color-warning-light, rgba(251, 191, 36, 0.1))",
              color: "var(--color-warning, #f59e0b)",
              flexShrink: 0,
            }}
          >
            <MdWarning size={24} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-300)",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        </div>
      }
      commandContent={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="secondaryButton"
            style={{
              padding: "var(--spacing-md) var(--spacing-lg)",
              backgroundColor: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            <MdClose size={18} />
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="dangerButton"
            style={{
              padding: "var(--spacing-md) var(--spacing-lg)",
              backgroundColor: "var(--color-error, #ef4444)",
              color: "white",
              border: "1px solid var(--color-error, #ef4444)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            <MdCheck size={18} />
            {confirmText}
          </button>
        </>
      }
    />
  );
}
