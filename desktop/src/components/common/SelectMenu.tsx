import { Check, ChevronDown } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  icon?: ReactNode;
  hideValue?: boolean;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  fullWidth?: boolean;
}

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  hideValue = false,
  triggerClassName = "",
  menuClassName = "",
  optionClassName = "",
  fullWidth = false
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const activeOption = useMemo(() => options.find((item) => item.value === value) || options[0], [options, value]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !popoverRef.current) {
      return;
    }

    function updatePopoverLayout() {
      const rootRect = rootRef.current?.getBoundingClientRect();
      const popoverRect = popoverRef.current?.getBoundingClientRect();
      if (!rootRect || !popoverRect) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const safeGap = 12;
      const spaceAbove = rootRect.top - safeGap;
      const spaceBelow = viewportHeight - rootRect.bottom - safeGap;
      const preferredHeight = Math.min(popoverRect.height, 320);
      const shouldOpenUp = spaceBelow < Math.min(preferredHeight, 160) && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(0, Math.min(availableHeight, 320));
      const shouldAlignRight = rootRect.left + popoverRect.width > viewportWidth - safeGap && rootRect.right - popoverRect.width > safeGap;

      setPlacement(shouldOpenUp ? "up" : "down");
      setPopoverStyle({
        left: shouldAlignRight ? "auto" : 0,
        right: shouldAlignRight ? 0 : "auto",
        top: shouldOpenUp ? "auto" : "calc(100% + 8px)",
        bottom: shouldOpenUp ? "calc(100% + 8px)" : "auto",
        maxHeight: `${maxHeight}px`,
        overflowY: "auto"
      });
    }

    updatePopoverLayout();
    window.addEventListener("resize", updatePopoverLayout);
    window.addEventListener("scroll", updatePopoverLayout, true);
    return () => {
      window.removeEventListener("resize", updatePopoverLayout);
      window.removeEventListener("scroll", updatePopoverLayout, true);
    };
  }, [open, options.length]);

  return (
    <div className={fullWidth ? "select-menu full-width" : "select-menu"} ref={rootRef}>
      <button
        type="button"
        className={triggerClassName ? `select-trigger ${hideValue ? "icon-only" : ""} ${triggerClassName}`.trim() : hideValue ? "select-trigger icon-only" : "select-trigger"}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="select-trigger-inner">
          {icon ? <span className="select-trigger-icon">{icon}</span> : null}
          {!hideValue ? <span className="select-trigger-value">{activeOption?.label || value}</span> : null}
          {hideValue ? <span className="select-trigger-sr">{activeOption?.label || value}</span> : null}
        </span>
        <ChevronDown size={15} className={open ? "select-chevron open" : "select-chevron"} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={menuClassName ? `select-menu-popover placement-${placement} ${menuClassName}` : `select-menu-popover placement-${placement}`}
          role="listbox"
          aria-label={ariaLabel}
          style={popoverStyle}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={optionClassName ? `select-option ${active ? "active" : ""} ${optionClassName}` : `select-option ${active ? "active" : ""}`}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {active && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
