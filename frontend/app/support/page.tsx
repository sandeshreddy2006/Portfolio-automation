import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "../legal-page";

export const metadata: Metadata = {
  title: "Support | Portfolabs",
  description: "Get help connecting Vercel, deploying a portfolio, or setting up a custom domain.",
};

export default function SupportPage() {
  return (
    <LegalPage current="/support" title="Portfolabs Support" updated="12 November 2026">
      <p>Get help publishing your portfolio, connecting a domain, or deploying to your own Vercel workspace.</p>

      <h2>Connect and deploy to Vercel</h2>
      <p>See the <Link href="/docs/vercel">Vercel deployment guide</Link> for setup, deployment, and update instructions.</p>

      <h2>Troubleshoot a connection or deployment</h2>
      <ul>
        <li><strong>The workspace doesn’t appear:</strong> finish authorizing it, then click <strong>Refresh connections</strong> in the editor.</li>
        <li><strong>Vercel denies access:</strong> confirm you can create projects in the selected workspace and ask its owner to check the integration permissions if needed.</li>
        <li><strong>The deployment fails:</strong> check its status in the editor and open the deployment details in your Vercel dashboard if a deployment was created.</li>
        <li><strong>The site still shows an older version:</strong> publish your latest changes on Portfolabs, then click <strong>Redeploy to Vercel</strong>.</li>
      </ul>

      <h2>Disconnect or take a site offline</h2>
      <p>Use <strong>Disconnect Vercel</strong> in the editor to remove the connection. To take a deployed copy offline, manage the project or deployment in your Vercel workspace. The <Link href="/eula">Vercel Integration EULA</Link> and <Link href="/privacy#vercel-integration">Privacy Policy</Link> explain how the connection works.</p>

      <h2>Custom domain help</h2>
      <p>In <strong>Hosting → Connect a custom domain</strong>, add the TXT record shown by Portfolabs, then click <strong>Check DNS</strong>. Add the routing records the editor shows next, allow time for your DNS provider to update them, and check again.</p>

      <h2>Contact support</h2>
      <p>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Portfolabs%20support`}>{CONTACT_EMAIL}</a>. Include the portfolio URL, the step you were on, and the error message you saw. Keep passwords, API tokens, and verification codes private.</p>
    </LegalPage>
  );
}
