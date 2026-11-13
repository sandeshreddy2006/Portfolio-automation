import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../../legal-page";

export const metadata: Metadata = {
  title: "Deploy to Vercel | Portfolabs Docs",
  description: "Connect a Vercel workspace, deploy your published Portfolabs portfolio, and update it from the editor.",
};

export default function VercelGuide() {
  return (
    <LegalPage current="/docs/vercel" title="Deploy your portfolio to Vercel" updated="12 November 2026">
      <p>Deploy a copy of your Portfolabs portfolio to a project in your own Vercel workspace. You’ll need a Portfolabs account and permission to create projects in the workspace you choose.</p>

      <h2>Publish your portfolio</h2>
      <p>Open your portfolio from <Link href="/dashboard">My portfolios</Link>. In the editor, click <strong>Publish</strong> to make the version you want to deploy available on Portfolabs.</p>

      <h2>Connect your Vercel workspace</h2>
      <ol>
        <li>Open <strong>Hosting</strong> in the portfolio editor.</li>
        <li>Under <strong>Deploy to my Vercel</strong>, click <strong>Connect Vercel</strong>.</li>
        <li>Sign in to Vercel if prompted, select your workspace, and authorize Portfolabs.</li>
        <li>Return to the editor. If your workspace hasn’t appeared, click <strong>Refresh connections</strong>.</li>
      </ol>
      <p>See the <Link href="/eula">Vercel Integration EULA</Link> and <Link href="/privacy#vercel-integration">Privacy Policy</Link> for how Portfolabs uses this access.</p>

      <h2>Deploy and share</h2>
      <p>Select your connected workspace and click <strong>Deploy to Vercel</strong>. Portfolabs creates a Vercel project with the published page, its styles, and its images. Once the editor shows <strong>Deployment ready</strong>, click <strong>Open Vercel deployment</strong> to see the site.</p>
      <p>If you enabled résumé downloads for the portfolio, the deployed copy can link to the Portfolabs download. Your PDF stays with Portfolabs, where you can revoke access.</p>

      <h2>Update or remove your Vercel copy</h2>
      <p>Publish your latest edits in Portfolabs, then click <strong>Redeploy to Vercel</strong> for the same workspace. To revoke the connection, click <strong>Disconnect Vercel</strong>. If you want to take the Vercel copy offline, remove it in your Vercel workspace. Unpublishing in Portfolabs leaves that copy online.</p>

      <h2>Get help</h2>
      <p>Visit <Link href="/support">Portfolabs Support</Link> for connection issues, failed deployments, and contact details.</p>
    </LegalPage>
  );
}
