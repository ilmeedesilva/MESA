import { Icon } from "../components/icons";

/** Phone-only top bar: the menu button, the app name and the current page. */
export function MobileBar({ title, navOpen, onOpenMenu }: { title: string; navOpen: boolean; onOpenMenu: () => void }) {
  return (
    <header className="mobileBar">
      <button
        type="button"
        className="mobileMenuButton"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
      >
        <Icon name="menu" />
      </button>
      <div className="mobileBarTitle">
        <strong>MESA</strong>
        <span>{title}</span>
      </div>
    </header>
  );
}
