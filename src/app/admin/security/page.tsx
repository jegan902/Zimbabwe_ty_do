"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  Smartphone,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TwoFactorState {
  enabled: boolean;
  pending: boolean;
  recoveryCodesRemaining: number;
  required: boolean;
}

interface Enrollment {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.message ||
        (typeof json.error === "object" ? json.error?.message : null) ||
        "Yêu cầu thất bại",
    );
  }
  return json.data as T;
}

function RecoveryCodeList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      toast.success("Đã copy toàn bộ mã dự phòng");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Trình duyệt không cho phép copy. Hãy chụp màn hình lại.");
    }
  };

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-emerald-900">
          Lưu 8 mã dự phòng này ở nơi an toàn — mỗi mã dùng được 1 lần
        </p>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={copy}>
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          Copy
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-emerald-950">
        {codes.map((code) => (
          <span key={code} className="rounded bg-white/70 px-2 py-1 tracking-wider">
            {code}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-emerald-800">
        Mã này chỉ hiển thị một lần. Rời trang mà chưa lưu thì phải tạo bộ mã mới.
      </p>
    </div>
  );
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const [state, setState] = useState<TwoFactorState | null>(null);
  const [loading, setLoading] = useState(true);

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [actionCode, setActionCode] = useState("");
  const [busy, setBusy] = useState<"rotate" | "disable" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/2fa/status");
      const json = await res.json();
      if (res.ok) setState(json.data);
    } catch {
      toast.error("Không tải được trạng thái 2FA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEnrollment = async () => {
    setStarting(true);
    try {
      const data = await postJson<Enrollment>("/api/auth/2fa/setup");
      setEnrollment(data);
      setRecoveryCodes(null);
      setEnrollCode("");
    } catch (error) {
      toast.error(errorMessage(error, "Không tạo được thiết lập 2FA"));
    } finally {
      setStarting(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setConfirming(true);
    try {
      const data = await postJson<{ enabled: boolean; recoveryCodes: string[] }>(
        "/api/auth/2fa/enable",
        { code: enrollCode.replace(/\s+/g, "") },
      );
      setRecoveryCodes(data.recoveryCodes);
      setEnrollment(null);
      setEnrollCode("");
      toast.success("Đã bật xác thực hai lớp");
      await load();
      router.refresh(); // clears the "chưa bật 2FA" banner in the shell
    } catch (error) {
      toast.error(errorMessage(error, "Mã xác thực không đúng"));
    } finally {
      setConfirming(false);
    }
  };

  const rotateCodes = async () => {
    if (!actionCode.trim()) {
      toast.error("Nhập mã hiện tại để tạo bộ mã dự phòng mới");
      return;
    }
    setBusy("rotate");
    try {
      const data = await postJson<{ recoveryCodes: string[] }>(
        "/api/auth/2fa/recovery-codes",
        { code: actionCode.replace(/\s+/g, "") },
      );
      setRecoveryCodes(data.recoveryCodes);
      setActionCode("");
      toast.success("Đã tạo bộ mã dự phòng mới, mã cũ không còn hiệu lực");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Không tạo lại được mã dự phòng"));
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    if (!actionCode.trim()) {
      toast.error("Nhập mã hiện tại để tắt 2FA");
      return;
    }
    setBusy("disable");
    try {
      await postJson("/api/auth/2fa/disable", { code: actionCode.replace(/\s+/g, "") });
      setActionCode("");
      setRecoveryCodes(null);
      toast.success("Đã tắt xác thực hai lớp");
      await load();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Không tắt được 2FA"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải cấu hình bảo mật...
      </div>
    );
  }

  const enabled = Boolean(state?.enabled);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Bảo mật tài khoản
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Lớp bảo vệ thứ hai cho tài khoản quản trị: kể cả khi lộ mật khẩu, kẻ tấn công vẫn
          không đăng nhập được nếu không có mã từ điện thoại của bạn.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold text-sm">Xác thực hai lớp (TOTP)</h2>
              {enabled ? (
                <Badge className="bg-emerald-600 text-[10px]">Đang bật</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Chưa bật
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Dùng Google Authenticator, Authy, 1Password hoặc bất kỳ ứng dụng TOTP nào.
              {enabled && state
                ? ` Còn ${state.recoveryCodesRemaining}/8 mã dự phòng.`
                : state?.pending
                  ? " Có một thiết lập đang chờ xác nhận — bắt đầu lại nếu bạn đã mất QR."
                  : ""}
            </p>
          </div>
          {!enabled && !enrollment && (
            <Button size="sm" onClick={startEnrollment} disabled={starting} className="shrink-0">
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              Bật 2FA
            </Button>
          )}
        </div>

        {state?.required && !enabled && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p>
              Môi trường này bắt buộc 2FA cho tài khoản quản trị. Mọi API quản trị đang bị
              chặn cho tới khi bạn bật xong.
            </p>
          </div>
        )}

        {enrollment && (
          <form onSubmit={confirmEnrollment} className="space-y-4 border-t pt-4">
            <div className="flex flex-col sm:flex-row gap-5">
              <img
                src={enrollment.qrDataUrl}
                alt="Mã QR thiết lập 2FA"
                className="h-40 w-40 rounded-lg border bg-white p-1"
              />
              <div className="space-y-2 text-xs flex-1">
                <p className="font-semibold">1. Mở ứng dụng xác thực và quét mã QR</p>
                <p className="text-muted-foreground">Hoặc nhập tay khoá sau:</p>
                <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">
                  {enrollment.secret}
                </code>
                <p className="font-semibold pt-1">2. Nhập mã 6 chữ số ứng dụng hiển thị</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value)}
                placeholder="123456"
                className="h-10 text-sm tracking-widest max-w-[200px]"
              />
              <Button type="submit" disabled={confirming} className="h-10">
                {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Xác nhận & bật
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={() => {
                  setEnrollment(null);
                  setEnrollCode("");
                }}
              >
                Huỷ
              </Button>
            </div>
          </form>
        )}

        {recoveryCodes && <RecoveryCodeList codes={recoveryCodes} />}
      </div>

      {enabled && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold text-sm">Mã dự phòng & tắt 2FA</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Các thao tác dưới đây cần mã hiện tại trong ứng dụng (hoặc một mã dự phòng), để
              kẻ đánh cắp cookie phiên không thể tự tắt bảo vệ.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={actionCode}
              onChange={(e) => setActionCode(e.target.value)}
              placeholder="Mã hiện tại"
              className="h-10 text-sm tracking-widest max-w-[220px]"
            />
            <Button
              variant="outline"
              className="h-10"
              onClick={rotateCodes}
              disabled={busy !== null}
            >
              {busy === "rotate" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Tạo lại mã dự phòng
            </Button>
            <Button
              variant="destructive"
              className="h-10"
              onClick={disable}
              disabled={busy !== null}
            >
              {busy === "disable" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Tắt 2FA
            </Button>
          </div>

          {state?.required && (
            <p className="text-[11px] text-amber-700">
              Lưu ý: môi trường này bắt buộc 2FA — tắt xong bạn sẽ bị chặn khỏi các API quản
              trị cho tới khi bật lại.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-muted/30 p-5 text-xs text-muted-foreground space-y-1.5">
        <p className="font-bold text-foreground">Mất điện thoại thì sao?</p>
        <p>
          1. Dùng một mã dự phòng ở màn hình đăng nhập để vào bình thường (mỗi mã dùng 1 lần).
        </p>
        <p>
          2. Sau khi vào, quay lại trang này, nhập mã hiện tại và tạo bộ mã dự phòng mới.
        </p>
        <p>
          3. Mất luôn cả mã dự phòng: liên hệ kỹ thuật viên để chạy lệnh{" "}
          <code className="font-mono">npm run admin:reset-2fa -- email@cua-ban</code> trên máy
          chủ.
        </p>
      </div>
    </div>
  );
}
