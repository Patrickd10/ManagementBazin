"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, {
    ok: false,
    message: "",
  });

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">Bazin Olimpic</p>
          <h1 id="login-title">Autentificare antrenor</h1>
          <p className="muted">
            Intra cu userul creat in baza de date pentru a gestiona elevii si abonamentele.
          </p>
        </div>

        <form action={formAction} className="login-form" suppressHydrationWarning>
          <label>
            <span>Nume</span>
            <input name="nume" type="text" autoComplete="username" required suppressHydrationWarning />
          </label>

          <label>
            <span>Parola</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              suppressHydrationWarning
            />
          </label>

          {state.message ? (
            <p className={state.ok ? "form-message success" : "form-message error"}>{state.message}</p>
          ) : null}

          <button type="submit" className="primary-button" disabled={isPending}>
            {isPending ? "Se verifica..." : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
