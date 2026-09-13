(() => {
  const TOKEN_KEY = "gallery_device_token";
  const WEBAUTHN_KEY = "gallery_webauthn_cred";

  const $ = (id) => document.getElementById(id);

  function b64urlToBuf(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    return buf.buffer;
  }

  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function showGate(show) {
    const el = $("auth-gate");
    if (!el) return;
    el.hidden = !show;
    document.body.classList.toggle("gated", show);
  }

  function setMsg(text, ok = false) {
    const m = $("gate-msg");
    if (!m) return;
    m.textContent = text || "";
    m.classList.toggle("ok", !!ok);
  }

  function setHint(show, text) {
    const h = $("gate-device-hint");
    if (!h) return;
    if (text) h.textContent = text;
    h.hidden = !show;
  }

  async function checkStatus() {
    const res = await fetch("/api/auth/status", {
      credentials: "same-origin",
      cache: "no-store",
    });
    return res.json();
  }

  async function afterUnlock(data) {
    if (data.device_token) {
      try {
        localStorage.setItem(TOKEN_KEY, data.device_token);
      } catch (_) {}
    }
    showGate(false);
    setHint(false);
    setMsg("");
    window.dispatchEvent(new CustomEvent("gallery-unlocked"));
  }

  async function loginPassword() {
    const password = ($("gate-password") || {}).value || "";
    if (!password) {
      setMsg("请输入访问密码");
      return;
    }
    setMsg("验证中…");
    try {
      const data = await api("/api/auth/login", { password });
      await afterUnlock(data);
      setMsg("已进入；本机已授信，下次可自动进入", true);
      if (bioSupported()) {
        $("gate-bio-register")?.removeAttribute("hidden");
      }
    } catch (err) {
      setMsg(err.message || "密码错误");
    }
  }

  async function loginToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error("本机尚未授信，请输入密码");
    const data = await api("/api/auth/token", { token });
    await afterUnlock(data);
  }

  function bioSupported() {
    return !!(window.isSecureContext && window.PublicKeyCredential);
  }

  async function registerBiometric() {
    if (!bioSupported()) {
      setMsg(
        location.protocol === "https:"
          ? "当前浏览器不支持本机指纹"
          : "指纹需 HTTPS（当前 http 下不可用）。密码进入后本机已授信，下次会自动进入。"
      );
      return;
    }
    setMsg("请按提示完成指纹 / 面容验证…");
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Private Atelier", id: location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "gallery-owner",
            displayName: "主人",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        },
      });
      if (!cred) throw new Error("未完成生物识别");
      localStorage.setItem(
        WEBAUTHN_KEY,
        JSON.stringify({ id: cred.id, rawId: bufToB64url(cred.rawId) })
      );
      setMsg("已启用本机指纹，下次可一键解锁", true);
      $("gate-bio-login")?.removeAttribute("hidden");
    } catch (err) {
      setMsg(err.message || "指纹注册取消或失败");
    }
  }

  async function loginBiometric() {
    const saved = localStorage.getItem(WEBAUTHN_KEY);
    if (!saved) {
      setMsg("尚未启用指纹；本机若已授信会自动进入，否则请输入密码");
      return;
    }
    if (!bioSupported()) {
      setMsg("指纹需 HTTPS，请改用密码或依赖本机授信自动进入");
      return;
    }
    setMsg("请验证指纹 / Touch ID…");
    try {
      const meta = JSON.parse(saved);
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: "required",
          allowCredentials: [
            {
              type: "public-key",
              id: b64urlToBuf(meta.rawId),
              transports: ["internal"],
            },
          ],
        },
      });
      if (!assertion) throw new Error("未完成生物识别");
      await loginToken();
      setMsg("已通过本机指纹解锁", true);
    } catch (err) {
      setMsg(err.message || "指纹验证失败，请改用密码");
    }
  }

  let gateWired = false;
  function wireGateControls() {
    if (gateWired) return;
    gateWired = true;
    $("gate-submit")?.addEventListener("click", loginPassword);
    $("gate-password")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loginPassword();
    });
    $("gate-bio-login")?.addEventListener("click", loginBiometric);
    $("gate-bio-register")?.addEventListener("click", registerBiometric);
  }

  window.addEventListener("gallery-lock", (e) => {
    showGate(true);
    wireGateControls();
    const msg = e && e.detail && e.detail.message;
    setMsg(msg || "会话已过期，请重新验证");
    $("gate-password")?.focus();
  });

  async function bootGate() {
    const gate = $("auth-gate");
    if (!gate) return;
    wireGateControls();

    // 1) 仍有有效会话 cookie → 直接进
    try {
      const st = await checkStatus();
      if (st.ok) {
        showGate(false);
        window.dispatchEvent(new CustomEvent("gallery-unlocked"));
        return;
      }
    } catch (_) {}

    showGate(true);

    const hasToken = !!localStorage.getItem(TOKEN_KEY);
    const hasBio = !!localStorage.getItem(WEBAUTHN_KEY);
    const canBio = bioSupported();

    // 2) 本机授信令牌：静默换发会话（别人的电脑没有这个 localStorage）
    if (hasToken) {
      setHint(true, "检测到本机授信，正在自动进入…");
      try {
        await loginToken();
        return;
      } catch (_) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (_) {}
        setHint(false);
        setMsg("本机授信已失效，请重新输入密码");
      }
    } else {
      setHint(false);
      setMsg("当前设备未授信，请输入访问密码");
    }

    if (canBio) {
      if (hasBio) $("gate-bio-login")?.removeAttribute("hidden");
      if (hasToken && !hasBio) $("gate-bio-register")?.removeAttribute("hidden");
      const copy = document.querySelector(".auth-copy");
      if (copy) {
        copy.textContent =
          "未授信设备须输入密码。本机授信后可自动进入；也可启用指纹 / Touch ID。";
      }
    } else {
      $("gate-bio-login")?.setAttribute("hidden", "");
      $("gate-bio-register")?.setAttribute("hidden", "");
      const copy = document.querySelector(".auth-copy");
      if (copy) {
        copy.textContent =
          "未授信设备须输入访问密码。密码验证成功后，此电脑会记住授信，下次自动进入；他人电脑没有授信，必须输密码。";
      }
    }
  }

  bootGate();
})();
