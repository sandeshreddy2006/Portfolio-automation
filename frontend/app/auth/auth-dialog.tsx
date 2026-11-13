"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount } from "./use-account";
import AuthForm, { type AuthStep } from "./auth-form";

type DialogOptions = { step: AuthStep; destination?: string; error?: string; deleted?: boolean; passwordUpdated?: boolean };
const AuthDialogContext = createContext<(options: DialogOptions) => void>(() => {});
const steps = new Set(["login", "register", "verify", "link", "password", "delete", "delete-confirm", "forgot", "reset-confirm", "change-password", "change-confirm"]);

function CallbackDialog({ open }: { open: (options: DialogOptions) => void }) {
  const query = useSearchParams();
  const pathname = usePathname();
  const consumed = useRef("");
  useEffect(() => {
    const step = query.get("auth");
    if (pathname !== "/" || !step || !steps.has(step)) {
      consumed.current = "";
      return;
    }
    const key = query.toString();
    if (consumed.current === key) return;
    consumed.current = key;
    const destination = query.get("next");
    open({ step: step as AuthStep, error: query.get("error") ?? undefined, deleted: query.get("status") === "deleted", passwordUpdated: query.get("status") === "password-updated",
      destination: destination && /^\/(?:dashboard(?:\?template=[a-z-]+)?|profile|editor\/[a-z0-9-]+)$/.test(destination) ? destination : undefined });
    const url = new URL(window.location.href);
    for (const name of ["auth", "error", "status", "next"]) url.searchParams.delete(name);
    window.history.replaceState(null, "", url);
  }, [query, pathname, open]);
  return null;
}

function Dialog({ options, close, change }: { options: DialogOptions; close: () => void; change: (step: AuthStep) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="auth-dialog" aria-label="Your Portfolabs account" onClose={close}>
      <div className="auth-dialog-content">
        <button type="button" className="auth-dialog-close" aria-label="Close account dialog" onClick={() => dialog.current?.close()}>×</button>
        <AuthForm key={options.step} initialStep={options.step} googleError={options.error} deleted={options.deleted ?? false} passwordUpdated={options.passwordUpdated ?? false}
          destination={options.destination ?? (options.step === "link" ? "/profile" : "/dashboard")} onStep={change} />
      </div>
    </dialog>
  );
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  return (
    <AuthDialogContext.Provider value={setOptions}>
      {children}
      <Suspense><CallbackDialog open={setOptions} /></Suspense>
      {options && <Dialog options={options} close={() => setOptions(null)}
        change={(step) => setOptions((current) => current && { step, destination: current.destination })} />}
    </AuthDialogContext.Provider>
  );
}

export function AuthLink({ step = "login", destination, className, children, whenSignedIn }: {
  step?: AuthStep; destination?: string; className?: string; children: ReactNode; whenSignedIn?: string;
}) {
  const open = useContext(AuthDialogContext);
  const router = useRouter();
  const account = useAccount(Boolean(whenSignedIn));
  const query = new URLSearchParams({ step });
  if (destination) query.set("next", destination);
  return (
    <Link className={className} href={account && whenSignedIn ? whenSignedIn : `/auth?${query}`} onClick={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (account && whenSignedIn) router.push(whenSignedIn);
      else open({ step, destination });
    }}>{children}</Link>
  );
}
