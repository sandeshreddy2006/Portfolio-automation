export default function GoogleButton({ connect = false, connected = false, disabled = false }: {
  connect?: boolean; connected?: boolean; disabled?: boolean;
}) {
  const logo = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.7h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/>
      <path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.5-4.6l-6.6-5A12 12 0 0 1 12.8 28H6v5.2A20 20 0 0 0 24 44Z"/>
      <path fill="#FBBC05" d="M12.8 28a12 12 0 0 1 0-8V14.8H6a20 20 0 0 0 0 18.4Z"/>
      <path fill="#EA4335" d="M24 12c3 0 5.6 1.2 7.7 3l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 6 14.8l6.8 5.2A12 12 0 0 1 24 12Z"/>
    </svg>
  );
  if (connected) return <span className="account-google google-connected">{logo} Google connected <span aria-hidden="true">✓</span></span>;

  return (
    <form action="/api/auth/google/start" method="get">
      {connect && <input type="hidden" name="intent" value="link" />}
      <button className="account-google" type="submit" disabled={disabled}>
        {logo} {connect ? "Connect with Google" : "Continue with Google"}
      </button>
    </form>
  );
}
