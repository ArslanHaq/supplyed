import Link from "next/link";

import { Icon, Logo } from "@/components/atoms";
import { PublicThemeControls } from "@/components/molecules";

const footerLinks = [
  ["For schools", "/founding-schools"],
  ["For teachers", "/founding-teachers"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Terms & conditions", "/terms"],
] as const;

export function PublicFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-main">
        <div>
          <Logo href="/" size={25} />
          <p>The right teacher, right now.</p>
          <span className="marketing-footer-location"><Icon name="pin" size={14} /> Greater Manchester &amp; Lancashire first.</span>
        </div>
        <nav aria-label="Footer navigation">
          {footerLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="marketing-footer-base">
        <span>SupplyED · Built around better education.</span>
        <span><Icon name="shield" size={14} /> Compliance-first. People-focused.</span>
      </div>
      <PublicThemeControls />
    </footer>
  );
}
