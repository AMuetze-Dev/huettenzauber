import styles from "./CardInputFields.module.css";
import { useState } from "react";

type BaseFieldProps<T> = {
  isEditMode: boolean;
  value: T;
  setValue: (v: T) => void;
  [key: string]: any;
};

export function TextField(props: BaseFieldProps<string>) {
  const { isEditMode, value, setValue, ...rest } = props;
  if (!isEditMode) return <span>{value}</span>;
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      {...rest}
    />
  );
}

export function NumberField(props: BaseFieldProps<number>) {
  const { isEditMode, value, setValue, ...rest } = props;
  if (!isEditMode) return <span>{value}</span>;
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      {...rest}
    />
  );
}

export function SelectField(
  props: BaseFieldProps<string | number> & {
    options: { value: string | number; label: string }[];
  }
) {
  const { isEditMode, value, setValue, options, ...rest } = props;
  if (!isEditMode)
    return (
      <span>{options.find((o) => o.value === value)?.label || value}</span>
    );
  return (
    <select value={value} onChange={(e) => setValue(e.target.value)} {...rest}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function IconField(
  props: BaseFieldProps<string> & {
    icons: { [key: string]: any };
    iconSize?: number;
  }
) {
  const { isEditMode, value, setValue, icons, iconSize = 24, ...rest } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const DefaultIcon = icons["MdCategory"] || (() => null);
  const IconComponent = value && icons[value] ? icons[value] : DefaultIcon;

  if (!isEditMode) return <IconComponent size={iconSize} />;

  // Filter icons based on search
  const filteredIcons = Object.keys(icons).filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  // Get readable name from icon key
  const getIconName = (iconKey: string) => {
    return iconKey
      .replace(/^(Md|Fa|Ai|Bi|Hi|Io|)/, "")
      .replace(/([A-Z])/g, " $1")
      .trim();
  };

  return (
    <div className={styles.iconFieldWrapper} {...rest}>
      {/* Dropdown Button */}
      <button
        type="button"
        className={styles.iconDropdownButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.iconDropdownContent}>
          <div className={styles.iconPreview}>
            <IconComponent size={iconSize} />
          </div>
          <span className={styles.iconLabel}>
            {getIconName(value || "MdCategory")}
          </span>
        </div>
        <div
          className={`${styles.dropdownArrow} ${
            isOpen ? styles.dropdownArrowOpen : ""
          }`}
        >
          ▼
        </div>
      </button>

      {/* Inline Dropdown */}
      {isOpen && (
        <div className={styles.iconDropdown}>
          <div className={styles.iconDropdownHeader}>
            <input
              type="text"
              placeholder="Nach Icons suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.iconSearchInput}
              autoFocus
            />
          </div>

          <div className={styles.iconGrid}>
            {filteredIcons.slice(0, 20).map((name) => {
              const Icon = icons[name];
              const isSelected = value === name;
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => {
                    setValue(name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={
                    isSelected ? styles.iconButtonSelected : styles.iconButton
                  }
                  title={getIconName(name)}
                >
                  <Icon size={32} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
