"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hosting, type Deployment, type Hosting } from "@/lib/hosting";
import styles from "../../studio.module.css";

const pending = new Set(["PREPARING", "QUEUED", "BUILDING", "INITIALIZING"]);

export default function HostingSettings({ slug, published, unpublished, disabled, publish }: {
  slug: string; published: boolean; unpublished: boolean; disabled: boolean; publish: () => void;
}) {
  const [settings, setSettings] = useState<Hosting>();
  const [hostname, setHostname] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const popup = useRef<Window | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await hosting.settings(slug);
      setSettings(result);
      setSelected((current) => result.connections.some(({ id }) => id === current) ? current : result.connections[0]?.id ?? "");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t load hosting settings.");
    }
  }, [slug]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("vercel") === "failed") {
        setError("Couldn’t connect to Vercel. Close the setup window and try again.");
      }
      void refresh();
    }, 0);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => {
      if (popup.current?.closed) {
        popup.current = null;
        void refresh();
      }
    }, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const deployment = settings?.deployments.find(({ connection_id }) => connection_id === selected);
  const deploying = Boolean(deployment && pending.has(deployment.status));

  function adoptDeployment(next: Deployment) {
    setSettings((current) => current && {
      ...current, deployments: [...current.deployments.filter(({ connection_id }) => connection_id !== next.connection_id), next],
    });
  }

  useEffect(() => {
    if (!deploying || !selected) return;
    let active = true;
    let timer: number;
    async function poll() {
      try {
        const next = await hosting.status(slug, selected);
        if (!active) return;
        adoptDeployment(next);
        if (!pending.has(next.status)) return;
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Couldn’t check deployment status.");
      }
      if (active) timer = window.setTimeout(poll, 6000);
    }
    timer = window.setTimeout(poll, 4000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [deploying, selected, slug]);

  async function run(action: string, operation: () => Promise<unknown>) {
    setBusy(action);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The hosting request couldn’t be completed.");
    } finally {
      setBusy("");
    }
  }

  function connect() {
    const windowHandle = window.open("about:blank", "_blank", "popup,width=720,height=760");
    if (windowHandle) {
      windowHandle.opener = null;
      popup.current = windowHandle;
    }
    void run("connect", async () => {
      try {
        const { url } = await hosting.connectVercel(slug);
        if (windowHandle) windowHandle.location.href = url;
        else window.location.href = url;
      } catch (failure) {
        windowHandle?.close();
        throw failure;
      }
    });
  }

  const blocked = disabled || Boolean(busy);
  const domain = settings?.domain;

  return (
    <section id="sec-hosting" className={styles.group} aria-labelledby="hosting-title">
      <h2 id="hosting-title">Hosting</h2>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!settings && !error && <p className={styles.hint}>Loading hosting options…</p>}
      <div className={styles.row}>
        <h3>Publish on Portfolabs</h3>
        <p className={styles.hint}>Use your Portfolabs address and update the site whenever you publish.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={blocked || (published && !unpublished)} onClick={publish}>
            {published ? "Update Portfolabs site" : "Publish on Portfolabs"}
          </button>
          {published && <a className={styles.secondary} href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">Open live portfolio</a>}
        </div>
      </div>

      <div className={styles.row}>
        <h3>Connect a custom domain</h3>
        <p className={styles.hint}>Use a domain you own. It displays the same published portfolio and updates whenever you publish.</p>
        {settings && !settings.domains_available && <p className={styles.hint}>Custom domains aren’t configured yet.</p>}
        {settings?.domains_available && !domain && (
          <>
            <label>Domain name<input value={hostname} maxLength={253} placeholder="janedoe.dev"
              onChange={(event) => setHostname(event.target.value)} /></label>
            <button type="button" className={styles.secondary} disabled={blocked || !hostname.trim()} onClick={() => void run("add-domain", async () => {
              const added = await hosting.connectDomain(slug, hostname.trim());
              setSettings({ ...settings, domain: added });
              setHostname("");
            })}>Add domain</button>
          </>
        )}
        {domain && settings && (
          <>
            <p className={styles.hint}>{domain.hostname} · {domain.active ? (published ? "Connected" : "Connected, publish to go live") : "Waiting for DNS"}</p>
            {domain.active && published && <a className={styles.secondary} href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">Open custom domain</a>}
            {!domain.active && (
              <>
                <p className={styles.hint}>{domain.attached
                  ? "Keep the verification TXT record. If a CNAME already exists for this exact hostname, edit its value to match the CNAME below. Otherwise, add the routing record shown. This changes where visitors to that hostname land. Then click Check DNS again."
                  : "At your DNS provider, add a new TXT record using the name and value below. Leave your existing TXT records in place. Then click Check DNS to get the routing record."}</p>
                <p className={styles.hint}>If your provider appends the domain to the Name field, enter only the prefix. For example, in GoDaddy enter <code>_portfolabs.www</code> for <code>_portfolabs.www.example.com</code> when editing <code>example.com</code>.</p>
                <ul className={styles.dnsRecords}>
                  {domain.records.map(({ type, name, value }, index) => (
                    <li key={`${type}-${name}-${index}`}>
                      <strong>{type}</strong>
                      {([["Name", name], ["Value", value]] as const).map(([label, field]) => {
                        const key = `${index}-${label}`;
                        return (
                          <div key={label} className={styles.dnsField}>
                            <span>{label}</span>
                            <code>{field}</code>
                            <button type="button" className={styles.linkButton} onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(field);
                                setCopied(key);
                              } catch {
                                setError(`Couldn’t copy. Select and copy the ${label.toLowerCase()} instead.`);
                              }
                            }}>{copied === key ? `${label} copied` : `Copy ${label.toLowerCase()}`}</button>
                          </div>
                        );
                      })}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={blocked || !settings.domains_available} onClick={() => void run("verify", async () => {
                setSettings({ ...settings, domain: await hosting.verifyDomain(slug) });
              })}>{busy === "verify" ? "Checking…" : "Check DNS"}</button>
              <button type="button" className={styles.danger} disabled={blocked} onClick={() => {
                if (window.confirm(`Disconnect ${domain.hostname}?`)) void run("remove-domain", async () => {
                  await hosting.removeDomain(slug);
                  setSettings({ ...settings, domain: null });
                });
              }}>Disconnect domain</button>
            </div>
          </>
        )}
      </div>

      <div className={styles.row}>
        <h3>Deploy to my Vercel</h3>
        <p className={styles.hint}>Deploy a copy of your published portfolio into a project in your own Vercel account or team. Publish and redeploy to update it. <a className={styles.linkButton} href="/docs/vercel" target="_blank" rel="noopener noreferrer">Read the deployment guide</a>.</p>
        {settings && !settings.deploy_available && <p className={styles.hint}>Vercel connections aren’t configured yet.</p>}
        {settings?.deploy_available && (
          <>
            <p className={styles.hint}>By connecting, you agree to the <a className={styles.linkButton} href="/eula" target="_blank" rel="noopener noreferrer">Vercel Integration EULA</a>. Read how we handle connection data in our <a className={styles.linkButton} href="/privacy#vercel-integration" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={blocked} onClick={connect}>{settings.connections.length ? "Connect another account" : "Connect Vercel"}</button>
              <button type="button" className={styles.secondary} disabled={blocked} onClick={() => void refresh()}>Refresh connections</button>
            </div>
            {settings.connections.length > 0 && (
              <>
                <label>Vercel account or team<select value={selected} onChange={(event) => setSelected(event.target.value)}>
                  {settings.connections.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select></label>
                {!published && <p className={styles.hint}>Publish on Portfolabs first to deploy a copy.</p>}
                {published && unpublished && <p className={styles.hint}>Publish your latest changes before deploying them.</p>}
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} disabled={blocked || !selected || !published || unpublished || deploying}
                    onClick={() => void run("deploy", async () => adoptDeployment(await hosting.deploy(slug, selected)))}>
                    {busy === "deploy" || deploying ? "Deploying…" : deployment ? "Redeploy to Vercel" : "Deploy to Vercel"}
                  </button>
                  <button type="button" className={styles.danger} disabled={blocked || !selected || deploying} onClick={() => {
                    if (window.confirm("Disconnect this Vercel account? Existing deployments will stay live.")) void run("disconnect", async () => {
                      await hosting.disconnect(selected);
                      await refresh();
                    });
                  }}>Disconnect Vercel</button>
                </div>
                {deployment && (
                  <div role="status">
                    {deploying ? <p>Vercel is preparing your deployment.</p> : deployment.status === "READY" ? <p>Deployment ready.</p> : null}
                    {deployment.error && <p className={styles.error}>{deployment.error}</p>}
                    {deployment.status === "CANCELED" && <p>Deployment canceled.</p>}
                    {deployment.url && <a className={styles.secondary} href={deployment.url} target="_blank" rel="noopener noreferrer">Open Vercel deployment</a>}
                  </div>
                )}
                <p className={styles.hint}>You manage the deployed copy in Vercel. Unpublishing or deleting on Portfolabs leaves that copy online.</p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
