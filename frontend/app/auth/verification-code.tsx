import { useId, useState } from "react";

export default function VerificationCode() {
  const id = useId();
  const [code, setCode] = useState("");
  return (
    <label htmlFor={id} className="verification-code">
      Verification code
      <span className="verification-code-field">
        <input id={id} name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" value={code} required
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} />
        <span className="verification-code-boxes" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} data-active={index === Math.min(code.length, 5)}>{code[index]}</span>
          ))}
        </span>
      </span>
    </label>
  );
}
