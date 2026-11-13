import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "../legal-page";

export const metadata: Metadata = {
  title: "Vercel Integration EULA | Portfolabs",
  description: "End User License Agreement for the Portfolabs integration with Vercel.",
};

export default function EulaPage() {
  return (
    <LegalPage current="/eula" title="Vercel Integration EULA" updated="12 November 2026">
      <p>This End User License Agreement governs your use of the Portfolabs integration that deploys a copy of your published portfolio to your Vercel workspace. It is an agreement between you and the operator of Portfolabs. Your use of the rest of Portfolabs is subject to the <Link href="/terms">Portfolabs Terms of Service</Link>.</p>

      <h2>License and authorized use</h2>
      <p>Portfolabs grants you a limited, non-exclusive, worldwide, non-transferable license to use the integration to deploy and update portfolios you are authorized to publish. You may use it with a Vercel workspace you own or have permission to manage. The acceptable-use rules in the Portfolabs Terms of Service also apply to the integration.</p>

      <h2>Access to your Vercel workspace</h2>
      <ul>
        <li>With your authorization, Portfolabs reads basic account and team information to identify the connected workspace and display its name.</li>
        <li>Portfolabs uses project and deployment access to create a project for your portfolio, upload the published site files, create deployments, and check deployment status.</li>
        <li>Portfolabs uses installation access to manage the connection and remove the installation when you disconnect. The <Link href="/privacy#vercel-integration">Privacy Policy</Link> explains what data Portfolabs stores and shares.</li>
      </ul>

      <h2>Portfolio content and deployed copies</h2>
      <p>You retain your rights in your content. When you deploy, you authorize Portfolabs to send the published page and its assets to the Vercel workspace you select. Drafts and private résumé files are excluded. If you enable résumé downloads, the deployed copy can include a link to the download managed by Portfolabs.</p>
      <p>Publishing a new version on Portfolabs leaves your Vercel copy at its current version until you redeploy. Disconnecting the integration, unpublishing, or deleting your Portfolabs portfolio leaves the deployed copy in your Vercel workspace. Manage or remove that copy from Vercel.</p>

      <h2>Vercel service and charges</h2>
      <p>Vercel provides the hosting for your deployed copy. Your Vercel account, usage limits, billing, and hosting are subject to your agreement with Vercel. Portfolabs provides support for the integration. Vercel is not a party to this agreement.</p>

      <h2>Disconnecting and ending access</h2>
      <p>You can disconnect from the Portfolabs editor or revoke access in Vercel. Your license to use the integration ends when your access ends. Portfolabs may suspend integration access if you violate these terms or if suspension is needed to protect the service or other users.</p>

      <h2>Availability and liability</h2>
      <p>The availability and liability provisions in the <Link href="/terms">Portfolabs Terms of Service</Link> apply to the integration. Rights that cannot be waived under applicable law still apply.</p>

      <h2>Contact</h2>
      <p>For questions about the integration or this agreement, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
