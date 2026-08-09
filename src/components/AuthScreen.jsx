import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { joinClassByCode } from "../lib/db";

// Sign up / sign in form. Replaces the old free-text "type your name" box —
// identity is now a real Supabase account, not a label anyone could type.
export default function AuthScreen({ styles }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (classCode.trim() && signUpData.user) {
          const result = await joinClassByCode(signUpData.user.id, classCode);
          if (!result.joined) {
            // account is already created — don't block signup over a bad code,
            // just let them know it didn't attach so they can ask their teacher
            setError(`Account created, but: ${result.error}`);
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      // On success, App.jsx's onAuthStateChange listener picks up the new
      // session and moves the app forward automatically.
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={styles.homeCard} onSubmit={submit}>
      <div style={styles.homeCardTitle}>
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </div>

      {mode === "signup" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={styles.homeInput}
          autoComplete="name"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        style={styles.homeInput}
        autoComplete="email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        style={styles.homeInput}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />

      {mode === "signup" && (
        <>
          <input
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            placeholder="Class code (optional)"
            style={styles.homeInput}
            autoComplete="off"
          />
          <div style={styles.homeCardNote}>Got a class code from your teacher? Enter it above — otherwise leave it blank.</div>
        </>
      )}

      {error && <div style={styles.authError}>{error}</div>}

      <button type="submit" style={styles.loginBtn} disabled={busy}>
        {busy ? (
          <Loader2 size={14} style={{ verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
        ) : mode === "signup" ? (
          "Create account"
        ) : (
          "Sign in"
        )}
      </button>

      <button
        type="button"
        style={styles.authToggle}
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
        }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>

      <div style={styles.homeCardNote}>Your chats and progress are private to you.</div>
    </form>
  );
}
