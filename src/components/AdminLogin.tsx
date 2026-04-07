import { useState } from 'react';
import { useStore } from '../store';
import { Lock, User, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

export function AdminLogin() {
  const { adminLogin, setShowAdmin } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await adminLogin(username, password);
      if (!success) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setPassword('');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-steam-darker p-4">
      <div className="w-full max-w-sm bg-steam-dark border border-steam-border rounded-xl p-8 fade-in">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gem/10 border border-gem/30 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-gem" />
          </div>
          <h2 className="text-lg font-bold text-white">관리자 인증</h2>
          <p className="text-xs text-steam-muted mt-1">관리 패널에 접속하려면 로그인하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted/50" />
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full bg-steam-input text-white pl-10 pr-4 py-3 rounded-lg border border-steam-border text-sm placeholder:text-steam-muted/50"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-muted/50" />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-steam-input text-white pl-10 pr-4 py-3 rounded-lg border border-steam-border text-sm placeholder:text-steam-muted/50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username || !password || loading}
            className="w-full py-3 bg-gem text-white rounded-lg font-semibold hover:bg-gem/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 spin-slow" />
                인증 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <button
          onClick={() => setShowAdmin(false)}
          className="w-full mt-4 py-2 text-sm text-steam-muted hover:text-white transition flex items-center justify-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          거래소로 돌아가기
        </button>
      </div>
    </div>
  );
}
