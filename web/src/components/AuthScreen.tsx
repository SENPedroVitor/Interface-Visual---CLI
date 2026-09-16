import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ArrowRight } from 'lucide-react';
import { WaddleAvatar } from './WaddleAvatar';
import './AuthScreen.css';

interface AuthScreenProps {
  mode: 'sign-in' | 'sign-up';
  email: string;
  password: string;
  error: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleMode: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  mode,
  email,
  password,
  error,
  busy,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onToggleMode,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isSignIn = mode === 'sign-in';

  return (
    <div className="auth-screen">
      <div className="auth-screen-glow auth-screen-glow-left" aria-hidden="true" />
      <div className="auth-screen-glow auth-screen-glow-right" aria-hidden="true" />

      <main className="auth-card" aria-labelledby="auth-title">
        <header className="auth-card-header">
          <div className="auth-brand">
            <span className="auth-brand-avatar" aria-hidden="true">
              <WaddleAvatar imageUrl="/avatars/chefe.png" state="idle" size={42} />
            </span>
            <span className="auth-brand-name">Waddle</span>
          </div>
          <span className="auth-secure-badge"><LockKeyhole size={13} /> Ambiente seguro</span>
        </header>

        <section className="auth-card-copy">
          <p className="auth-eyebrow">WADDLE AGENT OS</p>
          <h1 id="auth-title">{isSignIn ? 'Volte para sua equipe.' : 'Crie seu ambiente.'}</h1>
          <p>{isSignIn ? 'Entre para continuar conversando com seus agentes.' : 'Um espaço privado para organizar agentes, tarefas e contexto.'}</p>
        </section>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Senha</label>
            <div className="auth-password-wrap">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                minLength={6}
                required
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? 'Validando acesso…' : isSignIn ? 'Entrar no Waddle' : 'Criar acesso'}</span>
            {!busy && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </form>

        <div className="auth-divider" aria-hidden="true"><span>ou</span></div>

        <button className="auth-mode-toggle" type="button" onClick={onToggleMode}>
          {isSignIn ? 'Ainda não tenho uma conta' : 'Já tenho uma conta'}
        </button>

        <p className="auth-privacy">Seu acesso é protegido pelo Supabase Auth. O Waddle não exibe login social.</p>
      </main>

      <footer className="auth-footer">Agentes locais · Codex · Ollama · Claude</footer>
    </div>
  );
};

export default AuthScreen;
