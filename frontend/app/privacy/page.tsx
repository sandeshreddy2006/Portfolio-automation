import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy | Portfolabs", description: "What Portfolabs collects, why, and the choices you have." };

export default function PrivacyPage() {
  return (
    <LegalPage current="/privacy" title="Privacy Policy" updated="12 November 2026">
      <p>Portfolabs helps you build and publish a portfolio website. This page explains what we collect, why, and the choices you have. We keep it short and plain on purpose.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your name, email address, and either a password (stored only as a salted hash, never in readable form) or your Google account identifier if you sign in with Google.</li>
        <li><strong>Your portfolios:</strong> everything you type into the editor (name, headline, bio, projects, links) and the images you upload.</li>
        <li><strong>Security records:</strong> sign-in sessions and short-lived counters used to stop abuse, such as too many sign-in attempts.</li>
        <li><strong>Reports:</strong> if someone reports a portfolio, we keep the report and any contact email they choose to give us.</li>
      </ul>

      <h2>Profile and résumé</h2>
      <p>Details and photos saved to your profile are private until you add them to a published portfolio. If you upload a PDF to your profile, we store it privately. You can enable downloads for each published portfolio. Anyone with that portfolio link can then download the PDF, so review it for personal information before sharing. Removing or replacing the stored PDF disables its download links.</p>

      <h2>What is public</h2>
      <p>A portfolio you publish is public to anyone with its link. By default, search engines are asked <em>not</em> to list it. You can allow search engines in the editor at any time. Drafts are never public. Anything you put in a published portfolio, including images, can be seen and copied by visitors, so don’t include anything you want to keep private.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and show your portfolios.</li>
        <li>To send emails you need: sign-in verification codes, a note when someone signs in, and a message when you first publish a portfolio.</li>
        <li>To keep the service safe and fair, for example rate limits and handling reports.</li>
      </ul>
      <p>We do not sell your data and we do not show ads. We will not use your content to train AI models unless you have clearly agreed to it first.</p>

      <h2>Writing assistant</h2>
      <p>If you click “Improve with AI”, the text you chose is sent to Google’s Gemini service to produce a suggestion. It is only sent when you click, and we don’t send anything else from your account. Google’s terms for the free Gemini service allow it to use that text to improve its products, so don’t use the assistant on anything private.</p>

      <h2>Who helps us run the service</h2>
      <p>We use trusted providers to host and operate Portfolabs: Vercel (website hosting), Railway (server and database), Cloudflare (image storage), our email provider, and Google (sign-in, if you choose it, and the writing assistant). They process data only to provide their service to us.</p>

      <h2 id="vercel-integration">Vercel integration</h2>
      <p>If you connect a Vercel account or team, we store the installation ID, the team ID when applicable, the account or team display name, and an encrypted access token linked to your Portfolabs account. We use that access to identify your workspace, create projects and deployments you request, check their status, and remove the installation when you disconnect through Portfolabs. We also store project and deployment identifiers, status, and the deployment URL so you can find and update your copy.</p>
      <p>When you deploy, we send the published page and its assets to your selected Vercel workspace. We exclude drafts and the private résumé file. If résumé downloads are enabled for the published portfolio, we may include a link to its Portfolabs download. Disconnecting through Portfolabs removes the saved connection and its associated deployment records from Portfolabs. To remove the deployed files, delete the copy in Vercel. See the <Link href="/eula">Vercel Integration EULA</Link> for the terms of use.</p>

      <h2>Cookies</h2>
      <p>We ask before setting the essential cookies that keep you signed in and help verify your account. You can browse without cookies and change your choice on the <Link href="/cookies">Cookie Policy</Link> page.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete any portfolio at any time. Deleting a portfolio takes down the Portfolabs-hosted version. Copies you deploy to your own Vercel workspace stay there until you remove them.</li>
        <li>Delete your account from the account menu. This removes your account, your portfolios and your uploaded images. Backups can take a short while to clear.</li>
        <li>Ask us what we hold about you, or to correct it, by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
      </ul>

      <h2>Children</h2>
      <p>Portfolabs is meant for people aged 16 and over. If you are younger, please ask a parent or guardian before using it.</p>

      <h2>Changes and contact</h2>
      <p>If we change this policy in a way that matters, we’ll update the date above and, for big changes, tell you by email. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
