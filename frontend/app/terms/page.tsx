import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service | Portfolabs", description: "The rules for using Portfolabs." };

export default function TermsPage() {
  return (
    <LegalPage current="/terms" title="Terms of Service" updated="12 November 2026">
      <p>When you create a Portfolabs account, we ask you to agree to these Terms of Service. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your data, and our <Link href="/cookies">Cookie Policy</Link> explains how to manage cookies.</p>

      <h2>Your account</h2>
      <p>You must be 16 or older. Give us accurate details, keep your password safe, and tell us if you think someone else has used your account. You can have up to five portfolios.</p>

      <h2>Your content</h2>
      <p>You own what you create. You give Portfolabs permission to store, display and serve your content so we can run your portfolio, including showing published portfolios to anyone with the link. You are responsible for your content and for having the right to use everything you upload.</p>

      <h2>What you can’t do</h2>
      <ul>
        <li>Publish content that is illegal, hateful, harassing, sexually explicit, or that threatens or exploits others.</li>
        <li>Pretend to be another person or organisation, or use someone else’s name or photo without permission.</li>
        <li>Publish spam, scams, malware, or links meant to deceive or harm visitors.</li>
        <li>Upload content that infringes someone else’s copyright or privacy.</li>
        <li>Try to break, overload or get around the limits of the service, or access other people’s accounts.</li>
        <li>Use the service to collect other people’s personal data.</li>
      </ul>

      <h2>Reports and removal</h2>
      <p>Anyone can report a portfolio using the “Report” link on it. We may remove content, unpublish a portfolio, or suspend an account that breaks these terms, with or without notice where that is needed to keep people safe. Some portfolio addresses are reserved and can’t be claimed.</p>

      <h2>The service</h2>
      <p>We work hard to keep Portfolabs running but we provide it “as is”. We don’t promise it will always be available or error-free, and features, limits and templates may change. Keep your own copy of anything important.</p>

      <h2>Deploying to Vercel</h2>
      <p>If you connect a Vercel workspace and deploy a copy of your portfolio, the <Link href="/eula">Vercel Integration EULA</Link> applies to that integration. You manage the deployed copy and any hosting charges through your Vercel workspace.</p>

      <h2>Writing assistant</h2>
      <p>AI suggestions can be wrong or sound generic. Read them before you use them. You are responsible for what you publish.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, Portfolabs isn’t liable for indirect or consequential losses, or for loss of data or opportunities, arising from your use of the service. Nothing in these terms limits rights you have under the law that can’t be limited.</p>

      <h2>Ending things</h2>
      <p>You can delete your account at any time from the account menu. We may suspend or close accounts that break these terms.</p>

      <h2>Changes and contact</h2>
      <p>We may update these terms. If the change matters, we’ll update the date above and tell you. Using Portfolabs after a change means you accept it. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your data. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
