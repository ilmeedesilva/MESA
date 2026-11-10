import mesaMarkUrl from "../assets/brand/mesa-mark.svg";
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
      <img className="mobileBarMark" src={mesaMarkUrl} alt="" width={28} height={28} />
      <div className="mobileBarTitle">
        <strong>MESA</strong>
        <span>{title}</span>
      </div>
    </header>
  );
}
