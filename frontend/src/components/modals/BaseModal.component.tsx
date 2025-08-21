import React, { useEffect } from "react";
import { MdClose } from "react-icons/md";
import styles from "./BaseModal.module.css";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  inputContent?: React.ReactNode;
  commandContent?: React.ReactNode;
}

export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  inputContent,
  commandContent,
}: BaseModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup function to restore scrolling
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Modal schließen"
            type="button"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className={styles.modalContent}>
          {/* Input Container - for form inputs and content */}
          <div className={styles.inputContainer}>
            {inputContent || children}
          </div>

          {/* Command Container - for action buttons */}
          {commandContent && (
            <div className={styles.commandContainer}>{commandContent}</div>
          )}
        </div>
      </div>
    </div>
  );
}
