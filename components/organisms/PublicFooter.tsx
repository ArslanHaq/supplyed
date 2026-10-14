import Link from "next/link";

import { Icon, Logo } from "@/components/atoms";

const footerLinks = [
  ["For schools", "/founding-schools"],
  ["For teachers", "/founding-teachers"],
  ["How it works", "/how-it-works"],
  ["Join the waitlist", "/#register-interest"],
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
      <section className="mx-auto max-w-[1180px] px-4 py-5 text-xs leading-6 text-muted" id="waitlist-privacy" aria-labelledby="waitlist-privacy-heading">
        <h2 className="font-semibold text-ink" id="waitlist-privacy-heading">Waitlist privacy</h2>
        <p>We use the details you submit to manage your waitlist interest and contact you about SupplyED’s launch and first cohort. Joining the waitlist does not create a marketplace account or commit you to a booking.</p>
      </section>
      <div className="marketing-footer-base">
        <span>SupplyED · Built around better education.</span>
        <span><Icon name="shield" size={14} /> Compliance-first. People-focused.</span>
      </div>

    </footer>
  );
}
